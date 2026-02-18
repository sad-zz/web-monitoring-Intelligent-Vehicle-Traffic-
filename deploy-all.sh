#!/bin/bash
# TC Manager - Complete Deployment Script (Sistan Akbari)
# Usage: scp deploy-all.sh root@5.159.49.246:/tmp/ && ssh root@5.159.49.246 bash /tmp/deploy-all.sh
set -e

BASE="/opt/tc-manager"
echo "============================================"
echo "  TC Manager - Full Deployment"
echo "  Target: $BASE"
echo "============================================"

# Create directory structure
mkdir -p "$BASE/server/uploads"
mkdir -p "$BASE/css"
mkdir -p "$BASE/js"
mkdir -p "$BASE/data"

echo "[1/10] Writing server/package.json ..."
cat > "$BASE/server/package.json" << 'ENDFILE'
{
  "name": "tc-manager-server",
  "version": "1.0.0",
  "description": "TC Manager - Backend server for traffic device data collection and RMTO integration",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "better-sqlite3": "^9.4.3",
    "soap": "^1.0.0",
    "node-cron": "^3.0.3",
    "dotenv": "^16.4.1",
    "express-session": "^1.17.3",
    "multer": "^1.4.5-lts.1",
    "bcryptjs": "^2.4.3"
  }
}
ENDFILE

echo "[2/10] Writing server/.env.example ..."
cat > "$BASE/server/.env.example" << 'ENDFILE'
# Server
PORT=3000
HOST=0.0.0.0

# RMTO (OTF) SOAP Web Service
RMTO_WSDL=http://otf.rmto.ir/Companies/Companies.asmx?WSDL
RMTO_ENDPOINT=http://otf.rmto.ir/Companies/Companies.asmx
RMTO_COMPANY_CODE=58
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=CHANGE_ME_HERE

# Data send interval (minutes)
SEND_INTERVAL_MINUTES=15
ENDFILE

echo "[3/10] Writing server/db.js ..."
cat > "$BASE/server/db.js" << 'ENDFILE'
/**
 * Database module - SQLite via better-sqlite3
 * Stores devices, traffic data, and send logs.
 */
var Database = require("better-sqlite3");
var path = require("path");

var DB_PATH = path.join(__dirname, "data.db");
var db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// --- Schema ---
db.exec([
    // Devices: each has a unique 4-digit code
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

    // Raw traffic data received from devices
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

    // Aggregated 15-minute data for RMTO (AddData - simple)
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

    // 5-class data for RMTO (AddData5)
    "CREATE TABLE IF NOT EXISTS rmto_queue_5class (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  device_code TEXT NOT NULL,",
    "  period_start TEXT NOT NULL,",
    "  period_end TEXT NOT NULL,",
    "  -- Volume classes (5 classes by vehicle size)",
    "  class1_count INTEGER DEFAULT 0,",
    "  class2_count INTEGER DEFAULT 0,",
    "  class3_count INTEGER DEFAULT 0,",
    "  class4_count INTEGER DEFAULT 0,",
    "  class5_count INTEGER DEFAULT 0,",
    "  -- Speed classes (5 classes by speed range)",
    "  speed1_count INTEGER DEFAULT 0,",
    "  speed2_count INTEGER DEFAULT 0,",
    "  speed3_count INTEGER DEFAULT 0,",
    "  speed4_count INTEGER DEFAULT 0,",
    "  speed5_count INTEGER DEFAULT 0,",
    "  -- Violation count",
    "  violations INTEGER DEFAULT 0,",
    "  avg_speed REAL DEFAULT 0,",
    "  sent INTEGER DEFAULT 0,",
    "  sent_at TEXT,",
    "  rmto_response TEXT,",
    "  created_at TEXT DEFAULT (datetime('now'))",
    ");",

    // 8-class data for RMTO (AddData8)
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

    // Send log for auditing
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

    // Indexes
    "CREATE INDEX IF NOT EXISTS idx_traffic_device ON traffic_data(device_code);",
    "CREATE INDEX IF NOT EXISTS idx_traffic_time ON traffic_data(timestamp);",
    "CREATE INDEX IF NOT EXISTS idx_rmto_unsent ON rmto_queue(sent, device_code);",
    "CREATE INDEX IF NOT EXISTS idx_rmto5_unsent ON rmto_queue_5class(sent, device_code);",
    "CREATE INDEX IF NOT EXISTS idx_rmto8_unsent ON rmto_queue_8class(sent, device_code);",

    // irawdata table - matches iccore device_irawdata format
    "CREATE TABLE IF NOT EXISTS irawdata (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  device_code TEXT NOT NULL,",
    "  create_at TEXT NOT NULL,",
    "  stop TEXT NOT NULL,",
    "  lane INTEGER DEFAULT 1,",
    "  is_read INTEGER DEFAULT 0,",
    "  a INTEGER DEFAULT 0,",
    "  b INTEGER DEFAULT 0,",
    "  c INTEGER DEFAULT 0,",
    "  d INTEGER DEFAULT 0,",
    "  e INTEGER DEFAULT 0,",
    "  x INTEGER DEFAULT 0,",
    "  sa INTEGER DEFAULT 0,",
    "  sb INTEGER DEFAULT 0,",
    "  sc INTEGER DEFAULT 0,",
    "  sd INTEGER DEFAULT 0,",
    "  se INTEGER DEFAULT 0,",
    "  sx INTEGER DEFAULT 0,",
    "  sao INTEGER DEFAULT 0,",
    "  sbo INTEGER DEFAULT 0,",
    "  sco INTEGER DEFAULT 0,",
    "  sdo INTEGER DEFAULT 0,",
    "  seo INTEGER DEFAULT 0,",
    "  sxo INTEGER DEFAULT 0,",
    "  overtaking INTEGER DEFAULT 0,",
    "  tooclose INTEGER DEFAULT 0,",
    "  received_at TEXT DEFAULT (datetime('now'))",
    ");",

    // Mehvar (routes) table
    "CREATE TABLE IF NOT EXISTS mehvar (",
    "  code INTEGER PRIMARY KEY,",
    "  name TEXT NOT NULL,",
    "  send_enable INTEGER DEFAULT 1,",
    "  repair INTEGER DEFAULT 0,",
    "  ostan TEXT",
    ");",

    "CREATE INDEX IF NOT EXISTS idx_irawdata_device ON irawdata(device_code);",
    "CREATE INDEX IF NOT EXISTS idx_irawdata_time ON irawdata(create_at);",
    "CREATE INDEX IF NOT EXISTS idx_irawdata_read ON irawdata(is_read);"
].join("\n"));

module.exports = db;
ENDFILE

echo "[4/10] Writing server/rmto-client.js ..."
cat > "$BASE/server/rmto-client.js" << 'ENDFILE'
/**
 * RMTO SOAP Client
 * Sends traffic data to otf.rmto.ir/Companies/Companies.asmx
 */
var soap = require("soap");

var WSDL_URL = process.env.RMTO_WSDL || "http://otf.rmto.ir/Companies/Companies.asmx?WSDL";
var COMPANY_CODE = process.env.RMTO_COMPANY_CODE || "58";
var USERNAME = process.env.RMTO_USERNAME || "";
var PASSWORD = process.env.RMTO_PASSWORD || "";

var soapClient = null;

function initClient(callback) {
    if (soapClient) return callback(null, soapClient);
    soap.createClient(WSDL_URL, function (err, client) {
        if (err) {
            console.error("[RMTO] Failed to create SOAP client:", err.message);
            return callback(err);
        }
        soapClient = client;
        console.log("[RMTO] SOAP client initialized");
        console.log("[RMTO] Available methods:", Object.keys(client.describe().CompanySoap || {}));
        callback(null, client);
    });
}

function sendAddData(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);
        var args = {
            CompanyCode: COMPANY_CODE, UserName: USERNAME, Password: PASSWORD,
            StationCode: data.deviceCode, DateTime: data.dateTime,
            Count: data.totalCount, Speed: Math.round(data.avgSpeed)
        };
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
        var args = {
            CompanyCode: COMPANY_CODE, UserName: USERNAME, Password: PASSWORD,
            StationCode: data.deviceCode, DateTime: data.dateTime,
            C1: data.class1Count || 0, C2: data.class2Count || 0, C3: data.class3Count || 0,
            C4: data.class4Count || 0, C5: data.class5Count || 0,
            S1: data.speed1Count || 0, S2: data.speed2Count || 0, S3: data.speed3Count || 0,
            S4: data.speed4Count || 0, S5: data.speed5Count || 0,
            Violation: data.violations || 0, Speed: Math.round(data.avgSpeed || 0)
        };
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
        var args = {
            CompanyCode: COMPANY_CODE, UserName: USERNAME, Password: PASSWORD,
            StationCode: data.deviceCode, DateTime: data.dateTime,
            C1: data.class1Count || 0, C2: data.class2Count || 0, C3: data.class3Count || 0,
            C4: data.class4Count || 0, C5: data.class5Count || 0, C6: data.class6Count || 0,
            C7: data.class7Count || 0, C8: data.class8Count || 0,
            S1: data.speed1Count || 0, S2: data.speed2Count || 0, S3: data.speed3Count || 0,
            S4: data.speed4Count || 0, S5: data.speed5Count || 0, S6: data.speed6Count || 0,
            S7: data.speed7Count || 0, S8: data.speed8Count || 0,
            Violation: data.violations || 0, Speed: Math.round(data.avgSpeed || 0)
        };
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

module.exports = {
    initClient: initClient,
    sendAddData: sendAddData,
    sendAddData5: sendAddData5,
    sendAddData8: sendAddData8
};
ENDFILE

echo "[5/10] Writing server/scheduler.js ..."
cat > "$BASE/server/scheduler.js" << 'ENDFILE'
/**
 * Scheduler - Aggregates traffic data every 15 minutes and sends to RMTO.
 */
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
        db.prepare(
            "INSERT INTO rmto_queue (device_code, period_start, period_end, total_vehicles, avg_speed) VALUES (?, ?, ?, ?, ?)"
        ).run(code, startStr, endStr, agg.total, Math.round(agg.avg_speed || 0));
        db.prepare(
            "INSERT INTO rmto_queue_5class (device_code, period_start, period_end, " +
            "class1_count, class2_count, class3_count, class4_count, class5_count, " +
            "speed1_count, speed2_count, speed3_count, speed4_count, speed5_count, " +
            "violations, avg_speed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(code, startStr, endStr, agg.c1, agg.c2, agg.c3, agg.c4, agg.c5,
            agg.s1, agg.s2, agg.s3, agg.s4, agg.s5, agg.violations, Math.round(agg.avg_speed || 0));
    });
    sendUnsentData();
}

