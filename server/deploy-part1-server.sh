#!/bin/bash
# Part 1: Deploy server-side JS files
set -e
cd /opt/tc-manager

echo "=== Deploying server files ==="

mkdir -p server css js data

# --- server/db.js ---
cat > server/db.js << 'ENDFILE'
var Database = require("better-sqlite3");
var path = require("path");
var DB_PATH = path.join(__dirname, "data.db");
var db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec([
    "CREATE TABLE IF NOT EXISTS devices (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  device_code TEXT NOT NULL UNIQUE,",
    "  name TEXT NOT NULL,",
    "  type TEXT NOT NULL DEFAULT 'sensor',",
    "  route TEXT,",
    "  ip TEXT,",
    "  status TEXT NOT NULL DEFAULT 'offline',",
    "  last_seen TEXT,",
    "  firmware TEXT,",
    "  created_at TEXT DEFAULT (datetime('now'))",
    ");",
    "CREATE TABLE IF NOT EXISTS traffic_data (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  device_code TEXT NOT NULL,",
    "  timestamp TEXT NOT NULL,",
    "  vehicle_class INTEGER DEFAULT 0,",
    "  speed REAL DEFAULT 0,",
    "  direction INTEGER DEFAULT 1,",
    "  lane INTEGER DEFAULT 1,",
    "  raw_payload TEXT,",
    "  received_at TEXT DEFAULT (datetime('now')),",
    "  FOREIGN KEY (device_code) REFERENCES devices(device_code)",
    ");",
    "CREATE TABLE IF NOT EXISTS rmto_queue (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  device_code TEXT NOT NULL,",
    "  period_start TEXT NOT NULL,",
    "  period_end TEXT NOT NULL,",
    "  total_vehicles INTEGER DEFAULT 0,",
    "  avg_speed REAL DEFAULT 0,",
    "  sent INTEGER DEFAULT 0,",
    "  sent_at TEXT,",
    "  rmto_response TEXT,",
    "  created_at TEXT DEFAULT (datetime('now'))",
    ");",
    "CREATE TABLE IF NOT EXISTS rmto_queue_5class (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  device_code TEXT NOT NULL,",
    "  period_start TEXT NOT NULL,",
    "  period_end TEXT NOT NULL,",
    "  class1_count INTEGER DEFAULT 0,",
    "  class2_count INTEGER DEFAULT 0,",
    "  class3_count INTEGER DEFAULT 0,",
    "  class4_count INTEGER DEFAULT 0,",
    "  class5_count INTEGER DEFAULT 0,",
    "  speed1_count INTEGER DEFAULT 0,",
    "  speed2_count INTEGER DEFAULT 0,",
    "  speed3_count INTEGER DEFAULT 0,",
    "  speed4_count INTEGER DEFAULT 0,",
    "  speed5_count INTEGER DEFAULT 0,",
    "  violations INTEGER DEFAULT 0,",
    "  avg_speed REAL DEFAULT 0,",
    "  sent INTEGER DEFAULT 0,",
    "  sent_at TEXT,",
    "  rmto_response TEXT,",
    "  created_at TEXT DEFAULT (datetime('now'))",
    ");",
    "CREATE TABLE IF NOT EXISTS rmto_queue_8class (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  device_code TEXT NOT NULL,",
    "  period_start TEXT NOT NULL,",
    "  period_end TEXT NOT NULL,",
    "  class1_count INTEGER DEFAULT 0,",
    "  class2_count INTEGER DEFAULT 0,",
    "  class3_count INTEGER DEFAULT 0,",
    "  class4_count INTEGER DEFAULT 0,",
    "  class5_count INTEGER DEFAULT 0,",
    "  class6_count INTEGER DEFAULT 0,",
    "  class7_count INTEGER DEFAULT 0,",
    "  class8_count INTEGER DEFAULT 0,",
    "  speed1_count INTEGER DEFAULT 0,",
    "  speed2_count INTEGER DEFAULT 0,",
    "  speed3_count INTEGER DEFAULT 0,",
    "  speed4_count INTEGER DEFAULT 0,",
    "  speed5_count INTEGER DEFAULT 0,",
    "  speed6_count INTEGER DEFAULT 0,",
    "  speed7_count INTEGER DEFAULT 0,",
    "  speed8_count INTEGER DEFAULT 0,",
    "  violations INTEGER DEFAULT 0,",
    "  avg_speed REAL DEFAULT 0,",
    "  sent INTEGER DEFAULT 0,",
    "  sent_at TEXT,",
    "  rmto_response TEXT,",
    "  created_at TEXT DEFAULT (datetime('now'))",
    ");",
    "CREATE TABLE IF NOT EXISTS send_log (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  method TEXT NOT NULL,",
    "  device_code TEXT NOT NULL,",
    "  request_data TEXT,",
    "  response_data TEXT,",
    "  success INTEGER DEFAULT 0,",
    "  error_message TEXT,",
    "  created_at TEXT DEFAULT (datetime('now'))",
    ");",
    "CREATE INDEX IF NOT EXISTS idx_traffic_device ON traffic_data(device_code);",
    "CREATE INDEX IF NOT EXISTS idx_traffic_time ON traffic_data(timestamp);",
    "CREATE INDEX IF NOT EXISTS idx_rmto_unsent ON rmto_queue(sent, device_code);",
    "CREATE INDEX IF NOT EXISTS idx_rmto5_unsent ON rmto_queue_5class(sent, device_code);",
    "CREATE INDEX IF NOT EXISTS idx_rmto8_unsent ON rmto_queue_8class(sent, device_code);"
].join("\n"));
module.exports = db;
ENDFILE

