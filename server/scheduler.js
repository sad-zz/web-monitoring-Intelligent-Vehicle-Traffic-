/**
 * Scheduler - Aggregates traffic data every 15 minutes and sends to RMTO.
 */
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
        var dt = formatDateTime(row.period_start);

        rmto.sendAddData({
            deviceCode: row.device_code,
            dateTime: dt,
            totalCount: row.total_vehicles,
            avgSpeed: row.avg_speed
        }, function (err, response) {
            var success = !err && response;
            var responseStr = JSON.stringify(response || (err && err.message));
            db.prepare(
                "UPDATE rmto_queue SET sent = ?, sent_at = datetime('now','localtime'), rmto_response = ? WHERE id = ?"
            ).run(success ? 1 : 0, responseStr, row.id);

            db.prepare(
                "INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message) " +
                "VALUES (?, ?, ?, ?, ?, ?)"
            ).run("AddData", row.device_code, JSON.stringify(row),
                JSON.stringify(response), success ? 1 : 0, err ? err.message : null);

            if (success) {
                results.success++;
            } else {
                results.failed++;
                results.errors.push({
                    method: "AddData",
                    device_code: row.device_code,
                    error: err ? err.message : "پاسخ خالی از RMTO",
                    response: responseStr
                });
            }
            checkDone();
        });
    });

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
            var responseStr = JSON.stringify(response || (err && err.message));
            db.prepare(
                "UPDATE rmto_queue_5class SET sent = ?, sent_at = datetime('now','localtime'), rmto_response = ? WHERE id = ?"
            ).run(success ? 1 : 0, responseStr, row.id);

            db.prepare(
                "INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message) " +
                "VALUES (?, ?, ?, ?, ?, ?)"
            ).run("AddData5", row.device_code, JSON.stringify(row),
                JSON.stringify(response), success ? 1 : 0, err ? err.message : null);

            if (success) {
                results.success++;
            } else {
                results.failed++;
                results.errors.push({
                    method: "AddData5",
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
function start() {
    // Run every INTERVAL minutes
    var cronExpr = "*/" + INTERVAL + " * * * *";
    console.log("[Scheduler] Starting with cron:", cronExpr);

    cron.schedule(cronExpr, function () {
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
    sendUnsentData: sendUnsentData
};
