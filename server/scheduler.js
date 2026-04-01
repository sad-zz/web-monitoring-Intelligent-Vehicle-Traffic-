/**
 * Scheduler - Aggregates traffic data every 5 minutes and sends to RMTO.
 */

// Ensure Iran timezone (in case scheduler is loaded independently)
if (!process.env.TZ) process.env.TZ = "Asia/Tehran";

var cron = require("node-cron");
var http = require("http");
var https = require("https");
var db = require("./db");
var rmto = require("./rmto-client");

var INTERVAL = parseInt(process.env.SEND_INTERVAL_MINUTES, 10) || 5;
var RMTO_LIVE_WINDOW_MINUTES = parseInt(process.env.RMTO_LIVE_WINDOW_MINUTES, 10) || 20;
var RMTO_LIVE_BATCH_LIMIT = parseInt(process.env.RMTO_LIVE_BATCH_LIMIT, 10) || 30;
var RMTO_BACKLOG_BATCH_LIMIT = parseInt(process.env.RMTO_BACKLOG_BATCH_LIMIT, 10) || 20;

/**
 * Send a notification message via Bale messenger bot.
 * Settings: bale_bot_token, bale_chat_id (stored in DB settings table)
 */
function sendBaleNotification(text) {
    try {
        var rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('bale_bot_token','bale_chat_id')").all();
        var s = {};
        rows.forEach(function (r) { s[r.key] = r.value; });
        var token = s.bale_bot_token || "";
        var chatId = s.bale_chat_id || "";
        if (!token || !chatId) return; // Bale not configured
        var body = JSON.stringify({ chat_id: chatId, text: text });
        var options = {
            hostname: "tapi.bale.ai",
            port: 443,
            path: "/bot" + token + "/sendMessage",
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
        };
        var req = https.request(options, function (res) {
            var data = "";
            res.on("data", function (c) { data += c; });
            res.on("end", function () {
                if (res.statusCode !== 200) console.error("[Bale] sendMessage failed: " + res.statusCode + " " + data.substring(0, 200));
                else console.log("[Bale] Notification sent: " + text.substring(0, 80));
            });
        });
        req.on("error", function (e) { console.error("[Bale] Request error:", e.message); });
        req.setTimeout(10000, function () { req.destroy(); console.error("[Bale] Notification request timed out"); });
        req.write(body);
        req.end();
    } catch (e) {
        console.error("[Bale] sendBaleNotification error:", e.message);
    }
}

/**
 * Format Date as local ISO string (matching how device data is stored).
 * Device data is stored as "YYYY-MM-DDTHH:MM:SS" in LOCAL time (no Z suffix).
 * So scheduler queries must also use local time format.
 */
function toLocalISOString(d) {
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1).padStart(2, "0");
    var dy = String(d.getDate()).padStart(2, "0");
    var h = String(d.getHours()).padStart(2, "0");
    var mi = String(d.getMinutes()).padStart(2, "0");
    var s = String(d.getSeconds()).padStart(2, "0");
    return y + "-" + mo + "-" + dy + "T" + h + ":" + mi + ":" + s;
}

/**
 * Aggregate raw traffic_data into rmto_queue and rmto_queue_5class,
 * then send unsent records to RMTO.
 */
function aggregateAndSend() {
    console.log("[Scheduler] Starting aggregation cycle at", new Date().toISOString());

    var now = new Date();
    // Current period boundary (data up to this point can be aggregated)
    var currentPeriodEnd = new Date(now);
    currentPeriodEnd.setMinutes(Math.floor(currentPeriodEnd.getMinutes() / INTERVAL) * INTERVAL, 0, 0);

    // Get all devices (not just online - they may have sent data before going offline)
    var devices = db.prepare("SELECT device_code FROM devices").all();

    devices.forEach(function (dev) {
        var code = dev.device_code;

        // Find ALL distinct INTERVAL-minute periods with unread data for this device
        // This ensures we never miss older periods that weren't processed before
        var periods = db.prepare(
            "SELECT DISTINCT " +
            "strftime('%Y-%m-%dT%H:', create_at) || " +
            "printf('%02d', (CAST(strftime('%M', create_at) AS INTEGER) / " + INTERVAL + ") * " + INTERVAL + ") || ':00' " +
            "AS period_start " +
            "FROM irawdata WHERE device_code = ? AND is_read = 0 " +
            "ORDER BY period_start"
        ).all(code);

        periods.forEach(function (p) {
            var startStr = p.period_start;
            var pStart = new Date(startStr);
            var pEnd = new Date(pStart.getTime() + INTERVAL * 60 * 1000);
            var endStr = toLocalISOString(pEnd);

            // Don't aggregate the current incomplete period
            if (pEnd.getTime() > currentPeriodEnd.getTime()) return;

            aggregatePeriod(code, startStr, endStr);
        });
    });

    // Now send unsent records
    sendUnsentData();
}

