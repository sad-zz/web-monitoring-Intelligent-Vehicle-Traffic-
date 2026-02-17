/**
 * Scheduler - Aggregates traffic data every 15 minutes and sends to RMTO.
 */
var cron = require("node-cron");
var db = require("./db");
var rmto = require("./rmto-client");

var INTERVAL = parseInt(process.env.SEND_INTERVAL_MINUTES, 10) || 15;

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

    var startStr = periodStart.toISOString();
    var endStr = periodEnd.toISOString();

    // Get all active devices
    var devices = db.prepare("SELECT device_code FROM devices WHERE status != 'offline'").all();

    devices.forEach(function (dev) {
        var code = dev.device_code;

        // Aggregate raw data for this period
        var agg = db.prepare(
            "SELECT COUNT(*) as total, AVG(speed) as avg_speed, " +
            "SUM(CASE WHEN vehicle_class = 1 THEN 1 ELSE 0 END) as c1, " +
            "SUM(CASE WHEN vehicle_class = 2 THEN 1 ELSE 0 END) as c2, " +
            "SUM(CASE WHEN vehicle_class = 3 THEN 1 ELSE 0 END) as c3, " +
            "SUM(CASE WHEN vehicle_class = 4 THEN 1 ELSE 0 END) as c4, " +
            "SUM(CASE WHEN vehicle_class = 5 THEN 1 ELSE 0 END) as c5, " +
            "SUM(CASE WHEN speed < 60 THEN 1 ELSE 0 END) as s1, " +
            "SUM(CASE WHEN speed >= 60 AND speed < 80 THEN 1 ELSE 0 END) as s2, " +
            "SUM(CASE WHEN speed >= 80 AND speed < 100 THEN 1 ELSE 0 END) as s3, " +
            "SUM(CASE WHEN speed >= 100 AND speed < 120 THEN 1 ELSE 0 END) as s4, " +
            "SUM(CASE WHEN speed >= 120 THEN 1 ELSE 0 END) as s5, " +
            "SUM(CASE WHEN speed > 120 THEN 1 ELSE 0 END) as violations " +
            "FROM traffic_data WHERE device_code = ? AND timestamp >= ? AND timestamp < ?"
        ).get(code, startStr, endStr);

        if (!agg || agg.total === 0) return;

        // Insert into simple queue
        db.prepare(
            "INSERT INTO rmto_queue (device_code, period_start, period_end, total_vehicles, avg_speed) " +
            "VALUES (?, ?, ?, ?, ?)"
        ).run(code, startStr, endStr, agg.total, Math.round(agg.avg_speed || 0));

        // Insert into 5-class queue
        db.prepare(
            "INSERT INTO rmto_queue_5class (device_code, period_start, period_end, " +
            "class1_count, class2_count, class3_count, class4_count, class5_count, " +
            "speed1_count, speed2_count, speed3_count, speed4_count, speed5_count, " +
            "violations, avg_speed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(code, startStr, endStr,
            agg.c1, agg.c2, agg.c3, agg.c4, agg.c5,
            agg.s1, agg.s2, agg.s3, agg.s4, agg.s5,
            agg.violations, Math.round(agg.avg_speed || 0));
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
                "UPDATE rmto_queue SET sent = ?, sent_at = datetime('now'), rmto_response = ? WHERE id = ?"
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
                "UPDATE rmto_queue_5class SET sent = ?, sent_at = datetime('now'), rmto_response = ? WHERE id = ?"
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