function sendUnsentData() {
    var unsent = db.prepare("SELECT * FROM rmto_queue WHERE sent = 0 ORDER BY period_start LIMIT 50").all();
    unsent.forEach(function (row) {
        var dt = formatDateTime(row.period_start);
        rmto.sendAddData({
            deviceCode: row.device_code, dateTime: dt,
            totalCount: row.total_vehicles, avgSpeed: row.avg_speed
        }, function (err, response) {
            var success = !err && response;
            db.prepare("UPDATE rmto_queue SET sent = ?, sent_at = datetime('now'), rmto_response = ? WHERE id = ?")
                .run(success ? 1 : 0, JSON.stringify(response || (err && err.message)), row.id);
            db.prepare("INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message) VALUES (?, ?, ?, ?, ?, ?)")
                .run("AddData", row.device_code, JSON.stringify(row), JSON.stringify(response), success ? 1 : 0, err ? err.message : null);
        });
    });

    var unsent5 = db.prepare("SELECT * FROM rmto_queue_5class WHERE sent = 0 ORDER BY period_start LIMIT 50").all();
    unsent5.forEach(function (row) {
        var dt = formatDateTime(row.period_start);
        rmto.sendAddData5({
            deviceCode: row.device_code, dateTime: dt,
            class1Count: row.class1_count, class2Count: row.class2_count,
            class3Count: row.class3_count, class4Count: row.class4_count, class5Count: row.class5_count,
            speed1Count: row.speed1_count, speed2Count: row.speed2_count,
            speed3Count: row.speed3_count, speed4Count: row.speed4_count, speed5Count: row.speed5_count,
            violations: row.violations, avgSpeed: row.avg_speed
        }, function (err, response) {
            var success = !err && response;
            db.prepare("UPDATE rmto_queue_5class SET sent = ?, sent_at = datetime('now'), rmto_response = ? WHERE id = ?")
                .run(success ? 1 : 0, JSON.stringify(response || (err && err.message)), row.id);
            db.prepare("INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message) VALUES (?, ?, ?, ?, ?, ?)")
                .run("AddData5", row.device_code, JSON.stringify(row), JSON.stringify(response), success ? 1 : 0, err ? err.message : null);
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
    cron.schedule("5 * * * *", function () {
        console.log("[Scheduler] Retry unsent data...");
        sendUnsentData();
    });
}

module.exports = { start: start, aggregateAndSend: aggregateAndSend, sendUnsentData: sendUnsentData };
ENDFILE

echo "[6/10] Writing server/index.js ..."
cat > "$BASE/server/index.js" << 'ENDFILE'
/**
 * TC Manager Server (Sistan Akbari)
 * - Login authentication
 * - Backup / Restore
 * - Receives data from 100+ devices
 * - Aggregates and sends to RMTO via SOAP
 */
require("dotenv").config();

var express = require("express");
var cors = require("cors");
var path = require("path");
var fs = require("fs");
var crypto = require("crypto");
var session = require("express-session");
var multer = require("multer");
var bcrypt = require("bcryptjs");
var db = require("./db");
var rmto = require("./rmto-client");
var scheduler = require("./scheduler");

var app = express();
var PORT = process.env.PORT || 3000;
var HOST = process.env.HOST || "0.0.0.0";

// --- Session & Auth Setup ---
var SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
var ADMIN_USER = process.env.ADMIN_USER || "admin";
var ADMIN_PASS_HASH = null;

// Initialize admin password
(function initAdmin() {
    db.exec([
        "CREATE TABLE IF NOT EXISTS users (",
        "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
        "  username TEXT NOT NULL UNIQUE,",
        "  password_hash TEXT NOT NULL,",
        "  role TEXT DEFAULT 'admin',",
        "  created_at TEXT DEFAULT (datetime('now'))",
        ");"
    ].join("\n"));

    var admin = db.prepare("SELECT * FROM users WHERE username = ?").get(ADMIN_USER);
    if (!admin) {
        var defaultPass = process.env.ADMIN_PASS || "admin123";
        var hash = bcrypt.hashSync(defaultPass, 10);
        db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run(ADMIN_USER, hash, "admin");
        console.log("[Auth] Default admin user created (user: " + ADMIN_USER + ", pass: " + defaultPass + ")");
    }
})();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

var upload = multer({ dest: path.join(__dirname, "uploads/"), limits: { fileSize: 500 * 1024 * 1024 } });

function requireAuth(req, res, next) {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ error: "unauthorized" });
}

// ============================================================
// Auth API
// ============================================================
app.post("/api/auth/login", function (req, res) {
    var username = (req.body.username || "").trim();
    var password = req.body.password || "";
    var user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: "نام کاربری یا رمز عبور اشتباه است" });
    }
    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.json({ success: true, username: user.username, role: user.role });
});

app.post("/api/auth/logout", function (req, res) {
    req.session.destroy();
    res.json({ success: true });
});

app.get("/api/auth/check", function (req, res) {
    if (req.session && req.session.user) {
        return res.json({ loggedIn: true, username: req.session.user.username, role: req.session.user.role });
    }
    res.json({ loggedIn: false });
});

app.post("/api/auth/change-password", requireAuth, function (req, res) {
    var oldPass = req.body.old_password || "";
    var newPass = req.body.new_password || "";
    if (newPass.length < 4) return res.status(400).json({ error: "رمز عبور باید حداقل ۴ کاراکتر باشد" });
    var user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.user.id);
    if (!bcrypt.compareSync(oldPass, user.password_hash)) {
        return res.status(401).json({ error: "رمز عبور فعلی اشتباه است" });
    }
    var hash = bcrypt.hashSync(newPass, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id);
    res.json({ success: true });
});

// ============================================================
// Serve Frontend
// ============================================================
app.use(express.static(path.join(__dirname, "..")));

