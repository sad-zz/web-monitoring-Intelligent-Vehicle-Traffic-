/**
 * Scheduler - Aggregates traffic data every 15 minutes and sends to RMTO.
 */
// Set Iran timezone before any Date operations (mirrors server/index.js)
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
 * Process irawdata records directly (per-interval) and send via Add5.
 * Matches C# reference software pipeline exactly:
 *   irawdata → compute weighted avg + per-class speeds → Add5 → store RMTO response
 */
function processAndSendIrawdata() {
    // Load current RMTO company code from settings
    var companyCode = 58;
    try {
        var row = db.prepare("SELECT value FROM settings WHERE key = 'rmto_company_code'").get();
        companyCode = parseInt((row && row.value) || "58", 10) || 58;
    } catch (e) {}

    // Get up to 100 unprocessed records (rmto_id IS NULL), oldest first
    var rows;
    try {
        rows = db.prepare("SELECT * FROM irawdata WHERE rmto_id IS NULL ORDER BY create_at ASC LIMIT 100").all();
    } catch (e) {
        console.error("[Scheduler] processAndSendIrawdata query error:", e.message);
        return;
    }
    if (!rows || rows.length === 0) return;

    console.log("[Scheduler] processAndSendIrawdata: " + rows.length + " record(s) to send");

    rows.forEach(function (row) {
        // Mark as in-flight (rmto_id = -1) to prevent double-processing
        try { db.prepare("UPDATE irawdata SET rmto_id = -1 WHERE id = ? AND rmto_id IS NULL").run(row.id); } catch (e) { return; }

        // Compute RMTO fields
        var a = row.a || 0, b = row.b || 0, c = row.c || 0, d = row.d || 0;
        var e5 = (row.e || 0) + (row.x || 0);   // C5 = e + x (heavy)
        var totalCount = a + b + c + d + e5;

        var sa = row.sa || 0, sb = row.sb || 0, sc = row.sc || 0, sd = row.sd || 0;
        var se = (row.se || 0) + (row.sx || 0);
        var asp = totalCount > 0 ? Math.round((sa + sb + sc + sd + se) / totalCount) : 0;

        // Per-class avg speeds
        var s1 = a > 0 ? Math.round(sa / a) : 0;
        var s2 = b > 0 ? Math.round(sb / b) : 0;
        var s3 = c > 0 ? Math.round(sc / c) : 0;
        var s4 = d > 0 ? Math.round(sd / d) : 0;
        var s5 = e5 > 0 ? Math.round(se / e5) : 0;

        // Per-class overspeed counts
        var so1 = row.sao || 0, so2 = row.sbo || 0, so3 = row.sco || 0;
        var so4 = row.sdo || 0, so5 = (row.seo || 0) + (row.sxo || 0);
        var sso = so1 + so2 + so3 + so4 + so5;

        // Null record: all counts zero (inactive device) — per C# reference isnull logic
        var isNull = (totalCount === 0);

        rmto.sendAdd5({
            cid: companyCode,
            fid: row.id,
            rid: parseInt(row.device_code, 10) || 0,
            st: row.create_at,
            et: row.stop,
            c1: isNull ? null : a,
            c2: isNull ? null : b,
            c3: isNull ? null : c,
            c4: isNull ? null : d,
            c5: isNull ? null : e5,
            asp: isNull ? null : asp,
            s1: isNull ? null : s1,
            s2: isNull ? null : s2,
            s3: isNull ? null : s3,
            s4: isNull ? null : s4,
            s5: isNull ? null : s5,
            sso: isNull ? null : sso,
            so1: isNull ? null : so1,
            so2: isNull ? null : so2,
            so3: isNull ? null : so3,
            so4: isNull ? null : so4,
            so5: isNull ? null : so5,
            oo: row.overtaking || 0,
            esd: row.tooclose || 0
        }, function (err, response) {
            try {
                var rmtoId, cfl = null, srvdt = null, bil = null, errMsg = null;
                if (isNull) {
                    // Null record - mark as sent with RMTO_ID = 1 (per C# reference)
                    rmtoId = 1; cfl = 0; bil = 0; errMsg = "NULL SENT";
                } else if (response) {
                    rmtoId = response.ID || 0;
                    cfl = response.CFL || 0;
                    srvdt = response.SRVDT ? String(response.SRVDT) : null;
                    bil = response.BIL || 0;
                    errMsg = response.ERR || null;
                } else {
                    rmtoId = 0;
                    errMsg = err ? err.message : "no response";
                }

                db.prepare(
                    "UPDATE irawdata SET rmto_id = ?, rmto_cfl = ?, rmto_srvdt = ?, rmto_bil = ?, rmto_err = ? WHERE id = ?"
                ).run(rmtoId, cfl, srvdt, bil, errMsg, row.id);

                // Log to send_log for history/audit
                db.prepare(
                    "INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message) VALUES (?, ?, ?, ?, ?, ?)"
                ).run(
                    "Add5", row.device_code,
                    JSON.stringify({ fid: row.id, rid: row.device_code, st: row.create_at, et: row.stop, total: totalCount }),
                    JSON.stringify(response),
                    (rmtoId && rmtoId > 0) ? 1 : 0,
                    errMsg
                );
            } catch (dbErr) {
                console.error("[Scheduler] Failed to update RMTO status for irawdata id=" + row.id + ":", dbErr.message);
            }
        });
    });
}