# --- server/rmto-client.js ---
cat > server/rmto-client.js << 'ENDFILE'
var soap = require("soap");
var WSDL_URL = process.env.RMTO_WSDL || "http://otf.rmto.ir/Companies/Companies.asmx?WSDL";
var COMPANY_CODE = process.env.RMTO_COMPANY_CODE || "58";
var USERNAME = process.env.RMTO_USERNAME || "";
var PASSWORD = process.env.RMTO_PASSWORD || "";
var soapClient = null;

function initClient(callback) {
    if (soapClient) return callback(null, soapClient);
    soap.createClient(WSDL_URL, function (err, client) {
        if (err) { console.error("[RMTO] Failed to create SOAP client:", err.message); return callback(err); }
        soapClient = client;
        console.log("[RMTO] SOAP client initialized");
        console.log("[RMTO] Available methods:", Object.keys(client.describe().CompanySoap || {}));
        callback(null, client);
    });
}

function sendAddData(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);
        var args = { CompanyCode: COMPANY_CODE, UserName: USERNAME, Password: PASSWORD, StationCode: data.deviceCode, DateTime: data.dateTime, Count: data.totalCount, Speed: Math.round(data.avgSpeed) };
        console.log("[RMTO] AddData request:", JSON.stringify(args));
        soapClient.AddData(args, function (err, result) {
            if (err) { console.error("[RMTO] AddData error:", err.message); return callback(err, null); }
            var response = result && result.AddDataResult;
            console.log("[RMTO] AddData response:", response);
            callback(null, response);
        });
    });
}

function sendAddData5(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);
        var args = { CompanyCode: COMPANY_CODE, UserName: USERNAME, Password: PASSWORD, StationCode: data.deviceCode, DateTime: data.dateTime, C1: data.class1Count||0, C2: data.class2Count||0, C3: data.class3Count||0, C4: data.class4Count||0, C5: data.class5Count||0, S1: data.speed1Count||0, S2: data.speed2Count||0, S3: data.speed3Count||0, S4: data.speed4Count||0, S5: data.speed5Count||0, Violation: data.violations||0, Speed: Math.round(data.avgSpeed||0) };
        console.log("[RMTO] AddData5 request:", JSON.stringify(args));
        soapClient.AddData5(args, function (err, result) {
            if (err) { console.error("[RMTO] AddData5 error:", err.message); return callback(err, null); }
            var response = result && result.AddData5Result;
            console.log("[RMTO] AddData5 response:", response);
            callback(null, response);
        });
    });
}

