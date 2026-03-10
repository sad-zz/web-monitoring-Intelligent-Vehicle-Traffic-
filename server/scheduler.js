/**
 * Scheduler - Aggregates traffic data every 15 minutes and sends to RMTO.
 */

// Ensure Iran timezone (in case scheduler is loaded independently)
if (!process.env.TZ) process.env.TZ = "Asia/Tehran";

var cron = require("node-cron");
var db = require("./db");
var rmto = require("./rmto-client");

var INTERVAL = parseInt(process.env.SEND_INTERVAL_MINUTES, 10) || 15;

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
    var periodEnd = new Date(now);
    periodEnd.setMinutes(Math.floor(periodEnd.getMinutes() / INTERVAL) * INTERVAL, 0, 0);
    var periodStart = new Date(periodEnd.getTime() - INTERVAL * 60 * 1000);

    // Use local time format to match how device data is stored in irawdata
    var startStr = toLocalISOString(periodStart);
    var endStr = toLocalISOString(periodEnd);

    // Get all devices (not just online - they may have sent data before going offline)
    var devices = db.prepare("SELECT device_code FROM devices").all();

    devices.forEach(function (dev) {
        var code = dev.device_code;

        // Aggregate from irawdata table (where TCP/HTTP device data is stored)
        var iraw = db.prepare(
            "SELECT SUM(a) as a, SUM(b) as b, SUM(c) as c, SUM(d) as d, SUM(e) as e, SUM(x) as x, " +
            "SUM(sa) as sa, SUM(sb) as sb, SUM(sc) as sc, SUM(sd) as sd, SUM(se) as se, SUM(sx) as sx_sum, " +
            "SUM(sao) as sao, SUM(sbo) as sbo, SUM(sco) as sco, SUM(sdo) as sdo, SUM(seo) as seo, SUM(sxo) as sxo, " +
            "SUM(overtaking) as overtaking, SUM(tooclose) as tooclose " +
            "FROM irawdata WHERE device_code = ? AND create_at >= ? AND create_at < ? AND is_read = 0"
        ).get(code, startStr, endStr);

        if (!iraw) return;
        // RMTO class mapping: C1=a(motorcycle) C2=b(car) C3=c(van) C4=d(bus) C5=e+x(truck+other)
        var c1 = iraw.a||0, c2 = iraw.b||0, c3 = iraw.c||0, c4 = iraw.d||0, c5 = (iraw.e||0) + (iraw.x||0);
        var totalVehicles = c1 + c2 + c3 + c4 + c5;
        if (totalVehicles === 0) return;

        // Average speed per class: sa/sb/sc/sd/se/sx are SUM(avgSpeed * count) in irawdata
        // So per-class average = sa / a (speed-sum / count)
        var s1 = c1 > 0 ? Math.round((iraw.sa||0) / c1) : 0;
        var s2 = c2 > 0 ? Math.round((iraw.sb||0) / c2) : 0;
        var s3 = c3 > 0 ? Math.round((iraw.sc||0) / c3) : 0;
        var s4 = c4 > 0 ? Math.round((iraw.sd||0) / c4) : 0;
        var c5count = (iraw.e||0) + (iraw.x||0);
        var s5 = c5count > 0 ? Math.round(((iraw.se||0) + (iraw.sx_sum||0)) / c5count) : 0;

        // Overall average speed (ASP)
        var totalSpeedSum = (iraw.sa||0) + (iraw.sb||0) + (iraw.sc||0) + (iraw.sd||0) + (iraw.se||0) + (iraw.sx_sum||0);
        var avgSpeed = Math.round(totalSpeedSum / totalVehicles);

        // Speed violations per class (SO1-SO4, SO5 = null for 5-class)
        var so1 = iraw.sao||0;
        var so2 = iraw.sbo||0;
        var so3 = iraw.sco||0;
        var so4 = iraw.sdo||0;
        var so5 = null; // RMTO expects SO5 xsi:nil="true" for 5-class mode
        var sso = so1 + so2 + so3 + so4 + (iraw.seo||0) + (iraw.sxo||0); // total violations

        // Overtaking (OO) and too-close/headway (ESD)
        var oo = iraw.overtaking||0;
        var esd = iraw.tooclose||0;

        // Find route_id (mehvar code) for this device
        var devInfo = db.prepare("SELECT route FROM devices WHERE device_code = ?").get(code);
        var routeId = (devInfo && devInfo.route) || code;

        // Insert into simple queue (Add)
        db.prepare(
            "INSERT INTO rmto_queue (device_code, route_id, period_start, period_end, total_vehicles, avg_speed) " +
            "VALUES (?, ?, ?, ?, ?, ?)"
        ).run(code, routeId, startStr, endStr, totalVehicles, avgSpeed);

        // Insert into 5-class queue (Add5)
        db.prepare(
            "INSERT INTO rmto_queue_5class (device_code, route_id, period_start, period_end, " +
            "c1, c2, c3, c4, c5, avg_speed, s1, s2, s3, s4, s5, " +
            "sso, so1, so2, so3, so4, so5, oo, esd) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(code, routeId, startStr, endStr,
            c1, c2, c3, c4, c5, avgSpeed, s1, s2, s3, s4, s5,
            sso, so1, so2, so3, so4, so5, oo, esd);

        // Mark irawdata records as read so they won't be aggregated again
        db.prepare("UPDATE irawdata SET is_read = 1 WHERE device_code = ? AND create_at >= ? AND create_at < ?")
            .run(code, startStr, endStr);

        console.log("[Scheduler] Aggregated device " + code + " (route " + routeId + "): " + totalVehicles + " vehicles, ASP=" + avgSpeed + " SSO=" + sso + " OO=" + oo + " ESD=" + esd);
    });

    // Now send unsent records
    sendUnsentData();
}