/**
 * Aggregate raw traffic_data into rmto_queue and rmto_queue_5class,
 * then send unsent records to RMTO.
 * (Kept for HTTP devices that POST to /api/irawdata directly without TCP)
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
        // This is the correct source - TCP RATCX1 data only goes to irawdata
        var iraw = db.prepare(
            "SELECT SUM(a) as a, SUM(b) as b, SUM(c) as c, SUM(d) as d, SUM(e) as e, SUM(x) as x, " +
            "SUM(sa) as sa, SUM(sb) as sb, SUM(sc) as sc, SUM(sd) as sd, SUM(se) as se, SUM(sx) as sx_sum, " +
            "SUM(sao) as sao, SUM(sbo) as sbo, SUM(sco) as sco, SUM(sdo) as sdo, SUM(seo) as seo, SUM(sxo) as sxo " +
            "FROM irawdata WHERE device_code = ? AND create_at >= ? AND create_at < ? AND is_read = 0"
        ).get(code, startStr, endStr);

        if (!iraw) return;
        var totalVehicles = (iraw.a||0) + (iraw.b||0) + (iraw.c||0) + (iraw.d||0) + (iraw.e||0) + (iraw.x||0);
        if (totalVehicles === 0) return;

        var totalSpeedSum = (iraw.sa||0) + (iraw.sb||0) + (iraw.sc||0) + (iraw.sd||0) + (iraw.se||0) + (iraw.sx_sum||0);
        var avgSpeed = totalVehicles > 0 ? totalSpeedSum / totalVehicles : 0;
        var violations = (iraw.sao||0) + (iraw.sbo||0) + (iraw.sco||0) + (iraw.sdo||0) + (iraw.seo||0) + (iraw.sxo||0);

        // Compute speed class distribution from per-class averages
        // Speed ranges: S1(<60) S2(60-80) S3(80-100) S4(100-120) S5(>120)
        var s1 = 0, s2 = 0, s3 = 0, s4 = 0, s5 = 0;
        var classes = [
            { n: iraw.a||0, s: iraw.sa||0 },
            { n: iraw.b||0, s: iraw.sb||0 },
            { n: iraw.c||0, s: iraw.sc||0 },
            { n: iraw.d||0, s: iraw.sd||0 },
            { n: iraw.e||0, s: iraw.se||0 },
            { n: iraw.x||0, s: iraw.sx_sum||0 }
        ];
        classes.forEach(function (c) {
            if (c.n === 0) return;
            var avg = c.s / c.n;
            if (avg < 60) s1 += c.n;
            else if (avg < 80) s2 += c.n;
            else if (avg < 100) s3 += c.n;
            else if (avg < 120) s4 += c.n;
            else s5 += c.n;
        });

        // Insert into simple queue (AddData)
        db.prepare(
            "INSERT INTO rmto_queue (device_code, period_start, period_end, total_vehicles, avg_speed) " +
            "VALUES (?, ?, ?, ?, ?)"
        ).run(code, startStr, endStr, totalVehicles, Math.round(avgSpeed));

        // Insert into 5-class queue (AddData5)
        // Classes: a=motorcycle(C1) b=car(C2) c=van(C3) d=bus(C4) e+x=truck(C5)
        db.prepare(
            "INSERT INTO rmto_queue_5class (device_code, period_start, period_end, " +
            "class1_count, class2_count, class3_count, class4_count, class5_count, " +
            "speed1_count, speed2_count, speed3_count, speed4_count, speed5_count, " +
            "violations, avg_speed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(code, startStr, endStr,
            iraw.a||0, iraw.b||0, iraw.c||0, iraw.d||0, (iraw.e||0) + (iraw.x||0),
            s1, s2, s3, s4, s5,
            violations, Math.round(avgSpeed));

        // Mark irawdata records as read so they won't be aggregated again
        db.prepare("UPDATE irawdata SET is_read = 1 WHERE device_code = ? AND create_at >= ? AND create_at < ?")
            .run(code, startStr, endStr);

        console.log("[Scheduler] Aggregated device " + code + ": " + totalVehicles + " vehicles, avg " + Math.round(avgSpeed) + " km/h");
    });

    // Now send unsent records
    sendUnsentData();
}

/**
 * Send all unsent aggregated data to RMTO.
 */