/**
 * Aggregate a single period for a single device.
 */
function aggregatePeriod(code, startStr, endStr) {
    // Get device route info and RID (RMTO route number per lane)
    var devInfo = db.prepare("SELECT route, route1, route2, rid1, rid2 FROM devices WHERE device_code = ?").get(code);
    var route1 = (devInfo && (devInfo.route1 || devInfo.route)) || "";
    var route2 = (devInfo && devInfo.route2) || "";
    // Use rid1/rid2 as the RMTO route ID if set, otherwise fall back to route1/route2 (mehvar code)
    var rmtoRid1 = (devInfo && devInfo.rid1) || route1;
    var rmtoRid2 = (devInfo && devInfo.rid2) || route2;

    // Find which lanes have data in this period
    var lanes = db.prepare(
        "SELECT DISTINCT lane FROM irawdata WHERE device_code = ? AND create_at >= ? AND create_at < ? AND is_read = 0"
    ).all(code, startStr, endStr);

    if (!lanes.length) {
        db.prepare("UPDATE irawdata SET is_read = 1 WHERE device_code = ? AND create_at >= ? AND create_at < ? AND is_read = 0")
            .run(code, startStr, endStr);
        return;
    }

    // Group lanes by their RMTO route_id.
    // When multiple lanes share the same route_id (e.g. bidirectional on one big road)
    // their data must be SUMMED into a single RMTO record to avoid duplicate errors.
    var routeGroups = {}; // key: String(routeIdNum) -> { routeIdNum, lanes: [] }

    lanes.forEach(function (laneRow) {
        var lane = laneRow.lane || 1;
        var routeId = (lane === 2) ? rmtoRid2 : rmtoRid1;

        if (!routeId) {
            console.log("[Scheduler] Device " + code + " lane " + lane + " period " + startStr + ": no route assigned, skipping");
            db.prepare("UPDATE irawdata SET is_read = 1 WHERE device_code = ? AND create_at >= ? AND create_at < ? AND is_read = 0 AND lane = ?")
                .run(code, startStr, endStr, lane);
            return;
        }

        var routeIdNum = parseInt(routeId, 10);
        if (isNaN(routeIdNum) || routeIdNum <= 0) {
            console.log("[Scheduler] Device " + code + " lane " + lane + " route '" + routeId + "': invalid route_id, skipping");
            db.prepare("UPDATE irawdata SET is_read = 1 WHERE device_code = ? AND create_at >= ? AND create_at < ? AND is_read = 0 AND lane = ?")
                .run(code, startStr, endStr, lane);
            return;
        }

        var mehvar = db.prepare("SELECT code, send_enable FROM mehvar WHERE code = ?").get(routeIdNum);
        if (!mehvar) {
            console.log("[Scheduler] Device " + code + " lane " + lane + " route " + routeId + ": not in mehvar table, skipping");
            db.prepare("UPDATE irawdata SET is_read = 1 WHERE device_code = ? AND create_at >= ? AND create_at < ? AND is_read = 0 AND lane = ?")
                .run(code, startStr, endStr, lane);
            return;
        }
        if (!mehvar.send_enable) {
            console.log("[Scheduler] Device " + code + " lane " + lane + " route " + routeId + ": send_enable off, skipping");
            db.prepare("UPDATE irawdata SET is_read = 1 WHERE device_code = ? AND create_at >= ? AND create_at < ? AND is_read = 0 AND lane = ?")
                .run(code, startStr, endStr, lane);
            return;
        }

        var key = String(routeIdNum);
        if (!routeGroups[key]) routeGroups[key] = { routeIdNum: routeIdNum, lanes: [] };
        routeGroups[key].lanes.push(lane);
    });

    // For each unique route, aggregate ALL its lanes and insert ONE RMTO record.
    // This prevents RMTO duplicate errors when two lanes share the same route code.
    Object.keys(routeGroups).forEach(function (key) {
        var group = routeGroups[key];
        var routeIdNum = group.routeIdNum;
        var groupLanes = group.lanes;
        var merged = groupLanes.length > 1;

        // Build IN clause for querying multiple lanes at once
        var lanePlaceholders = groupLanes.map(function () { return "?"; }).join(",");
        var queryParams = [code, startStr, endStr].concat(groupLanes);

        var aggStmt = db.prepare(
            "SELECT SUM(a) as a, SUM(b) as b, SUM(c) as c, SUM(d) as d, SUM(e) as e, SUM(x) as x, " +
            "SUM(sa) as sa, SUM(sb) as sb, SUM(sc) as sc, SUM(sd) as sd, SUM(se) as se, SUM(sx) as sx_sum, " +
            "SUM(sao) as sao, SUM(sbo) as sbo, SUM(sco) as sco, SUM(sdo) as sdo, SUM(seo) as seo, SUM(sxo) as sxo, " +
            "SUM(overtaking) as overtaking, SUM(tooclose) as tooclose " +
            "FROM irawdata WHERE device_code = ? AND create_at >= ? AND create_at < ? AND is_read = 0 " +
            "AND lane IN (" + lanePlaceholders + ")"
        );
        var iraw = aggStmt.get.apply(aggStmt, queryParams);

        // RMTO class mapping: C1=a C2=b C3=c C4=d C5=e+x
        var c1 = (iraw && iraw.a)||0, c2 = (iraw && iraw.b)||0, c3 = (iraw && iraw.c)||0;
        var c4 = (iraw && iraw.d)||0, c5 = ((iraw && iraw.e)||0) + ((iraw && iraw.x)||0);
        var totalVehicles = c1 + c2 + c3 + c4 + c5;

        // Mark all lanes in this group as read
        groupLanes.forEach(function (lane) {
            db.prepare("UPDATE irawdata SET is_read = 1 WHERE device_code = ? AND create_at >= ? AND create_at < ? AND is_read = 0 AND lane = ?")
                .run(code, startStr, endStr, lane);
        });

        if (totalVehicles === 0) {
            console.log("[Scheduler] Device " + code + " route " + routeIdNum + " period " + startStr + ": 0 vehicles, skipping");
            return;
        }

        // Average speed per class
        var s1 = c1 > 0 ? Math.round((iraw.sa||0) / c1) : 0;
        var s2 = c2 > 0 ? Math.round((iraw.sb||0) / c2) : 0;
        var s3 = c3 > 0 ? Math.round((iraw.sc||0) / c3) : 0;
        var s4 = c4 > 0 ? Math.round((iraw.sd||0) / c4) : 0;
        var c5count = (iraw.e||0) + (iraw.x||0);
        var s5 = c5count > 0 ? Math.round(((iraw.se||0) + (iraw.sx_sum||0)) / c5count) : 0;

        var totalSpeedSum = (iraw.sa||0) + (iraw.sb||0) + (iraw.sc||0) + (iraw.sd||0) + (iraw.se||0) + (iraw.sx_sum||0);
        var avgSpeed = Math.round(totalSpeedSum / totalVehicles);

        var so1 = iraw.sao||0, so2 = iraw.sbo||0, so3 = iraw.sco||0;
        var so4 = iraw.sdo||0, so5 = (iraw.seo||0) + (iraw.sxo||0);
        var sso = so1 + so2 + so3 + so4 + so5;

        var oo = iraw.overtaking||0;
        var esd = iraw.tooclose||0;

        var lanesLabel = merged ? " lanes[" + groupLanes.join("+") + "](merged)" : " lane " + groupLanes[0];

        db.prepare(
            "INSERT INTO rmto_queue (device_code, route_id, period_start, period_end, total_vehicles, avg_speed) " +
            "VALUES (?, ?, ?, ?, ?, ?)"
        ).run(code, String(routeIdNum), startStr, endStr, totalVehicles, avgSpeed);

        db.prepare(
            "INSERT INTO rmto_queue_5class (device_code, route_id, period_start, period_end, " +
            "c1, c2, c3, c4, c5, avg_speed, s1, s2, s3, s4, s5, " +
            "sso, so1, so2, so3, so4, so5, oo, esd) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(code, String(routeIdNum), startStr, endStr,
            c1, c2, c3, c4, c5, avgSpeed, s1, s2, s3, s4, s5,
            sso, so1, so2, so3, so4, so5, oo, esd);

        console.log("[Scheduler] Aggregated device " + code + lanesLabel + " (route " + routeIdNum + ") period " + startStr + "-" + endStr + ": " + totalVehicles + " vehicles, ASP=" + avgSpeed + " SSO=" + sso + " OO=" + oo + " ESD=" + esd + (merged ? " [MERGED " + groupLanes.length + " lanes]" : ""));
    });
}