function sendAddData8(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);
        var args = { CompanyCode: COMPANY_CODE, UserName: USERNAME, Password: PASSWORD, StationCode: data.deviceCode, DateTime: data.dateTime, C1: data.class1Count||0, C2: data.class2Count||0, C3: data.class3Count||0, C4: data.class4Count||0, C5: data.class5Count||0, C6: data.class6Count||0, C7: data.class7Count||0, C8: data.class8Count||0, S1: data.speed1Count||0, S2: data.speed2Count||0, S3: data.speed3Count||0, S4: data.speed4Count||0, S5: data.speed5Count||0, S6: data.speed6Count||0, S7: data.speed7Count||0, S8: data.speed8Count||0, Violation: data.violations||0, Speed: Math.round(data.avgSpeed||0) };
        console.log("[RMTO] AddData8 request:", JSON.stringify(args));
        soapClient.AddData8(args, function (err, result) {
            if (err) { console.error("[RMTO] AddData8 error:", err.message); return callback(err, null); }
            var response = result && result.AddData8Result;
            console.log("[RMTO] AddData8 response:", response);
            callback(null, response);
        });
    });
}

function ensureClient(callback) {
    if (soapClient) return callback(null);
    initClient(function (err) { callback(err); });
}

module.exports = { initClient: initClient, sendAddData: sendAddData, sendAddData5: sendAddData5, sendAddData8: sendAddData8 };
ENDFILE

# --- server/scheduler.js ---
cat > server/scheduler.js << 'ENDFILE'
var cron = require("node-cron");
var db = require("./db");
var rmto = require("./rmto-client");
var INTERVAL = parseInt(process.env.SEND_INTERVAL_MINUTES, 10) || 15;