/**
 * Send all unsent aggregated data to RMTO.
 * @param {function} [onComplete] - Optional callback(results) called when all sends finish.
 *   results = { total, success, failed, errors: [{ method, device_code, error, response }] }
 */
function sendUnsentData(onComplete) {
    var results = { total: 0, success: 0, failed: 0, errors: [] };

    // --- Send simple AddData ---
    var unsent = db.prepare("SELECT * FROM rmto_queue WHERE sent = 0 ORDER BY period_start LIMIT 50").all();

    // --- Send 5-class AddData5 ---
    var unsent5 = db.prepare("SELECT * FROM rmto_queue_5class WHERE sent = 0 ORDER BY period_start LIMIT 50").all();

    var pending = unsent.length + unsent5.length;
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

    unsent.forEach(function (row) {
        rmto.sendAddData({
            FID: row.route_id || row.device_code,
            ST: row.period_start,
            ET: row.period_end,
            totalCount: row.total_vehicles,
            avgSpeed: row.avg_speed
        }, function (err, response, soapXml) {
            var success = !err && response;
            var responseStr = JSON.stringify(response || (err && err.message));
            db.prepare(
                "UPDATE rmto_queue SET sent = ?, sent_at = datetime('now','localtime'), rmto_response = ? WHERE id = ?"
            ).run(success ? 1 : 0, responseStr, row.id);

            db.prepare(
                "INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message, soap_xml) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).run("Add", row.device_code, JSON.stringify(row),
                JSON.stringify(response), success ? 1 : 0, err ? err.message : null, soapXml || null);

            if (success) {
                results.success++;
            } else {
                results.failed++;
                results.errors.push({
                    method: "Add",
                    device_code: row.device_code,
                    error: err ? err.message : "پاسخ خالی از RMTO",
                    response: responseStr
                });
            }
            checkDone();
        });
    });

    unsent5.forEach(function (row) {
        rmto.sendAddData5({
            RID: row.route_id || row.device_code,
            ST: row.period_start,
            ET: row.period_end,
            C1: row.c1, C2: row.c2, C3: row.c3, C4: row.c4, C5: row.c5,
            ASP: Math.round(row.avg_speed),
            S1: row.s1, S2: row.s2, S3: row.s3, S4: row.s4, S5: row.s5,
            SSO: row.sso,
            SO1: row.so1, SO2: row.so2, SO3: row.so3, SO4: row.so4, SO5: row.so5,
            OO: row.oo,
            ESD: row.esd
        }, function (err, response, soapXml) {
            var success = !err && response;
            var responseStr = JSON.stringify(response || (err && err.message));
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
                results.errors.push({
                    method: "Add5",
                    device_code: row.device_code,
                    error: err ? err.message : "پاسخ خالی از RMTO",
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
        "SELECT device_code FROM devices WHERE status = 'online' AND last_seen < ?"
    ).all(cutoff);

    stale.forEach(function (d) {
        db.prepare("UPDATE devices SET status = 'offline' WHERE device_code = ?").run(d.device_code);
        console.log("[Scheduler] Device " + d.device_code + " marked offline (last_seen < " + cutoff + ")");
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
    sendUnsentData: sendUnsentData,
    checkOfflineDevices: checkOfflineDevices,
    // Alias for backward compatibility with older index.js versions
    processAndSendIrawdata: aggregateAndSend
};