/**
 * Send all unsent aggregated data to RMTO.
 * @param {function} [onComplete] - Optional callback(results) called when all sends finish.
 *   results = { total, success, failed, errors: [{ method, device_code, error, response }] }
 */
function sendUnsentData(onComplete) {
    var results = { total: 0, success: 0, failed: 0, errors: [] };

    // Mark simple queue entries as sent (we only send Add5, matching C# reference)
    // The rmto_queue table lacks C1-C5 columns needed by the WSDL Add method
    db.prepare("UPDATE rmto_queue SET sent = 1, sent_at = datetime('now','localtime') WHERE sent = 0").run();

    // --- Send 5-class AddData5 (primary method, matching C# reference) ---
    // Prioritize recent records so fresh device data is sent first,
    // while still draining historical backlog in controlled batches.
    var now = new Date();
    var liveThreshold = toLocalISOString(new Date(now.getTime() - RMTO_LIVE_WINDOW_MINUTES * 60 * 1000));
    var liveRows = db.prepare(
        "SELECT * FROM rmto_queue_5class WHERE sent = 0 AND period_end >= ? ORDER BY period_start LIMIT ?"
    ).all(liveThreshold, RMTO_LIVE_BATCH_LIMIT);
    var backlogRows = db.prepare(
        "SELECT * FROM rmto_queue_5class WHERE sent = 0 AND period_end < ? ORDER BY period_start LIMIT ?"
    ).all(liveThreshold, RMTO_BACKLOG_BATCH_LIMIT);
    // sendMode is runtime metadata for source IP selection (not a DB column).
    function appendRowsWithMode(rows, mode, target) {
        rows.forEach(function (r) { target.push(Object.assign({}, r, { sendMode: mode })); });
    }

    var unsent5 = [];
    appendRowsWithMode(liveRows, "live", unsent5);
    appendRowsWithMode(backlogRows, "backlog", unsent5);
    var sourceIps = rmto.getSourceIps();

    var pending = unsent5.length;
    results.total = pending;

    if (pending === 0) {
        if (onComplete) onComplete(results);
        return;
    }

    function checkDone() {
        pending--;
        if (pending <= 0 && onComplete) {
            onComplete(results);
        }
    }

    unsent5.forEach(function (row) {
        // Skip records without a valid route_id (never fall back to device_code)
        if (!row.route_id) {
            console.log("[Scheduler] Skipping Add5 for device " + row.device_code + " id=" + row.id + ": no route_id");
            db.prepare("UPDATE rmto_queue_5class SET sent = 1, sent_at = datetime('now','localtime'), rmto_response = ? WHERE id = ?")
                .run('{"skipped":"no route_id"}', row.id);
            checkDone();
            return;
        }
        rmto.sendAddData5({
            FID: row.id,
            RID: row.route_id,
            ST: row.period_start,
            ET: row.period_end,
            C1: row.c1, C2: row.c2, C3: row.c3, C4: row.c4, C5: row.c5,
            ASP: Math.round(row.avg_speed),
            S1: row.s1, S2: row.s2, S3: row.s3, S4: row.s4, S5: row.s5,
            SSO: row.sso,
            SO1: row.so1, SO2: row.so2, SO3: row.so3, SO4: row.so4, SO5: row.so5,
            OO: row.oo,
            ESD: row.esd,
            sourceIp: row.sendMode === "backlog" ? sourceIps.backlog : sourceIps.live
        }, function (err, response, soapXml) {
            // Match C# reference success check: ID > 0 || CFL == 100
            var success = !err && response && (response.ID > 0 || response.CFL === 100);
            var responseStr = JSON.stringify(response || (err && err.message));

            if (!err && response) {
                console.log("[Scheduler] Add5 response for device " + row.device_code + ": ID=" + response.ID + " FID=" + response.FID + " CFL=" + response.CFL + " ERR=" + (response.ERR || "none"));
            }

            db.prepare(
                "UPDATE rmto_queue_5class SET sent = ?, sent_at = datetime('now','localtime'), rmto_response = ? WHERE id = ?"
            ).run(success ? 1 : 0, responseStr, row.id);

            db.prepare(
                "INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message, soap_xml) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).run("Add5", row.device_code, JSON.stringify(row),
                JSON.stringify(response), success ? 1 : 0, err ? err.message : null, soapXml || null);

            if (success) {
                results.success++;
            } else {
                results.failed++;
                var errMsg = err ? err.message : (response && response.ERR ? response.ERR : "پاسخ خالی از RMTO");
                results.errors.push({
                    method: "Add5",
                    device_code: row.device_code,
                    error: errMsg,
                    response: responseStr
                });
            }
            checkDone();
        });
    });
}

