/**
 * TC Manager Server
 * - Receives data from 100+ devices (each identified by 4-digit code)
 * - Stores in SQLite database
 * - Aggregates and sends to RMTO (otf.rmto.ir) via SOAP
 * - Serves frontend dashboard
 */
require("dotenv").config();

var express = require("express");
var cors = require("cors");
var path = require("path");
var db = require("./db");
var rmto = require("./rmto-client");
var scheduler = require("./scheduler");

var app = express();
var PORT = process.env.PORT || 3000;
var HOST = process.env.HOST || "0.0.0.0";

app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "..")));

// ============================================================
// API: Device Management
// ============================================================

// Get all devices
app.get("/api/devices", function (req, res) {
    var rows = db.prepare("SELECT * FROM devices ORDER BY device_code").all();
    res.json(rows);
});

// Get single device
app.get("/api/devices/:code", function (req, res) {
    var row = db.prepare("SELECT * FROM devices WHERE device_code = ?").get(req.params.code);
    if (!row) return res.status(404).json({ error: "دستگاه یافت نشد" });
    res.json(row);
});

// Add device
app.post("/api/devices", function (req, res) {
    var b = req.body;
    if (!b.device_code || !b.name) {
        return res.status(400).json({ error: "کد دستگاه و نام الزامی است" });
    }
    if (!/^\d{4}$/.test(b.device_code)) {
        return res.status(400).json({ error: "کد دستگاه باید ۴ رقمی باشد" });
    }
    try {
        db.prepare(
            "INSERT INTO devices (device_code, name, type, route, ip, status, firmware) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(b.device_code, b.name, b.type || "sensor", b.route || "", b.ip || "", "offline", b.firmware || "");
        res.json({ success: true, device_code: b.device_code });
    } catch (e) {
        if (e.message.indexOf("UNIQUE") !== -1) {
            return res.status(409).json({ error: "کد دستگاه تکراری است" });
        }
        res.status(500).json({ error: e.message });
    }
});

// Update device
app.put("/api/devices/:code", function (req, res) {
    var b = req.body;
    var code = req.params.code;
    db.prepare(
        "UPDATE devices SET name = COALESCE(?, name), type = COALESCE(?, type), " +
        "route = COALESCE(?, route), ip = COALESCE(?, ip), firmware = COALESCE(?, firmware) " +
        "WHERE device_code = ?"
    ).run(b.name, b.type, b.route, b.ip, b.firmware, code);
    res.json({ success: true });
});

// Delete device
app.delete("/api/devices/:code", function (req, res) {
    db.prepare("DELETE FROM devices WHERE device_code = ?").run(req.params.code);
    res.json({ success: true });
});

// ============================================================
// API: Receive Traffic Data from Devices
// ============================================================

/**
 * POST /api/data
 * Devices send traffic data here.
 * Body: { device_code, timestamp, vehicle_class, speed, direction, lane }
 * Or batch: { device_code, records: [ { timestamp, vehicle_class, speed, ... }, ... ] }
 */
app.post("/api/data", function (req, res) {
    var b = req.body;
    var code = b.device_code;

    if (!code || !/^\d{4}$/.test(code)) {
        return res.status(400).json({ error: "کد دستگاه ۴ رقمی الزامی است" });
    }

    // Update device status
    db.prepare("UPDATE devices SET status = 'online', last_seen = datetime('now') WHERE device_code = ?").run(code);

    var insert = db.prepare(
        "INSERT INTO traffic_data (device_code, timestamp, vehicle_class, speed, direction, lane, raw_payload) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)"
    );

    var count = 0;

    if (b.records && Array.isArray(b.records)) {
        // Batch insert
        var insertMany = db.transaction(function (records) {
            records.forEach(function (r) {
                insert.run(
                    code,
                    r.timestamp || new Date().toISOString(),
                    r.vehicle_class || 0,
                    r.speed || 0,
                    r.direction || 1,
                    r.lane || 1,
                    JSON.stringify(r)
                );
                count++;
            });
        });
        insertMany(b.records);
    } else {
        // Single record
        insert.run(
            code,
            b.timestamp || new Date().toISOString(),
            b.vehicle_class || 0,
            b.speed || 0,
            b.direction || 1,
            b.lane || 1,
            JSON.stringify(b)
        );
        count = 1;
    }

    res.json({ success: true, received: count });
});

// ============================================================
// API: Dashboard Stats
// ============================================================

app.get("/api/stats", function (req, res) {
    var totalDevices = db.prepare("SELECT COUNT(*) as c FROM devices").get().c;
    var onlineDevices = db.prepare("SELECT COUNT(*) as c FROM devices WHERE status = 'online'").get().c;
    var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    var todayVehicles = db.prepare(
        "SELECT COUNT(*) as c FROM traffic_data WHERE timestamp >= ?"
    ).get(todayStart.toISOString()).c;
    var todayAvgSpeed = db.prepare(
        "SELECT AVG(speed) as avg FROM traffic_data WHERE timestamp >= ? AND speed > 0"
    ).get(todayStart.toISOString()).avg || 0;

    var unsentCount = db.prepare("SELECT COUNT(*) as c FROM rmto_queue WHERE sent = 0").get().c;
    var unsent5Count = db.prepare("SELECT COUNT(*) as c FROM rmto_queue_5class WHERE sent = 0").get().c;

    res.json({
        totalDevices: totalDevices,
        onlineDevices: onlineDevices,
        todayVehicles: todayVehicles,
        todayAvgSpeed: Math.round(todayAvgSpeed),
        unsentRMTO: unsentCount,
        unsentRMTO5: unsent5Count
    });
});

// ============================================================
// API: RMTO Send Logs
// ============================================================

app.get("/api/rmto/logs", function (req, res) {
    var limit = parseInt(req.query.limit, 10) || 50;
    var rows = db.prepare("SELECT * FROM send_log ORDER BY created_at DESC LIMIT ?").all(limit);
    res.json(rows);
});

// Manual trigger: send unsent data now
app.post("/api/rmto/send-now", function (req, res) {
    scheduler.sendUnsentData();
    res.json({ success: true, message: "ارسال داده‌های ارسال‌نشده شروع شد" });
});

// Manual trigger: aggregate and send
app.post("/api/rmto/aggregate", function (req, res) {
    scheduler.aggregateAndSend();
    res.json({ success: true, message: "تجمیع و ارسال شروع شد" });
});

// RMTO queue status
app.get("/api/rmto/queue", function (req, res) {
    var unsent = db.prepare(
        "SELECT device_code, period_start, total_vehicles, avg_speed, created_at " +
        "FROM rmto_queue WHERE sent = 0 ORDER BY period_start DESC LIMIT 100"
    ).all();
    var sent = db.prepare(
        "SELECT device_code, period_start, total_vehicles, avg_speed, sent_at, rmto_response " +
        "FROM rmto_queue WHERE sent = 1 ORDER BY sent_at DESC LIMIT 50"
    ).all();
    res.json({ unsent: unsent, sent: sent });
});

// ============================================================
// API: Traffic Data Query
// ============================================================

app.get("/api/traffic", function (req, res) {
    var code = req.query.device_code || "";
    var from = req.query.from || "";
    var to = req.query.to || "";
    var limit = parseInt(req.query.limit, 10) || 100;

    var sql = "SELECT * FROM traffic_data WHERE 1=1";
    var params = [];
    if (code) { sql += " AND device_code = ?"; params.push(code); }
    if (from) { sql += " AND timestamp >= ?"; params.push(from); }
    if (to) { sql += " AND timestamp <= ?"; params.push(to); }
    sql += " ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);

    var rows = db.prepare(sql).all.apply(db.prepare(sql), params);
    res.json(rows);
});

// ============================================================
// Start Server
// ============================================================

app.listen(PORT, HOST, function () {
    console.log("============================================");
    console.log("  TC Manager Server (Sistan Akbari)");
    console.log("  http://" + HOST + ":" + PORT);
    console.log("============================================");

    // Initialize RMTO SOAP client
    rmto.initClient(function (err) {
        if (err) console.error("[RMTO] Will retry on first send");
    });

    // Start the scheduler
    scheduler.start();
});