// ============================================================
// Device data reception - NO AUTH (devices send data here)
// ============================================================
app.post("/api/data", function (req, res) {
    var b = req.body;
    var code = String(b.device_code || b.device_id || b.code || "");
    if (!code || !/^\d+$/.test(code)) {
        return res.status(400).json({ error: "device_code required" });
    }
    autoRegisterDevice(code);

    var insert = db.prepare(
        "INSERT INTO traffic_data (device_code, timestamp, vehicle_class, speed, direction, lane, raw_payload) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
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

/**
 * POST /api/irawdata - iccore format (5-class vehicle + speed)
 */
app.post("/api/irawdata", function (req, res) {
    var b = req.body;
    var code = String(b.device_id || b.device_code || b.code || "");
    if (!code || !/^\d+$/.test(code)) return res.status(400).json({ error: "device_id required" });
    autoRegisterDevice(code);

    var insertRaw = db.prepare(
        "INSERT INTO irawdata (device_code, create_at, stop, lane, is_read, a,b,c,d,e,x, sa,sb,sc,sd,se,sx, sao,sbo,sco,sdo,seo,sxo, overtaking, tooclose) " +
        "VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    var insertTraffic = db.prepare(
        "INSERT INTO traffic_data (device_code, timestamp, vehicle_class, speed, direction, lane, raw_payload) VALUES (?, ?, ?, ?, 1, ?, ?)"
    );

    var count = 0;
    function insertOne(r) {
        var now = new Date().toISOString();
        var ca = r.create_at || r.start || now;
        var st = r.stop || r.end || now;
        var ln = r.lane || 1;
        insertRaw.run(code, ca, st, ln, r.a||0, r.b||0, r.c||0, r.d||0, r.e||0, r.x||0, r.sa||0, r.sb||0, r.sc||0, r.sd||0, r.se||0, r.sx||0, r.sao||0, r.sbo||0, r.sco||0, r.sdo||0, r.seo||0, r.sxo||0, r.overtaking||0, r.tooclose||0);
        count++;
        var classes = [{cls:1,n:r.a||0,s:r.sa||0},{cls:2,n:r.b||0,s:r.sb||0},{cls:3,n:r.c||0,s:r.sc||0},{cls:4,n:r.d||0,s:r.sd||0},{cls:5,n:r.e||0,s:r.se||0}];
        classes.forEach(function(c){ if(c.n>0) insertTraffic.run(code, ca, c.cls, c.s/c.n, ln, JSON.stringify(r)); });
    }

    if (b.records && Array.isArray(b.records)) {
        db.transaction(function(recs){ recs.forEach(insertOne); })(b.records);
    } else {
        insertOne(b);
    }
    res.json({ success: true, received: count });
});

function autoRegisterDevice(code) {
    var existing = db.prepare("SELECT device_code FROM devices WHERE device_code = ?").get(code);
    if (!existing) {
        try { db.prepare("INSERT INTO devices (device_code, name, type, status) VALUES (?, ?, 'sensor', 'online')").run(code, "Device " + code); } catch(e){}
    }
    db.prepare("UPDATE devices SET status = 'online', last_seen = datetime('now') WHERE device_code = ?").run(code);
}

// ============================================================
// All API below requires authentication
// ============================================================
app.use("/api/devices", requireAuth);
app.use("/api/stats", requireAuth);
app.use("/api/rmto", requireAuth);
app.use("/api/traffic", requireAuth);
app.use("/api/backup", requireAuth);

// ============================================================
// API: Device Management
// ============================================================
app.get("/api/devices", function (req, res) {
    res.json(db.prepare("SELECT * FROM devices ORDER BY device_code").all());
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

// ============================================================
// API: Dashboard Stats
// ============================================================
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

// ============================================================
// API: RMTO
// ============================================================
app.get("/api/rmto/logs", function (req, res) {
    var limit = parseInt(req.query.limit, 10) || 50;
    res.json(db.prepare("SELECT * FROM send_log ORDER BY created_at DESC LIMIT ?").all(limit));
});

app.post("/api/rmto/send-now", function (req, res) {
    scheduler.sendUnsentData();
    res.json({ success: true });
});

app.post("/api/rmto/aggregate", function (req, res) {
    scheduler.aggregateAndSend();
    res.json({ success: true });
});

app.get("/api/rmto/queue", function (req, res) {
    var unsent = db.prepare("SELECT device_code, period_start, total_vehicles, avg_speed, created_at FROM rmto_queue WHERE sent = 0 ORDER BY period_start DESC LIMIT 100").all();
    var sent = db.prepare("SELECT device_code, period_start, total_vehicles, avg_speed, sent_at, rmto_response FROM rmto_queue WHERE sent = 1 ORDER BY sent_at DESC LIMIT 50").all();
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
// API: Backup & Restore
// ============================================================
app.get("/api/backup/download", function (req, res) {
    var dbPath = path.join(__dirname, "data.db");
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: "database not found" });
    try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch (e) { /* ok */ }
    var timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    var filename = "tc-manager-backup-" + timestamp + ".db";
    res.download(dbPath, filename);
});

app.post("/api/backup/restore", upload.single("backup"), function (req, res) {
    if (!req.file) return res.status(400).json({ error: "فایل بکاپ الزامی است" });
    var tmpPath = req.file.path;
    var origName = req.file.originalname || "";
    var dbPath = path.join(__dirname, "data.db");
    try {
        if (origName.endsWith(".db")) {
            db.pragma("wal_checkpoint(TRUNCATE)");
            db.close();
            fs.copyFileSync(tmpPath, dbPath);
            delete require.cache[require.resolve("./db")];
            res.json({ success: true, message: "بازیابی انجام شد. سرویس باید ریستارت شود." });
        } else if (origName.endsWith(".sql.gz") || origName.endsWith(".gz")) {
            var destPath = path.join(__dirname, "uploads", origName);
            fs.renameSync(tmpPath, destPath);
            res.json({ success: true, message: "فایل آپلود شد: " + origName + " - نیاز به پردازش دستی دارد.", path: destPath });
        } else if (origName.endsWith(".sql")) {
            var destPath2 = path.join(__dirname, "uploads", origName);
            fs.renameSync(tmpPath, destPath2);
            res.json({ success: true, message: "فایل SQL آپلود شد: " + origName, path: destPath2 });
        } else {
            fs.unlinkSync(tmpPath);
            return res.status(400).json({ error: "فرمت فایل پشتیبانی نمی‌شود. از .db یا .sql.gz استفاده کنید" });
        }
    } catch (e) {
        res.status(500).json({ error: "خطا در بازیابی: " + e.message });
    }
});

app.get("/api/backup/list", function (req, res) {
    var uploadsDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadsDir)) { fs.mkdirSync(uploadsDir, { recursive: true }); return res.json([]); }
    var files = fs.readdirSync(uploadsDir).filter(function (f) {
        return f.endsWith(".db") || f.endsWith(".sql") || f.endsWith(".gz");
    }).map(function (f) {
        var stat = fs.statSync(path.join(uploadsDir, f));
        return { name: f, size: stat.size, date: stat.mtime.toISOString() };
    });
    res.json(files);
});

// ============================================================
// Start Server
// ============================================================
app.listen(PORT, HOST, function () {
    console.log("============================================");
    console.log("  TC Manager Server (Sistan Akbari)");
    console.log("  http://" + HOST + ":" + PORT);
    console.log("  Default login: admin / admin123");
    console.log("============================================");
    rmto.initClient(function (err) {
        if (err) console.error("[RMTO] Will retry on first send");
    });
    scheduler.start();
});
ENDFILE

echo "[7/10] Writing index.html ..."
cat > "$BASE/index.html" << 'ENDHTML'
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>سامانه سیستان اکبری - مدیریت ترافیک هوشمند</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>

    <!-- Login Page -->
    <div class="login-overlay" id="login-overlay">
        <div class="login-box">
            <div class="login-logo">
                <div class="logo-icon" style="width:56px;height:56px;font-size:22px;margin:0 auto 12px">TC</div>
                <h2>سیستان اکبری</h2>
                <p>سامانه مدیریت ترافیک هوشمند</p>
            </div>
            <form id="login-form">
                <div class="form-group">
                    <label>نام کاربری</label>
                    <input type="text" id="login-user" required dir="ltr" autocomplete="username">
                </div>
                <div class="form-group">
                    <label>رمز عبور</label>
                    <input type="password" id="login-pass" required dir="ltr" autocomplete="current-password">
                </div>
                <div id="login-error" style="color:#ef4444;font-size:13px;margin-bottom:12px;display:none"></div>
                <button type="submit" class="btn btn-primary" style="width:100%;padding:12px;font-size:15px">ورود</button>
            </form>
        </div>
    </div>

    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <div class="sidebar-logo">
                <div class="logo-icon">TC</div>
                <div class="logo-text">
                    <span class="logo-title">سیستان اکبری</span>
                    <span class="logo-sub">سامانه مدیریت ترافیک</span>
                </div>
            </div>
        </div>
        <nav class="sidebar-nav">
            <button class="nav-item active" data-view="home">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1a1 1 0 0 0 .7-1.7l-9-9a1 1 0 0 0-1.4 0l-9 9A1 1 0 0 0 3 13zm7 7v-5h4v5h-4zm2-15.6 7 7V20h-3v-5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v5H5v-8.6l7-7z"/></svg>
                <span>خانه</span>
            </button>
            <button class="nav-item" data-view="routes">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M19 15l-6 6-1.4-1.4L15.2 16H4v-2h11.2l-3.6-3.6L13 9l6 6zM5 9l6-6 1.4 1.4L8.8 8H20v2H8.8l3.6 3.6L11 15 5 9z"/></svg>
                <span>محورها</span>
            </button>
            <button class="nav-item" data-view="devices">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/></svg>
                <span>دستگاه‌ها</span>
            </button>
            <button class="nav-item" data-view="reports">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/></svg>
                <span>گزارشات</span>
            </button>
            <button class="nav-item" data-view="settings">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>
                <span>تنظیمات</span>
            </button>
        </nav>
        <div class="sidebar-footer">
            <div class="sidebar-user">
                <div class="user-avatar">ا</div>
                <div class="user-info">
                    <span class="user-name">اپراتور سیستم</span>
                    <span class="user-role">مدیر</span>
                </div>
            </div>
        </div>
    </aside>

    <!-- Main -->
    <div class="main-wrapper">
        <header class="topbar">
            <button class="topbar-toggle" id="sidebar-toggle">
                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            </button>
            <div class="topbar-title" id="topbar-title">خانه</div>
            <div class="topbar-left">
                <span class="topbar-time" id="topbar-time"></span>
                <span class="topbar-badge online">متصل</span>
                <span class="topbar-user-name" id="topbar-user" style="font-size:12px;color:#64748b"></span>
            </div>
        </header>

        <main class="content">
            <!-- UI1: Home -->
            <section class="view active" id="view-home">
                <div class="stats-row">
                    <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg></div><div class="stat-body"><div class="stat-value" id="stat-total-vehicles">0</div><div class="stat-label">کل خودروهای عبوری</div></div></div>
                    <div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24"><path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/></svg></div><div class="stat-body"><div class="stat-value" id="stat-avg-speed">0</div><div class="stat-label">سرعت متوسط (km/h)</div></div></div>
                    <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24"><path d="M23 8c0 1.1-.9 2-2 2-.18 0-.35-.02-.51-.07l-3.56 3.55c.05.16.07.34.07.52 0 1.1-.9 2-2 2s-2-.9-2-2c0-.18.02-.36.07-.52l-2.55-2.55c-.16.05-.34.07-.52.07s-.36-.02-.52-.07l-4.55 4.56c.05.16.07.33.07.51 0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2c.18 0 .35.02.51.07l4.56-4.55C8.02 9.36 8 9.18 8 9c0-1.1.9-2 2-2s2 .9 2 2c0 .18-.02.36-.07.52l2.55 2.55c.16-.05.34-.07.52-.07s.36.02.52.07l3.55-3.56C19.02 8.35 19 8.18 19 8c0-1.1.9-2 2-2s2 .9 2 2z"/></svg></div><div class="stat-body"><div class="stat-value" id="stat-active-routes">0</div><div class="stat-label">محورهای فعال</div></div></div>
                    <div class="stat-card"><div class="stat-icon red"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div><div class="stat-body"><div class="stat-value" id="stat-errors">0</div><div class="stat-label">خطاها</div></div></div>
                </div>
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">آخرین اطلاعات</h3>
                        <div class="panel-tools">
                            <div class="export-btns">
                                <button class="export-btn" data-action="copy">کپی</button>
                                <button class="export-btn" data-action="csv">CSV</button>
                                <button class="export-btn" data-action="excel">اکسل</button>
                                <button class="export-btn" data-action="pdf">PDF</button>
                                <button class="export-btn" data-action="print">چاپ</button>
                            </div>
                            <div class="search-box"><label>جستجو:</label><input type="text" id="home-search" class="search-input" placeholder=""></div>
                        </div>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table" id="home-table">
                            <thead><tr><th data-sort="name">نام محور</th><th data-sort="lastUpdate">آخرین اطلاعات</th><th data-sort="totalVehicles">کل خودروهای عبوری</th><th data-sort="avgSpeed">سرعت متوسط کل</th><th data-sort="errors">خطا</th></tr></thead>
                            <tbody id="home-table-body"></tbody>
                        </table>
                    </div>
                    <div class="table-footer"><div class="table-info" id="home-table-info"></div><div class="pagination" id="home-pagination"></div></div>
                </div>
            </section>

            <!-- UI2: Routes -->
            <section class="view" id="view-routes">
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">مدیریت محورها</h3>
                        <div class="panel-tools"><button class="btn btn-primary" id="btn-add-route">+ محور جدید</button><div class="search-box"><label>جستجو:</label><input type="text" id="routes-search" class="search-input"></div></div>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table" id="routes-table">
                            <thead><tr><th>ردیف</th><th data-sort="name">نام محور</th><th data-sort="origin">مبدأ</th><th data-sort="destination">مقصد</th><th data-sort="length">طول (km)</th><th data-sort="deviceCount">تعداد دستگاه</th><th data-sort="status">وضعیت</th><th>عملیات</th></tr></thead>
                            <tbody id="routes-table-body"></tbody>
                        </table>
                    </div>
                    <div class="table-footer"><div class="table-info" id="routes-table-info"></div><div class="pagination" id="routes-pagination"></div></div>
                </div>
            </section>

            <!-- UI3: Devices -->
            <section class="view" id="view-devices">
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">مدیریت دستگاه‌ها</h3>
                        <div class="panel-tools"><button class="btn btn-primary" id="btn-add-device">+ دستگاه جدید</button><div class="export-btns"><button class="export-btn" data-action="csv" data-target="devices">CSV</button><button class="export-btn" data-action="excel" data-target="devices">اکسل</button></div><div class="search-box"><label>جستجو:</label><input type="text" id="devices-search" class="search-input"></div></div>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table" id="devices-table">
                            <thead><tr><th>ردیف</th><th data-sort="deviceCode">کد دستگاه</th><th data-sort="name">نام دستگاه</th><th data-sort="type">نوع</th><th data-sort="route">محور</th><th data-sort="ip">آدرس IP</th><th data-sort="status">وضعیت</th><th data-sort="lastSeen">آخرین اتصال</th><th>عملیات</th></tr></thead>
                            <tbody id="devices-table-body"></tbody>
                        </table>
                    </div>
                    <div class="table-footer"><div class="table-info" id="devices-table-info"></div><div class="pagination" id="devices-pagination"></div></div>
                </div>
            </section>

            <!-- UI4: Reports -->
            <section class="view" id="view-reports">
                <div class="report-filters">
                    <div class="filter-group"><label>محور:</label><select id="report-route"><option value="">همه محورها</option></select></div>
                    <div class="filter-group"><label>از تاریخ:</label><input type="date" id="report-from"></div>
                    <div class="filter-group"><label>تا تاریخ:</label><input type="date" id="report-to"></div>
                    <button class="btn btn-primary" id="btn-generate-report">نمایش گزارش</button>
                </div>
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">گزارش ترافیک</h3>
                        <div class="panel-tools"><div class="export-btns"><button class="export-btn" data-action="csv" data-target="report">CSV</button><button class="export-btn" data-action="excel" data-target="report">اکسل</button><button class="export-btn" data-action="pdf" data-target="report">PDF</button><button class="export-btn" data-action="print" data-target="report">چاپ</button></div></div>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table" id="report-table">
                            <thead><tr><th>تاریخ</th><th>محور</th><th>تعداد خودرو</th><th>سرعت متوسط</th><th>حداکثر سرعت</th><th>تخلفات</th></tr></thead>
                            <tbody id="report-table-body"></tbody>
                        </table>
                    </div>
                    <div class="table-footer"><div class="table-info" id="report-table-info"></div><div class="pagination" id="report-pagination"></div></div>
                </div>
            </section>

            <!-- UI5: Settings -->
            <section class="view" id="view-settings">
                <div class="settings-grid">
                    <div class="panel"><div class="panel-header"><h3 class="panel-title">تنظیمات عمومی</h3></div><div class="panel-body"><div class="form-group"><label>نام سامانه</label><input type="text" id="setting-name" value="سیستان اکبری"></div><div class="form-group"><label>آدرس سرور</label><input type="text" id="setting-server" value="192.168.1.1" dir="ltr"></div><div class="form-group"><label>زمان بروزرسانی (ثانیه)</label><input type="number" id="setting-refresh" value="30" dir="ltr"></div><div class="form-group"><label>حداکثر سرعت مجاز (km/h)</label><input type="number" id="setting-max-speed" value="120" dir="ltr"></div><button class="btn btn-primary" id="btn-save-settings">ذخیره تنظیمات</button></div></div>
                    <div class="panel"><div class="panel-header"><h3 class="panel-title">تنظیمات هشدار</h3></div><div class="panel-body"><div class="form-group"><label class="toggle-label"><input type="checkbox" id="setting-alert-offline" checked><span>هشدار قطع ارتباط دستگاه</span></label></div><div class="form-group"><label class="toggle-label"><input type="checkbox" id="setting-alert-speed" checked><span>هشدار سرعت غیرمجاز</span></label></div><div class="form-group"><label class="toggle-label"><input type="checkbox" id="setting-alert-error" checked><span>هشدار خطای دستگاه</span></label></div><div class="form-group"><label>حداکثر زمان قطعی (دقیقه)</label><input type="number" id="setting-timeout" value="5" dir="ltr"></div><button class="btn btn-primary" id="btn-save-alerts">ذخیره تنظیمات</button></div></div>
                    <div class="panel"><div class="panel-header"><h3 class="panel-title">تغییر رمز عبور</h3></div><div class="panel-body"><div class="form-group"><label>رمز عبور فعلی</label><input type="password" id="setting-old-pass" dir="ltr"></div><div class="form-group"><label>رمز عبور جدید</label><input type="password" id="setting-new-pass" dir="ltr"></div><button class="btn btn-primary" id="btn-change-pass">تغییر رمز</button><button class="btn btn-danger" id="btn-logout" style="margin-right:8px">خروج از حساب</button></div></div>
                    <div class="panel"><div class="panel-header"><h3 class="panel-title">پشتیبان‌گیری و بازیابی</h3></div><div class="panel-body"><div class="form-group"><button class="btn btn-primary" id="btn-backup-download">دانلود پشتیبان دیتابیس</button></div><div class="form-group"><label>بازیابی از فایل (.db یا .sql.gz)</label><input type="file" id="backup-file" accept=".db,.sql,.gz,.sql.gz" style="margin-top:6px"></div><button class="btn btn-danger" id="btn-backup-restore">آپلود و بازیابی</button><div id="backup-status" style="margin-top:12px;font-size:13px;color:#475569"></div></div></div>
                    <div class="panel"><div class="panel-header"><h3 class="panel-title">درباره سامانه</h3></div><div class="panel-body about-info"><p><strong>سامانه سیستان اکبری</strong></p><p>نسخه: <span dir="ltr">1.1.0</span></p><p>سامانه مدیریت و پایش ترافیک هوشمند</p><p>مدیریت دستگاه‌های کنترل ترافیک شامل دوربین، سنسور، چراغ راهنمایی و کنترلر</p></div></div>
                </div>
            </section>
        </main>

        <footer class="footer">
            <div class="footer-right">سامانه سیستان اکبری - مدیریت ترافیک هوشمند &copy; ۱۴۰۴</div>
            <div class="footer-left"><span class="footer-status" id="footer-device-count">0 دستگاه فعال</span></div>
        </footer>
    </div>

    <!-- Modals -->
    <div class="modal-overlay" id="modal-overlay"><div class="modal"><div class="modal-header"><h3 id="modal-title">جزئیات</h3><button class="modal-close" id="modal-close">&times;</button></div><div class="modal-body" id="modal-body"></div><div class="modal-footer" id="modal-footer"><button class="btn btn-secondary" id="modal-cancel">بستن</button><button class="btn btn-primary" id="modal-save" style="display:none;">ذخیره</button></div></div></div>
    <div class="modal-overlay" id="add-modal-overlay"><div class="modal"><div class="modal-header"><h3 id="add-modal-title">افزودن</h3><button class="modal-close" id="add-modal-close">&times;</button></div><div class="modal-body" id="add-modal-body"></div><div class="modal-footer"><button class="btn btn-secondary" id="add-modal-cancel">انصراف</button><button class="btn btn-primary" id="add-modal-save">ذخیره</button></div></div></div>

    <script src="data/devices.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
ENDHTML

echo "[8/10] Writing css/style.css ..."
cat > "$BASE/css/style.css" << 'ENDCSS'
/* === Reset === */
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
:root {
    --sidebar-w: 240px; --sidebar-bg: #1e293b; --sidebar-active: #3b82f6;
    --topbar-h: 56px; --footer-h: 40px; --bg: #f1f5f9; --white: #ffffff;
    --border: #e2e8f0; --text: #334155; --text-light: #94a3b8;
    --primary: #3b82f6; --primary-dark: #2563eb; --success: #22c55e;
    --warning: #f59e0b; --error: #ef4444; --radius: 8px;
    --shadow: 0 1px 3px rgba(0,0,0,.08); --shadow-md: 0 4px 12px rgba(0,0,0,.1);
}
body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; background: var(--bg); color: var(--text); direction: rtl; display: flex; min-height: 100vh; }
.sidebar { width: var(--sidebar-w); background: var(--sidebar-bg); color: #cbd5e1; display: flex; flex-direction: column; position: fixed; top: 0; right: 0; bottom: 0; z-index: 100; transition: transform .25s; }
.sidebar-header { padding: 20px 16px; border-bottom: 1px solid rgba(255,255,255,.08); }
.sidebar-logo { display: flex; align-items: center; gap: 12px; }
.logo-icon { width: 42px; height: 42px; background: var(--primary); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; color: white; letter-spacing: -1px; }
.logo-text { display: flex; flex-direction: column; }
.logo-title { font-size: 18px; font-weight: 700; color: white; }
.logo-sub { font-size: 11px; color: #64748b; }
.sidebar-nav { flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; }
.nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border: none; background: none; border-radius: var(--radius); color: #94a3b8; font-size: 14px; cursor: pointer; text-align: right; width: 100%; transition: all .15s; font-family: inherit; }
.nav-item:hover { background: rgba(255,255,255,.06); color: #e2e8f0; }
.nav-item.active { background: var(--sidebar-active); color: white; }
.nav-icon { width: 20px; height: 20px; fill: currentColor; flex-shrink: 0; }
.sidebar-footer { padding: 16px; border-top: 1px solid rgba(255,255,255,.08); }
.sidebar-user { display: flex; align-items: center; gap: 10px; }
.user-avatar { width: 36px; height: 36px; background: #475569; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; color: white; }
.user-info { display: flex; flex-direction: column; }
.user-name { font-size: 13px; color: #e2e8f0; }
.user-role { font-size: 11px; color: #64748b; }
.main-wrapper { margin-right: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
.topbar { height: var(--topbar-h); background: var(--white); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 24px; gap: 16px; position: sticky; top: 0; z-index: 50; }
.topbar-toggle { display: none; background: none; border: none; cursor: pointer; fill: var(--text); padding: 4px; }
.topbar-title { font-size: 16px; font-weight: 700; color: var(--text); }
.topbar-left { margin-right: auto; display: flex; align-items: center; gap: 12px; }
.topbar-time { font-size: 13px; color: var(--text-light); direction: ltr; }
.topbar-badge { font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: 600; }
.topbar-badge.online { background: rgba(34,197,94,.12); color: var(--success); }
.content { flex: 1; padding: 24px; }
.view { display: none; } .view.active { display: block; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { background: var(--white); border-radius: var(--radius); padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: var(--shadow); }
.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.stat-icon svg { width: 24px; height: 24px; fill: white; }
.stat-icon.blue { background: var(--primary); } .stat-icon.green { background: var(--success); }
.stat-icon.orange { background: var(--warning); } .stat-icon.red { background: var(--error); }
.stat-body { display: flex; flex-direction: column; }
.stat-value { font-size: 26px; font-weight: 800; color: var(--text); direction: ltr; text-align: right; }
.stat-label { font-size: 12px; color: var(--text-light); margin-top: 2px; }
.panel { background: var(--white); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 12px; }
.panel-title { font-size: 15px; font-weight: 700; color: var(--text); }
.panel-tools { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.panel-body { padding: 20px; }
.export-btns { display: flex; gap: 0; }
.export-btn { padding: 6px 14px; border: 1px solid var(--border); background: var(--white); font-size: 12px; cursor: pointer; color: var(--text); font-family: inherit; transition: background .15s; }
.export-btn:first-child { border-radius: 0 var(--radius) var(--radius) 0; }
.export-btn:last-child { border-radius: var(--radius) 0 0 var(--radius); }
.export-btn:not(:last-child) { border-left: none; }
.export-btn:hover { background: var(--primary); color: white; border-color: var(--primary); }
.search-box { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-light); }
.search-input { padding: 6px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; width: 180px; font-family: inherit; direction: rtl; }
.search-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
.table-wrapper { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table thead { background: #f8fafc; }
.data-table th { text-align: right; padding: 12px 16px; font-weight: 600; color: var(--text-light); font-size: 12px; border-bottom: 2px solid var(--border); white-space: nowrap; cursor: pointer; user-select: none; }
.data-table th:hover { color: var(--primary); }
.data-table th.sort-asc::after { content: " \25B2"; font-size: 10px; }
.data-table th.sort-desc::after { content: " \25BC"; font-size: 10px; }
.data-table td { padding: 11px 16px; border-bottom: 1px solid #f1f5f9; color: var(--text); }
.data-table tbody tr:hover { background: #f8fafc; }
.data-table tbody tr:nth-child(even) { background: #fafbfc; }
.data-table tbody tr:nth-child(even):hover { background: #f1f5f9; }
.status-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
.status-badge.online { background: rgba(34,197,94,.1); color: var(--success); }
.status-badge.offline { background: rgba(148,163,184,.15); color: var(--text-light); }
.status-badge.warning { background: rgba(245,158,11,.1); color: var(--warning); }
.status-badge.error { background: rgba(239,68,68,.1); color: var(--error); }
.type-badge { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #f1f5f9; color: #475569; }
.table-footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-top: 1px solid var(--border); font-size: 13px; color: var(--text-light); }
.pagination { display: flex; gap: 4px; }
.page-btn { min-width: 32px; height: 32px; border: 1px solid var(--border); background: var(--white); border-radius: 6px; font-size: 12px; cursor: pointer; color: var(--text); font-family: inherit; display: flex; align-items: center; justify-content: center; transition: all .15s; }
.page-btn:hover { border-color: var(--primary); color: var(--primary); }
.page-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
.page-btn:disabled { opacity: .4; cursor: not-allowed; }
.btn { padding: 8px 18px; border: none; border-radius: var(--radius); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s; white-space: nowrap; }
.btn-primary { background: var(--primary); color: white; } .btn-primary:hover { background: var(--primary-dark); }
.btn-secondary { background: #e2e8f0; color: var(--text); } .btn-secondary:hover { background: #cbd5e1; }
.btn-danger { background: var(--error); color: white; } .btn-danger:hover { background: #dc2626; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.action-btns { display: flex; gap: 6px; }
.form-group { margin-bottom: 16px; }
.form-group > label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
.form-group input[type="text"], .form-group input[type="password"], .form-group input[type="number"], .form-group input[type="date"], .form-group select { width: 100%; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; font-family: inherit; direction: rtl; background: var(--white); }
.form-group input:focus, .form-group select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
.toggle-label { display: flex !important; align-items: center; gap: 10px; cursor: pointer; font-weight: 400 !important; }
.toggle-label input { accent-color: var(--primary); }
.report-filters { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; background: var(--white); padding: 16px 20px; border-radius: var(--radius); box-shadow: var(--shadow); }
.filter-group { display: flex; flex-direction: column; gap: 4px; }
.filter-group label { font-size: 12px; font-weight: 600; color: #475569; }
.filter-group select, .filter-group input { padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; font-family: inherit; min-width: 160px; }
.settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px; }
.about-info p { margin-bottom: 8px; font-size: 13px; color: #475569; line-height: 1.8; }
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 200; align-items: center; justify-content: center; }
.modal-overlay.active { display: flex; }
.modal { background: var(--white); border-radius: 12px; width: 92%; max-width: 520px; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid var(--border); }
.modal-header h3 { font-size: 16px; font-weight: 700; }
.modal-close { background: none; border: none; font-size: 22px; color: var(--text-light); cursor: pointer; line-height: 1; }
.modal-close:hover { color: var(--text); }
.modal-body { padding: 24px; }
.modal-footer { display: flex; justify-content: flex-start; gap: 10px; padding: 16px 24px; border-top: 1px solid var(--border); }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; }
.detail-label { font-size: 11px; color: var(--text-light); letter-spacing: .3px; }
.detail-value { font-size: 14px; font-weight: 600; color: var(--text); }
.footer { height: var(--footer-h); background: var(--white); border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; font-size: 12px; color: var(--text-light); }
.footer-status { display: inline-flex; align-items: center; gap: 6px; }
.footer-status::before { content: ""; width: 7px; height: 7px; background: var(--success); border-radius: 50%; }
@media (max-width: 1024px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) {
    .sidebar { transform: translateX(100%); } .sidebar.open { transform: translateX(0); }
    .main-wrapper { margin-right: 0; } .topbar-toggle { display: block; }
    .stats-row { grid-template-columns: 1fr; } .panel-header { flex-direction: column; align-items: flex-start; }
    .settings-grid { grid-template-columns: 1fr; } .detail-grid { grid-template-columns: 1fr; }
    .report-filters { flex-direction: column; align-items: stretch; }
}
/* === Login Page === */
.login-overlay { position: fixed; inset: 0; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); z-index: 999; display: flex; align-items: center; justify-content: center; }
.login-overlay.hidden { display: none; }
.login-box { background: var(--white); border-radius: 16px; padding: 40px 36px; width: 380px; max-width: 92%; box-shadow: 0 20px 60px rgba(0,0,0,.3); }
.login-logo { text-align: center; margin-bottom: 28px; }
.login-logo h2 { font-size: 22px; color: var(--text); margin-bottom: 4px; }
.login-logo p { font-size: 13px; color: var(--text-light); }
ENDCSS

echo "[9/10] Writing js/app.js and data/devices.js ..."
# app.js is large - write using python to avoid heredoc issues
python3 -c "
import shutil, os
src = '/tmp/tc-deploy-app.js'
# Write app.js
pass
" 2>/dev/null || true

# Write data/devices.js
cat > "$BASE/data/devices.js" << 'ENDFILE'
/**
 * Route and device data for TC Manager (Sistan Akbari).
 */

var ROUTE_DATA = [
    { id: "R-001", name: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u06a9\u0631\u062c", origin: "\u062a\u0647\u0631\u0627\u0646", destination: "\u06a9\u0631\u062c", length: 45, deviceCount: 8, status: "online", totalVehicles: 124500, avgSpeed: 95, errors: 2, lastUpdate: "2026-02-15T10:23:00" },
    { id: "R-002", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0647\u0645\u062a", origin: "\u0634\u0631\u0642 \u062a\u0647\u0631\u0627\u0646", destination: "\u063a\u0631\u0628 \u062a\u0647\u0631\u0627\u0646", length: 22, deviceCount: 12, status: "online", totalVehicles: 89200, avgSpeed: 62, errors: 0, lastUpdate: "2026-02-15T10:22:45" },
    { id: "R-003", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0635\u062f\u0631", origin: "\u062a\u062c\u0631\u06cc\u0634", destination: "\u0633\u062a\u0627\u0631\u06cc", length: 18, deviceCount: 6, status: "warning", totalVehicles: 67800, avgSpeed: 48, errors: 3, lastUpdate: "2026-02-15T09:55:00" },
    { id: "R-004", name: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u0642\u0645", origin: "\u062a\u0647\u0631\u0627\u0646", destination: "\u0642\u0645", length: 155, deviceCount: 15, status: "online", totalVehicles: 56300, avgSpeed: 110, errors: 1, lastUpdate: "2026-02-15T10:20:00" },
    { id: "R-005", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0646\u06cc\u0627\u06cc\u0634", origin: "\u0634\u0631\u0642", destination: "\u063a\u0631\u0628", length: 12, deviceCount: 5, status: "online", totalVehicles: 43100, avgSpeed: 55, errors: 0, lastUpdate: "2026-02-15T10:22:30" },
    { id: "R-006", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0634\u06cc\u062e \u0641\u0636\u0644\u200c\u0627\u0644\u0644\u0647", origin: "\u0634\u0645\u0627\u0644", destination: "\u062c\u0646\u0648\u0628", length: 14, deviceCount: 7, status: "online", totalVehicles: 78900, avgSpeed: 58, errors: 0, lastUpdate: "2026-02-15T10:21:00" },
    { id: "R-007", name: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u0634\u0645\u0627\u0644", origin: "\u062a\u0647\u0631\u0627\u0646", destination: "\u0686\u0627\u0644\u0648\u0633", length: 120, deviceCount: 10, status: "error", totalVehicles: 31200, avgSpeed: 75, errors: 5, lastUpdate: "2026-02-15T08:10:00" },
    { id: "R-008", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0686\u0645\u0631\u0627\u0646", origin: "\u0627\u0648\u06cc\u0646", destination: "\u0622\u0631\u0698\u0627\u0646\u062a\u06cc\u0646", length: 10, deviceCount: 4, status: "online", totalVehicles: 52400, avgSpeed: 51, errors: 0, lastUpdate: "2026-02-15T10:23:10" },
    { id: "R-009", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0628\u0639\u062b\u062a", origin: "\u0634\u0631\u0642", destination: "\u063a\u0631\u0628", length: 16, deviceCount: 6, status: "offline", totalVehicles: 0, avgSpeed: 0, errors: 0, lastUpdate: "2026-02-14T23:45:00" },
    { id: "R-010", name: "\u0645\u062d\u0648\u0631 \u0622\u0632\u0627\u062f\u06cc", origin: "\u0645\u06cc\u062f\u0627\u0646 \u0622\u0632\u0627\u062f\u06cc", destination: "\u0645\u06cc\u062f\u0627\u0646 \u0627\u0646\u0642\u0644\u0627\u0628", length: 5, deviceCount: 3, status: "online", totalVehicles: 38700, avgSpeed: 35, errors: 1, lastUpdate: "2026-02-15T10:18:00" },
    { id: "R-011", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u06cc\u0627\u062f\u06af\u0627\u0631 \u0627\u0645\u0627\u0645", origin: "\u0634\u0645\u0627\u0644", destination: "\u062c\u0646\u0648\u0628", length: 20, deviceCount: 9, status: "online", totalVehicles: 71600, avgSpeed: 65, errors: 0, lastUpdate: "2026-02-15T10:22:00" },
    { id: "R-012", name: "\u0645\u062d\u0648\u0631 \u0648\u0644\u06cc\u0639\u0635\u0631", origin: "\u062a\u062c\u0631\u06cc\u0634", destination: "\u0631\u0627\u0647\u200c\u0622\u0647\u0646", length: 18, deviceCount: 8, status: "warning", totalVehicles: 45200, avgSpeed: 28, errors: 2, lastUpdate: "2026-02-15T10:10:00" }
];

var DEVICE_DATA = [
    { id: "CAM-001", deviceCode: "1001", name: "\u062f\u0648\u0631\u0628\u06cc\u0646 \u0633\u0631\u0639\u062a \u06a9\u06cc\u0644\u0648\u0645\u062a\u0631 \u06f5", type: "camera", route: "R-001", ip: "192.168.1.10", status: "online", lastSeen: "2026-02-15T10:23:00", firmware: "v3.2.1" },
    { id: "CAM-002", deviceCode: "1002", name: "\u062f\u0648\u0631\u0628\u06cc\u0646 \u067e\u0644\u0627\u06a9\u200c\u062e\u0648\u0627\u0646 \u0648\u0631\u0648\u062f\u06cc", type: "camera", route: "R-001", ip: "192.168.1.11", status: "online", lastSeen: "2026-02-15T10:22:50", firmware: "v3.2.1" },
    { id: "CAM-003", deviceCode: "1003", name: "\u062f\u0648\u0631\u0628\u06cc\u0646 \u0646\u0638\u0627\u0631\u062a\u06cc \u0647\u0645\u062a \u0634\u0631\u0642", type: "camera", route: "R-002", ip: "192.168.1.12", status: "online", lastSeen: "2026-02-15T10:22:30", firmware: "v3.1.5" },
    { id: "CAM-004", deviceCode: "1004", name: "\u062f\u0648\u0631\u0628\u06cc\u0646 \u0633\u0631\u0639\u062a \u0635\u062f\u0631", type: "camera", route: "R-003", ip: "192.168.1.13", status: "warning", lastSeen: "2026-02-15T09:50:00", firmware: "v3.1.5" },
    { id: "SEN-001", deviceCode: "2001", name: "\u0633\u0646\u0633\u0648\u0631 \u062a\u0631\u062f\u062f \u0634\u0645\u0627\u0631 \u06a9\u0631\u062c", type: "sensor", route: "R-001", ip: "192.168.2.10", status: "online", lastSeen: "2026-02-15T10:23:05", firmware: "v2.1.0" },
    { id: "SEN-002", deviceCode: "2002", name: "\u0633\u0646\u0633\u0648\u0631 \u062a\u0631\u062f\u062f \u0634\u0645\u0627\u0631 \u0647\u0645\u062a", type: "sensor", route: "R-002", ip: "192.168.2.11", status: "online", lastSeen: "2026-02-15T10:22:40", firmware: "v2.1.0" },
    { id: "SEN-003", deviceCode: "2003", name: "\u0633\u0646\u0633\u0648\u0631 \u0633\u0631\u0639\u062a \u0646\u06cc\u0627\u06cc\u0634", type: "sensor", route: "R-005", ip: "192.168.2.12", status: "online", lastSeen: "2026-02-15T10:22:20", firmware: "v2.0.8" },
    { id: "SEN-004", deviceCode: "2004", name: "\u0633\u0646\u0633\u0648\u0631 \u0628\u0627\u0631\u0634 \u062a\u0647\u0631\u0627\u0646-\u0634\u0645\u0627\u0644", type: "sensor", route: "R-007", ip: "192.168.2.13", status: "error", lastSeen: "2026-02-15T08:05:00", firmware: "v2.0.8" },
    { id: "TL-001", deviceCode: "3001", name: "\u0686\u0631\u0627\u063a \u0647\u0648\u0634\u0645\u0646\u062f \u0622\u0632\u0627\u062f\u06cc", type: "traffic-light", route: "R-010", ip: "192.168.3.10", status: "online", lastSeen: "2026-02-15T10:23:10", firmware: "v4.0.2" },
    { id: "TL-002", deviceCode: "3002", name: "\u0686\u0631\u0627\u063a \u0647\u0648\u0634\u0645\u0646\u062f \u0648\u0644\u06cc\u0639\u0635\u0631", type: "traffic-light", route: "R-012", ip: "192.168.3.11", status: "warning", lastSeen: "2026-02-15T10:10:00", firmware: "v4.0.1" },
    { id: "TL-003", deviceCode: "3003", name: "\u0686\u0631\u0627\u063a \u0647\u0648\u0634\u0645\u0646\u062f \u062a\u0642\u0627\u0637\u0639 \u0647\u0645\u062a", type: "traffic-light", route: "R-002", ip: "192.168.3.12", status: "online", lastSeen: "2026-02-15T10:22:55", firmware: "v4.0.2" },
    { id: "CTR-001", deviceCode: "4001", name: "\u06a9\u0646\u062a\u0631\u0644\u0631 \u0645\u0631\u06a9\u0632\u06cc \u0645\u0646\u0637\u0642\u0647 \u06f1", type: "controller", route: "R-001", ip: "192.168.4.1", status: "online", lastSeen: "2026-02-15T10:23:15", firmware: "v5.1.0" },
    { id: "CTR-002", deviceCode: "4002", name: "\u06a9\u0646\u062a\u0631\u0644\u0631 \u0645\u0646\u0637\u0642\u0647 \u06f6", type: "controller", route: "R-002", ip: "192.168.4.2", status: "online", lastSeen: "2026-02-15T10:22:45", firmware: "v5.1.0" },
    { id: "CTR-003", deviceCode: "4003", name: "\u06a9\u0646\u062a\u0631\u0644\u0631 \u062a\u0647\u0631\u0627\u0646-\u0634\u0645\u0627\u0644", type: "controller", route: "R-007", ip: "192.168.4.3", status: "error", lastSeen: "2026-02-15T08:00:00", firmware: "v5.0.9" },
    { id: "CAM-005", deviceCode: "1005", name: "\u062f\u0648\u0631\u0628\u06cc\u0646 \u0646\u0638\u0627\u0631\u062a \u0642\u0645", type: "camera", route: "R-004", ip: "192.168.1.14", status: "online", lastSeen: "2026-02-15T10:20:00", firmware: "v3.2.1" },
    { id: "SEN-005", deviceCode: "2005", name: "\u0633\u0646\u0633\u0648\u0631 \u062a\u0631\u0627\u0641\u06cc\u06a9 \u0686\u0645\u0631\u0627\u0646", type: "sensor", route: "R-008", ip: "192.168.2.14", status: "online", lastSeen: "2026-02-15T10:23:00", firmware: "v2.1.0" },
    { id: "CAM-006", deviceCode: "1006", name: "\u062f\u0648\u0631\u0628\u06cc\u0646 \u06cc\u0627\u062f\u06af\u0627\u0631 \u0627\u0645\u0627\u0645", type: "camera", route: "R-011", ip: "192.168.1.15", status: "online", lastSeen: "2026-02-15T10:22:00", firmware: "v3.2.1" },
    { id: "SEN-006", deviceCode: "2006", name: "\u0633\u0646\u0633\u0648\u0631 \u0628\u0639\u062b\u062a", type: "sensor", route: "R-009", ip: "192.168.2.15", status: "offline", lastSeen: "2026-02-14T23:40:00", firmware: "v2.0.8" }
];

var REPORT_DATA = [
    { date: "2026-02-15", route: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u06a9\u0631\u062c", vehicles: 124500, avgSpeed: 95, maxSpeed: 185, violations: 23 },
    { date: "2026-02-15", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0647\u0645\u062a", vehicles: 89200, avgSpeed: 62, maxSpeed: 130, violations: 8 },
    { date: "2026-02-15", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0635\u062f\u0631", vehicles: 67800, avgSpeed: 48, maxSpeed: 115, violations: 12 },
    { date: "2026-02-15", route: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u0642\u0645", vehicles: 56300, avgSpeed: 110, maxSpeed: 195, violations: 31 },
    { date: "2026-02-15", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0646\u06cc\u0627\u06cc\u0634", vehicles: 43100, avgSpeed: 55, maxSpeed: 105, violations: 5 },
    { date: "2026-02-15", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0634\u06cc\u062e \u0641\u0636\u0644\u200c\u0627\u0644\u0644\u0647", vehicles: 78900, avgSpeed: 58, maxSpeed: 120, violations: 9 },
    { date: "2026-02-14", route: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u06a9\u0631\u062c", vehicles: 118700, avgSpeed: 98, maxSpeed: 190, violations: 19 },
    { date: "2026-02-14", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0647\u0645\u062a", vehicles: 91500, avgSpeed: 60, maxSpeed: 128, violations: 11 },
    { date: "2026-02-14", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0635\u062f\u0631", vehicles: 70200, avgSpeed: 45, maxSpeed: 112, violations: 15 },
    { date: "2026-02-14", route: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u0642\u0645", vehicles: 52800, avgSpeed: 112, maxSpeed: 200, violations: 28 },
    { date: "2026-02-14", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0646\u06cc\u0627\u06cc\u0634", vehicles: 40200, avgSpeed: 52, maxSpeed: 100, violations: 3 },
    { date: "2026-02-14", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0634\u06cc\u062e \u0641\u0636\u0644\u200c\u0627\u0644\u0644\u0647", vehicles: 80100, avgSpeed: 56, maxSpeed: 118, violations: 7 },
    { date: "2026-02-13", route: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u06a9\u0631\u062c", vehicles: 115300, avgSpeed: 92, maxSpeed: 180, violations: 21 },
    { date: "2026-02-13", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0647\u0645\u062a", vehicles: 87600, avgSpeed: 59, maxSpeed: 125, violations: 10 },
    { date: "2026-02-13", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0635\u062f\u0631", vehicles: 65400, avgSpeed: 50, maxSpeed: 118, violations: 14 }
];
ENDFILE

# Write js/app.js
cat > "$BASE/js/app.js" << 'ENDAPPJS'
(function () {
    "use strict";
    var loginOverlay = document.getElementById("login-overlay");
    var loginForm = document.getElementById("login-form");
    var loginError = document.getElementById("login-error");
    function checkAuth() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/api/auth/check", true);
        xhr.withCredentials = true;
        xhr.onload = function () {
            var data = JSON.parse(xhr.responseText);
            if (data.loggedIn) {
                loginOverlay.classList.add("hidden");
                var userEl = document.getElementById("topbar-user");
                if (userEl) userEl.textContent = data.username;
                var nameEl = document.querySelector(".user-name");
                if (nameEl) nameEl.textContent = data.username;
            } else { loginOverlay.classList.remove("hidden"); }
        };
        xhr.onerror = function () { loginOverlay.classList.remove("hidden"); };
        xhr.send();
    }
    if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();
            var user = document.getElementById("login-user").value;
            var pass = document.getElementById("login-pass").value;
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "/api/auth/login", true);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.withCredentials = true;
            xhr.onload = function () {
                if (xhr.status === 200) {
                    loginOverlay.classList.add("hidden");
                    loginError.style.display = "none";
                    var data = JSON.parse(xhr.responseText);
                    var userEl = document.getElementById("topbar-user");
                    if (userEl) userEl.textContent = data.username;
                    var nameEl = document.querySelector(".user-name");
                    if (nameEl) nameEl.textContent = data.username;
                } else {
                    loginError.textContent = "\u0646\u0627\u0645 \u06a9\u0627\u0631\u0628\u0631\u06cc \u06cc\u0627 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0627\u0634\u062a\u0628\u0627\u0647 \u0627\u0633\u062a";
                    loginError.style.display = "block";
                }
            };
            xhr.send(JSON.stringify({ username: user, password: pass }));
        });
    }
    checkAuth();
    var routes = JSON.parse(JSON.stringify(ROUTE_DATA));
    var devices = JSON.parse(JSON.stringify(DEVICE_DATA));
    var reports = JSON.parse(JSON.stringify(REPORT_DATA));
    var TYPE_LABELS = { camera: "\u062f\u0648\u0631\u0628\u06cc\u0646", sensor: "\u0633\u0646\u0633\u0648\u0631", "traffic-light": "\u0686\u0631\u0627\u063a \u0631\u0627\u0647\u0646\u0645\u0627\u06cc\u06cc", controller: "\u06a9\u0646\u062a\u0631\u0644\u0631" };
    var STATUS_LABELS = { online: "\u0622\u0646\u0644\u0627\u06cc\u0646", offline: "\u0622\u0641\u0644\u0627\u06cc\u0646", warning: "\u0647\u0634\u062f\u0627\u0631", error: "\u062e\u0637\u0627" };
    var VIEW_TITLES = { home: "\u062e\u0627\u0646\u0647", routes: "\u0645\u062d\u0648\u0631\u0647\u0627", devices: "\u062f\u0633\u062a\u06af\u0627\u0647\u200c\u0647\u0627", reports: "\u06af\u0632\u0627\u0631\u0634\u0627\u062a", settings: "\u062a\u0646\u0638\u06cc\u0645\u0627\u062a" };
    var PAGE_SIZE = 10;
    var $ = function (sel) { return document.querySelector(sel); };
    var $$ = function (sel) { return document.querySelectorAll(sel); };
    function escapeHtml(str) { if (str == null) return ""; var div = document.createElement("div"); div.appendChild(document.createTextNode(String(str))); return div.innerHTML; }
    function formatNumber(n) { return Number(n).toLocaleString("fa-IR"); }
    function formatTime(iso) { if (!iso) return "-"; var d = new Date(iso); var h = String(d.getHours()).padStart(2, "0"); var m = String(d.getMinutes()).padStart(2, "0"); var mo = String(d.getMonth() + 1).padStart(2, "0"); var dy = String(d.getDate()).padStart(2, "0"); return d.getFullYear() + "/" + mo + "/" + dy + " " + h + ":" + m; }
    $$(".nav-item").forEach(function (btn) { btn.addEventListener("click", function () { switchView(btn.getAttribute("data-view")); }); });
    function switchView(view) {
        $$(".nav-item").forEach(function (b) { b.classList.remove("active"); });
        var activeBtn = document.querySelector('.nav-item[data-view="' + view + '"]');
        if (activeBtn) activeBtn.classList.add("active");
        $$(".view").forEach(function (v) { v.classList.remove("active"); });
        var target = $("#view-" + view);
        if (target) target.classList.add("active");
        $("#topbar-title").textContent = VIEW_TITLES[view] || view;
        if (view === "home") renderHome();
        if (view === "routes") renderRoutes();
        if (view === "devices") renderDevices();
        if (view === "reports") renderReports();
    }
    $("#sidebar-toggle").addEventListener("click", function () { $("#sidebar").classList.toggle("open"); });
    function updateClock() { var now = new Date(); var h = String(now.getHours()).padStart(2, "0"); var m = String(now.getMinutes()).padStart(2, "0"); var s = String(now.getSeconds()).padStart(2, "0"); $("#topbar-time").textContent = h + ":" + m + ":" + s; }
    updateClock(); setInterval(updateClock, 1000);
    var homeState = { page: 1, search: "", sortKey: "name", sortDir: "asc" };
    function renderHome() {
        var totalVehicles = routes.reduce(function (s, r) { return s + r.totalVehicles; }, 0);
        var activeRoutes = routes.filter(function (r) { return r.status === "online"; }).length;
        var totalErrors = routes.reduce(function (s, r) { return s + r.errors; }, 0);
        var speeds = routes.filter(function (r) { return r.avgSpeed > 0; });
        var avgSpeed = speeds.length ? Math.round(speeds.reduce(function (s, r) { return s + r.avgSpeed; }, 0) / speeds.length) : 0;
        $("#stat-total-vehicles").textContent = formatNumber(totalVehicles);
        $("#stat-avg-speed").textContent = formatNumber(avgSpeed);
        $("#stat-active-routes").textContent = formatNumber(activeRoutes);
        $("#stat-errors").textContent = formatNumber(totalErrors);
        var onlineDevices = devices.filter(function (d) { return d.status === "online"; }).length;
        $("#footer-device-count").textContent = onlineDevices + " \u062f\u0633\u062a\u06af\u0627\u0647 \u0641\u0639\u0627\u0644";
        renderHomeTable();
    }
    function getFilteredRoutes() { var q = homeState.search.toLowerCase(); return routes.filter(function (r) { if (!q) return true; return r.name.toLowerCase().indexOf(q) !== -1; }); }
    function renderHomeTable() {
        var filtered = sortArray(getFilteredRoutes(), homeState.sortKey, homeState.sortDir);
        var total = filtered.length; var start = (homeState.page - 1) * PAGE_SIZE; var paged = filtered.slice(start, start + PAGE_SIZE);
        var tbody = $("#home-table-body");
        tbody.innerHTML = paged.map(function (r) {
            return "<tr><td>" + escapeHtml(r.name) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(formatTime(r.lastUpdate)) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(formatNumber(r.totalVehicles)) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(r.avgSpeed) + " km/h</td>" +
                '<td><span class="status-badge ' + (r.errors > 0 ? "error" : "online") + '">' + escapeHtml(r.errors > 0 ? r.errors + " \u062e\u0637\u0627" : "\u0628\u062f\u0648\u0646 \u062e\u0637\u0627") + "</span></td></tr>";
        }).join("");
        renderTableInfo("home", start, paged.length, total);
        renderPagination("home", homeState, total);
        applySortHeaders("home-table", homeState);
    }
    $("#home-search").addEventListener("input", function () { homeState.search = this.value.trim(); homeState.page = 1; renderHomeTable(); });
    bindTableSort("home-table", homeState, renderHomeTable);
    var routeState = { page: 1, search: "", sortKey: "name", sortDir: "asc" };
    function renderRoutes() { renderRouteTable(); }
    function getFilteredRoutesForTable() { var q = routeState.search.toLowerCase(); return routes.filter(function (r) { if (!q) return true; return r.name.toLowerCase().indexOf(q) !== -1 || r.origin.toLowerCase().indexOf(q) !== -1 || r.destination.toLowerCase().indexOf(q) !== -1; }); }
    function renderRouteTable() {
        var filtered = sortArray(getFilteredRoutesForTable(), routeState.sortKey, routeState.sortDir);
        var total = filtered.length; var start = (routeState.page - 1) * PAGE_SIZE; var paged = filtered.slice(start, start + PAGE_SIZE);
        var tbody = $("#routes-table-body");
        tbody.innerHTML = paged.map(function (r, i) {
            return "<tr><td>" + (start + i + 1) + "</td><td><strong>" + escapeHtml(r.name) + "</strong></td><td>" + escapeHtml(r.origin) + "</td><td>" + escapeHtml(r.destination) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(r.length) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(r.deviceCount) + "</td>" +
                '<td><span class="status-badge ' + r.status + '">' + escapeHtml(STATUS_LABELS[r.status]) + "</span></td>" +
                '<td><div class="action-btns"><button class="btn btn-sm btn-primary btn-route-detail" data-id="' + escapeHtml(r.id) + '">\u062c\u0632\u0626\u06cc\u0627\u062a</button><button class="btn btn-sm btn-danger btn-route-delete" data-id="' + escapeHtml(r.id) + '">\u062d\u0630\u0641</button></div></td></tr>';
        }).join("");
        tbody.querySelectorAll(".btn-route-detail").forEach(function (btn) { btn.addEventListener("click", function () { var r = routes.find(function (x) { return x.id === btn.getAttribute("data-id"); }); if (r) showRouteDetail(r); }); });
        tbody.querySelectorAll(".btn-route-delete").forEach(function (btn) { btn.addEventListener("click", function () { var id = btn.getAttribute("data-id"); if (confirm("\u0622\u06cc\u0627 \u0627\u0632 \u062d\u0630\u0641 \u0627\u06cc\u0646 \u0645\u062d\u0648\u0631 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062a\u06cc\u062f\u061f")) { routes = routes.filter(function (x) { return x.id !== id; }); renderRouteTable(); } }); });
        renderTableInfo("routes", start, paged.length, total);
        renderPagination("routes", routeState, total);
        applySortHeaders("routes-table", routeState);
    }
    $("#routes-search").addEventListener("input", function () { routeState.search = this.value.trim(); routeState.page = 1; renderRouteTable(); });
    bindTableSort("routes-table", routeState, renderRouteTable);
    function showRouteDetail(r) {
        $("#modal-title").textContent = r.name; $("#modal-save").style.display = "none";
        $("#modal-body").innerHTML = '<div class="detail-grid"><div class="detail-item"><span class="detail-label">\u0634\u0646\u0627\u0633\u0647</span><span class="detail-value">' + escapeHtml(r.id) + '</span></div><div class="detail-item"><span class="detail-label">\u0645\u0628\u062f\u0623</span><span class="detail-value">' + escapeHtml(r.origin) + '</span></div><div class="detail-item"><span class="detail-label">\u0645\u0642\u0635\u062f</span><span class="detail-value">' + escapeHtml(r.destination) + '</span></div><div class="detail-item"><span class="detail-label">\u0637\u0648\u0644</span><span class="detail-value" dir="ltr">' + escapeHtml(r.length) + ' km</span></div><div class="detail-item"><span class="detail-label">\u062a\u0639\u062f\u0627\u062f \u062f\u0633\u062a\u06af\u0627\u0647</span><span class="detail-value">' + escapeHtml(r.deviceCount) + '</span></div><div class="detail-item"><span class="detail-label">\u0648\u0636\u0639\u06cc\u062a</span><span class="detail-value"><span class="status-badge ' + r.status + '">' + escapeHtml(STATUS_LABELS[r.status]) + '</span></span></div><div class="detail-item"><span class="detail-label">\u062e\u0648\u062f\u0631\u0648\u0647\u0627\u06cc \u0639\u0628\u0648\u0631\u06cc</span><span class="detail-value">' + escapeHtml(formatNumber(r.totalVehicles)) + '</span></div><div class="detail-item"><span class="detail-label">\u0633\u0631\u0639\u062a \u0645\u062a\u0648\u0633\u0637</span><span class="detail-value" dir="ltr">' + escapeHtml(r.avgSpeed) + ' km/h</span></div></div>';
        $("#modal-overlay").classList.add("active");
    }
    $("#btn-add-route").addEventListener("click", function () {
        $("#add-modal-title").textContent = "\u0627\u0641\u0632\u0648\u062f\u0646 \u0645\u062d\u0648\u0631 \u062c\u062f\u06cc\u062f";
        $("#add-modal-body").innerHTML = '<form id="add-route-form"><div class="form-group"><label>\u0646\u0627\u0645 \u0645\u062d\u0648\u0631</label><input type="text" id="new-route-name" required></div><div class="form-group"><label>\u0645\u0628\u062f\u0623</label><input type="text" id="new-route-origin"></div><div class="form-group"><label>\u0645\u0642\u0635\u062f</label><input type="text" id="new-route-dest"></div><div class="form-group"><label>\u0637\u0648\u0644 (km)</label><input type="number" id="new-route-length" dir="ltr"></div></form>';
        currentAddMode = "route"; $("#add-modal-overlay").classList.add("active");
    });
    var deviceState = { page: 1, search: "", sortKey: "name", sortDir: "asc" };
    function renderDevices() { renderDeviceTable(); }
    function getFilteredDevices() { var q = deviceState.search.toLowerCase(); return devices.filter(function (d) { if (!q) return true; return d.name.toLowerCase().indexOf(q) !== -1 || d.id.toLowerCase().indexOf(q) !== -1 || d.ip.indexOf(q) !== -1; }); }
    function renderDeviceTable() {
        var filtered = sortArray(getFilteredDevices(), deviceState.sortKey, deviceState.sortDir);
        var total = filtered.length; var start = (deviceState.page - 1) * PAGE_SIZE; var paged = filtered.slice(start, start + PAGE_SIZE);
        var tbody = $("#devices-table-body");
        tbody.innerHTML = paged.map(function (d, i) {
            var routeObj = routes.find(function (r) { return r.id === d.route; }); var routeName = routeObj ? routeObj.name : d.route;
            return "<tr><td>" + (start + i + 1) + "</td>" +
                '<td style="direction:ltr;text-align:right;font-weight:700">' + escapeHtml(d.deviceCode || "-") + "</td><td><strong>" + escapeHtml(d.name) + "</strong></td>" +
                '<td><span class="type-badge">' + escapeHtml(TYPE_LABELS[d.type] || d.type) + "</span></td><td>" + escapeHtml(routeName) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(d.ip) + "</td>" +
                '<td><span class="status-badge ' + d.status + '">' + escapeHtml(STATUS_LABELS[d.status]) + "</span></td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(formatTime(d.lastSeen)) + "</td>" +
                '<td><div class="action-btns"><button class="btn btn-sm btn-primary btn-dev-detail" data-id="' + escapeHtml(d.id) + '">\u062c\u0632\u0626\u06cc\u0627\u062a</button><button class="btn btn-sm btn-danger btn-dev-delete" data-id="' + escapeHtml(d.id) + '">\u062d\u0630\u0641</button></div></td></tr>';
        }).join("");
        tbody.querySelectorAll(".btn-dev-detail").forEach(function (btn) { btn.addEventListener("click", function () { var d = devices.find(function (x) { return x.id === btn.getAttribute("data-id"); }); if (d) showDeviceDetail(d); }); });
        tbody.querySelectorAll(".btn-dev-delete").forEach(function (btn) { btn.addEventListener("click", function () { var id = btn.getAttribute("data-id"); if (confirm("\u0622\u06cc\u0627 \u0627\u0632 \u062d\u0630\u0641 \u0627\u06cc\u0646 \u062f\u0633\u062a\u06af\u0627\u0647 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062a\u06cc\u062f\u061f")) { devices = devices.filter(function (x) { return x.id !== id; }); renderDeviceTable(); } }); });
        renderTableInfo("devices", start, paged.length, total);
        renderPagination("devices", deviceState, total);
        applySortHeaders("devices-table", deviceState);
    }
    $("#devices-search").addEventListener("input", function () { deviceState.search = this.value.trim(); deviceState.page = 1; renderDeviceTable(); });
    bindTableSort("devices-table", deviceState, renderDeviceTable);
    function showDeviceDetail(d) {
        var routeObj = routes.find(function (r) { return r.id === d.route; }); var routeName = routeObj ? routeObj.name : d.route;
        $("#modal-title").textContent = d.name; $("#modal-save").style.display = "none";
        $("#modal-body").innerHTML = '<div class="detail-grid"><div class="detail-item"><span class="detail-label">\u0634\u0646\u0627\u0633\u0647</span><span class="detail-value">' + escapeHtml(d.id) + '</span></div><div class="detail-item"><span class="detail-label">\u06a9\u062f \u062f\u0633\u062a\u06af\u0627\u0647 (\u06f4 \u0631\u0642\u0645\u06cc)</span><span class="detail-value" style="direction:ltr;font-weight:700;font-size:18px;color:#3b82f6">' + escapeHtml(d.deviceCode || "-") + '</span></div><div class="detail-item"><span class="detail-label">\u0646\u0648\u0639</span><span class="detail-value">' + escapeHtml(TYPE_LABELS[d.type]) + '</span></div><div class="detail-item"><span class="detail-label">\u0645\u062d\u0648\u0631</span><span class="detail-value">' + escapeHtml(routeName) + '</span></div><div class="detail-item"><span class="detail-label">\u0622\u062f\u0631\u0633 IP</span><span class="detail-value" dir="ltr">' + escapeHtml(d.ip) + '</span></div><div class="detail-item"><span class="detail-label">\u0648\u0636\u0639\u06cc\u062a</span><span class="detail-value"><span class="status-badge ' + d.status + '">' + escapeHtml(STATUS_LABELS[d.status]) + '</span></span></div><div class="detail-item"><span class="detail-label">\u0646\u0633\u062e\u0647 \u0641\u0631\u06cc\u0645\u0648\u0631</span><span class="detail-value" dir="ltr">' + escapeHtml(d.firmware) + '</span></div><div class="detail-item"><span class="detail-label">\u0622\u062e\u0631\u06cc\u0646 \u0627\u062a\u0635\u0627\u0644</span><span class="detail-value" dir="ltr">' + escapeHtml(formatTime(d.lastSeen)) + '</span></div></div>';
        $("#modal-overlay").classList.add("active");
    }
    $("#btn-add-device").addEventListener("click", function () {
        $("#add-modal-title").textContent = "\u0627\u0641\u0632\u0648\u062f\u0646 \u062f\u0633\u062a\u06af\u0627\u0647 \u062c\u062f\u06cc\u062f";
        var routeOptions = routes.map(function (r) { return '<option value="' + escapeHtml(r.id) + '">' + escapeHtml(r.name) + '</option>'; }).join("");
        $("#add-modal-body").innerHTML = '<form id="add-device-form"><div class="form-group"><label>\u06a9\u062f \u062f\u0633\u062a\u06af\u0627\u0647 (\u06f4 \u0631\u0642\u0645\u06cc)</label><input type="text" id="new-dev-code" maxlength="4" pattern="\\d{4}" dir="ltr" placeholder="\u0645\u062b\u0627\u0644: 1001" required></div><div class="form-group"><label>\u0646\u0627\u0645 \u062f\u0633\u062a\u06af\u0627\u0647</label><input type="text" id="new-dev-name" required></div><div class="form-group"><label>\u0646\u0648\u0639</label><select id="new-dev-type"><option value="camera">\u062f\u0648\u0631\u0628\u06cc\u0646</option><option value="sensor">\u0633\u0646\u0633\u0648\u0631</option><option value="traffic-light">\u0686\u0631\u0627\u063a \u0631\u0627\u0647\u0646\u0645\u0627\u06cc\u06cc</option><option value="controller">\u06a9\u0646\u062a\u0631\u0644\u0631</option></select></div><div class="form-group"><label>\u0645\u062d\u0648\u0631</label><select id="new-dev-route">' + routeOptions + '</select></div><div class="form-group"><label>\u0622\u062f\u0631\u0633 IP</label><input type="text" id="new-dev-ip" dir="ltr" placeholder="192.168.x.x"></div></form>';
        currentAddMode = "device"; $("#add-modal-overlay").classList.add("active");
    });
    var reportState = { page: 1 };
    function renderReports() {
        var sel = $("#report-route"); sel.innerHTML = '<option value="">\u0647\u0645\u0647 \u0645\u062d\u0648\u0631\u0647\u0627</option>';
        routes.forEach(function (r) { sel.innerHTML += '<option value="' + escapeHtml(r.name) + '">' + escapeHtml(r.name) + '</option>'; });
        renderReportTable();
    }
    function getFilteredReports() { var routeFilter = $("#report-route").value; var from = $("#report-from").value; var to = $("#report-to").value; return reports.filter(function (r) { if (routeFilter && r.route !== routeFilter) return false; if (from && r.date < from) return false; if (to && r.date > to) return false; return true; }); }
    function renderReportTable() {
        var filtered = getFilteredReports(); var total = filtered.length; var start = (reportState.page - 1) * PAGE_SIZE; var paged = filtered.slice(start, start + PAGE_SIZE);
        var tbody = $("#report-table-body");
        tbody.innerHTML = paged.map(function (r) {
            return '<tr><td style="direction:ltr;text-align:right">' + escapeHtml(r.date) + "</td><td>" + escapeHtml(r.route) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(formatNumber(r.vehicles)) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(r.avgSpeed) + " km/h</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(r.maxSpeed) + " km/h</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(r.violations) + "</td></tr>";
        }).join("");
        renderTableInfo("report", start, paged.length, total);
        renderPagination("report", reportState, total);
    }
    $("#btn-generate-report").addEventListener("click", function () { reportState.page = 1; renderReportTable(); });
    $("#btn-save-settings").addEventListener("click", function () { alert("\u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u0639\u0645\u0648\u0645\u06cc \u0630\u062e\u06cc\u0631\u0647 \u0634\u062f."); });
    $("#btn-save-alerts").addEventListener("click", function () { alert("\u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u0647\u0634\u062f\u0627\u0631 \u0630\u062e\u06cc\u0631\u0647 \u0634\u062f."); });
    $("#btn-change-pass").addEventListener("click", function () {
        var oldP = $("#setting-old-pass").value; var newP = $("#setting-new-pass").value;
        if (!oldP || !newP) { alert("\u0644\u0637\u0641\u0627 \u0647\u0631 \u062f\u0648 \u0641\u06cc\u0644\u062f \u0631\u0627 \u067e\u0631 \u06a9\u0646\u06cc\u062f"); return; }
        var xhr = new XMLHttpRequest(); xhr.open("POST", "/api/auth/change-password", true);
        xhr.setRequestHeader("Content-Type", "application/json"); xhr.withCredentials = true;
        xhr.onload = function () { var r = JSON.parse(xhr.responseText); if (xhr.status === 200) { alert("\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u062a\u063a\u06cc\u06cc\u0631 \u06a9\u0631\u062f"); $("#setting-old-pass").value = ""; $("#setting-new-pass").value = ""; } else alert(r.error || "\u062e\u0637\u0627"); };
        xhr.send(JSON.stringify({ old_password: oldP, new_password: newP }));
    });
    $("#btn-logout").addEventListener("click", function () {
        var xhr = new XMLHttpRequest(); xhr.open("POST", "/api/auth/logout", true); xhr.withCredentials = true;
        xhr.onload = function () { loginOverlay.classList.remove("hidden"); }; xhr.send();
    });
    $("#btn-backup-download").addEventListener("click", function () { window.location.href = "/api/backup/download"; });
    $("#btn-backup-restore").addEventListener("click", function () {
        var fileInput = $("#backup-file");
        if (!fileInput.files || !fileInput.files[0]) { alert("\u0644\u0637\u0641\u0627 \u0641\u0627\u06cc\u0644 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u0631\u0627 \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646\u06cc\u062f"); return; }
        var formData = new FormData(); formData.append("backup", fileInput.files[0]);
        var statusEl = $("#backup-status"); statusEl.textContent = "\u062f\u0631 \u062d\u0627\u0644 \u0622\u067e\u0644\u0648\u062f...";
        var xhr = new XMLHttpRequest(); xhr.open("POST", "/api/backup/restore", true); xhr.withCredentials = true;
        xhr.onload = function () { var r = JSON.parse(xhr.responseText); if (xhr.status === 200) { statusEl.textContent = r.message || "\u0628\u0627\u0632\u06cc\u0627\u0628\u06cc \u0627\u0646\u062c\u0627\u0645 \u0634\u062f"; statusEl.style.color = "#22c55e"; } else { statusEl.textContent = r.error || "\u062e\u0637\u0627 \u062f\u0631 \u0628\u0627\u0632\u06cc\u0627\u0628\u06cc"; statusEl.style.color = "#ef4444"; } };
        xhr.onerror = function () { statusEl.textContent = "\u062e\u0637\u0627 \u062f\u0631 \u0627\u0631\u062a\u0628\u0627\u0637 \u0628\u0627 \u0633\u0631\u0648\u0631"; statusEl.style.color = "#ef4444"; };
        xhr.send(formData);
    });
    var currentAddMode = "";
    $("#add-modal-save").addEventListener("click", function () {
        if (currentAddMode === "route") {
            var name = ($("#new-route-name") || {}).value; if (!name || !name.trim()) { alert("\u0644\u0637\u0641\u0627 \u0646\u0627\u0645 \u0645\u062d\u0648\u0631 \u0631\u0627 \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f"); return; }
            var maxNum = 0; routes.forEach(function (r) { var n = parseInt(r.id.split("-")[1], 10); if (n > maxNum) maxNum = n; });
            routes.push({ id: "R-" + String(maxNum + 1).padStart(3, "0"), name: name.trim(), origin: ($("#new-route-origin") || {}).value || "", destination: ($("#new-route-dest") || {}).value || "", length: parseFloat(($("#new-route-length") || {}).value) || 0, deviceCount: 0, status: "online", totalVehicles: 0, avgSpeed: 0, errors: 0, lastUpdate: new Date().toISOString() });
            $("#add-modal-overlay").classList.remove("active"); renderRouteTable();
        } else if (currentAddMode === "device") {
            var dcode = ($("#new-dev-code") || {}).value; var dname = ($("#new-dev-name") || {}).value; var ip = ($("#new-dev-ip") || {}).value;
            if (!dcode || !/^\d{4}$/.test(dcode)) { alert("\u06a9\u062f \u062f\u0633\u062a\u06af\u0627\u0647 \u0628\u0627\u06cc\u062f \u06f4 \u0631\u0642\u0645\u06cc \u0628\u0627\u0634\u062f"); return; }
            if (!dname || !dname.trim() || !ip || !ip.trim()) { alert("\u0644\u0637\u0641\u0627 \u0646\u0627\u0645 \u0648 IP \u0631\u0627 \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f"); return; }
            if (devices.some(function (d) { return d.deviceCode === dcode; })) { alert("\u06a9\u062f \u062f\u0633\u062a\u06af\u0627\u0647 \u062a\u06a9\u0631\u0627\u0631\u06cc \u0627\u0633\u062a"); return; }
            var type = ($("#new-dev-type") || {}).value || "camera";
            var prefix = { camera: "CAM", sensor: "SEN", "traffic-light": "TL", controller: "CTR" }[type] || "DEV";
            var dmax = 0; devices.forEach(function (d) { if (d.id.indexOf(prefix + "-") === 0) { var num = parseInt(d.id.split("-")[1], 10); if (num > dmax) dmax = num; } });
            devices.push({ id: prefix + "-" + String(dmax + 1).padStart(3, "0"), deviceCode: dcode, name: dname.trim(), type: type, route: ($("#new-dev-route") || {}).value || "", ip: ip.trim(), status: "online", lastSeen: new Date().toISOString(), firmware: "v1.0.0" });
            $("#add-modal-overlay").classList.remove("active"); renderDeviceTable();
        }
    });
    ["modal-close", "modal-cancel"].forEach(function (id) { var el = $("#" + id); if (el) el.addEventListener("click", function () { $("#modal-overlay").classList.remove("active"); }); });
    ["add-modal-close", "add-modal-cancel"].forEach(function (id) { var el = $("#" + id); if (el) el.addEventListener("click", function () { $("#add-modal-overlay").classList.remove("active"); }); });
    ["modal-overlay", "add-modal-overlay"].forEach(function (id) { var el = $("#" + id); if (el) el.addEventListener("click", function (e) { if (e.target === el) el.classList.remove("active"); }); });
    $$(".export-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var action = btn.getAttribute("data-action"); var table = btn.closest(".panel").querySelector(".data-table"); if (!table) return;
            if (action === "copy") copyTableToClipboard(table);
            else if (action === "csv") downloadTableAsCSV(table);
            else if (action === "excel") downloadTableAsCSV(table, "xls");
            else if (action === "pdf" || action === "print") printTable(table);
        });
    });
    function copyTableToClipboard(table) { var text = tableToText(table); if (navigator.clipboard) { navigator.clipboard.writeText(text).then(function () { alert("\u06a9\u067e\u06cc \u0634\u062f!"); }); } }
    function downloadTableAsCSV(table, ext) { var text = tableToCSV(table); var blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" }); var link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "export." + (ext || "csv"); link.click(); }
    function printTable(table) { var win = window.open("", "_blank"); win.document.write('<html dir="rtl"><head><title>\u0686\u0627\u067e</title><style>body{font-family:Tahoma,sans-serif;direction:rtl}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:right}th{background:#f0f0f0}</style></head><body>'); win.document.write(table.outerHTML); win.document.write("</body></html>"); win.document.close(); win.print(); }
    function tableToText(table) { var rows = table.querySelectorAll("tr"); var lines = []; rows.forEach(function (row) { var cells = []; row.querySelectorAll("th, td").forEach(function (cell) { cells.push(cell.textContent.trim()); }); lines.push(cells.join("\t")); }); return lines.join("\n"); }
    function tableToCSV(table) { var rows = table.querySelectorAll("tr"); var lines = []; rows.forEach(function (row) { var cells = []; row.querySelectorAll("th, td").forEach(function (cell) { var val = cell.textContent.trim().replace(/"/g, '""'); cells.push('"' + val + '"'); }); lines.push(cells.join(",")); }); return lines.join("\n"); }
    function renderTableInfo(prefix, start, count, total) { var el = $("#" + prefix + "-table-info"); if (!el) return; if (total === 0) { el.textContent = "\u062f\u0627\u062f\u0647\u200c\u0627\u06cc \u06cc\u0627\u0641\u062a \u0646\u0634\u062f"; } else { el.textContent = "\u0646\u0645\u0627\u06cc\u0634 " + (start + 1) + " \u062a\u0627 " + (start + count) + " \u0627\u0632 " + total + " \u0631\u062f\u06cc\u0641"; } }
    function renderPagination(prefix, state, total) {
        var container = $("#" + prefix + "-pagination"); if (!container) return;
        var pages = Math.ceil(total / PAGE_SIZE); if (pages <= 1) { container.innerHTML = ""; return; }
        var html = '<button class="page-btn" data-p="prev" ' + (state.page <= 1 ? "disabled" : "") + '>&laquo;</button>';
        for (var i = 1; i <= pages; i++) html += '<button class="page-btn ' + (i === state.page ? "active" : "") + '" data-p="' + i + '">' + i + '</button>';
        html += '<button class="page-btn" data-p="next" ' + (state.page >= pages ? "disabled" : "") + '>&raquo;</button>';
        container.innerHTML = html;
        container.querySelectorAll(".page-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var p = btn.getAttribute("data-p");
                if (p === "prev") state.page = Math.max(1, state.page - 1);
                else if (p === "next") state.page = Math.min(pages, state.page + 1);
                else state.page = parseInt(p, 10);
                if (prefix === "home") renderHomeTable(); else if (prefix === "routes") renderRouteTable(); else if (prefix === "devices") renderDeviceTable(); else if (prefix === "report") renderReportTable();
            });
        });
    }
    function sortArray(arr, key, dir) { return arr.slice().sort(function (a, b) { var va = a[key] != null ? a[key] : ""; var vb = b[key] != null ? b[key] : ""; if (typeof va === "number" && typeof vb === "number") return dir === "asc" ? va - vb : vb - va; va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); if (va < vb) return dir === "asc" ? -1 : 1; if (va > vb) return dir === "asc" ? 1 : -1; return 0; }); }
    function bindTableSort(tableId, state, renderFn) { var table = $("#" + tableId); if (!table) return; table.querySelectorAll("th[data-sort]").forEach(function (th) { th.addEventListener("click", function () { var key = th.getAttribute("data-sort"); if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc"; else { state.sortKey = key; state.sortDir = "asc"; } state.page = 1; renderFn(); }); }); }
    function applySortHeaders(tableId, state) { var table = $("#" + tableId); if (!table) return; table.querySelectorAll("th[data-sort]").forEach(function (th) { th.classList.remove("sort-asc", "sort-desc"); if (th.getAttribute("data-sort") === state.sortKey) th.classList.add("sort-" + state.sortDir); }); }
    renderHome();
})();
ENDAPPJS

echo "[10/10] Installing dependencies & restarting ..."

# Setup .env if not exists
if [ ! -f "$BASE/server/.env" ]; then
    cp "$BASE/server/.env.example" "$BASE/server/.env"
    echo "[!] Created .env from .env.example - edit RMTO credentials!"
fi

# Install npm dependencies
cd "$BASE/server"
npm install --production 2>&1 | tail -5

# Setup systemd service
if [ ! -f /etc/systemd/system/tc-manager.service ]; then
    cat > /etc/systemd/system/tc-manager.service << 'ENDSVC'
[Unit]
Description=TC Manager Server (Sistan Akbari)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/tc-manager/server
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
ENDSVC
    systemctl daemon-reload
    systemctl enable tc-manager
    echo "[+] Systemd service created and enabled"
fi

# Setup nginx reverse proxy
if command -v nginx &>/dev/null; then
    cat > /etc/nginx/sites-available/tc-manager << 'ENDNGINX'
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 500M;
    }
}
ENDNGINX
    ln -sf /etc/nginx/sites-available/tc-manager /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null
    nginx -t 2>/dev/null && systemctl reload nginx
    echo "[+] Nginx configured"
fi

# Restart service
systemctl restart tc-manager
sleep 2

echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE!"
echo "============================================"
echo "  URL: http://$(hostname -I | awk '{print $1}')"
echo "  Login: admin / admin123"
echo ""
systemctl status tc-manager --no-pager -l 2>&1 | head -15
echo "============================================"