/**
 * Format ISO date to RMTO format: "YYYY/MM/DD HH:mm"
 */
function formatDateTime(isoStr) {
    var d = new Date(isoStr);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var dy = String(d.getDate()).padStart(2, "0");
    var h = String(d.getHours()).padStart(2, "0");
    var mn = String(d.getMinutes()).padStart(2, "0");
    return y + "/" + m + "/" + dy + " " + h + ":" + mn;
}

/**
 * Start the scheduler.
 */
/**
 * Mark devices as offline if they haven't been seen for more than 15 minutes.
 */
function checkOfflineDevices() {
    var cutoff = toLocalISOString(new Date(Date.now() - 15 * 60 * 1000));
    var stale = db.prepare(
        "SELECT device_code, name FROM devices WHERE status = 'online' AND last_seen < ?"
    ).all(cutoff);

    stale.forEach(function (d) {
        db.prepare("UPDATE devices SET status = 'offline' WHERE device_code = ?").run(d.device_code);
        console.log("[Scheduler] Device " + d.device_code + " marked offline (last_seen < " + cutoff + ")");
        sendBaleNotification("🔴 دستگاه آفلاین شد\nکد: " + d.device_code + "\nنام: " + (d.name || d.device_code));
    });
}

function start() {
    // Run every INTERVAL minutes
    var cronExpr = "*/" + INTERVAL + " * * * *";
    console.log("[Scheduler] Starting with cron:", cronExpr);

    cron.schedule(cronExpr, function () {
        try { checkOfflineDevices(); } catch (e) { console.error("[Scheduler] checkOfflineDevices error:", e.message); }
        aggregateAndSend();
    });

    // Also allow manual retry of unsent data every hour
    cron.schedule("5 * * * *", function () {
        console.log("[Scheduler] Retry unsent data...");
        sendUnsentData();
    });
}

module.exports = {
    start: start,
    aggregateAndSend: aggregateAndSend,
    aggregatePeriod: aggregatePeriod,
    sendUnsentData: sendUnsentData,
    checkOfflineDevices: checkOfflineDevices,
    sendBaleNotification: sendBaleNotification,
    // Alias for backward compatibility with older index.js versions
    processAndSendIrawdata: aggregateAndSend
};