function aggregateAndSend() {
    console.log("[Scheduler] Starting aggregation cycle at", new Date().toISOString());
    var now = new Date();
    var periodEnd = new Date(now);
    periodEnd.setMinutes(Math.floor(periodEnd.getMinutes() / INTERVAL) * INTERVAL, 0, 0);
    var periodStart = new Date(periodEnd.getTime() - INTERVAL * 60 * 1000);
    var startStr = periodStart.toISOString();
    var endStr = periodEnd.toISOString();
    var devices = db.prepare("SELECT device_code FROM devices WHERE status != 'offline'").all();
    devices.forEach(function (dev) {
        var code = dev.device_code;
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
        db.prepare("INSERT INTO rmto_queue (device_code, period_start, period_end, total_vehicles, avg_speed) VALUES (?, ?, ?, ?, ?)").run(code, startStr, endStr, agg.total, Math.round(agg.avg_speed || 0));
        db.prepare("INSERT INTO rmto_queue_5class (device_code, period_start, period_end, class1_count, class2_count, class3_count, class4_count, class5_count, speed1_count, speed2_count, speed3_count, speed4_count, speed5_count, violations, avg_speed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(code, startStr, endStr, agg.c1, agg.c2, agg.c3, agg.c4, agg.c5, agg.s1, agg.s2, agg.s3, agg.s4, agg.s5, agg.violations, Math.round(agg.avg_speed || 0));
    });
    sendUnsentData();
}

function sendUnsentData() {
    var unsent = db.prepare("SELECT * FROM rmto_queue WHERE sent = 0 ORDER BY period_start LIMIT 50").all();
    unsent.forEach(function (row) {
        var dt = formatDateTime(row.period_start);
        rmto.sendAddData({ deviceCode: row.device_code, dateTime: dt, totalCount: row.total_vehicles, avgSpeed: row.avg_speed }, function (err, response) {
            var success = !err && response;
            db.prepare("UPDATE rmto_queue SET sent = ?, sent_at = datetime('now'), rmto_response = ? WHERE id = ?").run(success ? 1 : 0, JSON.stringify(response || (err && err.message)), row.id);
            db.prepare("INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message) VALUES (?, ?, ?, ?, ?, ?)").run("AddData", row.device_code, JSON.stringify(row), JSON.stringify(response), success ? 1 : 0, err ? err.message : null);
        });
    });
    var unsent5 = db.prepare("SELECT * FROM rmto_queue_5class WHERE sent = 0 ORDER BY period_start LIMIT 50").all();
    unsent5.forEach(function (row) {
        var dt = formatDateTime(row.period_start);
        rmto.sendAddData5({ deviceCode: row.device_code, dateTime: dt, class1Count: row.class1_count, class2Count: row.class2_count, class3Count: row.class3_count, class4Count: row.class4_count, class5Count: row.class5_count, speed1Count: row.speed1_count, speed2Count: row.speed2_count, speed3Count: row.speed3_count, speed4Count: row.speed4_count, speed5Count: row.speed5_count, violations: row.violations, avgSpeed: row.avg_speed }, function (err, response) {
            var success = !err && response;
            db.prepare("UPDATE rmto_queue_5class SET sent = ?, sent_at = datetime('now'), rmto_response = ? WHERE id = ?").run(success ? 1 : 0, JSON.stringify(response || (err && err.message)), row.id);
            db.prepare("INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message) VALUES (?, ?, ?, ?, ?, ?)").run("AddData5", row.device_code, JSON.stringify(row), JSON.stringify(response), success ? 1 : 0, err ? err.message : null);
        });
    });
}

function formatDateTime(isoStr) {
    var d = new Date(isoStr);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var dy = String(d.getDate()).padStart(2, "0");
    var h = String(d.getHours()).padStart(2, "0");
    var mn = String(d.getMinutes()).padStart(2, "0");
    return y + "/" + m + "/" + dy + " " + h + ":" + mn;
}

function start() {
    var cronExpr = "*/" + INTERVAL + " * * * *";
    console.log("[Scheduler] Starting with cron:", cronExpr);
    cron.schedule(cronExpr, function () { aggregateAndSend(); });
    cron.schedule("5 * * * *", function () { console.log("[Scheduler] Retry unsent data..."); sendUnsentData(); });
}

module.exports = { start: start, aggregateAndSend: aggregateAndSend, sendUnsentData: sendUnsentData };
ENDFILE

# --- server/index.js ---
cat > server/index.js << 'ENDFILE'
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
app.use(express.static(path.join(__dirname, "..")));

app.get("/api/devices", function (req, res) {
    var rows = db.prepare("SELECT * FROM devices ORDER BY device_code").all();
    res.json(rows);
});
app.get("/api/devices/:code", function (req, res) {
    var row = db.prepare("SELECT * FROM devices WHERE device_code = ?").get(req.params.code);
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
});
app.post("/api/devices", function (req, res) {
    var b = req.body;
    if (!b.device_code || !b.name) return res.status(400).json({ error: "device_code and name required" });
    if (!/^\d{4}$/.test(b.device_code)) return res.status(400).json({ error: "device_code must be 4 digits" });
    try {
        db.prepare("INSERT INTO devices (device_code, name, type, route, ip, status, firmware) VALUES (?, ?, ?, ?, ?, ?, ?)").run(b.device_code, b.name, b.type || "sensor", b.route || "", b.ip || "", "offline", b.firmware || "");
        res.json({ success: true, device_code: b.device_code });
    } catch (e) {
        if (e.message.indexOf("UNIQUE") !== -1) return res.status(409).json({ error: "duplicate device_code" });
        res.status(500).json({ error: e.message });
    }
});
app.put("/api/devices/:code", function (req, res) {
    var b = req.body;
    db.prepare("UPDATE devices SET name = COALESCE(?, name), type = COALESCE(?, type), route = COALESCE(?, route), ip = COALESCE(?, ip), firmware = COALESCE(?, firmware) WHERE device_code = ?").run(b.name, b.type, b.route, b.ip, b.firmware, req.params.code);
    res.json({ success: true });
});
app.delete("/api/devices/:code", function (req, res) {
    db.prepare("DELETE FROM devices WHERE device_code = ?").run(req.params.code);
    res.json({ success: true });
});

app.post("/api/data", function (req, res) {
    var b = req.body;
    var code = b.device_code;
    if (!code || !/^\d{4}$/.test(code)) return res.status(400).json({ error: "4-digit device_code required" });
    db.prepare("UPDATE devices SET status = 'online', last_seen = datetime('now') WHERE device_code = ?").run(code);
    var insert = db.prepare("INSERT INTO traffic_data (device_code, timestamp, vehicle_class, speed, direction, lane, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?)");
    var count = 0;
    if (b.records && Array.isArray(b.records)) {
        var insertMany = db.transaction(function (records) {
            records.forEach(function (r) {
                insert.run(code, r.timestamp || new Date().toISOString(), r.vehicle_class || 0, r.speed || 0, r.direction || 1, r.lane || 1, JSON.stringify(r));
                count++;
            });
        });
        insertMany(b.records);
    } else {
        insert.run(code, b.timestamp || new Date().toISOString(), b.vehicle_class || 0, b.speed || 0, b.direction || 1, b.lane || 1, JSON.stringify(b));
        count = 1;
    }
    res.json({ success: true, received: count });
});

app.get("/api/stats", function (req, res) {
    var totalDevices = db.prepare("SELECT COUNT(*) as c FROM devices").get().c;
    var onlineDevices = db.prepare("SELECT COUNT(*) as c FROM devices WHERE status = 'online'").get().c;
    var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    var todayVehicles = db.prepare("SELECT COUNT(*) as c FROM traffic_data WHERE timestamp >= ?").get(todayStart.toISOString()).c;
    var todayAvgSpeed = db.prepare("SELECT AVG(speed) as avg FROM traffic_data WHERE timestamp >= ? AND speed > 0").get(todayStart.toISOString()).avg || 0;
    var unsentCount = db.prepare("SELECT COUNT(*) as c FROM rmto_queue WHERE sent = 0").get().c;
    var unsent5Count = db.prepare("SELECT COUNT(*) as c FROM rmto_queue_5class WHERE sent = 0").get().c;
    res.json({ totalDevices: totalDevices, onlineDevices: onlineDevices, todayVehicles: todayVehicles, todayAvgSpeed: Math.round(todayAvgSpeed), unsentRMTO: unsentCount, unsentRMTO5: unsent5Count });
});

app.get("/api/rmto/logs", function (req, res) {
    var limit = parseInt(req.query.limit, 10) || 50;
    res.json(db.prepare("SELECT * FROM send_log ORDER BY created_at DESC LIMIT ?").all(limit));
});
app.post("/api/rmto/send-now", function (req, res) { scheduler.sendUnsentData(); res.json({ success: true }); });
app.post("/api/rmto/aggregate", function (req, res) { scheduler.aggregateAndSend(); res.json({ success: true }); });
app.get("/api/rmto/queue", function (req, res) {
    var unsent = db.prepare("SELECT device_code, period_start, total_vehicles, avg_speed, created_at FROM rmto_queue WHERE sent = 0 ORDER BY period_start DESC LIMIT 100").all();
    var sent = db.prepare("SELECT device_code, period_start, total_vehicles, avg_speed, sent_at, rmto_response FROM rmto_queue WHERE sent = 1 ORDER BY sent_at DESC LIMIT 50").all();
    res.json({ unsent: unsent, sent: sent });
});
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

app.listen(PORT, HOST, function () {
    console.log("TC Manager Server running on http://" + HOST + ":" + PORT);
    rmto.initClient(function (err) { if (err) console.error("[RMTO] Will retry on first send"); });
    scheduler.start();
});
ENDFILE

echo "=== Part 1 done: server files deployed ==="