function sendUnsentData() {
    // --- Send simple AddData ---
    var unsent = db.prepare("SELECT * FROM rmto_queue WHERE sent = 0 ORDER BY period_start LIMIT 50").all();

    unsent.forEach(function (row) {
        var dt = formatDateTime(row.period_start);

        rmto.sendAddData({
            deviceCode: row.device_code,
            dateTime: dt,
            totalCount: row.total_vehicles,
            avgSpeed: row.avg_speed
        }, function (err, response) {
            var success = !err && response;
            db.prepare(
                "UPDATE rmto_queue SET sent = ?, sent_at = datetime('now','localtime'), rmto_response = ? WHERE id = ?"
            ).run(success ? 1 : 0, JSON.stringify(response || (err && err.message)), row.id);

            db.prepare(
                "INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message) " +
                "VALUES (?, ?, ?, ?, ?, ?)"
            ).run("AddData", row.device_code, JSON.stringify(row),
                JSON.stringify(response), success ? 1 : 0, err ? err.message : null);
        });
    });

    // --- Send 5-class AddData5 ---
    var unsent5 = db.prepare("SELECT * FROM rmto_queue_5class WHERE sent = 0 ORDER BY period_start LIMIT 50").all();

    unsent5.forEach(function (row) {
        var dt = formatDateTime(row.period_start);

        rmto.sendAddData5({
            deviceCode: row.device_code,
            dateTime: dt,
            class1Count: row.class1_count,
            class2Count: row.class2_count,
            class3Count: row.class3_count,
            class4Count: row.class4_count,
            class5Count: row.class5_count,
            speed1Count: row.speed1_count,
            speed2Count: row.speed2_count,
            speed3Count: row.speed3_count,
            speed4Count: row.speed4_count,
            speed5Count: row.speed5_count,
            violations: row.violations,
            avgSpeed: row.avg_speed
        }, function (err, response) {
            var success = !err && response;
            db.prepare(
                "UPDATE rmto_queue_5class SET sent = ?, sent_at = datetime('now','localtime'), rmto_response = ? WHERE id = ?"
            ).run(success ? 1 : 0, JSON.stringify(response || (err && err.message)), row.id);

            db.prepare(
                "INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message) " +
                "VALUES (?, ?, ?, ?, ?, ?)"
            ).run("AddData5", row.device_code, JSON.stringify(row),
                JSON.stringify(response), success ? 1 : 0, err ? err.message : null);
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
 * Check for HTTP devices that have gone silent and mark them offline.
 * TCP devices are already marked offline on socket disconnect (in index.js).
 * HTTP devices have no connection to drop, so we check last_seen periodically.
 */
var stmtGetOfflineTimeout = db.prepare("SELECT value FROM settings WHERE key = 'offline_timeout'");
var stmtMarkOffline = db.prepare(
    "UPDATE devices SET status = 'offline' " +
    "WHERE status = 'online' " +
    "AND last_seen IS NOT NULL " +
    "AND datetime(last_seen) < datetime(?)"
);

function checkOfflineDevices() {
    try {
        var timeoutRow = stmtGetOfflineTimeout.get();
        var timeoutMin = parseInt((timeoutRow && timeoutRow.value) || "5", 10);
        if (isNaN(timeoutMin) || timeoutMin < 1) timeoutMin = 5;

        // Calculate threshold in JavaScript and pass as a bound parameter
        var threshold = new Date(Date.now() - timeoutMin * 60 * 1000);
        var thresholdStr = toLocalISOString(threshold);

        var updated = stmtMarkOffline.run(thresholdStr).changes;

        if (updated > 0) {
            console.log("[Scheduler] checkOfflineDevices: marked " + updated + " device(s) offline (timeout=" + timeoutMin + " min)");
        }
    } catch (e) {
        console.error("[Scheduler] checkOfflineDevices error:", e.message);
    }
}

/**
 * Start the scheduler.
 */
function start() {
    // Process and send irawdata records every 5 minutes (per-interval pipeline)
    cron.schedule("*/5 * * * *", function () {
        processAndSendIrawdata();
    });

    // Retry failed rmto_queue records (for HTTP devices) every INTERVAL minutes
    var cronExpr = "*/" + INTERVAL + " * * * *";
    console.log("[Scheduler] Starting with cron:", cronExpr);
    cron.schedule(cronExpr, function () {
        sendUnsentData();
    });

    // Check for offline devices every minute (covers HTTP devices that stop sending)
    cron.schedule("* * * * *", function () {
        checkOfflineDevices();
    });

    // Retry unsent irawdata and rmto_queue hourly
    cron.schedule("5 * * * *", function () {
        console.log("[Scheduler] Retry unsent data...");
        processAndSendIrawdata();
        sendUnsentData();
    });
}

module.exports = {
    start: start,
    aggregateAndSend: processAndSendIrawdata,  // backward compat alias
    processAndSendIrawdata: processAndSendIrawdata,
    sendUnsentData: sendUnsentData,
    checkOfflineDevices: checkOfflineDevices
};
