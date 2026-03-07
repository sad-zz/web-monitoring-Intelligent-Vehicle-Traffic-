#!/bin/bash
# deploy-offline.sh — TC Manager v2026-03-07
# Self-contained: no internet required on server
# Usage: scp this file to server, then: bash deploy-offline.sh
set -e
TC_DIR="/opt/tc-manager"
if [ ! -d "$TC_DIR" ]; then echo "❌ $TC_DIR not found"; exit 1; fi
cd "$TC_DIR"
echo "========================================================"
echo "  TC Manager — آفلاین deploy (Fix1-Fix45 + Fix46-preview)"
echo "========================================================"
pm2 stop tc-manager 2>/dev/null || true
sleep 2
fuser -k 2022/tcp 3000/tcp 2>/dev/null || true
sleep 1

write_file() {
  local path="$1"; local content="$2"
  mkdir -p "$(dirname "$TC_DIR/$path")"
  printf '%s' "$content" > "$TC_DIR/$path"
  echo "✅ $path"
}

# === server/index.js ===
cat > "$TC_DIR/server/index.js" << 'TCEOF_server_index_js'
/**
 * TC Manager Server (Noavaran Jonoob Shargh)
 * - Login authentication
 * - Backup / Restore
 * - Receives data from 100+ devices
 * - Aggregates and sends to RMTO via SOAP
 *
 * @version 2026-02-27-v3
 * @fixes Fix1(stats-localtime) Fix2(offline-detect) Fix3(irawdata-dedup)
 *        Fix4(mehvar-ui) Fix5(tcp-panel) Fix6(users-table)
 *        Fix8(stop=create+5min) Fix9(tcp-connected-api)
 *        Fix10(0012-yyMMddHHmmss) Fix11(one-cmd-per-conn)
 *        Fix12(syntax-braces) Fix13(uncaughtException)
 *        Fix14(EADDRINUSE-retry) Fix15/16(HTTP-EADDRINUSE-exit)
 *        Fix17(deviceCode-strip) Fix18(clear-drift-on-disconnect)
 *        Fix19(deviceLastSeen) Fix20(setNoDelay)
 *        Fix21(dead-clock-0197) Fix22(8012-then-0197)
 *        Fix23(8821-drain) Fix24(zero-vehicle-store)
 *        Fix25(DB-last-for-0197) Fix26(skip-old-history)
 *        Fix27(deviceClockDrift-restore) Fix29d(rmto-queue-api)
 *        Fix30(TZ=Asia/Tehran) Fix31(8821-timestamp-fix)
 *        Fix33(SIGTERM-graceful) Fix34(skip-stale-UTC-records)
 *        Fix35(UPSERT-irawdata) Fix36(stop-future-intervals)
 *        Fix37(rmto-detail-button) Fix38(auth-error-detection)
 */
// Set Iran Standard Time (UTC+3:30) BEFORE any require() or Date operation.
// Without this, a UTC-timezone VPS sends UTC time via 0012 → device clocks are
// 3.5 hours wrong → 0197 requests miss stored intervals → data appears empty.
if (!process.env.TZ) process.env.TZ = "Asia/Tehran";
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

// ----------------------------------------------------------------
// SQLite-backed session store — sessions survive PM2 restart
// (no extra npm packages needed; uses existing better-sqlite3 db)
// ----------------------------------------------------------------
(function () {
    db.exec(
        "CREATE TABLE IF NOT EXISTS sessions (" +
        "  sid TEXT PRIMARY KEY," +
        "  data TEXT NOT NULL," +
        "  expires INTEGER NOT NULL" +
        ")"
    );
    db.prepare("DELETE FROM sessions WHERE expires < ?").run(Math.floor(Date.now() / 1000));
    setInterval(function () {
        db.prepare("DELETE FROM sessions WHERE expires < ?").run(Math.floor(Date.now() / 1000));
    }, 3600000);
})();

var util = require("util");
function SqliteStore(options) { session.Store.call(this, options || {}); }
util.inherits(SqliteStore, session.Store);
SqliteStore.prototype.get = function (sid, cb) {
    var row = db.prepare("SELECT data, expires FROM sessions WHERE sid = ?").get(sid);
    if (!row || row.expires < Math.floor(Date.now() / 1000)) {
        if (row) db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
        return cb(null, null);
    }
    try { cb(null, JSON.parse(row.data)); } catch (e) { cb(e); }
};
SqliteStore.prototype.set = function (sid, sess, cb) {
    var exp = sess.cookie && sess.cookie.expires
        ? Math.floor(new Date(sess.cookie.expires).getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 86400;
    db.prepare("INSERT INTO sessions (sid,data,expires) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET data=?,expires=?")
        .run(sid, JSON.stringify(sess), exp, JSON.stringify(sess), exp);
    if (cb) cb(null);
};
SqliteStore.prototype.destroy = function (sid, cb) {
    db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
    if (cb) cb(null);
};

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new SqliteStore(),
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Multer for file uploads (backup restore)
var upload = multer({ dest: path.join(__dirname, "uploads/"), limits: { fileSize: 500 * 1024 * 1024 } });

// ============================================================
// Auth Middleware
// ============================================================
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
// Serve Frontend (login page is public, dashboard requires auth)
// ============================================================
app.use(express.static(path.join(__dirname, "..")));

// ============================================================
// Live Log - keeps last 100 incoming requests for monitoring
// ============================================================
var liveLog = [];
var MAX_LOG = 200;

function addLiveLog(entry) {
    liveLog.unshift(entry);
    if (liveLog.length > MAX_LOG) liveLog.length = MAX_LOG;
}

// API to read live log (requires auth)
app.get("/api/live", requireAuth, function (req, res) {
    var since = parseInt(req.query.since, 10) || 0;
    if (since > 0) {
        var filtered = liveLog.filter(function (e) { return e.ts > since; });
        return res.json(filtered);
    }
    var limit = parseInt(req.query.limit, 10) || 50;
    res.json(liveLog.slice(0, limit));
});

// ============================================================
// Device data reception - NO AUTH (devices send data here)
// ============================================================
app.post("/api/data", function (req, res) {
    var b = req.body;
    var code = String(b.device_code || b.device_id || b.code || "");

    addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "data", ip: req.ip, device: code, body: b });

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
 * Body: { device_id, create_at, stop, lane, a,b,c,d,e,x, sa..sx, sao..sxo, overtaking, tooclose }
 * Or batch: { device_id, records: [{...}, ...] }
 * Vehicle: a=motorcycle b=car c=van d=bus e=truck x=unknown
 * Speed: sa..sx = sum of speeds per class
 * Violations: sao..sxo = over-speed count per class
 */
app.post("/api/irawdata", function (req, res) {
    var b = req.body;
    var code = String(b.device_id || b.device_code || b.code || "");

    addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "irawdata", ip: req.ip, device: code, a: b.a||0, b: b.b||0, c: b.c||0, d: b.d||0, e: b.e||0, x: b.x||0, lane: b.lane||1 });

    if (!code || !/^\d+$/.test(code)) return res.status(400).json({ error: "device_id required" });

    autoRegisterDevice(code);

    var insertRaw = db.prepare(
        "INSERT OR IGNORE INTO irawdata (device_code, create_at, stop, lane, is_read, a,b,c,d,e,x, sa,sb,sc,sd,se,sx, sao,sbo,sco,sdo,seo,sxo, overtaking, tooclose) " +
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
        // Also store in traffic_data for RMTO aggregation
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

// Auto-register unknown devices
function autoRegisterDevice(code) {
    var existing = db.prepare("SELECT device_code FROM devices WHERE device_code = ?").get(code);
    if (!existing) {
        try { db.prepare("INSERT INTO devices (device_code, name, type, status) VALUES (?, ?, 'counter', 'online')").run(code, "Device " + code); } catch(e){}
    }
    db.prepare("UPDATE devices SET status = 'online', last_seen = datetime('now','localtime') WHERE device_code = ?").run(code);
}

// Log ALL POST requests to catch unknown device formats
app.post("*", function (req, res, next) {
    if (req.path.indexOf("/api/auth") === -1 && req.path.indexOf("/api/settings") === -1 && req.path.indexOf("/api/backup") === -1) {
        addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "unknown", ip: req.ip, path: req.path, body: req.body });
    }
    next();
});

// ============================================================
// All API below requires authentication
// ============================================================
app.use("/api/devices", requireAuth);
app.use("/api/stats", requireAuth);
app.use("/api/rmto", requireAuth);
app.use("/api/traffic", requireAuth);
app.use("/api/backup", requireAuth);
app.use("/api/settings", requireAuth);

// ============================================================
// API: Settings
// ============================================================
app.get("/api/settings", function (req, res) {
    var rows = db.prepare("SELECT key, value FROM settings").all();
    var settings = {};
    rows.forEach(function (r) { settings[r.key] = r.value; });
    res.json(settings);
});

app.post("/api/settings", function (req, res) {
    var upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?");
    var b = req.body;
    var allowed = ["system_name", "server_ip", "server_port", "tcp_port", "refresh_interval", "max_speed", "alert_offline", "alert_speed", "alert_error", "offline_timeout", "rmto_company_code", "rmto_username", "rmto_password", "rmto_wsdl"];
    var updated = 0;
    allowed.forEach(function (k) {
        if (b[k] !== undefined) {
            upsert.run(k, String(b[k]), String(b[k]));
            updated++;
        }
    });
    res.json({ success: true, updated: updated });
});

// ============================================================
// API: Server Time
// ============================================================
app.get("/api/server/time", requireAuth, function (req, res) {
    var now = new Date();
    res.json({
        time: now.toISOString(),
        local: now.toLocaleString("fa-IR", { timeZone: process.env.TZ || "Asia/Tehran" }),
        timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tehran",
        uptime: process.uptime()
    });
});

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
    if (!/^\d{1,8}$/.test(b.device_code)) return res.status(400).json({ error: "device_code must be 1-8 digits" });
    try {
        db.prepare("INSERT INTO devices (device_code, name, type, route, ip, status, firmware, mehvar_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(b.device_code, b.name, b.type || "sensor", b.route || "", b.ip || "", "offline", b.firmware || "", b.mehvar_code || null);
        res.json({ success: true, device_code: b.device_code });
    } catch (e) {
        if (e.message.indexOf("UNIQUE") !== -1) return res.status(409).json({ error: "duplicate device_code" });
        res.status(500).json({ error: e.message });
    }
});

app.put("/api/devices/:code", function (req, res) {
    var b = req.body;
    db.prepare("UPDATE devices SET name = COALESCE(?, name), type = COALESCE(?, type), route = COALESCE(?, route), ip = COALESCE(?, ip), firmware = COALESCE(?, firmware), mehvar_code = COALESCE(?, mehvar_code) WHERE device_code = ?").run(b.name, b.type, b.route, b.ip, b.firmware, b.mehvar_code || null, req.params.code);
    res.json({ success: true });
});

app.delete("/api/devices/:code", function (req, res) {
    db.prepare("DELETE FROM devices WHERE device_code = ?").run(req.params.code);
    res.json({ success: true });
});

// Import multiple devices from JSON array
app.post("/api/devices/import", function (req, res) {
    var devices = req.body.devices;
    if (!Array.isArray(devices) || !devices.length) return res.status(400).json({ error: "devices array required" });
    var insert = db.prepare("INSERT OR IGNORE INTO devices (device_code, name, type, route, status) VALUES (?, ?, ?, ?, 'offline')");
    var imported = 0;
    var tx = db.transaction(function () {
        devices.forEach(function (d) {
            if (!d.device_code || !/^\d{1,8}$/.test(String(d.device_code))) return;
            insert.run(String(d.device_code), d.name || ("Device " + d.device_code), d.type || "counter", d.route || "");
            imported++;
        });
    });
    tx();
    res.json({ success: true, imported: imported });
});

// ============================================================
// API: Dashboard Stats
// ============================================================
app.get("/api/stats", function (req, res) {
    var totalDevices = db.prepare("SELECT COUNT(*) as c FROM devices").get().c;
    var onlineDevices = db.prepare("SELECT COUNT(*) as c FROM devices WHERE status = 'online'").get().c;
    var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    // Use local time format (irawdata.create_at is stored as local time, not UTC)
    var todayStartStr = todayStart.getFullYear() + "-" +
        String(todayStart.getMonth() + 1).padStart(2, "0") + "-" +
        String(todayStart.getDate()).padStart(2, "0") + "T00:00:00";
    // Count today's vehicles from irawdata (where TCP/HTTP device data is stored)
    var todayIraw = db.prepare("SELECT COALESCE(SUM(a+b+c+d+e+x), 0) as c FROM irawdata WHERE create_at >= ?").get(todayStartStr);
    var todayVehicles = (todayIraw && todayIraw.c) || 0;
    var unsentCount = db.prepare("SELECT COUNT(*) as c FROM rmto_queue WHERE sent = 0").get().c;
    var unsent5Count = db.prepare("SELECT COUNT(*) as c FROM rmto_queue_5class WHERE sent = 0").get().c;
    res.json({ totalDevices: totalDevices, onlineDevices: onlineDevices, todayVehicles: todayVehicles, unsentRMTO: unsentCount, unsentRMTO5: unsent5Count });
});

// ============================================================
// API: RMTO
// ============================================================
app.get("/api/rmto/logs", function (req, res) {
    var limit = parseInt(req.query.limit, 10) || 50;
    res.json(db.prepare("SELECT * FROM send_log ORDER BY created_at DESC LIMIT ?").all(limit));
});

app.post("/api/rmto/send-now", function (req, res) {
    scheduler.processAndSendIrawdata();
    scheduler.sendUnsentData();
    res.json({ success: true });
});

app.post("/api/rmto/aggregate", function (req, res) {
    scheduler.processAndSendIrawdata();
    res.json({ success: true });
});

// Reinitialize RMTO SOAP client after settings change
app.post("/api/rmto/reinit", function (req, res) {
    rmto.reinit(function (err, info) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, wsdl: info.wsdl, company: info.company, user: info.user, hasPass: info.hasPass });
    });
});

// Reset auth-error records so they can be retried after credentials are fixed
app.post("/api/rmto/reset-auth-errors", function (req, res) {
    try {
        var info = db.prepare("UPDATE irawdata SET rmto_id = NULL, rmto_err = NULL WHERE rmto_id = -2").run();
        res.json({ success: true, reset: info.changes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Reinitialize RMTO SOAP client after settings change (called by UI after saving RMTO settings)
app.post("/api/rmto/reinit", function (req, res) {
    rmto.reinit(function (err, info) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, wsdl: info.wsdl, company: info.company, user: info.user, hasPass: info.hasPass });
    });
});

// Show last SOAP XML actually sent by node-soap (for debugging)
app.get("/api/rmto/lastsoap", requireAuth, function (req, res) {
    var xml = rmto.getLastSoapXml ? rmto.getLastSoapXml() : null;
    res.json({ soapXml: xml || "(هنوز هیچ ارسالی انجام نشده یا RMTO_DEBUG=1 نیست)" });
});

// Preview Add5 payload for a specific irawdata record
app.get("/api/rmto/preview/:id", function (req, res) {
    try {
        var row = db.prepare("SELECT * FROM irawdata WHERE id = ?").get(req.params.id);
        if (!row) return res.status(404).json({ error: "رکورد یافت نشد" });

        var companyCode = 58;
        try {
            var s = db.prepare("SELECT value FROM settings WHERE key='rmto_company_code'").get();
            if (s && s.value) companyCode = parseInt(s.value, 10) || 58;
        } catch (e) {}

        // RMTO Add5 class mapping — identical to scheduler.js (Fix45c)
        // C1 = سواری و وانت       = firmware a (motorcycle) + b (car) + c (van/pickup)
        // C2 = کامیونت و مینی‌بوس = firmware d (light truck/minibus)
        // C3 = کامیون دو محور     = firmware e (2-axle truck)
        // C4 = اتوبوس             = 0 (RATCX1 cannot distinguish bus)
        // C5 = کامیون سه محور+    = firmware x (3+ axle heavy)
        var c1 = (row.a || 0) + (row.b || 0) + (row.c || 0);
        var c2 = row.d || 0;
        var c3 = row.e || 0;
        var c4 = 0;
        var c5 = row.x || 0;
        var totalCount = c1 + c2 + c3 + c4 + c5;
        var sc1 = (row.sa || 0) + (row.sb || 0) + (row.sc || 0);
        var sc2 = row.sd || 0;
        var sc3 = row.se || 0;
        var sc4 = 0;
        var sc5 = row.sx || 0;
        var asp = totalCount > 0 ? Math.round((sc1 + sc2 + sc3 + sc4 + sc5) / totalCount) : 0;
        var s1 = c1 > 0 ? Math.round(sc1 / c1) : 0;
        var s2 = c2 > 0 ? Math.round(sc2 / c2) : 0;
        var s3 = c3 > 0 ? Math.round(sc3 / c3) : 0;
        var s4 = 0;
        var s5 = c5 > 0 ? Math.round(sc5 / c5) : 0;
        var so1 = (row.sao || 0) + (row.sbo || 0) + (row.sco || 0);
        var so2 = row.sdo || 0;
        var so3 = row.seo || 0;
        var so4 = 0;
        var so5 = row.sxo || 0;
        var sso = so1 + so2 + so3 + so4 + so5;
        var isNull = (totalCount === 0);

        // RID = mehvar_code (شناسه محور) if set, otherwise device_code
        var previewDevRow = null;
        try { previewDevRow = db.prepare("SELECT mehvar_code FROM devices WHERE device_code = ?").get(row.device_code); } catch (e) {}
        var previewRid = (previewDevRow && previewDevRow.mehvar_code) ? parseInt(previewDevRow.mehvar_code, 10) : (parseInt(row.device_code, 10) || 0);

        var payload = {
            CID: companyCode,
            UID: "(rmto_username از تنظیمات)",
            PWD: "***",
            FID: row.id,
            RID: previewRid,
            ST: row.create_at,
            ET: row.stop,
            C1: isNull ? null : c1,
            C2: isNull ? null : c2,
            C3: isNull ? null : c3,
            C4: isNull ? null : c4,
            C5: isNull ? null : c5,
            ASP: isNull ? null : asp,
            S1: isNull ? null : s1,
            S2: isNull ? null : s2,
            S3: isNull ? null : s3,
            S4: isNull ? null : s4,
            S5: isNull ? null : s5,
            SSO: isNull ? null : sso,
            SO1: isNull ? null : so1,
            SO2: isNull ? null : so2,
            SO3: isNull ? null : so3,
            SO4: isNull ? null : so4,
            SO5: isNull ? null : so5,
            OO: row.overtaking || 0,
            ESD: row.tooclose || 0
        };

        // Note: node-soap determines actual namespace from WSDL (typically http://tempuri.org/)
        // The XML below uses the standard .NET ASMX namespace
        var nsUri = "http://tempuri.org/";
        var classLabels = {
            CID: "شناسه شرکت", UID: "نام کاربری", PWD: "رمز عبور",
            FID: "شناسه رکورد", RID: "شناسه محور",
            ST: "زمان شروع", ET: "زمان پایان",
            C1: "سواری و وانت (a+b+c)", C2: "کامیونت و مینی‌بوس (d)", C3: "کامیون دو محور (e)",
            C4: "اتوبوس (0-RATCX1 ندارد)", C5: "کامیون سه محور+ (x)",
            ASP: "سرعت متوسط وزنی", S1: "سرعت C1", S2: "سرعت C2",
            S3: "سرعت C3", S4: "سرعت C4", S5: "سرعت C5",
            SSO: "تخلف سرعت جمع", SO1: "تخلف سرعت C1", SO2: "تخلف سرعت C2",
            SO3: "تخلف سرعت C3", SO4: "تخلف سرعت C4", SO5: "تخلف سرعت C5",
            OO: "سبقت غیرمجاز", ESD: "فاصله غیرمجاز"
        };
        var soapXml = '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n' +
            '  <soap:Body>\n' +
            '    <Add5 xmlns="' + nsUri + '">\n' +
            Object.keys(payload).map(function (k) {
                var label = classLabels[k] ? " <!-- " + classLabels[k] + " -->" : "";
                return "      <" + k + ">" + (payload[k] === null ? "" : payload[k]) + "</" + k + ">" + label;
            }).join("\n") + "\n" +
            '    </Add5>\n' +
            '  </soap:Body>\n' +
            '</soap:Envelope>';

        res.json({
            record: {
                id: row.id,
                device_code: row.device_code,
                create_at: row.create_at,
                stop: row.stop,
                total_vehicles: totalCount,
                isNull: isNull,
                rmto_id: row.rmto_id,
                rmto_err: row.rmto_err
            },
            payload: payload,
            soapXml: soapXml
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/rmto/queue", function (req, res) {
    // Show irawdata records with RMTO status (per-interval pipeline)
    var unsent = db.prepare(
        "SELECT id, device_code, create_at, stop, " +
        "(a+b+c+d+e+x) as total_vehicles, " +
        "CASE WHEN (a+b+c+d+e+x)>0 THEN ROUND((sa+sb+sc+sd+se+sx)*1.0/(a+b+c+d+e+x)) ELSE 0 END as avg_speed, " +
        "received_at as created_at " +
        "FROM irawdata WHERE (rmto_id IS NULL OR rmto_id = 0) ORDER BY create_at DESC LIMIT 100"
    ).all();
    var sent = db.prepare(
        "SELECT id, device_code, create_at, stop, " +
        "(a+b+c+d+e+x) as total_vehicles, " +
        "CASE WHEN (a+b+c+d+e+x)>0 THEN ROUND((sa+sb+sc+sd+se+sx)*1.0/(a+b+c+d+e+x)) ELSE 0 END as avg_speed, " +
        "rmto_id, rmto_cfl, rmto_srvdt, rmto_bil, rmto_err " +
        "FROM irawdata WHERE rmto_id IS NOT NULL AND rmto_id > 0 ORDER BY create_at DESC LIMIT 50"
    ).all();
    // Auth-error records (rmto_id = -2): permanent failures, user must fix credentials
    var authErrors = db.prepare(
        "SELECT COUNT(*) as c FROM irawdata WHERE rmto_id = -2"
    ).get().c;
    // Recent auth errors from send_log (last 10 entries)
    var recentAuthErr = db.prepare(
        "SELECT COUNT(*) as c FROM send_log WHERE success = 0 AND error_message LIKE '%Wrong%' " +
        "AND created_at >= datetime('now','-1 hour','localtime')"
    ).get().c;
    res.json({ unsent: unsent, sent: sent, authErrorCount: authErrors, recentAuthErrors: recentAuthErr });
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
// API: irawdata list (Data Reception view)
// ============================================================
app.use("/api/irawdata/list", requireAuth);
app.get("/api/irawdata/list", function (req, res) {
    var limit = parseInt(req.query.limit, 10) || 100;
    var offset = parseInt(req.query.offset, 10) || 0;
    var code = req.query.device_code || "";
    var sql = "SELECT * FROM irawdata WHERE 1=1";
    var countSql = "SELECT COUNT(*) as total FROM irawdata WHERE 1=1";
    var params = [];
    var countParams = [];
    if (code) { sql += " AND device_code = ?"; countSql += " AND device_code = ?"; params.push(code); countParams.push(code); }
    sql += " ORDER BY create_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    var rows = db.prepare(sql).all.apply(db.prepare(sql), params);
    var total = db.prepare(countSql).all.apply(db.prepare(countSql), countParams)[0].total;
    res.json({ rows: rows, total: total });
});

// ============================================================
// API: Mehvar (routes from DB)
// ============================================================
app.use("/api/mehvar", requireAuth);
app.get("/api/mehvar", function (req, res) {
    res.json(db.prepare("SELECT * FROM mehvar ORDER BY code").all());
});

app.post("/api/mehvar", function (req, res) {
    var b = req.body;
    if (!b.code || !b.name) return res.status(400).json({ error: "code and name required" });
    try {
        db.prepare("INSERT INTO mehvar (code, name, send_enable, repair, ostan) VALUES (?, ?, ?, ?, ?)").run(parseInt(b.code), b.name, b.send_enable !== undefined ? parseInt(b.send_enable) : 1, b.repair ? parseInt(b.repair) : 0, b.ostan || "");
        res.json({ success: true });
    } catch (e) {
        if (e.message.indexOf("UNIQUE") !== -1) return res.status(409).json({ error: "duplicate code" });
        res.status(500).json({ error: e.message });
    }
});

app.delete("/api/mehvar/:code", function (req, res) {
    db.prepare("DELETE FROM mehvar WHERE code = ?").run(parseInt(req.params.code));
    res.json({ success: true });
});

// ============================================================
// PostgreSQL Dump Importer
// ============================================================
function importPostgresDump(filePath) {
    var zlib = require("zlib");
    var raw;
    if (filePath.endsWith(".gz")) {
        raw = zlib.gunzipSync(fs.readFileSync(filePath)).toString("utf8");
    } else {
        raw = fs.readFileSync(filePath, "utf8");
    }

    var stats = { devices: 0, irawdata: 0, mehvar: 0 };
    var lines = raw.split("\n");
    var copyMode = null;
    var copyColumns = [];

    var insertDevice = db.prepare("INSERT OR IGNORE INTO devices (device_code, name, type, status) VALUES (?, ?, 'counter', 'offline')");
    var insertIraw = db.prepare(
        "INSERT OR IGNORE INTO irawdata (device_code, create_at, stop, lane, is_read, a,b,c,d,e,x, sa,sb,sc,sd,se,sx, sao,sbo,sco,sdo,seo,sxo, overtaking, tooclose) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    var insertMehvar = db.prepare("INSERT OR IGNORE INTO mehvar (code, name, send_enable, repair, ostan) VALUES (?, ?, ?, ?, ?)");

    var importTx = db.transaction(function () {
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];

            // Detect COPY ... FROM stdin
            if (line.indexOf("COPY ") === 0 && line.indexOf("FROM stdin") !== -1) {
                var match = line.match(/COPY\s+(\S+)\s*\(([^)]+)\)/);
                if (match) {
                    var tableName = match[1].replace(/^public\./, "");
                    copyColumns = match[2].split(",").map(function (c) { return c.trim(); });
                    if (tableName === "device_device" || tableName === "device_irawdata" || tableName === "device_mehvar") {
                        copyMode = tableName;
                    } else {
                        copyMode = null;
                    }
                }
                continue;
            }

            // End of COPY block
            if (line === "\\." || line === "\\.") {
                copyMode = null;
                copyColumns = [];
                continue;
            }

            if (!copyMode) continue;

            var vals = line.split("\t");
            if (vals.length < 2) continue;

            function colVal(name) {
                var idx = copyColumns.indexOf(name);
                if (idx === -1) return null;
                var v = vals[idx];
                return (v === "\\N" || v === undefined) ? null : v;
            }

            if (copyMode === "device_device") {
                var devCode = colVal("code");
                if (devCode) {
                    insertDevice.run(String(devCode), "Device " + devCode);
                    stats.devices++;
                }
            } else if (copyMode === "device_irawdata") {
                var devId = colVal("device_id");
                var createAt = colVal("create_at") || new Date().toISOString();
                var stop = colVal("stop") || createAt;
                if (devId) {
                    insertIraw.run(String(devId), createAt, stop,
                        parseInt(colVal("lane")) || 1, parseInt(colVal("is_read")) || 0,
                        parseInt(colVal("a")) || 0, parseInt(colVal("b")) || 0, parseInt(colVal("c")) || 0,
                        parseInt(colVal("d")) || 0, parseInt(colVal("e")) || 0, parseInt(colVal("x")) || 0,
                        parseInt(colVal("sa")) || 0, parseInt(colVal("sb")) || 0, parseInt(colVal("sc")) || 0,
                        parseInt(colVal("sd")) || 0, parseInt(colVal("se")) || 0, parseInt(colVal("sx")) || 0,
                        parseInt(colVal("sao")) || 0, parseInt(colVal("sbo")) || 0, parseInt(colVal("sco")) || 0,
                        parseInt(colVal("sdo")) || 0, parseInt(colVal("seo")) || 0, parseInt(colVal("sxo")) || 0,
                        parseInt(colVal("overtaking")) || 0, parseInt(colVal("tooclose")) || 0);
                    stats.irawdata++;
                }
            } else if (copyMode === "device_mehvar") {
                var mCode = colVal("code");
                var mName = colVal("name");
                if (mCode && mName) {
                    insertMehvar.run(parseInt(mCode), mName, parseInt(colVal("send_enable")) || 1, parseInt(colVal("repair")) || 0, colVal("ostan_id") || "");
                    stats.mehvar++;
                }
            }
        }
    });

    importTx();
    console.log("[Backup] Imported from PostgreSQL dump:", JSON.stringify(stats));
    return stats;
}

// ============================================================
// API: Backup & Restore
// ============================================================

// Download backup (copy of SQLite DB file)
app.get("/api/backup/download", function (req, res) {
    var dbPath = path.join(__dirname, "data.db");
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: "database not found" });

    // Checkpoint WAL before backup
    try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch (e) { /* ok */ }

    var timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    var filename = "tc-manager-backup-" + timestamp + ".db";
    res.download(dbPath, filename);
});

// Restore from uploaded .sql.gz or .db file
app.post("/api/backup/restore", upload.single("backup"), function (req, res) {
    if (!req.file) return res.status(400).json({ error: "فایل بکاپ الزامی است" });

    var tmpPath = req.file.path;
    var origName = req.file.originalname || "";
    var dbPath = path.join(__dirname, "data.db");

    try {
        if (origName.endsWith(".db")) {
            // Direct SQLite DB file - replace
            db.pragma("wal_checkpoint(TRUNCATE)");
            db.close();
            fs.copyFileSync(tmpPath, dbPath);
            // Re-require db (Node caches modules, so we need to clear)
            delete require.cache[require.resolve("./db")];
            res.json({ success: true, message: "بازیابی انجام شد. سرویس باید ریستارت شود." });
        } else if (origName.endsWith(".sql.gz") || origName.endsWith(".gz") || origName.endsWith(".sql")) {
            // PostgreSQL dump - decompress and parse
            var destPath = path.join(__dirname, "uploads", origName);
            fs.renameSync(tmpPath, destPath);
            try {
                var result = importPostgresDump(destPath);
                res.json({ success: true, message: "بازیابی انجام شد. " + result.devices + " دستگاه و " + result.irawdata + " رکورد داده وارد شد.", details: result });
            } catch (parseErr) {
                res.json({ success: true, message: "فایل ذخیره شد ولی پردازش خودکار با خطا مواجه شد: " + parseErr.message, path: destPath });
            }
        } else {
            fs.unlinkSync(tmpPath);
            return res.status(400).json({ error: "فرمت فایل پشتیبانی نمی‌شود. از .db یا .sql.gz استفاده کنید" });
        }
    } catch (e) {
        res.status(500).json({ error: "خطا در بازیابی: " + e.message });
    }
});

// List uploaded backup files
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
// TCP Server for raw device data (port 2022)
// Devices send fixed-length ASCII strings via TCP
// ============================================================
var net = require("net");
var TCP_PORT = parseInt(process.env.TCP_PORT, 10) || 2022;

/**
 * Parse RATCX1 firmware interval data (264 chars sent after "8821" + datetime prefix).
 * Firmware format (from 91-7.c / Interval.h):
 *   [0-7]:    system_id (8 digits, e.g. "10001704")
 *   [8-17]:   datetime  YYMMDDHHMI (10 chars)
 *   --- Lane 1: 6 classes (A,B,C,D,E,X) x 19 chars each = 114 ---
 *   Per class: count(4) + avgSpeed(3) + speedViolation(4) + grab(4) + headway(4)
 *   [18-36]:   class A lane1     [37-55]:  class B lane1
 *   [56-74]:   class C lane1     [75-93]:  class D lane1
 *   [94-112]:  class E lane1     [113-131]: class X lane1
 *   [132-134]: lane1 occupancy (3 chars)
 *   --- Lane 2: same structure = 114 + 3 ---
 *   [135-153]: class A lane2     [154-172]: class B lane2
 *   [173-191]: class C lane2     [192-210]: class D lane2
 *   [211-229]: class E lane2     [230-248]: class X lane2
 *   [249-251]: lane2 occupancy (3 chars)
 *   [252-254]: battery voltage (3 chars)
 *   [255-257]: solar voltage (3 chars)
 *   [258-261]: error_byte (4 chars)
 *   [262-263]: CR+LF
 */
function parseRATCX1Interval(intervalStr) {
    var s = intervalStr.replace(/[\r\n\x00]/g, "");
    if (s.length < 262) return null;

    var deviceCode = s.substring(0, 8).replace(/^0+/, "") || "0";
    var yy = s.substring(8, 10), mm = s.substring(10, 12), dd = s.substring(12, 14);
    var hh = s.substring(14, 16), mi = s.substring(16, 18);
    var year = parseInt(yy, 10) > 50 ? "19" + yy : "20" + yy;
    var dateStr = year + "-" + mm + "-" + dd + "T" + hh + ":" + mi + ":00";

    function parseClass(offset) {
        return {
            count: parseInt(s.substring(offset, offset + 4), 10) || 0,
            avgSpeed: parseInt(s.substring(offset + 4, offset + 7), 10) || 0,
            speedViolation: parseInt(s.substring(offset + 7, offset + 11), 10) || 0,
            grab: parseInt(s.substring(offset + 11, offset + 15), 10) || 0,
            headway: parseInt(s.substring(offset + 15, offset + 19), 10) || 0
        };
    }

    // Lane 1
    var l1a = parseClass(18);
    var l1b = parseClass(37);
    var l1c = parseClass(56);
    var l1d = parseClass(75);
    var l1e = parseClass(94);
    var l1x = parseClass(113);
    var l1occ = parseInt(s.substring(132, 135), 10) || 0;

    // Lane 2
    var l2a = parseClass(135);
    var l2b = parseClass(154);
    var l2c = parseClass(173);
    var l2d = parseClass(192);
    var l2e = parseClass(211);
    var l2x = parseClass(230);
    var l2occ = parseInt(s.substring(249, 252), 10) || 0;

    var battery = parseInt(s.substring(252, 255), 10) || 0;
    var solar = parseInt(s.substring(255, 258), 10) || 0;
    var errorByte = parseInt(s.substring(258, 262), 10) || 0;

    return {
        device_code: deviceCode,
        create_at: dateStr,
        lane1: { a: l1a, b: l1b, c: l1c, d: l1d, e: l1e, x: l1x, occupancy: l1occ },
        lane2: { a: l2a, b: l2b, c: l2c, d: l2d, e: l2e, x: l2x, occupancy: l2occ },
        battery: battery,
        solar: solar,
        error_byte: errorByte
    };
}

/** Convert RATCX1 parsed interval to irawdata rows (one per lane) */
function ratcx1ToIrawdata(parsed) {
    // Calculate stop time = create_at + 5 minutes (each interval is a 5-min window)
    var createDate = new Date(parsed.create_at);
    var stopDate = new Date(createDate.getTime() + 5 * 60 * 1000);
    var stopStr;
    if (isNaN(stopDate.getTime())) {
        stopStr = parsed.create_at; // fallback: same as create_at
    } else {
        stopStr = stopDate.getFullYear() + "-" +
            String(stopDate.getMonth() + 1).padStart(2, "0") + "-" +
            String(stopDate.getDate()).padStart(2, "0") + "T" +
            String(stopDate.getHours()).padStart(2, "0") + ":" +
            String(stopDate.getMinutes()).padStart(2, "0") + ":00";
    }

    var rows = [];
    [{ lane: 1, data: parsed.lane1 }, { lane: 2, data: parsed.lane2 }].forEach(function (l) {
        var d = l.data;
        rows.push({
            device_code: parsed.device_code,
            create_at: parsed.create_at,
            stop: stopStr,
            lane: l.lane,
            a: d.a.count, b: d.b.count, c: d.c.count, d: d.d.count, e: d.e.count, x: d.x.count,
            sa: d.a.avgSpeed * d.a.count, sb: d.b.avgSpeed * d.b.count,
            sc: d.c.avgSpeed * d.c.count, sd: d.d.avgSpeed * d.d.count,
            se: d.e.avgSpeed * d.e.count, sx: d.x.avgSpeed * d.x.count,
            sao: d.a.speedViolation, sbo: d.b.speedViolation,
            sco: d.c.speedViolation, sdo: d.d.speedViolation,
            seo: d.e.speedViolation, sxo: d.x.speedViolation,
            overtaking: d.a.grab + d.b.grab + d.c.grab + d.d.grab + d.e.grab + d.x.grab,
            tooclose: d.a.headway + d.b.headway + d.c.headway + d.d.headway + d.e.headway + d.x.headway
        });
    });
    return rows;
}

/**
 * Parse iccore fixed-length raw data from device.
 * Format (based on standard iccore TC protocol):
 *   8 chars: device_code
 *  14 chars: start datetime YYYYMMDDHHmmss
 *  14 chars: stop datetime  YYYYMMDDHHmmss
 *   1 char:  lane
 *   5 chars each: a, b, c, d, e, x     (vehicle counts)     = 30
 *   8 chars each: sa, sb, sc, sd, se, sx (speed sums)        = 48
 *   5 chars each: sao, sbo, sco, sdo, seo, sxo (over-speed)  = 30
 *   5 chars: overtaking
 *   5 chars: tooclose
 * Total minimum: 8+14+14+1+30+48+30+5+5 = 155 chars
 */
function parseIccoreData(raw) {
    raw = raw.replace(/[\r\n\x00]/g, "").trim();
    if (raw.length < 37) return null; // too short - at least device + timestamps + lane

    var pos = 0;
    function take(n) { var s = raw.substring(pos, pos + n); pos += n; return s; }

    var deviceCode = take(8).replace(/^0+/, "") || "0";
    var startStr = take(14);
    var stopStr = take(14);
    var lane = parseInt(take(1), 10) || 1;

    function parseDateTime(s) {
        if (!s || s.length < 14 || s === "00000000000000") return new Date().toISOString();
        var y = s.substring(0, 4), mo = s.substring(4, 6), d = s.substring(6, 8);
        var h = s.substring(8, 10), mi = s.substring(10, 12), se = s.substring(12, 14);
        return y + "-" + mo + "-" + d + "T" + h + ":" + mi + ":" + se;
    }

    var result = {
        device_code: deviceCode,
        create_at: parseDateTime(startStr),
        stop: parseDateTime(stopStr),
        lane: lane,
        a: 0, b: 0, c: 0, d: 0, e: 0, x: 0,
        sa: 0, sb: 0, sc: 0, sd: 0, se: 0, sx: 0,
        sao: 0, sbo: 0, sco: 0, sdo: 0, seo: 0, sxo: 0,
        overtaking: 0, tooclose: 0
    };

    // Parse remaining fields if data is long enough
    if (raw.length >= 67) { // 37 + 30 vehicle counts
        result.a = parseInt(take(5), 10) || 0;
        result.b = parseInt(take(5), 10) || 0;
        result.c = parseInt(take(5), 10) || 0;
        result.d = parseInt(take(5), 10) || 0;
        result.e = parseInt(take(5), 10) || 0;
        result.x = parseInt(take(5), 10) || 0;
    }
    if (raw.length >= 115) { // 67 + 48 speed sums
        result.sa = parseInt(take(8), 10) || 0;
        result.sb = parseInt(take(8), 10) || 0;
        result.sc = parseInt(take(8), 10) || 0;
        result.sd = parseInt(take(8), 10) || 0;
        result.se = parseInt(take(8), 10) || 0;
        result.sx = parseInt(take(8), 10) || 0;
    }
    if (raw.length >= 145) { // 115 + 30 over-speed
        result.sao = parseInt(take(5), 10) || 0;
        result.sbo = parseInt(take(5), 10) || 0;
        result.sco = parseInt(take(5), 10) || 0;
        result.sdo = parseInt(take(5), 10) || 0;
        result.seo = parseInt(take(5), 10) || 0;
        result.sxo = parseInt(take(5), 10) || 0;
    }
    if (raw.length >= 150) result.overtaking = parseInt(take(5), 10) || 0;
    if (raw.length >= 155) result.tooclose = parseInt(take(5), 10) || 0;

    return result;
}

// Track connected RATCX1 devices for sending commands
var connectedDevices = {};

// Track pending time syncs waiting for ACK (device_code -> { retries, timer, deferDataRequest, socket })
var pendingSyncs = {};

// Track clock drift per device (device_code -> drift in minutes)
var deviceClockDrift = {};

// Track device's last known reported time (device_code -> { devTime: Date, serverTime: Date })
// Used to send 0197 with device-adjusted timestamp when device RTC is out of sync
var deviceLastSeen = {};

// ============================================================
// TCP: Time sync & Active polling
// ============================================================
function formatPollTimestamp(date) {
    var yy = String(date.getFullYear()).substring(2);
    var mm = String(date.getMonth() + 1).padStart(2, "0");
    var dd = String(date.getDate()).padStart(2, "0");
    var hh = String(date.getHours()).padStart(2, "0");
    var mi = String(date.getMinutes()).padStart(2, "0");
    return yy + mm + dd + hh + mi;
}

/**
 * Format date for time sync command "0012".
 * Firmware (DS1305_Lib.h rtc_write) reads uart2_data[4..15] as yyMMddHHmmss:
 *   [4-5]  = year  (2 digits, e.g. "26" for 2026)
 *   [6-7]  = month (2 digits)
 *   [8-9]  = day   (2 digits)
 *   [10-11]= hour  (2 digits)
 *   [12-13]= minute(2 digits)
 *   [14-15]= second(2 digits)
 * C# original: DateTime.Now.ToString("yyMMddHHmmss")
 * NOT the verbose "YYYY.MM.DD-HH:MM:SS.0" format (that is what the device sends OUT).
 */
function formatDeviceDatetime(date) {
    var yy = String(date.getFullYear()).substring(2); // last 2 digits of year
    var mo = String(date.getMonth() + 1).padStart(2, "0");
    var dy = String(date.getDate()).padStart(2, "0");
    var h  = String(date.getHours()).padStart(2, "0");
    var m  = String(date.getMinutes()).padStart(2, "0");
    var s  = String(date.getSeconds()).padStart(2, "0");
    return yy + mo + dy + h + m + s;  // 12 chars: yyMMddHHmmss
}

/**
 * Send a command to device via TCP with detailed logging.
 */
function sendToDevice(deviceCode, socket, cmd, label) {
    if (socket.destroyed) {
        console.log("[TCP] >> " + deviceCode + " SKIP (disconnected): " + label);
        return false;
    }
    console.log("[TCP] >> " + deviceCode + " " + label + ": " + cmd + " (" + cmd.length + " bytes)");
    try {
        socket.write(cmd + "\r\n");
        return true;
    } catch (e) {
        console.error("[TCP] >> " + deviceCode + " write error: " + e.message);
        return false;
    }
}

/**
 * Send time sync "0012" command to device.
 * Format: "0012yyMMddHHmmss" (4+12 = 16 bytes before CRLF)
 * Firmware reads uart2_data[4..15] as: year(2),month(2),day(2),hour(2),min(2),sec(2)
 */
function syncDeviceTime(deviceCode, socket) {
    var now = new Date();
    var cmd = "0012" + formatDeviceDatetime(now);
    var sent = sendToDevice(deviceCode, socket, cmd, "TIME_SYNC");
    if (!sent) return false;

    // Track this sync and set up ACK timeout with retry
    if (!pendingSyncs[deviceCode]) {
        pendingSyncs[deviceCode] = { retries: 0, deferDataRequest: false, socket: null };
    }
    var ps = pendingSyncs[deviceCode];
    if (ps.timer) clearTimeout(ps.timer);

    ps.timer = setTimeout(function () {
        if (!pendingSyncs[deviceCode]) return; // ACK already received
        if (pendingSyncs[deviceCode].retries < 3) {
            pendingSyncs[deviceCode].retries++;
            console.log("[TCP] TIME_SYNC ACK not received for " + deviceCode + ", retry " + pendingSyncs[deviceCode].retries + "/3");
            syncDeviceTime(deviceCode, socket);
        } else {
            console.log("[TCP] TIME_SYNC failed for " + deviceCode + " after 3 retries — clearing drift so next connection polls data");
            delete pendingSyncs[deviceCode];
            // Clear drift so the next 8000 connection takes the data-poll path.
            // The device may not implement 8012 ACK; clearing here prevents the
            // infinite 0012-only loop.
            delete deviceClockDrift[deviceCode];
        }
    }, 10000); // Wait 10 seconds for ACK

    return true;
}

/**
 * Start polling device for interval data after handshake.
 *
 * PROTOCOL NOTE: The RATCX1 firmware (UART2 47-byte buffer) processes
 * exactly ONE command per TCP connection. After receiving a command and
 * sending its ACK (8012 or 8821), the device immediately does CIPSHUT.
 * Any second command sent in the same connection will overflow the UART2
 * buffer during the modem's CIPSEND and the device gets stuck waiting for
 * "SEND OK" that never comes.  Therefore:
 *   - Send ONLY ONE command per connection.
 *   - If drift > 5 min: send 0012 only. The NEXT 8000 connection will
 *     naturally send 0197 (since drift will then be small).
 *   - If drift small: send ONE 0197 for the last completed interval.
 */
function startDevicePoll(deviceCode, socket) {
    var drift = deviceClockDrift[deviceCode] || 0;
    var largeDrift = drift > 5; // more than 5 minutes drift
    console.log("[TCP] ====== Starting poll for device " + deviceCode + " (drift=" + drift + "min) ======");

    // Send exactly ONE command 1 second after handshake
    setTimeout(function () {
        if (socket.destroyed) return;
        if (largeDrift) {
            // Clock badly wrong: send 0012 ONLY. Next connection handles data.
            // NOTE: drift is cleared when socket closes (see end/error handlers)
            // so the NEXT connection will send 0197 even if 8012 ACK never arrives
            // (some firmware versions do not send 8012 back).
            syncDeviceTime(deviceCode, socket);
            if (pendingSyncs[deviceCode]) {
                pendingSyncs[deviceCode].deferDataRequest = false; // no data request after 8012
                pendingSyncs[deviceCode].socket = socket;
            }
            console.log("[TCP] Device " + deviceCode + ": drift=" + drift + "min \u2014 sent 0012 only; next connection will poll data");
            addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1", ip: "", device: deviceCode, detail: "\u0627\u062e\u062a\u0644\u0627\u0641 \u0633\u0627\u0639\u062a " + drift + " \u062f\u0642\u06cc\u0642\u0647 \u2014 \u0641\u0642\u0637 \u062f\u0633\u062a\u0648\u0631 \u062a\u0646\u0638\u06cc\u0645 \u0633\u0627\u0639\u062a \u0627\u0631\u0633\u0627\u0644 \u0634\u062f" });
        } else {
            // Clock OK (or small drift): send ONE 0197 for last completed interval
            startDataRequests(deviceCode, socket);
        }
    }, 1000);
}

/**
 * Send ONE 0197 data request for the last completed 5-minute interval.
 *
 * PROTOCOL NOTE: The RATCX1 firmware processes exactly ONE command per TCP
 * connection (47-byte UART2 buffer; device CIPSHUTs after sending its ACK).
 * Sending more than one command causes the device to get stuck waiting for
 * "SEND OK" from the modem while extra bytes overflow the buffer.
 * Therefore we send ONLY ONE 0197 per connection.  On the NEXT 8000
 * connection, startDevicePoll calls us again to get the next interval.
 *
 * DEVICE-CLOCK NOTE: If the device RTC is dead (shows 2000.01.01), we use
 * the device's own reported time as a reference, adjusted for elapsed time
 * since the last handshake.  This lets the device find the matching interval
 * in its buffer even when its clock is wrong.
 */
function startDataRequests(deviceCode, socket) {
    if (socket.destroyed) return;

    var now = new Date();
    var refTime;

    // Fix25: Use last stored DB record + 5min so we continue from where we left off.
    // This matches original TC Manager behaviour and avoids requesting intervals from
    // year-2000 dead-clock timestamps.
    try {
        var lastRec = db.prepare("SELECT create_at FROM irawdata WHERE device_code = ? ORDER BY create_at DESC LIMIT 1").get(deviceCode);
        if (lastRec && lastRec.create_at) {
            var lastDate = new Date(lastRec.create_at);
            if (!isNaN(lastDate.getTime()) && lastDate.getFullYear() >= 2000) {
                refTime = new Date(lastDate.getTime() + 5 * 60 * 1000);
                console.log("[TCP] 0197 using DB last record: last=" + lastRec.create_at + " next=" + refTime.toISOString());
            }
        }
    } catch (e) { /* DB not ready yet */ }

    if (!refTime) {
        // No DB record for this device: request last completed server-time interval
        refTime = new Date(now.getTime() - 5 * 60 * 1000);
        console.log("[TCP] 0197 no DB record for " + deviceCode + " — using server time - 5min: " + refTime.toISOString());
    }

    // Fix34: If refTime is more than 4 hours behind server time, the DB record is stale
    // (e.g., stored before Fix30/TZ change when server was UTC, now server is Iran time).
    // Requesting a 4h-old interval wastes connection cycles (device will drain 48+ empty
    // intervals via Fix26 before reaching current time).  Jump directly to now - 5min.
    var staleLimitMs = 4 * 60 * 60 * 1000; // 4 hours
    if (now.getTime() - refTime.getTime() > staleLimitMs) {
        console.log("[TCP] Fix34: stale DB record for " + deviceCode +
            " (refTime=" + refTime.toISOString() + " is " +
            Math.round((now.getTime() - refTime.getTime()) / 60000) +
            "min behind server) — jumping to server time - 5min");
        refTime = new Date(now.getTime() - 5 * 60 * 1000);
    }

    refTime.setSeconds(0, 0);
    refTime.setMinutes(Math.floor(refTime.getMinutes() / 5) * 5);

    // Fix36: The last COMPLETED 5-min interval ended at the last 5-min boundary before now.
    // If refTime >= lastCompleted, the requested interval hasn't finished yet → device would
    // respond with an incomplete (all-zero) 8821, and "زمان جلو" appears in reception table.
    // Solution: don't send 0197 for an interval that hasn't completed yet.
    var lastCompleted = new Date(now.getTime() - 5 * 60 * 1000);
    lastCompleted.setSeconds(0, 0);
    lastCompleted.setMinutes(Math.floor(lastCompleted.getMinutes() / 5) * 5);
    if (refTime.getTime() > lastCompleted.getTime()) {
        console.log("[TCP] Fix36: No completed interval to request for " + deviceCode +
            " (next=" + formatPollTimestamp(refTime) + " > lastCompleted=" + formatPollTimestamp(lastCompleted) + ") — skipping");
        return;
    }

    var ts = formatPollTimestamp(refTime);
    var cmd = "0197" + ts;
    if (!socket._lastDataReqTs) socket._lastDataReqTs = ts;
    sendToDevice(deviceCode, socket, cmd, "DATA_REQ");
    console.log("[TCP] Sent 0197 for device " + deviceCode + " interval " + ts);
}

/**
 * Poll device every 5 minutes for the latest COMPLETED interval data.
 * Also re-syncs time every 15 minutes.
 */
function startPeriodicPoll(deviceCode, socket) {
    console.log("[TCP] Starting periodic poll for device " + deviceCode + " (every 5 min)");

    // Immediate first request for the last completed interval (don't wait 5 min)
    if (!socket.destroyed) {
        var firstReq = new Date();
        firstReq.setMinutes(Math.floor(firstReq.getMinutes() / 5) * 5, 0, 0);
        firstReq = new Date(firstReq.getTime() - 5 * 60 * 1000); // last COMPLETED interval
        var firstCmd = "0197" + formatPollTimestamp(firstReq);
        sendToDevice(deviceCode, socket, firstCmd, "IMMEDIATE_POLL");
    }

    var intervalId = setInterval(function () {
        if (socket.destroyed) {
            clearInterval(intervalId);
            return;
        }
        var now = new Date();

        // Re-sync time every 15 minutes (at :00, :15, :30, :45)
        if (now.getMinutes() % 15 === 0) {
            syncDeviceTime(deviceCode, socket);
        }

        // Request last COMPLETED interval (current - 5min) instead of in-progress one
        var reqTime = new Date(now);
        reqTime.setMinutes(Math.floor(reqTime.getMinutes() / 5) * 5, 0, 0);
        reqTime = new Date(reqTime.getTime() - 5 * 60 * 1000); // go back to completed interval
        var cmd = "0197" + formatPollTimestamp(reqTime);
        sendToDevice(deviceCode, socket, cmd, "PERIODIC_POLL");
    }, 5 * 60 * 1000); // every 5 minutes

    // Store interval ID on socket for cleanup
    socket._pollInterval = intervalId;
}

// Track all active TCP client sockets so gracefulShutdown can destroy them immediately
var _activeTcpSockets = new Set();

var tcpServer = net.createServer(function (socket) {
    _activeTcpSockets.add(socket);
    socket.on("close", function () { _activeTcpSockets.delete(socket); });

    var clientIP = socket.remoteAddress || "";
    var buffer = "";
    var deviceId = null;
    var pollStarted = false;
    socket.setNoDelay(true); // disable Nagle — send commands immediately without buffering
    console.log("[TCP] New connection from " + clientIP);

    // Helper: check for handshake and start polling (only once per connection)
    function checkHandshake(line) {
        var clean = line.replace(/[\r\n\x00]/g, "").trim();
        if (clean.substring(0, 4) === "8000" && clean.length >= 33) {
            var newId = clean.substring(25, 33).replace(/^0+/, "") || null;
            if (newId && !pollStarted) {
                deviceId = newId;
                pollStarted = true;
                connectedDevices[deviceId] = socket;
                socket._connectedAt = new Date().toISOString();
                socket._intervalCount = 0;  // count 8821 responses per connection
                socket._lastDataReqTs = null;
                console.log("[TCP] Device " + deviceId + " registered for commands");
                startDevicePoll(deviceId, socket);
            }
        }
    }

    socket.on("data", function (chunk) {
        var incoming = chunk.toString();

        // Log raw incoming data for debugging
        var logStr = incoming.substring(0, 120).replace(/[\r\n]/g, "\\n").replace(/[^\x20-\x7E\\]/g, ".");
        console.log("[TCP] << " + (deviceId || clientIP) + " +" + incoming.length + "b (buf=" + buffer.length + "): " + logStr);

        // Strip SIM900 modem +IPD/+RECEIVE prefix if present
        incoming = incoming.replace(/\+IPD,\d+:/g, "");
        incoming = incoming.replace(/\+RECEIVE,\d+,\d+:/g, "");
        buffer += incoming;

        // Reset buffer flush timer (flush incomplete data after 5s of silence)
        if (socket._bufTimer) clearTimeout(socket._bufTimer);
        socket._bufTimer = setTimeout(function () {
            if (buffer.trim().length > 0) {
                console.log("[TCP] Buffer timeout flush (" + buffer.length + "b): " + buffer.substring(0, 100));
                var clean = buffer.replace(/[\r\n\x00]/g, "").trim();
                if (clean.length > 0) {
                    processRawData(clean, clientIP);
                    checkHandshake(clean);
                }
                buffer = "";
            }
        }, 5000);

        // Process complete lines (terminated by \r\n or \n)
        var lines = buffer.split(/[\r\n]+/);
        buffer = lines.pop(); // keep incomplete part in buffer

        lines.forEach(function (line) {
            line = line.trim();
            if (!line) return;
            // Skip AT command echoes from modem
            if (line.indexOf("AT+") === 0 || line === "OK" || line === "ERROR" || line === "SEND OK" || line === ">") return;
            processRawData(line, clientIP);
            checkHandshake(line);
        });

        // Try to extract complete RATCX1 messages from buffer even without CRLF
        // This handles cases where device sends fixed-length data without line terminators
        // 8821 interval data = 4+21+262 = 287+ chars
        // 8012 time sync ack = 4+21+8 = 33+ chars
        // 8000 handshake = variable length, contains "READY"
        var trimBuf = buffer.replace(/[\x00]/g, "").trim();
        if (trimBuf.length >= 287 && trimBuf.substring(0, 4) === "8821") {
            console.log("[TCP] Extracted 8821 message from buffer (" + trimBuf.length + "b without CRLF)");
            processRawData(trimBuf.substring(0, 287), clientIP);
            buffer = trimBuf.substring(287);
        } else if (trimBuf.length >= 33 && trimBuf.substring(0, 4) === "8012") {
            console.log("[TCP] Extracted 8012 message from buffer (" + trimBuf.length + "b without CRLF)");
            processRawData(trimBuf, clientIP);
            buffer = "";
        } else if (trimBuf.substring(0, 4) === "8000" && trimBuf.indexOf("READY") !== -1) {
            console.log("[TCP] Extracted 8000 handshake from buffer (" + trimBuf.length + "b without CRLF)");
            processRawData(trimBuf, clientIP);
            checkHandshake(trimBuf);
            buffer = "";
        }
    });

    socket.on("end", function () {
        // Process any remaining buffer data on disconnect
        if (buffer.trim().length > 0) {
            console.log("[TCP] Processing remaining buffer on disconnect (" + buffer.length + "b)");
            var clean = buffer.replace(/[\r\n\x00]/g, "").trim();
            if (clean.length > 0) processRawData(clean, clientIP);
        }
        if (socket._bufTimer) clearTimeout(socket._bufTimer);
        if (socket._pollInterval) clearInterval(socket._pollInterval);
        if (deviceId && connectedDevices[deviceId] === socket) {
            delete connectedDevices[deviceId];
        }
        // Clean up pending time syncs
        if (deviceId && pendingSyncs[deviceId]) {
            clearTimeout(pendingSyncs[deviceId].timer);
            delete pendingSyncs[deviceId];
            // Clear drift so next connection takes the data-poll path.
            // The firmware may not send 8012 ACK; if the socket closes without ACK,
            // assume 0012 was processed and let the next connection try 0197.
            delete deviceClockDrift[deviceId];
        }
        // Mark device offline when it disconnects
        if (deviceId) {
            try { db.prepare("UPDATE devices SET status = 'offline' WHERE device_code = ?").run(deviceId); } catch(e){}
        }
        console.log("[TCP] Disconnected " + clientIP + (deviceId ? " (device " + deviceId + ")" : ""));
    });

    socket.on("error", function (err) {
        if (socket._bufTimer) clearTimeout(socket._bufTimer);
        if (socket._pollInterval) clearInterval(socket._pollInterval);
        if (deviceId && connectedDevices[deviceId] === socket) {
            delete connectedDevices[deviceId];
        }
        // Clean up pending time syncs
        if (deviceId && pendingSyncs[deviceId]) {
            clearTimeout(pendingSyncs[deviceId].timer);
            delete pendingSyncs[deviceId];
            delete deviceClockDrift[deviceId]; // clear drift so next connection tries data poll
        }
        if (deviceId) {
            try { db.prepare("UPDATE devices SET status = 'offline' WHERE device_code = ?").run(deviceId); } catch(e){}
        }
        console.error("[TCP] Error from " + clientIP + (deviceId ? " (device " + deviceId + ")" : "") + ": " + err.message);
    });
});

function storeIrawdata(parsed) {
    // Fix35: UPSERT — if a zero-vehicle row was stored first (e.g. from a duplicate
    // request or timestamp correction), update it when real traffic data arrives.
    // Only update when new total > existing total so we never downgrade real data.
    var insertRaw = db.prepare(
        "INSERT INTO irawdata (device_code, create_at, stop, lane, is_read, a,b,c,d,e,x, sa,sb,sc,sd,se,sx, sao,sbo,sco,sdo,seo,sxo, overtaking, tooclose) " +
        "VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(device_code, create_at, stop, lane) DO UPDATE SET " +
        "a=excluded.a, b=excluded.b, c=excluded.c, d=excluded.d, e=excluded.e, x=excluded.x, " +
        "sa=excluded.sa, sb=excluded.sb, sc=excluded.sc, sd=excluded.sd, se=excluded.se, sx=excluded.sx, " +
        "sao=excluded.sao, sbo=excluded.sbo, sco=excluded.sco, sdo=excluded.sdo, seo=excluded.seo, sxo=excluded.sxo, " +
        "overtaking=excluded.overtaking, tooclose=excluded.tooclose " +
        "WHERE (excluded.a+excluded.b+excluded.c+excluded.d+excluded.e+excluded.x) > " +
        "      (irawdata.a+irawdata.b+irawdata.c+irawdata.d+irawdata.e+irawdata.x)"
    );
    insertRaw.run(
        parsed.device_code, parsed.create_at, parsed.stop, parsed.lane,
        parsed.a, parsed.b, parsed.c, parsed.d, parsed.e, parsed.x,
        parsed.sa, parsed.sb, parsed.sc, parsed.sd, parsed.se, parsed.sx,
        parsed.sao, parsed.sbo, parsed.sco, parsed.sdo, parsed.seo, parsed.sxo,
        parsed.overtaking, parsed.tooclose
    );
}

function processRawData(raw, ip) {
    var rawPreview = raw.substring(0, 100).replace(/[\r\n]/g, "\\n").replace(/[^\x20-\x7E\\]/g, ".");
    console.log("[TCP] Processing (" + raw.length + " chars) code=" + raw.substring(0, 4) + ": " + rawPreview + (raw.length > 100 ? "..." : ""));

    // Detect RATCX1 firmware format: starts with "8xxx" command code
    var clean = raw.replace(/[\r\n\x00]/g, "").trim();

    // --- RATCX1 Handshake: "8000" + datetime(21) + system_id(8) + model + version + "READY" ---
    if (clean.substring(0, 4) === "8000") {
        var datetime = clean.substring(4, 25);
        var sysId = clean.substring(25, 33).replace(/^0+/, "") || "0";
        var rest = clean.substring(33);
        console.log("[TCP] RATCX1 handshake: device=" + sysId + " time=" + datetime + " info=" + rest);

        // Check device clock drift on handshake and store for poll decision
        var devTimeParts = datetime.match(/^(\d{4})\.(\d{2})\.(\d{2})-(\d{2}):(\d{2}):(\d{2})/);
        if (devTimeParts) {
            var devMonth = parseInt(devTimeParts[2], 10);
            var devDay = parseInt(devTimeParts[3], 10);
            var devDate = new Date(devTimeParts[1] + "-" + devTimeParts[2] + "-" + devTimeParts[3] + "T" + devTimeParts[4] + ":" + devTimeParts[5] + ":" + devTimeParts[6]);
            var srvDate = new Date();
            var driftM;
            // If device date is invalid (e.g. month=26), treat as very large drift
            if (devMonth < 1 || devMonth > 12 || devDay < 1 || devDay > 31 || isNaN(devDate.getTime())) {
                driftM = 9999;
                console.log("[TCP] Device " + sysId + " clock INVALID date: " + devTimeParts[1] + "-" + devTimeParts[2] + "-" + devTimeParts[3] + " (month=" + devMonth + " day=" + devDay + ") - treating as large drift");
            } else {
                driftM = Math.round(Math.abs(srvDate.getTime() - devDate.getTime()) / 60000);
            }
            // Store device's reported time for use in 0197 requests
            // (so we can send 0197 with device-matching timestamps even when RTC is dead)
            if (!isNaN(devDate.getTime())) {
                deviceLastSeen[sysId] = { devTime: devDate, serverTime: new Date() };
            }
            // Store drift so startDevicePoll can decide whether to request old data
            deviceClockDrift[sysId] = driftM;
            console.log("[TCP] Device " + sysId + " clock drift: " + driftM + " minutes (device=" + devTimeParts[1] + "-" + devTimeParts[2] + "-" + devTimeParts[3] + " " + devTimeParts[4] + ":" + devTimeParts[5] + " server=" + srvDate.toISOString() + ")");
            if (driftM > 5) {
                console.log("[TCP] WARNING: Device " + sysId + " clock drift too large (" + driftM + " min) - will sync first, then start polling");
                addLiveLog({ ts: Date.now(), time: srvDate.toISOString(), type: "tcp-ratcx1", ip: ip, device: sysId, detail: "هشدار: ساعت دستگاه " + driftM + " دقیقه عقب‌تر است - ابتدا ساعت تنظیم می‌شود" });
            } else if (driftM > 2) {
                console.log("[TCP] WARNING: Device " + sysId + " clock drift detected: " + driftM + " minutes - will sync");
            }
        }

        addLiveLog({
            ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1",
            ip: ip, device: sysId, detail: "اتصال اولیه: " + rest
        });
        autoRegisterDevice(sysId);
        // Update device firmware info
        try {
            var modelMatch = rest.match(/^(RATCX\d+)(HW:[^,]+,SW:[^R]+)/);
            if (modelMatch) {
                db.prepare("UPDATE devices SET firmware = ? WHERE device_code = ?").run(modelMatch[2], sysId);
            }
        } catch (e) { /* ok */ }
        return;
    }

    // --- RATCX1 Interval data: "8821" + datetime(21) + interval_data(262+) ---
    if (clean.substring(0, 4) === "8821") {
        var datetime21 = clean.substring(4, 25);
        var intervalStr = clean.substring(25);
        console.log("[TCP] *** RATCX1 INTERVAL DATA RECEIVED ***");
        console.log("[TCP]   response_time=" + datetime21 + " interval_len=" + intervalStr.length + " total_len=" + clean.length);
        console.log("[TCP]   interval_preview: " + intervalStr.substring(0, 80) + (intervalStr.length > 80 ? "..." : ""));

        var parsed = parseRATCX1Interval(intervalStr);
        if (!parsed) {
            console.error("[TCP]   PARSE FAILED - need >= 262 chars, got " + intervalStr.length);
            addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-raw", ip: ip, device: "-", detail: "RATCX1 parse fail: need 262 chars, got " + intervalStr.length });
            return;
        }

        // Validate device timestamp - detect clock drift and correct if needed
        var serverNow = new Date();
        var deviceTime = new Date(parsed.create_at);
        var timestampCorrected = false;
        // Pre-check: if device date is NaN (e.g. month=26), correct it to server time
        if (isNaN(deviceTime.getTime())) {
            var corrNow = new Date();
            corrNow.setMinutes(Math.floor(corrNow.getMinutes() / 5) * 5, 0, 0);
            var corrStr = corrNow.getFullYear() + "-" + String(corrNow.getMonth() + 1).padStart(2, "0") + "-" + String(corrNow.getDate()).padStart(2, "0") + "T" + String(corrNow.getHours()).padStart(2, "0") + ":" + String(corrNow.getMinutes()).padStart(2, "0") + ":00";
            console.log("[TCP] Device " + parsed.device_code + " has INVALID date: " + parsed.create_at + " -> correcting to " + corrStr);
            parsed.create_at = corrStr;
            timestampCorrected = true;
            addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1", ip: ip, device: parsed.device_code, detail: "تاریخ نامعتبر: " + parsed.create_at + " - اصلاح شد به " + corrStr });
        }
        // Fix31: Only correct FUTURE timestamps (device clock ahead) or dead-clock (year<2020).
        // Past valid-year timestamps are backlogged intervals requested via 0197 and must be
        // stored with their original time.  Correcting all >30min-old timestamps to "now"
        // caused every interval to get the same bucket → INSERT OR IGNORE discarded all but
        // the first → irawdata appeared empty.
        if (!isNaN(deviceTime.getTime())) {
            var isFuture = deviceTime.getTime() > serverNow.getTime() + 10 * 60 * 1000; // >10min ahead
            var isDeadClock = deviceTime.getFullYear() < 2020;
            if (isFuture || isDeadClock) {
                var corrected = new Date(serverNow);
                corrected.setMinutes(Math.floor(corrected.getMinutes() / 5) * 5, 0, 0);
                var correctedStr = corrected.getFullYear() + "-" + String(corrected.getMonth() + 1).padStart(2, "0") + "-" + String(corrected.getDate()).padStart(2, "0") + "T" + String(corrected.getHours()).padStart(2, "0") + ":" + String(corrected.getMinutes()).padStart(2, "0") + ":00";
                var reason = isFuture ? "ساعت دستگاه جلو است" : "ساعت دستگاه dead-clock (year<2020)";
                console.log("[TCP] Fix31 correcting timestamp (" + reason + "): " + parsed.create_at + " -> " + correctedStr);
                parsed.create_at = correctedStr;
                timestampCorrected = true;
                addLiveLog({ ts: Date.now(), time: serverNow.toISOString(), type: "tcp-ratcx1", ip: ip, device: parsed.device_code, detail: reason + " — زمان اصلاح شد به " + correctedStr });
            } else {
                var pastDriftMin = Math.round((serverNow.getTime() - deviceTime.getTime()) / 60000);
                if (pastDriftMin > 5) {
                    console.log("[TCP] Backlog interval: " + parsed.device_code + " create_at=" + parsed.create_at + " (" + pastDriftMin + "min ago) — stored as-is");
                }
            }
        }

        var rows = ratcx1ToIrawdata(parsed);
        var totalAll = 0;
        autoRegisterDevice(parsed.device_code);

        try {
            rows.forEach(function (r) {
                var t = r.a + r.b + r.c + r.d + r.e + r.x;
                totalAll += t;
                storeIrawdata(r);
            });
            // Update device battery/solar info
            db.prepare("UPDATE devices SET status = 'online', last_seen = datetime('now','localtime') WHERE device_code = ?").run(parsed.device_code);
            console.log("[TCP] RATCX1 stored: device=" + parsed.device_code + " vehicles=" + totalAll + " lanes=" + rows.length + " bat=" + parsed.battery + " sol=" + parsed.solar + (timestampCorrected ? " (timestamp corrected)" : ""));
        } catch (e) {
            console.error("[TCP] DB error: " + e.message);
        }

        addLiveLog({
            ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1",
            ip: ip, device: parsed.device_code,
            a: (parsed.lane1.a.count + parsed.lane2.a.count),
            b: (parsed.lane1.b.count + parsed.lane2.b.count),
            c: (parsed.lane1.c.count + parsed.lane2.c.count),
            d: (parsed.lane1.d.count + parsed.lane2.d.count),
            e: (parsed.lane1.e.count + parsed.lane2.e.count),
            x: (parsed.lane1.x.count + parsed.lane2.x.count),
            total: totalAll, battery: parsed.battery, solar: parsed.solar,
            detail: "تردد=" + totalAll + " باتری=" + parsed.battery + " سولار=" + parsed.solar + " خطا=" + parsed.error_byte
        });

        // Request next 5-min interval: device stays connected until its buffer is drained.
        // Fix26: if received interval is more than 1 hour behind server time, skip to
        // server_time-5min so we don't drain thousands of old (empty) intervals.
        // Limit to 200 intervals per connection to prevent runaway loops.
        var sock = connectedDevices[parsed.device_code];
        if (sock && !sock.destroyed) {
            if (!sock._intervalCount) sock._intervalCount = 0;
            sock._intervalCount++;
            if (sock._intervalCount < 200) {
                var dataDate = new Date(parsed.create_at);
                var srvNowFix26 = new Date();
                var behindMs = srvNowFix26.getTime() - dataDate.getTime();
                var nextStart;
                if (!isNaN(dataDate.getTime()) && behindMs > 60 * 60 * 1000) {
                    // More than 1 hour behind: jump to server time - 5min
                    nextStart = new Date(srvNowFix26.getTime() - 5 * 60 * 1000);
                    console.log("[TCP] Fix26: " + parsed.device_code + " interval " + parsed.create_at +
                        " is " + Math.round(behindMs / 60000) + "min behind — jumping to " + nextStart.toISOString());
                } else {
                    nextStart = new Date(dataDate.getTime() + 5 * 60 * 1000);
                }
                nextStart.setSeconds(0, 0);
                nextStart.setMinutes(Math.floor(nextStart.getMinutes() / 5) * 5);
                // Fix36b: Stop drain when next interval hasn't completed yet (avoid future/incomplete data)
                var lastCompletedDrain = new Date(srvNowFix26.getTime() - 5 * 60 * 1000);
                lastCompletedDrain.setSeconds(0, 0);
                lastCompletedDrain.setMinutes(Math.floor(lastCompletedDrain.getMinutes() / 5) * 5);
                if (nextStart.getTime() > lastCompletedDrain.getTime()) {
                    console.log("[TCP] Fix36b: " + parsed.device_code + " buffer drained to current time — stopping");
                    return;
                }
                var nextTs = formatPollTimestamp(nextStart);
                sendToDevice(parsed.device_code, sock, "0197" + nextTs, "DATA_REQ_NEXT #" + sock._intervalCount);
            } else {
                console.log("[TCP] Max 200 intervals per connection reached for " + parsed.device_code + " — stopping poll");
            }
        }
        return;
    }

    // --- RATCX1 Time set response: "8012" + datetime(21) + system_id(8) ---
    if (clean.substring(0, 4) === "8012") {
        var dt = clean.substring(4, 25);
        var sid = clean.substring(25, 33).replace(/^0+/, "") || "0";
        console.log("[TCP] *** TIME SYNC ACK RECEIVED ***");
        console.log("[TCP]   device=" + sid + " device_time=" + dt + " total_len=" + clean.length);

        // Verify device actually updated its clock by checking ACK timestamp
        var ackTimeParts = dt.match(/^(\d{4})\.(\d{2})\.(\d{2})-(\d{2}):(\d{2}):(\d{2})/);
        var syncVerified = false;
        if (ackTimeParts) {
            var ackMonth = parseInt(ackTimeParts[2], 10);
            var ackDay = parseInt(ackTimeParts[3], 10);
            var ackDate = new Date(ackTimeParts[1] + "-" + ackTimeParts[2] + "-" + ackTimeParts[3] + "T" + ackTimeParts[4] + ":" + ackTimeParts[5] + ":" + ackTimeParts[6]);
            if (ackMonth < 1 || ackMonth > 12 || ackDay < 1 || ackDay > 31 || isNaN(ackDate.getTime())) {
                console.log("[TCP] WARNING: Device " + sid + " ACK still has INVALID date after TIME_SYNC: " + dt + " - device may not support time sync");
                addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1", ip: ip, device: sid, detail: "هشدار: دستگاه ساعت را تنظیم نکرد (تاریخ نامعتبر: " + dt + ")" });
            } else {
                var srvNow = new Date();
                var ackDrift = Math.round(Math.abs(srvNow.getTime() - ackDate.getTime()) / 60000);
                if (ackDrift > 5) {
                    console.log("[TCP] WARNING: Device " + sid + " ACK time still drifted by " + ackDrift + " min after TIME_SYNC: " + dt);
                    addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1", ip: ip, device: sid, detail: "هشدار: ساعت دستگاه بعد از تنظیم هنوز " + ackDrift + " دقیقه اختلاف دارد" });
                } else {
                    syncVerified = true;
                    console.log("[TCP]   TIME_SYNC verified - device clock now correct (drift=" + ackDrift + "min)");
                }
            }
        }

        // Clean up pending sync and clear drift.
        // Do NOT call startDataRequests here: the device is about to CIPSHUT
        // (it sends 8012 ACK immediately before disconnecting).  Any 0197
        // written now would overflow the device's 47-byte UART2 buffer while
        // it is in the middle of the CIPSEND handshake, causing it to get
        // stuck.  The NEXT 8000 connection will call startDevicePoll which
        // will now see drift≈0 and send a single 0197.
        if (pendingSyncs[sid]) {
            clearTimeout(pendingSyncs[sid].timer);
            delete pendingSyncs[sid];
        }

        // Clear drift so next 8000 connection takes the "normal data poll" path
        delete deviceClockDrift[sid];

        // IMPORTANT: After 8012 ACK the device has NOT CIPSHUTted — it is waiting
        // for a 0197 data request.  Send it immediately using the old device-clock
        // reference (deviceLastSeen still holds the pre-sync 2000.01.01 time so the
        // 0197 timestamp will match the intervals stored in the device's buffer).
        var activeSock = connectedDevices[sid] || socket;
        if (activeSock && !activeSock.destroyed) {
            startDataRequests(sid, activeSock);
        }

        if (syncVerified) {
            console.log("[TCP]   TIME_SYNC verified for " + sid + " - next connection will poll data");
            addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1", ip: ip, device: sid, detail: "ساعت تنظیم شد ✓ — اتصال بعدی داده دریافت می‌کند" });
        } else {
            console.log("[TCP]   TIME_SYNC ACK received for " + sid + " (clock not verified) - next connection will poll data");
            addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1", ip: ip, device: sid, detail: "پاسخ تنظیم ساعت دریافت شد — اتصال بعدی داده دریافت می‌کند" });
        }

        addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1", ip: ip, device: sid, detail: "پاسخ تنظیم ساعت: " + dt + (syncVerified ? " ✓" : " (تنظیم نشد)") });
        return;
    }

    // --- RATCX1 Unknown 8xxx response (log for debugging) ---
    if (clean.length > 4 && clean.charAt(0) === "8") {
        console.log("[TCP] RATCX1 unknown response code " + clean.substring(0, 4) + " from " + ip + " len=" + clean.length);
        addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1", ip: ip, device: "-", detail: "پاسخ " + clean.substring(0, 4) + " (len=" + clean.length + ")" });
        return;
    }

    // --- Fallback: iccore format ---
    var parsed = parseIccoreData(raw);

    if (!parsed || !parsed.device_code) {
        addLiveLog({
            ts: Date.now(), time: new Date().toISOString(), type: "tcp-raw",
            ip: ip, device: "-", detail: "len=" + raw.length + " data=" + raw.substring(0, 60)
        });
        return;
    }

    var total = parsed.a + parsed.b + parsed.c + parsed.d + parsed.e + parsed.x;
    addLiveLog({
        ts: Date.now(), time: new Date().toISOString(), type: "tcp",
        ip: ip, device: parsed.device_code,
        a: parsed.a, b: parsed.b, c: parsed.c, d: parsed.d, e: parsed.e, x: parsed.x,
        total: total, lane: parsed.lane,
        detail: "تردد=" + total + " لاین=" + parsed.lane
    });

    autoRegisterDevice(parsed.device_code);

    try {
        storeIrawdata(parsed);
        console.log("[TCP] Stored: device=" + parsed.device_code + " vehicles=" + total);
    } catch (e) {
        console.error("[TCP] DB error: " + e.message);
    }
}

// API: Connected devices list & send command
app.get("/api/tcp/connected", requireAuth, function (req, res) {
    var result = {};
    Object.keys(connectedDevices).forEach(function (id) {
        var s = connectedDevices[id];
        if (!s.destroyed) {
            result[id] = { ip: s.remoteAddress || "", connectedAt: s._connectedAt || null };
        }
    });
    res.json(result);
});

// API: Manually trigger time sync for a connected device
app.post("/api/tcp/sync-time", requireAuth, function (req, res) {
    var code = String(req.body.device_code || "");
    if (!code) return res.status(400).json({ error: "device_code required" });
    var sock = connectedDevices[code];
    if (!sock || sock.destroyed) return res.status(404).json({ error: "دستگاه متصل نیست" });
    syncDeviceTime(code, sock);
    res.json({ success: true, message: "فرمان تنظیم ساعت ارسال شد" });
});

// API: Manually trigger data poll for a connected device
app.post("/api/tcp/poll", requireAuth, function (req, res) {
    var code = String(req.body.device_code || "");
    if (!code) return res.status(400).json({ error: "device_code required" });
    var sock = connectedDevices[code];
    if (!sock || sock.destroyed) return res.status(404).json({ error: "دستگاه متصل نیست" });
    startDataRequests(code, sock);
    res.json({ success: true, message: "درخواست داده ارسال شد" });
});

app.post("/api/tcp/send", requireAuth, function (req, res) {
    var code = String(req.body.device_code || "");
    var command = String(req.body.command || "");
    if (!code || !command) return res.status(400).json({ error: "device_code and command required" });
    var sock = connectedDevices[code];
    if (!sock || sock.destroyed) return res.status(404).json({ error: "دستگاه متصل نیست" });
    try {
        sock.write(command);
        console.log("[TCP] >> " + code + " manual command: " + command + " (" + command.length + " bytes)");
        res.json({ success: true, sent: command });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

tcpServer.listen(TCP_PORT, "0.0.0.0", function () {
    console.log("[TCP] Listening on port " + TCP_PORT + " for raw device data");
});

var _tcpRetries = 0;
var TCP_MAX_RETRIES = 10;
tcpServer.on("error", function (err) {
    if (err.code === "EADDRINUSE") {
        _tcpRetries++;
        if (_tcpRetries > TCP_MAX_RETRIES) {
            console.error("[TCP] Port " + TCP_PORT + " still in use after " + TCP_MAX_RETRIES + " retries — exiting so PM2 can restart cleanly");
            process.exit(1);
        }
        console.error("[TCP] Port " + TCP_PORT + " already in use, retry " + _tcpRetries + "/" + TCP_MAX_RETRIES + " in 5s");
        setTimeout(function () {
            tcpServer.close(function () {
                tcpServer.listen(TCP_PORT, "0.0.0.0");
            });
        }, 5000);
    }
});

// ============================================================
// Graceful shutdown — close servers so PM2 restart finds ports free
// ============================================================
function gracefulShutdown(signal) {
    console.log("[SHUTDOWN] " + signal + " received — closing servers gracefully...");
    // Destroy all active TCP device sockets immediately so tcpServer.close() resolves fast
    _activeTcpSockets.forEach(function (s) { try { s.destroy(); } catch (e) {} });
    _activeTcpSockets.clear();
    tcpServer.close(function () { console.log("[SHUTDOWN] TCP server closed"); });
    if (httpServer && httpServer.listening) {
        httpServer.close(function () {
            console.log("[SHUTDOWN] HTTP server closed — exiting");
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
    // Force exit after 5s if servers won't close
    setTimeout(function () {
        console.error("[SHUTDOWN] Force exit after 5s timeout");
        process.exit(0);
    }, 5000);
}
process.on("SIGTERM", function () { gracefulShutdown("SIGTERM"); });
process.on("SIGINT",  function () { gracefulShutdown("SIGINT"); });

// ============================================================
// Global Error Handlers — prevent process crash on unexpected errors
// ============================================================
process.on("uncaughtException", function (err) {
    if (err.code === "EADDRINUSE") {
        console.error("[FATAL] Port already in use (" + (err.port || "unknown") + ") — waiting 8s then exiting for clean PM2 restart");
        setTimeout(function () { process.exit(1); }, 8000);
        return;
    }
    console.error("[FATAL] Uncaught exception (server kept running):", err.message, err.stack || "");
});
process.on("unhandledRejection", function (reason) {
    console.error("[FATAL] Unhandled promise rejection (server kept running):", reason);
});

// ============================================================
// Start HTTP Server
// ============================================================
var httpServer = app.listen(PORT, HOST, function () {
    console.log("============================================");
    console.log("  TC Manager Server (Noavaran Jonoob Shargh)");
    console.log("  HTTP: http://" + HOST + ":" + PORT);
    console.log("  TCP:  port " + TCP_PORT + " (device data)");
    console.log("  Login: admin / admin123");
    console.log("============================================");

    rmto.initClient(function (err) {
        if (err) console.error("[RMTO] Will retry on first send");
    });

    scheduler.start();
});
httpServer.on("error", function (err) {
    if (err.code === "EADDRINUSE") {
        console.error("[HTTP] Port " + PORT + " already in use — exiting for clean PM2 restart");
        process.exit(1);
    }
    throw err;
});
httpServer.on("error", function (err) {
    if (err.code === "EADDRINUSE") {
        console.error("[HTTP] Port " + PORT + " already in use — waiting 8s then exiting for clean PM2 restart");
        setTimeout(function () { process.exit(1); }, 8000);
        return;
    }
    throw err;
});
httpServer.on("error", function (err) {
    if (err.code === "EADDRINUSE") {
        console.error("[HTTP] Port " + PORT + " already in use — closing TCP and exiting for clean PM2 restart");
        // Destroy active TCP sockets so tcpServer releases its port too
        _activeTcpSockets.forEach(function (s) { try { s.destroy(); } catch (e) {} });
        _activeTcpSockets.clear();
        tcpServer.close(function () {});
        setTimeout(function () { process.exit(1); }, 3000);
        return;
    }
    throw err;
});
TCEOF_server_index_js

# === server/scheduler.js ===
cat > "$TC_DIR/server/scheduler.js" << 'TCEOF_server_scheduler_js'
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
    // Load current RMTO settings from DB + env
    var companyCode = 58;
    var rmtoUser = process.env.RMTO_USERNAME || "";
    var rmtoPass = process.env.RMTO_PASSWORD || "";
    try {
        var settingRows = db.prepare("SELECT key, value FROM settings WHERE key IN ('rmto_company_code','rmto_username','rmto_password')").all();
        settingRows.forEach(function (r) {
            if (r.key === "rmto_company_code") companyCode = parseInt(r.value || "58", 10) || 58;
            if (r.key === "rmto_username" && r.value) rmtoUser = r.value;
            if (r.key === "rmto_password" && r.value !== undefined) rmtoPass = r.value;
        });
    } catch (e) {}

    // Skip entirely if no credentials configured — prevents spam-logging auth errors
    if (!rmtoUser) {
        console.warn("[Scheduler] RMTO credentials not configured — skipping send (set rmto_username in settings or .env)");
        return;
    }

    // Get up to 20 unprocessed records (rmto_id IS NULL) or transiently-failed (rmto_id = 0), oldest first
    // Auth errors (rmto_id = -2) are NOT retried — user must fix credentials first
    // Records with rid=0 (unknown device) are also excluded — RMTO rejects them
    var rows;
    try {
        rows = db.prepare(
            "SELECT * FROM irawdata WHERE (rmto_id IS NULL OR rmto_id = 0) AND CAST(device_code AS INTEGER) > 0 ORDER BY create_at ASC LIMIT 20"
        ).all();
    } catch (e) {
        console.error("[Scheduler] processAndSendIrawdata query error:", e.message);
        return;
    }
    if (!rows || rows.length === 0) return;

    console.log("[Scheduler] processAndSendIrawdata: " + rows.length + " record(s) to send");

    rows.forEach(function (row) {
        // Mark as in-flight (rmto_id = -1) to prevent double-processing
        try { db.prepare("UPDATE irawdata SET rmto_id = -1 WHERE id = ? AND (rmto_id IS NULL OR rmto_id = 0)").run(row.id); } catch (e) { return; }

        // RID = RMTO Road ID (شناسه محور) — from devices.mehvar_code, NOT device_code
        var devRow = null;
        try { devRow = db.prepare("SELECT mehvar_code FROM devices WHERE device_code = ?").get(row.device_code); } catch (e) {}
        var rid = (devRow && devRow.mehvar_code) ? parseInt(devRow.mehvar_code, 10) : (parseInt(row.device_code, 10) || 0);

        // RMTO Add5 class mapping (RATCX1 firmware → RMTO 5 vehicle classes):
        // C1 = سواری و وانت       = firmware a (motorcycle) + b (car) + c (van/pickup)
        // C2 = کامیونت و مینی‌بوس = firmware d (light truck/minibus)
        // C3 = کامیون دو محور     = firmware e (2-axle truck)
        // C4 = اتوبوس             = 0 (RATCX1 cannot separate bus from 2-axle truck)
        // C5 = کامیون سه محور+    = firmware x (3+ axle heavy truck)
        var c1 = (row.a || 0) + (row.b || 0) + (row.c || 0);  // سواری و وانت
        var c2 = row.d || 0;                                    // کامیونت و مینی‌بوس
        var c3 = row.e || 0;                                    // کامیون دو محور
        var c4 = 0;                                             // اتوبوس (not distinguishable)
        var c5 = row.x || 0;                                    // کامیون سه محور به بالا
        var totalCount = c1 + c2 + c3 + c4 + c5;

        // Weighted average speed across all classes
        var sc1 = (row.sa || 0) + (row.sb || 0) + (row.sc || 0);  // sum of speeds for C1 vehicles
        var sc2 = row.sd || 0;
        var sc3 = row.se || 0;
        var sc4 = 0;
        var sc5 = row.sx || 0;
        var asp = totalCount > 0 ? Math.round((sc1 + sc2 + sc3 + sc4 + sc5) / totalCount) : 0;

        // Per-class avg speeds
        var s1 = c1 > 0 ? Math.round(sc1 / c1) : 0;
        var s2 = c2 > 0 ? Math.round(sc2 / c2) : 0;
        var s3 = c3 > 0 ? Math.round(sc3 / c3) : 0;
        var s4 = 0;
        var s5 = c5 > 0 ? Math.round(sc5 / c5) : 0;

        // Per-class overspeed counts
        var so1 = (row.sao || 0) + (row.sbo || 0) + (row.sco || 0);  // C1 overspeed
        var so2 = row.sdo || 0;                                        // C2 overspeed
        var so3 = row.seo || 0;                                        // C3 overspeed
        var so4 = 0;                                                    // C4 overspeed
        var so5 = row.sxo || 0;                                        // C5 overspeed
        var sso = so1 + so2 + so3 + so4 + so5;

        // Null record: all counts zero (inactive device) — per C# reference isnull logic
        var isNull = (totalCount === 0);

        rmto.sendAdd5({
            cid: companyCode,
            fid: row.id,
            rid: rid,
            st: row.create_at,
            et: row.stop,
            c1: isNull ? null : c1,
            c2: isNull ? null : c2,
            c3: isNull ? null : c3,
            c4: isNull ? null : c4,
            c5: isNull ? null : c5,
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
                var isAuthError = false;
                function isAuthMsg(msg) {
                    return msg && (msg.indexOf("password") >= 0 || msg.indexOf("username") >= 0 || msg.indexOf("Wrong") >= 0 || msg.indexOf("status codes") >= 0);
                }
                function isDuplicateMsg(msg) {
                    return msg && (msg.toUpperCase().indexOf("DUPLICATE") >= 0);
                }
                if (err && isAuthMsg(err.message)) {
                    // Auth / HTTP 401/403 error — mark as permanent failure (-2) to stop retry loop
                    rmtoId = -2; errMsg = err.message; isAuthError = true;
                } else if (response) {
                    rmtoId = response.ID || 0;
                    cfl = response.CFL || 0;
                    // SRVDT: use local time, ignore C# DateTime.MinValue (year 0001 → shows as 0000-12-31 UTC)
                    var srvdtRaw = response.SRVDT ? new Date(response.SRVDT) : null;
                    srvdt = (srvdtRaw && srvdtRaw.getFullYear() > 2000) ? toLocalISOString(srvdtRaw) : null;
                    bil = response.BIL || 0;
                    // ERR field: if empty but CFL > 0, build a descriptive message
                    errMsg = response.ERR || null;
                    if (!errMsg && cfl > 0) errMsg = "RMTO خطا (CFL=" + cfl + ", ID=" + (response.ID || 0) + ")";
                    if (!errMsg && rmtoId === 0) errMsg = "RMTO: ID=0 (داده پذیرفته نشد)";
                    // DUPLICATE RECORD → data already in RMTO (e.g. sent in prev session before DB update)
                    // Treat as permanent success (-3) to stop infinite retry loop
                    if (isDuplicateMsg(errMsg)) {
                        rmtoId = -3; errMsg = "DUPLICATE (قبلاً ارسال شده)";
                    }
                    // Check if RMTO error field indicates auth problem
                    if (isAuthMsg(errMsg)) {
                        rmtoId = -2; isAuthError = true;
                    }
                } else {
                    rmtoId = 0;
                    errMsg = err ? err.message : "no response";
                }

                // For null records: only retry on transient network errors (rmto_id stays 0).
                // Auth errors (-2), duplicates (-3) and successes (>0) are final — do not reset to NULL.
                if (isNull && !isAuthError && rmtoId === 0) {
                    // Null record transient network error — reset to NULL so it retries
                    rmtoId = null;
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
                    (rmtoId && (rmtoId > 0 || rmtoId === -3)) ? 1 : 0,
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
TCEOF_server_scheduler_js

# === server/db.js ===
cat > "$TC_DIR/server/db.js" << 'TCEOF_server_db_js'
/**
 * Database module - SQLite via better-sqlite3
 * Stores devices, traffic data, and send logs.
 */
// Set Iran timezone before any SQLite `datetime('now','localtime')` calls
if (!process.env.TZ) process.env.TZ = "Asia/Tehran";
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
    "  created_at TEXT DEFAULT (datetime('now','localtime'))",
    ");",

    // Users for authentication (admin login)
    "CREATE TABLE IF NOT EXISTS users (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  username TEXT NOT NULL UNIQUE,",
    "  password_hash TEXT NOT NULL,",
    "  role TEXT DEFAULT 'admin',",
    "  created_at TEXT DEFAULT (datetime('now','localtime'))",
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
    "  received_at TEXT DEFAULT (datetime('now','localtime')),",
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
    "  created_at TEXT DEFAULT (datetime('now','localtime'))",
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
    "  created_at TEXT DEFAULT (datetime('now','localtime'))",
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
    "  created_at TEXT DEFAULT (datetime('now','localtime'))",
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
    "  created_at TEXT DEFAULT (datetime('now','localtime'))",
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
    "  received_at TEXT DEFAULT (datetime('now','localtime'))",
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
    "CREATE INDEX IF NOT EXISTS idx_irawdata_read ON irawdata(is_read);",
    // Prevent duplicate interval records when a TCP device reconnects and re-sends the same interval
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_irawdata_unique ON irawdata(device_code, create_at, stop, lane);",

    // Settings (key-value store)
    "CREATE TABLE IF NOT EXISTS settings (",
    "  key TEXT PRIMARY KEY,",
    "  value TEXT",
    ");"
].join("\n"));

// Add RMTO tracking columns to irawdata (safe migration for existing databases)
["rmto_id INTEGER", "rmto_cfl INTEGER", "rmto_srvdt TEXT", "rmto_bil INTEGER", "rmto_err TEXT"].forEach(function (col) {
    try { db.exec("ALTER TABLE irawdata ADD COLUMN " + col); } catch (e) { /* already exists */ }
});

// Reset any in-flight records (rmto_id = -1) left by a previous crash
try { db.exec("UPDATE irawdata SET rmto_id = NULL WHERE rmto_id = -1"); } catch (e) {}

// Add missing columns to irawdata (safe migration for existing databases)
// Includes received_at for old DBs created before it was added to the schema
["received_at TEXT DEFAULT (datetime('now','localtime'))", "rmto_id INTEGER", "rmto_cfl INTEGER", "rmto_srvdt TEXT", "rmto_bil INTEGER", "rmto_err TEXT"].forEach(function (col) {
    try { db.exec("ALTER TABLE irawdata ADD COLUMN " + col); } catch (e) { /* already exists */ }
});

// Add mehvar_code to devices (safe migration — stores the RMTO Road ID / شناسه محور)
try { db.exec("ALTER TABLE devices ADD COLUMN mehvar_code INTEGER"); } catch (e) { /* already exists */ }

// Reset any in-flight records (rmto_id = -1) left by a previous crash
try { db.exec("UPDATE irawdata SET rmto_id = NULL WHERE rmto_id = -1"); } catch (e) {}

// Insert default settings if not exists
var defaultSettings = {
    system_name: "نوآوران جنوب شرق",
    server_ip: "0.0.0.0",
    server_port: "3000",
    tcp_port: "2022",
    refresh_interval: "30",
    max_speed: "120",
    alert_offline: "1",
    alert_speed: "1",
    alert_error: "1",
    offline_timeout: "5",
    rmto_company_code: "58",
    rmto_username: "",
    rmto_password: "",
    rmto_wsdl: "http://otf.rmto.ir/Companies/Companies.asmx?WSDL"
};
var insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
Object.keys(defaultSettings).forEach(function (k) {
    insertSetting.run(k, defaultSettings[k]);
});

module.exports = db;
TCEOF_server_db_js

# === server/rmto-client.js ===
cat > "$TC_DIR/server/rmto-client.js" << 'TCEOF_server_rmto-client_js'
/**
 * RMTO SOAP Client
 * Sends traffic data to otf.rmto.ir/Companies/Companies.asmx
 *
 * Methods:
 *   - AddData  (v1.02): Simple total count + avg speed per 15-min period
 *   - AddData5 (v1.01): 5-class volume + 5-class speed + violations
 *   - AddData8 (v1.00): 8-class volume + 8-class speed + violations
 */
var soap = require("soap");
var db = require("./db");

var WSDL_URL = process.env.RMTO_WSDL || "http://otf.rmto.ir/Companies/Companies.asmx?WSDL";
var COMPANY_CODE = process.env.RMTO_COMPANY_CODE || "58";
var USERNAME = process.env.RMTO_USERNAME || "";
var lastSoapXml = null;  // stores last Add5 SOAP XML for /api/rmto/lastsoap
var PASSWORD = process.env.RMTO_PASSWORD || "";

var soapClient = null;

/**
 * Load RMTO settings from database (overrides env vars).
 * Called before each send to pick up UI changes.
 */
function loadDbSettings() {
    try {
        var rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('rmto_company_code', 'rmto_username', 'rmto_password', 'rmto_wsdl')").all();
        var s = {};
        rows.forEach(function (r) { s[r.key] = r.value; });
        if (s.rmto_company_code) COMPANY_CODE = s.rmto_company_code;
        if (s.rmto_username !== undefined) USERNAME = s.rmto_username;
        if (s.rmto_password !== undefined) PASSWORD = s.rmto_password;
        if (s.rmto_wsdl && s.rmto_wsdl !== WSDL_URL) {
            WSDL_URL = s.rmto_wsdl;
            soapClient = null; // force re-creation with new URL
        }
    } catch (e) {
        console.error("[RMTO] Failed to load DB settings:", e.message);
    }
}

/**
 * Initialize SOAP client (called once at startup).
 */
function initClient(callback) {
    if (soapClient) return callback(null, soapClient);

    soap.createClient(WSDL_URL, function (err, client) {
        if (err) {
            console.error("[RMTO] Failed to create SOAP client:", err.message);
            return callback(err);
        }
        soapClient = client;
        console.log("[RMTO] SOAP client initialized");
        // Auto-detect binding name (could be CompanySoap, CompaniesSoap, etc.)
        var desc = client.describe();
        var serviceName = Object.keys(desc)[0];
        if (serviceName) {
            var portName = Object.keys(desc[serviceName])[0];
            if (portName) {
                console.log("[RMTO] Service=" + serviceName + " Port=" + portName);
                console.log("[RMTO] Available methods:", Object.keys(desc[serviceName][portName]));
            } else {
                console.log("[RMTO] WARNING: No SOAP port found in service " + serviceName);
            }
        } else {
            console.log("[RMTO] WARNING: No SOAP service found in WSDL - check URL: " + WSDL_URL);
        }
        callback(null, client);
    });
}

/**
 * AddData (v1.02) - Simple traffic data
 * @param {object} data
 * @param {string} data.deviceCode - 4-digit device code
 * @param {string} data.dateTime   - Period date/time "YYYY/MM/DD HH:mm"
 * @param {number} data.totalCount - Total vehicles in period
 * @param {number} data.avgSpeed   - Average speed in period
 */
function sendAddData(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CompanyCode: COMPANY_CODE,
            UserName: USERNAME,
            Password: PASSWORD,
            StationCode: data.deviceCode,
            DateTime: data.dateTime,
            Count: data.totalCount,
            Speed: Math.round(data.avgSpeed)
        };

        console.log("[RMTO] AddData request:", JSON.stringify(args));

        soapClient.AddData(args, function (err, result) {
            if (err) {
                console.error("[RMTO] AddData error:", err.message);
                return callback(err, null);
            }
            var response = result && result.AddDataResult;
            console.log("[RMTO] AddData response:", response);
            callback(null, response);
        });
    });
}

/**
 * AddData5 (v1.01) - 5-class traffic data
 * @param {object} data
 * @param {string} data.deviceCode
 * @param {string} data.dateTime
 * @param {number} data.class1Count .. data.class5Count  (volume by vehicle class)
 * @param {number} data.speed1Count .. data.speed5Count  (count by speed range)
 * @param {number} data.violations
 * @param {number} data.avgSpeed
 */
function sendAddData5(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CompanyCode: COMPANY_CODE,
            UserName: USERNAME,
            Password: PASSWORD,
            StationCode: data.deviceCode,
            DateTime: data.dateTime,
            // 5 volume classes
            C1: data.class1Count || 0,
            C2: data.class2Count || 0,
            C3: data.class3Count || 0,
            C4: data.class4Count || 0,
            C5: data.class5Count || 0,
            // 5 speed classes
            S1: data.speed1Count || 0,
            S2: data.speed2Count || 0,
            S3: data.speed3Count || 0,
            S4: data.speed4Count || 0,
            S5: data.speed5Count || 0,
            // Violation & speed
            Violation: data.violations || 0,
            Speed: Math.round(data.avgSpeed || 0)
        };

        console.log("[RMTO] AddData5 request:", JSON.stringify(args));

        soapClient.AddData5(args, function (err, result) {
            if (err) {
                console.error("[RMTO] AddData5 error:", err.message);
                return callback(err, null);
            }
            var response = result && result.AddData5Result;
            console.log("[RMTO] AddData5 response:", response);
            callback(null, response);
        });
    });
}

/**
 * Add5 (WSDL: Companies.asmx) - 5-class traffic data per interval
 * Matches reference C# software exactly (CID/UID/PWD/FID/RID/ST/ET/C1-C5/ASP/S1-S5/SSO/SO1-SO5/OO/ESD)
 * @param {object} data
 * @param {number} data.cid         - Company ID
 * @param {number} data.fid         - Internal record ID (irawdata.id)
 * @param {number} data.rid         - Station/device code (mehvar RID)
 * @param {string|Date} data.st     - Interval start
 * @param {string|Date} data.et     - Interval end
 * @param {number|null} data.c1-c5  - Vehicle class counts (null = inactive)
 * @param {number|null} data.asp    - Weighted avg speed
 * @param {number|null} data.s1-s5  - Per-class avg speeds
 * @param {number|null} data.sso    - Sum of overspeed counts
 * @param {number|null} data.so1-so5 - Per-class overspeed counts
 * @param {number|null} data.oo     - Overtaking count
 * @param {number|null} data.esd    - Headway (tooclose)
 */
/**
 * Normalize a date value to RMTO-expected XSD datetime: "YYYY-MM-DDTHH:mm:ss" (local, no Z, no ms).
 * node-soap corrupts ISO strings with Z/ms suffix when serializing xsd:dateTime fields.
 */
function toSoapDateTime(s) {
    if (!s) return new Date().toISOString().slice(0, 19);
    var d = new Date(s);
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 19);
    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0") + "T" +
        String(d.getHours()).padStart(2, "0") + ":" +
        String(d.getMinutes()).padStart(2, "0") + ":" +
        String(d.getSeconds()).padStart(2, "0");
}

function sendAdd5(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var isNull = (data.c1 === null);
        var args = {
            CID: parseInt(COMPANY_CODE, 10) || 58,
            UID: USERNAME,
            PWD: PASSWORD,
            FID: data.fid,
            RID: data.rid,
            ST: toSoapDateTime(data.st),
            ET: toSoapDateTime(data.et),
            C1: isNull ? null : (data.c1 || 0),
            C2: isNull ? null : (data.c2 || 0),
            C3: isNull ? null : (data.c3 || 0),
            C4: isNull ? null : (data.c4 || 0),
            C5: isNull ? null : (data.c5 || 0),
            ASP: isNull ? null : (data.asp || 0),
            S1: isNull ? null : (data.s1 || 0),
            S2: isNull ? null : (data.s2 || 0),
            S3: isNull ? null : (data.s3 || 0),
            S4: isNull ? null : (data.s4 || 0),
            S5: isNull ? null : (data.s5 || 0),
            SSO: isNull ? null : (data.sso || 0),
            SO1: isNull ? null : (data.so1 || 0),
            SO2: isNull ? null : (data.so2 || 0),
            SO3: isNull ? null : (data.so3 || 0),
            SO4: isNull ? null : (data.so4 || 0),
            SO5: isNull ? null : (data.so5 || 0),
            OO: isNull ? null : (data.oo || 0),
            ESD: isNull ? null : (data.esd || 0)
        };

        console.log("[RMTO] Add5 fid=" + data.fid + " rid=" + data.rid + " total=" + ((data.c1||0)+(data.c2||0)+(data.c3||0)+(data.c4||0)+(data.c5||0)));

        soapClient.Add5(args, function (err, result) {
            // Store last SOAP XML for debugging
            if (soapClient.lastRequest) {
                lastSoapXml = soapClient.lastRequest;
            }
            if (err) {
                console.error("[RMTO] Add5 error:", err.message);
                return callback(err, null);
            }
            var response = result && result.Add5Result;
            console.log("[RMTO] Add5 response: ID=" + (response && response.ID) + " ERR=" + (response && response.ERR));
            callback(null, response);
        });
    });
}

/**
 * AddData8 (v1.00) - 8-class traffic data
 */
function sendAddData8(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CompanyCode: COMPANY_CODE,
            UserName: USERNAME,
            Password: PASSWORD,
            StationCode: data.deviceCode,
            DateTime: data.dateTime,
            C1: data.class1Count || 0,
            C2: data.class2Count || 0,
            C3: data.class3Count || 0,
            C4: data.class4Count || 0,
            C5: data.class5Count || 0,
            C6: data.class6Count || 0,
            C7: data.class7Count || 0,
            C8: data.class8Count || 0,
            S1: data.speed1Count || 0,
            S2: data.speed2Count || 0,
            S3: data.speed3Count || 0,
            S4: data.speed4Count || 0,
            S5: data.speed5Count || 0,
            S6: data.speed6Count || 0,
            S7: data.speed7Count || 0,
            S8: data.speed8Count || 0,
            Violation: data.violations || 0,
            Speed: Math.round(data.avgSpeed || 0)
        };

        console.log("[RMTO] AddData8 request:", JSON.stringify(args));

        soapClient.AddData8(args, function (err, result) {
            if (err) {
                console.error("[RMTO] AddData8 error:", err.message);
                return callback(err, null);
            }
            var response = result && result.AddData8Result;
            console.log("[RMTO] AddData8 response:", response);
            callback(null, response);
        });
    });
}

function ensureClient(callback) {
    loadDbSettings();
    if (soapClient) return callback(null);
    initClient(function (err) { callback(err); });
}

/**
 * Reload settings from DB and force SOAP client re-init.
 * Called by /api/rmto/reinit after settings are saved via UI.
 */
function reinit(callback) {
    soapClient = null;  // force re-creation
    loadDbSettings();
    initClient(function (err) {
        callback(err, { wsdl: WSDL_URL, company: COMPANY_CODE, user: USERNAME, hasPass: !!PASSWORD });
    });
}

module.exports = {
    initClient: initClient,
    reinit: reinit,
    getLastSoapXml: function () { return lastSoapXml; },
    sendAddData: sendAddData,
    sendAddData5: sendAddData5,
    sendAddData8: sendAddData8,
    sendAdd5: sendAdd5
};
TCEOF_server_rmto-client_js

# === js/app.js ===
cat > "$TC_DIR/js/app.js" << 'TCEOF_js_app_js'
(function () {
    "use strict";

    // ============================================================
    // Helpers
    // ============================================================
    var $ = function (sel) { return document.querySelector(sel); };
    var $$ = function (sel) { return document.querySelectorAll(sel); };

    function escapeHtml(str) {
        if (str == null) return "";
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    function formatTime(iso) {
        if (!iso) return "-";
        var d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        var y = d.getFullYear();
        var mo = String(d.getMonth() + 1).padStart(2, "0");
        var dy = String(d.getDate()).padStart(2, "0");
        var h = String(d.getHours()).padStart(2, "0");
        var m = String(d.getMinutes()).padStart(2, "0");
        return y + "/" + mo + "/" + dy + " " + h + ":" + m;
    }

    function api(method, url, body, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.withCredentials = true;
        if (body && method !== "GET") {
            xhr.setRequestHeader("Content-Type", "application/json");
        }
        xhr.onload = function () {
            var data = null;
            try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
            callback(xhr.status, data);
        };
        xhr.onerror = function () { callback(0, null); };
        xhr.send(body ? JSON.stringify(body) : null);
    }

    var TYPE_LABELS = { counter: "ترددشمار", sensor: "سنسور", loop: "حلقه القایی", radar: "رادار" };
    var STATUS_LABELS = { online: "آنلاین", offline: "آفلاین", warning: "هشدار", error: "خطا" };

    var VIEW_TITLES = {
        dashboard: "داشبورد",
        devices: "دستگاه‌ها",
        reception: "دریافت داده",
        rmto: "ارسال رهسام",
        mehvar: "محورها",
        settings: "تنظیمات"
    };

    var PAGE_SIZE = 20;

    // ============================================================
    // Authentication
    // ============================================================
    var loginOverlay = $("#login-overlay");
    var loginForm = $("#login-form");
    var loginError = $("#login-error");
    var serverConnected = false;

    function checkAuth() {
        api("GET", "/api/auth/check", null, function (status, data) {
            if (status === 200 && data && data.loggedIn) {
                loginOverlay.classList.add("hidden");
                serverConnected = true;
                updateConnectionStatus(true);
                if (data.username) {
                    var u = $("#topbar-user"); if (u) u.textContent = data.username;
                    var n = $(".user-name"); if (n) n.textContent = data.username;
                }
                loadDashboard();
            } else if (status === 200) {
                loginOverlay.classList.remove("hidden");
                serverConnected = true;
                updateConnectionStatus(true);
            } else {
                serverConnected = false;
                updateConnectionStatus(false);
                loginOverlay.classList.remove("hidden");
            }
        });
    }

    function updateConnectionStatus(connected) {
        var badge = $("#topbar-status");
        if (!badge) return;
        if (connected) {
            badge.textContent = "متصل به سرور";
            badge.className = "topbar-badge online";
        } else {
            badge.textContent = "عدم اتصال";
            badge.className = "topbar-badge";
            badge.style.background = "rgba(239,68,68,.12)";
            badge.style.color = "#ef4444";
        }
    }

    if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();
            var user = $("#login-user").value;
            var pass = $("#login-pass").value;
            api("POST", "/api/auth/login", { username: user, password: pass }, function (status, data) {
                if (status === 200 && data && data.success) {
                    loginOverlay.classList.add("hidden");
                    loginError.style.display = "none";
                    serverConnected = true;
                    updateConnectionStatus(true);
                    if (data.username) {
                        var u = $("#topbar-user"); if (u) u.textContent = data.username;
                        var n = $(".user-name"); if (n) n.textContent = data.username;
                    }
                    loadDashboard();
                } else {
                    loginError.textContent = (data && data.error) || "نام کاربری یا رمز عبور اشتباه است";
                    loginError.style.display = "block";
                }
            });
        });
    }

    checkAuth();

    // ============================================================
    // Navigation
    // ============================================================
    $$(".nav-item").forEach(function (btn) {
        btn.addEventListener("click", function () {
            switchView(btn.getAttribute("data-view"));
        });
    });

    function switchView(view) {
        $$(".nav-item").forEach(function (b) { b.classList.remove("active"); });
        var activeBtn = document.querySelector('.nav-item[data-view="' + view + '"]');
        if (activeBtn) activeBtn.classList.add("active");
        $$(".view").forEach(function (v) { v.classList.remove("active"); });
        var target = $("#view-" + view);
        if (target) target.classList.add("active");
        $("#topbar-title").textContent = VIEW_TITLES[view] || view;

        if (view === "dashboard") loadDashboard();
        else if (view === "devices") loadDevices();
        else if (view === "reception") loadReception();
        else if (view === "rmto") loadRMTO();
        else if (view === "mehvar") loadMehvar();
        else if (view === "settings") loadSettings();
    }

    // Sidebar toggle (mobile)
    $("#sidebar-toggle").addEventListener("click", function () {
        $("#sidebar").classList.toggle("open");
    });

    // Clock
    function updateClock() {
        var now = new Date();
        var h = String(now.getHours()).padStart(2, "0");
        var m = String(now.getMinutes()).padStart(2, "0");
        var s = String(now.getSeconds()).padStart(2, "0");
        $("#topbar-time").textContent = h + ":" + m + ":" + s;
    }
    updateClock();
    setInterval(updateClock, 1000);

    // ============================================================
    // Dashboard
    // ============================================================
    function loadDashboard() {
        api("GET", "/api/stats", null, function (status, data) {
            if (status === 200 && data) {
                $("#stat-total-devices").textContent = data.totalDevices || 0;
                $("#stat-online-devices").textContent = data.onlineDevices || 0;
                $("#stat-today-vehicles").textContent = data.todayVehicles || 0;
                $("#stat-unsent-rmto").textContent = (data.unsentRMTO || 0) + (data.unsentRMTO5 || 0);
                $("#footer-device-count").textContent = (data.onlineDevices || 0) + " دستگاه فعال";
            }
        });

        api("GET", "/api/devices", null, function (status, data) {
            var tbody = $("#dashboard-table-body");
            if (status !== 200 || !data || !data.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">دستگاهی ثبت نشده است</td></tr>';
                return;
            }
            tbody.innerHTML = data.map(function (d) {
                var st = d.status || "offline";
                return "<tr>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(d.device_code) + "</td>" +
                    "<td>" + escapeHtml(d.name) + "</td>" +
                    '<td><span class="type-badge">' + escapeHtml(TYPE_LABELS[d.type] || d.type) + "</span></td>" +
                    '<td><span class="status-badge ' + st + '">' + escapeHtml(STATUS_LABELS[st] || st) + "</span></td>" +
                    '<td dir="ltr" style="text-align:right">' + escapeHtml(formatTime(d.last_seen)) + "</td>" +
                    "</tr>";
            }).join("");
        });

        loadTcpConnected();
    }

    function loadTcpConnected() {
        api("GET", "/api/tcp/connected", null, function (status, data) {
            var tbody = $("#tcp-table-body");
            if (!tbody) return;
            if (status !== 200 || !data || !Object.keys(data).length) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8">دستگاهی متصل نیست</td></tr>';
                return;
            }
            var rows = Object.keys(data).map(function (code) {
                var d = data[code];
                return "<tr>" +
                    '<td dir="ltr" style="text-align:center;font-weight:700">' + escapeHtml(code) + "</td>" +
                    '<td dir="ltr">' + escapeHtml(d.ip || "-") + "</td>" +
                    '<td dir="ltr" style="text-align:right">' + escapeHtml(formatTime(d.connectedAt)) + "</td>" +
                    '<td>' +
                        '<button class="btn btn-sm btn-secondary" data-action="tcp-sync" data-code="' + escapeHtml(code) + '">سینک ساعت</button> ' +
                        '<button class="btn btn-sm btn-primary" data-action="tcp-poll" data-code="' + escapeHtml(code) + '">دریافت داده</button>' +
                    '</td>' +
                    "</tr>";
            });
            tbody.innerHTML = rows.join("");
        });
    }

    // Event delegation for TCP action buttons
    var tcpTableEl = $("#tcp-table-body");
    if (tcpTableEl) tcpTableEl.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-action]");
        if (!btn) return;
        var action = btn.getAttribute("data-action");
        var code = btn.getAttribute("data-code");
        if (action === "tcp-sync") {
            api("POST", "/api/tcp/sync-time", { device_code: code }, function (s) {
                if (s === 200) alert("دستور سینک ساعت ارسال شد: " + code);
                else alert("خطا در ارسال دستور");
            });
        } else if (action === "tcp-poll") {
            api("POST", "/api/tcp/poll", { device_code: code }, function (s) {
                if (s === 200) alert("درخواست داده ارسال شد: " + code);
                else alert("خطا در ارسال درخواست");
            });
        }
    });

    var refreshTcpBtn = $("#btn-refresh-tcp");
    if (refreshTcpBtn) refreshTcpBtn.addEventListener("click", loadTcpConnected);

    var refreshDashBtn = $("#btn-refresh-dashboard");
    if (refreshDashBtn) refreshDashBtn.addEventListener("click", loadDashboard);

    // ============================================================
    // Live Monitor
    // ============================================================
    var lastLiveTs = 0;

    function loadLive() {
        var url = "/api/live?limit=50";
        if (lastLiveTs > 0) url = "/api/live?since=" + lastLiveTs;

        api("GET", url, null, function (status, data) {
            var tbody = $("#live-table-body");
            if (status !== 200 || !data || !data.length) {
                if (lastLiveTs === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">هنوز داده‌ای دریافت نشده</td></tr>';
                }
                return;
            }

            if (lastLiveTs === 0) tbody.innerHTML = "";

            // Update timestamp
            if (data[0] && data[0].ts) lastLiveTs = data[0].ts;

            var newHtml = data.map(function (e) {
                var typeLabel = { data: "HTTP", irawdata: "HTTP-iraw", tcp: "TCP", "tcp-raw": "TCP-خام", "tcp-ratcx1": "RATCX1", unknown: "نامشخص" }[e.type] || e.type;
                var typeClass = { data: "online", irawdata: "online", tcp: "online", "tcp-raw": "warning", "tcp-ratcx1": "online", unknown: "warning" }[e.type] || "";
                var detail = "";
                if (e.type === "tcp-ratcx1" && e.total !== undefined) {
                    detail = "تردد=" + (e.total||0) + " | a:" + (e.a||0) + " b:" + (e.b||0) + " c:" + (e.c||0) + " d:" + (e.d||0) + " e:" + (e.e||0) + " x:" + (e.x||0);
                    if (e.battery !== undefined) detail += " | باتری:" + e.battery + " سولار:" + (e.solar||0);
                } else if (e.type === "tcp-ratcx1") {
                    detail = e.detail || "";
                } else if (e.type === "tcp") {
                    detail = "تردد=" + (e.total||0) + " | a:" + (e.a||0) + " b:" + (e.b||0) + " c:" + (e.c||0) + " d:" + (e.d||0) + " e:" + (e.e||0) + " x:" + (e.x||0) + " لاین:" + (e.lane||1);
                } else if (e.type === "tcp-raw") {
                    detail = e.detail || "raw data";
                } else if (e.type === "irawdata") {
                    detail = "a:" + (e.a||0) + " b:" + (e.b||0) + " c:" + (e.c||0) + " d:" + (e.d||0) + " e:" + (e.e||0) + " x:" + (e.x||0);
                } else if (e.type === "unknown") {
                    detail = escapeHtml(e.path || "");
                    if (e.body) {
                        var keys = Object.keys(e.body).slice(0, 5).join(",");
                        detail += " {" + keys + "}";
                    }
                } else if (e.type === "data") {
                    if (e.body && e.body.records) detail = e.body.records.length + " records";
                    else detail = "1 record";
                }
                var time = e.time || "";
                if (time) {
                    var d = new Date(time);
                    time = String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0") + ":" + String(d.getSeconds()).padStart(2,"0");
                }
                return "<tr>" +
                    '<td dir="ltr" style="text-align:right;font-size:12px;font-family:monospace">' + escapeHtml(time) + "</td>" +
                    '<td><span class="status-badge ' + typeClass + '">' + escapeHtml(typeLabel) + "</span></td>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(e.ip || "-") + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(e.device || "-") + "</td>" +
                    '<td dir="ltr" style="font-size:11px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(detail) + "</td>" +
                    "</tr>";
            }).join("");

            tbody.insertAdjacentHTML("afterbegin", newHtml);

            // Keep max 100 rows
            while (tbody.children.length > 100) tbody.removeChild(tbody.lastChild);
        });
    }

    var refreshLiveBtn = $("#btn-refresh-live");
    if (refreshLiveBtn) refreshLiveBtn.addEventListener("click", function () { lastLiveTs = 0; loadLive(); });

    // Auto-refresh live monitor every 3 seconds
    setInterval(function () {
        var autoCheck = $("#live-auto-refresh");
        var activeView = document.querySelector(".view.active");
        if (autoCheck && autoCheck.checked && activeView && activeView.id === "view-dashboard") {
            loadLive();
        }
    }, 3000);

    // ============================================================
    // Devices
    // ============================================================
    var allDevices = [];
    var deviceState = { page: 1, search: "" };

    function loadDevices() {
        api("GET", "/api/devices", null, function (status, data) {
            if (status === 200 && data) {
                allDevices = data;
            } else {
                allDevices = [];
            }
            deviceState.page = 1;
            renderDeviceTable();
        });
    }

    function renderDeviceTable() {
        var q = deviceState.search.toLowerCase();
        var filtered = allDevices.filter(function (d) {
            if (!q) return true;
            return (d.name || "").toLowerCase().indexOf(q) !== -1 ||
                   (d.device_code || "").indexOf(q) !== -1;
        });
        var total = filtered.length;
        var start = (deviceState.page - 1) * PAGE_SIZE;
        var paged = filtered.slice(start, start + PAGE_SIZE);

        var tbody = $("#devices-table-body");
        if (!paged.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8">دستگاهی یافت نشد</td></tr>';
        } else {
            tbody.innerHTML = paged.map(function (d, i) {
                var st = d.status || "offline";
                return "<tr>" +
                    "<td>" + (start + i + 1) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(d.device_code) + "</td>" +
                    "<td><strong>" + escapeHtml(d.name) + "</strong></td>" +
                    '<td><span class="type-badge">' + escapeHtml(TYPE_LABELS[d.type] || d.type) + "</span></td>" +
                    "<td>" + escapeHtml(d.route || "-") + "</td>" +
                    '<td dir="ltr" style="text-align:center;font-weight:' + (d.mehvar_code ? '700;color:#0f766e' : '400;color:#94a3b8') + '">' + escapeHtml(d.mehvar_code ? String(d.mehvar_code) : "—") + "</td>" +
                    '<td><span class="status-badge ' + st + '">' + escapeHtml(STATUS_LABELS[st] || st) + "</span></td>" +
                    '<td dir="ltr" style="text-align:right">' + escapeHtml(formatTime(d.last_seen)) + "</td>" +
                    "<td>" +
                        '<div class="action-btns">' +
                            '<button class="btn btn-sm btn-primary btn-dev-edit" data-code="' + escapeHtml(d.device_code) + '">ویرایش</button>' +
                            '<button class="btn btn-sm btn-danger btn-dev-delete" data-code="' + escapeHtml(d.device_code) + '">حذف</button>' +
                        "</div></td>" +
                    "</tr>";
            }).join("");

            tbody.querySelectorAll(".btn-dev-edit").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var code = btn.getAttribute("data-code");
                    var dev = allDevices.filter(function (d) { return d.device_code === code; })[0];
                    if (!dev) return;
                    openDeviceEditModal(dev);
                });
            });

            tbody.querySelectorAll(".btn-dev-delete").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var code = btn.getAttribute("data-code");
                    if (confirm("آیا از حذف دستگاه " + code + " مطمئن هستید؟")) {
                        api("DELETE", "/api/devices/" + code, null, function (s) {
                            if (s === 200) loadDevices();
                            else alert("خطا در حذف");
                        });
                    }
                });
            });
        }

        renderTableInfo("devices", start, paged.length, total);
        renderPagination("devices", deviceState, total, renderDeviceTable);
    }

    var devSearch = $("#devices-search");
    if (devSearch) devSearch.addEventListener("input", function () {
        deviceState.search = this.value.trim();
        deviceState.page = 1;
        renderDeviceTable();
    });

    // Add device
    var addDevBtn = $("#btn-add-device");
    if (addDevBtn) addDevBtn.addEventListener("click", function () {
        currentEditCode = null;
        $("#add-modal-title").textContent = "افزودن دستگاه جدید";
        $("#add-modal-body").innerHTML =
            '<form id="add-device-form">' +
                '<div class="form-group"><label>کد دستگاه (حداکثر ۸ رقم)</label><input type="text" id="new-dev-code" maxlength="8" pattern="\\d{1,8}" dir="ltr" placeholder="مثال: 10010001" required></div>' +
                '<div class="form-group"><label>نام دستگاه</label><input type="text" id="new-dev-name" required></div>' +
                '<div class="form-group"><label>نوع</label><select id="new-dev-type">' +
                    '<option value="counter">ترددشمار</option>' +
                    '<option value="sensor">سنسور</option>' +
                    '<option value="loop">حلقه القایی</option>' +
                    '<option value="radar">رادار</option>' +
                '</select></div>' +
                '<div class="form-group"><label>محور</label><input type="text" id="new-dev-route" placeholder="نام محور"></div>' +
                '<div class="form-group"><label>شناسه محور (RID) — برای ارسال به سامانه RMTO</label><input type="number" id="new-dev-mehvar-code" dir="ltr" placeholder="مثال: 613151"></div>' +
                '<div class="form-group"><label>آدرس IP</label><input type="text" id="new-dev-ip" dir="ltr" placeholder="مثال: 192.168.1.1"></div>' +
            '</form>';
        currentAddMode = "device";
        $("#add-modal-overlay").classList.add("active");
    });

    // Edit device modal
    var currentEditCode = null;

    function openDeviceEditModal(dev) {
        $("#add-modal-title").textContent = "ویرایش دستگاه " + dev.device_code;
        $("#add-modal-body").innerHTML =
            '<form id="add-device-form">' +
                '<div class="form-group"><label>کد دستگاه</label><input type="text" id="new-dev-code" value="' + escapeHtml(dev.device_code) + '" dir="ltr" disabled style="background:#f1f5f9"></div>' +
                '<div class="form-group"><label>نام دستگاه</label><input type="text" id="new-dev-name" value="' + escapeHtml(dev.name) + '" required></div>' +
                '<div class="form-group"><label>نوع</label><select id="new-dev-type">' +
                    '<option value="counter"' + (dev.type === "counter" ? " selected" : "") + '>ترددشمار</option>' +
                    '<option value="sensor"' + (dev.type === "sensor" ? " selected" : "") + '>سنسور</option>' +
                    '<option value="loop"' + (dev.type === "loop" ? " selected" : "") + '>حلقه القایی</option>' +
                    '<option value="radar"' + (dev.type === "radar" ? " selected" : "") + '>رادار</option>' +
                '</select></div>' +
                '<div class="form-group"><label>محور</label><input type="text" id="new-dev-route" value="' + escapeHtml(dev.route || "") + '" placeholder="نام محور"></div>' +
                '<div class="form-group"><label>شناسه محور (RID) — برای ارسال به سامانه RMTO</label><input type="number" id="new-dev-mehvar-code" dir="ltr" value="' + escapeHtml(String(dev.mehvar_code || "")) + '" placeholder="مثال: 613151"></div>' +
                '<div class="form-group"><label>آدرس IP</label><input type="text" id="new-dev-ip" value="' + escapeHtml(dev.ip || "") + '" dir="ltr" placeholder="مثال: 192.168.1.1"></div>' +
            '</form>';
        currentAddMode = "device";
        currentEditCode = dev.device_code;
        $("#add-modal-overlay").classList.add("active");
    }

    // Import devices from JSON/CSV file
    var importBtn = $("#btn-import-devices");
    var importFile = $("#import-devices-file");
    if (importBtn && importFile) {
        importBtn.addEventListener("click", function () { importFile.click(); });
        importFile.addEventListener("change", function () {
            var file = importFile.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function (e) {
                var text = e.target.result;
                var devices = [];
                try {
                    // Try JSON first
                    var parsed = JSON.parse(text);
                    devices = Array.isArray(parsed) ? parsed : (parsed.devices || []);
                } catch (_) {
                    // Try CSV: device_code,name,type,route
                    var lines = text.split(/[\r\n]+/).filter(function (l) { return l.trim(); });
                    for (var i = 0; i < lines.length; i++) {
                        var parts = lines[i].split(",");
                        if (parts.length >= 1 && /^\d{1,8}$/.test(parts[0].trim())) {
                            devices.push({
                                device_code: parts[0].trim(),
                                name: parts[1] ? parts[1].trim() : ("Device " + parts[0].trim()),
                                type: parts[2] ? parts[2].trim() : "counter",
                                route: parts[3] ? parts[3].trim() : ""
                            });
                        }
                    }
                }
                if (!devices.length) { alert("هیچ دستگاهی در فایل یافت نشد"); return; }
                if (!confirm(devices.length + " دستگاه یافت شد. وارد شوند؟")) return;
                api("POST", "/api/devices/import", { devices: devices }, function (status, data) {
                    if (status === 200) {
                        alert((data && data.imported || 0) + " دستگاه وارد شد");
                        loadDevices();
                    } else {
                        alert("خطا در واردکردن");
                    }
                });
            };
            reader.readAsText(file);
            importFile.value = "";
        });
    }

    // ============================================================
    // Data Reception (irawdata)
    // ============================================================
    var receptionState = { page: 1, total: 0, filterCode: "" };

    function loadReception() {
        var code = receptionState.filterCode;
        var offset = (receptionState.page - 1) * PAGE_SIZE;
        var url = "/api/irawdata/list?limit=" + PAGE_SIZE + "&offset=" + offset;
        if (code) url += "&device_code=" + encodeURIComponent(code);

        api("GET", url, null, function (status, data) {
            var tbody = $("#reception-table-body");
            if (status !== 200 || !data || !data.rows || !data.rows.length) {
                tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#94a3b8">داده‌ای دریافت نشده</td></tr>';
                receptionState.total = 0;
                renderTableInfo("reception", 0, 0, 0);
                renderPagination("reception", receptionState, 0, loadReception);
                return;
            }

            receptionState.total = data.total;
            var rows = data.rows;
            var start = (receptionState.page - 1) * PAGE_SIZE;

            tbody.innerHTML = rows.map(function (r) {
                var total = (r.a||0) + (r.b||0) + (r.c||0) + (r.d||0) + (r.e||0) + (r.x||0);
                return "<tr>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(r.device_code) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(formatTime(r.create_at)) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(formatTime(r.stop)) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.lane||1) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.a||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.b||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.c||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.d||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.e||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.x||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center;font-weight:700">' + total + "</td>" +
                    "</tr>";
            }).join("");

            renderTableInfo("reception", start, rows.length, data.total);
            renderPagination("reception", receptionState, data.total, loadReception);
        });
    }

    var recFilter = $("#reception-filter-code");
    if (recFilter) recFilter.addEventListener("change", function () {
        receptionState.filterCode = this.value.trim();
        receptionState.page = 1;
        loadReception();
    });

    var recRefresh = $("#btn-refresh-reception");
    if (recRefresh) recRefresh.addEventListener("click", function () {
        receptionState.page = 1;
        loadReception();
    });

    // ============================================================
    // RMTO Send
    // ============================================================
    function loadRMTO() {
        // Fix37b: reset auto-refresh timer (self-scheduling when RMTO view is active)
        if (_rmtoRefreshTimer) { clearTimeout(_rmtoRefreshTimer); _rmtoRefreshTimer = null; }
        _rmtoRefreshTimer = setTimeout(function () {
            if (document.querySelector("#view-rmto.active")) loadRMTO();
        }, 30000);

        // Load queue from irawdata-based pipeline
        api("GET", "/api/rmto/queue", null, function (status, data) {
            if (status !== 200 || !data) return;

            // Auth-error warning
            var warnDiv = $("#rmto-auth-warning");
            var resetBtn = $("#btn-rmto-reset-auth");
            if (data.recentAuthErrors > 0 || data.authErrorCount > 0) {
                if (warnDiv) warnDiv.style.display = "";
                if (resetBtn) resetBtn.style.display = "";
            } else {
                if (warnDiv) warnDiv.style.display = "none";
                if (resetBtn) resetBtn.style.display = "none";
            }

            // Unsent queue
            var ubody = $("#rmto-unsent-body");
            if (data.unsent && data.unsent.length) {
                ubody.innerHTML = data.unsent.map(function (r) {
                    return "<tr>" +
                        '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(r.device_code || "") + "</td>" +
                        '<td dir="ltr" style="text-align:right">' + escapeHtml(formatTime(r.create_at)) + "</td>" +
                        '<td dir="ltr" style="text-align:right">' + escapeHtml(formatTime(r.stop)) + "</td>" +
                        '<td dir="ltr" style="text-align:center">' + (r.total_vehicles || 0) + "</td>" +
                        '<td dir="ltr" style="text-align:center">' + (r.avg_speed || 0) + "</td>" +
                        '<td><button class="btn btn-sm btn-secondary rmto-preview-btn" data-id="' + r.id + '">نمونه SOAP</button></td>' +
                        "</tr>";
                }).join("");
                $("#rmto-unsent-count").textContent = data.unsent.length;
            } else {
                ubody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">صف ارسال خالی</td></tr>';
                $("#rmto-unsent-count").textContent = "0";
            }

            // Sent history
            if (data.sent && data.sent.length) {
                $("#rmto-sent-count").textContent = data.sent.length + "+";
                var lastSent = data.sent[0];
                if (lastSent && lastSent.create_at) {
                    $("#rmto-last-send").textContent = formatTime(lastSent.create_at);
                }
            } else {
                $("#rmto-sent-count").textContent = "0";
                $("#rmto-last-send").textContent = "-";
            }
        });

        // Load logs
        api("GET", "/api/rmto/logs?limit=30", null, function (status, data) {
            var lbody = $("#rmto-log-body");
            if (status !== 200 || !data || !data.length) {
                lbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8">هنوز ارسالی انجام نشده</td></tr>';
                return;
            }
            lbody.innerHTML = data.map(function (r) {
                var ok = r.success === 1;
                // Show error_message directly in table; fall back to truncated response_data for success
                var displayText = ok
                    ? (r.response_data ? r.response_data.substring(0, 50) + (r.response_data.length > 50 ? "..." : "") : "-")
                    : (r.error_message || "(جزییات ناموجود)");
                var fullResp = (r.response_data || "") + (r.error_message ? "\n\nپیام خطا:\n" + r.error_message : "");
                return "<tr>" +
                    "<td>" + escapeHtml(r.method) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(r.device_code) + "</td>" +
                    '<td><span class="status-badge ' + (ok ? "online" : "error") + '">' + (ok ? "موفق" : "خطا") + "</span></td>" +
                    '<td dir="ltr" style="font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis;color:' + (ok ? "inherit" : "#ef4444") + '">' + escapeHtml(displayText) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(formatTime(r.created_at)) + "</td>" +
                    '<td><button class="btn btn-sm btn-secondary rmto-detail-btn" data-resp="' + escapeHtml(fullResp) + '" data-err="' + escapeHtml(r.error_message || "") + '">جزییات</button></td>' +
                    "</tr>";
            }).join("");
        });
    }

    // Fix37a: detail button handler (event delegation on document)
    document.addEventListener("click", function (ev) {
        var btn = ev.target.closest ? ev.target.closest(".rmto-detail-btn") : (ev.target.className.indexOf("rmto-detail-btn") >= 0 ? ev.target : null);
        if (!btn) return;
        var resp = btn.getAttribute("data-resp") || "";
        var errMsg = btn.getAttribute("data-err") || "";
        var msg = resp || "(پاسخی دریافت نشد)";
        if (errMsg) msg += "\n\nخطا:\n" + errMsg;
        alert(msg);
    });

    // RMTO SOAP preview button handler
    document.addEventListener("click", function (ev) {
        var btn = ev.target.closest ? ev.target.closest(".rmto-preview-btn") : (ev.target.className.indexOf("rmto-preview-btn") >= 0 ? ev.target : null);
        if (!btn) return;
        var id = btn.getAttribute("data-id");
        if (!id) return;
        btn.disabled = true;
        btn.textContent = "...";
        api("GET", "/api/rmto/preview/" + id, null, function (status, data) {
            btn.disabled = false;
            btn.textContent = "نمونه SOAP";
            if (status !== 200 || !data) { alert("خطا در دریافت نمونه"); return; }
            var lines = [
                "═══ رکورد irawdata #" + data.record.id + " ═══",
                "دستگاه: " + data.record.device_code,
                "بازه: " + data.record.create_at + " تا " + data.record.stop,
                "تردد کل: " + data.record.total_vehicles,
                data.record.isNull ? "⚠️ رکورد null (بدون تردد)" : "",
                "",
                "═══ پارامترهای Add5 ═══"
            ];
            var p = data.payload;
            lines.push("CID=" + p.CID + "  FID=" + p.FID + "  RID=" + p.RID);
            lines.push("ST=" + p.ST + "  ET=" + p.ET);
            lines.push("C1(موتور)=" + p.C1 + "  C2(سواری)=" + p.C2 + "  C3(وانت)=" + p.C3 + "  C4(کامیون)=" + p.C4 + "  C5(سنگین)=" + p.C5);
            lines.push("ASP=" + p.ASP + "  S1=" + p.S1 + "  S2=" + p.S2 + "  S3=" + p.S3 + "  S4=" + p.S4 + "  S5=" + p.S5);
            lines.push("SSO=" + p.SSO + "  OO=" + p.OO + "  ESD=" + p.ESD);
            lines.push("");
            lines.push("═══ SOAP XML ═══");
            lines.push(data.soapXml);
            alert(lines.filter(function (l) { return l !== undefined; }).join("\n"));
        });
    });

    // Fix37b: auto-refresh RMTO section every 30s when active
    var _rmtoRefreshTimer = null;

    var rmtoSendBtn = $("#btn-rmto-send-now");
    if (rmtoSendBtn) rmtoSendBtn.addEventListener("click", function () {
        rmtoSendBtn.disabled = true;
        rmtoSendBtn.textContent = "در حال ارسال...";
        api("POST", "/api/rmto/send-now", {}, function (status) {
            rmtoSendBtn.disabled = false;
            rmtoSendBtn.textContent = "ارسال الان";
            if (status === 200) {
                // Fix37c: wait 3s for async SOAP to complete before refreshing
                setTimeout(function () { loadRMTO(); }, 3000);
            } else alert("خطا در ارسال");
        });
    });

    var rmtoAggBtn = $("#btn-rmto-aggregate");
    if (rmtoAggBtn) rmtoAggBtn.addEventListener("click", function () {
        rmtoAggBtn.disabled = true;
        api("POST", "/api/rmto/aggregate", {}, function (status) {
            rmtoAggBtn.disabled = false;
            if (status === 200) {
                setTimeout(function () { loadRMTO(); }, 3000);
            } else alert("خطا");
        });
    });

    var rmtoRefreshBtn = $("#btn-rmto-refresh");
    if (rmtoRefreshBtn) rmtoRefreshBtn.addEventListener("click", loadRMTO);

    var rmtoResetAuthBtn = $("#btn-rmto-reset-auth");
    if (rmtoResetAuthBtn) rmtoResetAuthBtn.addEventListener("click", function () {
        if (!confirm("آیا مطمئن هستید؟ رکوردهای خطای اعتبارنامه برای ارسال مجدد بازنشانی می‌شوند.")) return;
        api("POST", "/api/rmto/reset-auth-errors", {}, function (status, data) {
            if (status === 200) {
                alert("بازنشانی انجام شد. " + (data && data.reset || 0) + " رکورد برای ارسال مجدد آماده شد.");
                loadRMTO();
            } else alert("خطا در بازنشانی");
        });
    });

    // ============================================================
    // Mehvar (Routes) Management
    // ============================================================
    function loadMehvar() {
        api("GET", "/api/mehvar", null, function (status, data) {
            var tbody = $("#mehvar-table-body");
            if (status !== 200 || !data || !data.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8">محوری ثبت نشده</td></tr>';
                return;
            }
            tbody.innerHTML = data.map(function (r) {
                return "<tr>" +
                    '<td dir="ltr" style="text-align:center;font-weight:700">' + escapeHtml(r.code) + "</td>" +
                    "<td>" + escapeHtml(r.name) + "</td>" +
                    "<td>" + escapeHtml(r.ostan || "-") + "</td>" +
                    '<td style="text-align:center"><span class="status-badge ' + (r.send_enable ? "online" : "warning") + '">' +
                        (r.send_enable ? "فعال" : "غیرفعال") + "</span></td>" +
                    '<td style="text-align:center"><span class="status-badge ' + (r.repair ? "error" : "") + '">' +
                        (r.repair ? "بله" : "خیر") + "</span></td>" +
                    '<td><button class="btn btn-sm btn-danger" data-action="delete-mehvar" data-code="' + escapeHtml(String(r.code)) + '">حذف</button></td>' +
                    "</tr>";
            }).join("");
        });
    }

    // Event delegation for mehvar table buttons
    var mehvarTableEl = $("#mehvar-table-body");
    if (mehvarTableEl) mehvarTableEl.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-action='delete-mehvar']");
        if (!btn) return;
        var code = btn.getAttribute("data-code");
        if (!confirm("محور " + code + " حذف شود؟")) return;
        api("DELETE", "/api/mehvar/" + encodeURIComponent(code), null, function (status) {
            if (status === 200) loadMehvar();
            else alert("خطا در حذف محور");
        });
    });

    var addMehvarBtn = $("#btn-add-mehvar");
    if (addMehvarBtn) addMehvarBtn.addEventListener("click", function () {
        var addBody = $("#add-modal-body");
        var addTitle = $("#add-modal-title");
        if (!addBody || !addTitle) return;
        addTitle.textContent = "افزودن محور جدید";
        addBody.innerHTML =
            '<div class="form-group"><label>کد محور</label><input type="number" id="new-mehvar-code" placeholder="مثال: 101" dir="ltr"></div>' +
            '<div class="form-group"><label>نام محور</label><input type="text" id="new-mehvar-name" placeholder="مثال: تهران - مشهد"></div>' +
            '<div class="form-group"><label>استان</label><input type="text" id="new-mehvar-ostan" placeholder="مثال: تهران"></div>' +
            '<div class="form-group"><label>ارسال رهسام</label><select id="new-mehvar-send">' +
                '<option value="1">فعال</option><option value="0">غیرفعال</option>' +
            '</select></div>' +
            '<div class="form-group"><label>تحت تعمیر</label><select id="new-mehvar-repair">' +
                '<option value="0">خیر</option><option value="1">بله</option>' +
            '</select></div>';
        $("#add-modal-overlay").classList.add("active");
        $("#add-modal-save").onclick = function () {
            var code = parseInt($("#new-mehvar-code").value, 10);
            var name = ($("#new-mehvar-name").value || "").trim();
            if (!code || !name) { alert("کد و نام محور الزامی است"); return; }
            api("POST", "/api/mehvar", {
                code: code,
                name: name,
                ostan: ($("#new-mehvar-ostan").value || "").trim(),
                send_enable: parseInt($("#new-mehvar-send").value, 10),
                repair: parseInt($("#new-mehvar-repair").value, 10)
            }, function (status, data) {
                if (status === 200) {
                    $("#add-modal-overlay").classList.remove("active");
                    loadMehvar();
                } else {
                    alert((data && data.error) || "خطا در ثبت محور");
                }
            });
        };
    });

    var refreshMehvarBtn = $("#btn-refresh-mehvar");
    if (refreshMehvarBtn) refreshMehvarBtn.addEventListener("click", loadMehvar);

    // ============================================================
    // Settings
    // ============================================================
    function loadSettings() {
        loadServerTime();
        api("GET", "/api/settings", null, function (status, data) {
            if (status !== 200 || !data) return;
            if (data.system_name) $("#setting-name").value = data.system_name;
            if (data.server_ip) $("#setting-server").value = data.server_ip;
            if (data.server_port) $("#setting-port").value = data.server_port;
            if (data.tcp_port) { var tp = $("#setting-tcp-port"); if (tp) tp.value = data.tcp_port; }
            if (data.refresh_interval) $("#setting-refresh").value = data.refresh_interval;
            if (data.max_speed) $("#setting-max-speed").value = data.max_speed;
            // RMTO
            if (data.rmto_wsdl) $("#setting-rmto-wsdl").value = data.rmto_wsdl;
            if (data.rmto_company_code) $("#setting-rmto-company").value = data.rmto_company_code;
            if (data.rmto_username) $("#setting-rmto-user").value = data.rmto_username;
            if (data.rmto_password) $("#setting-rmto-pass").value = data.rmto_password;
        });
    }

    function saveSettings(body, msg) {
        api("POST", "/api/settings", body, function (status) {
            if (status === 200) alert(msg || "ذخیره شد");
            else alert("خطا در ذخیره");
        });
    }

    var saveSettingsBtn = $("#btn-save-settings");
    var generalStatusEl = $("#general-save-status");
    if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", function () {
        var tcpPort = $("#setting-tcp-port");
        saveSettingsBtn.disabled = true;
        api("POST", "/api/settings", {
            system_name: $("#setting-name").value,
            server_ip: $("#setting-server").value,
            server_port: $("#setting-port").value,
            tcp_port: tcpPort ? tcpPort.value : "2022",
            refresh_interval: $("#setting-refresh").value,
            max_speed: $("#setting-max-speed").value
        }, function (status) {
            saveSettingsBtn.disabled = false;
            if (generalStatusEl) {
                generalStatusEl.style.display = "";
                generalStatusEl.style.color = status === 200 ? "#16a34a" : "#dc2626";
                generalStatusEl.textContent = status === 200 ? "✅ تنظیمات عمومی ذخیره شد" : (status === 401 ? "❌ نشست منقضی — مجدداً وارد شوید" : "❌ خطا در ذخیره");
                setTimeout(function () { if (generalStatusEl) generalStatusEl.style.display = "none"; }, 5000);
            }
            if (status === 401) setTimeout(function () { window.location.reload(); }, 2000);
        });
    });

    var saveRmtoBtn = $("#btn-save-rmto");
    var rmtoStatusEl = $("#rmto-save-status");
    function showRmtoStatus(msg, ok) {
        if (!rmtoStatusEl) return;
        rmtoStatusEl.style.display = "";
        rmtoStatusEl.style.color = ok ? "#16a34a" : "#dc2626";
        rmtoStatusEl.textContent = msg;
        setTimeout(function () { if (rmtoStatusEl) rmtoStatusEl.style.display = "none"; }, 6000);
    }
    if (saveRmtoBtn) saveRmtoBtn.addEventListener("click", function () {
        saveRmtoBtn.disabled = true;
        api("POST", "/api/settings", {
            rmto_wsdl: $("#setting-rmto-wsdl").value,
            rmto_company_code: $("#setting-rmto-company").value,
            rmto_username: $("#setting-rmto-user").value,
            rmto_password: $("#setting-rmto-pass").value
        }, function (status) {
            saveRmtoBtn.disabled = false;
            if (status === 200) {
                showRmtoStatus("✅ تنظیمات ذخیره شد — در حال اعمال به سرور...", true);
                // Force SOAP client reinit so new credentials are used immediately
                api("POST", "/api/rmto/reinit", {}, function (s, d) {
                    if (s === 200 && d && d.success) {
                        showRmtoStatus("✅ تنظیمات ذخیره شد و اتصال رهسام بازسازی شد (کاربر: " + (d.user || "-") + ")", true);
                    } else {
                        showRmtoStatus("✅ ذخیره شد — خطا در اتصال: " + ((d && d.error) || "بررسی کنید"), false);
                    }
                });
            } else if (status === 401) {
                showRmtoStatus("❌ نشست منقضی شده — لطفاً مجدداً وارد شوید", false);
                setTimeout(function () { window.location.reload(); }, 2000);
            } else {
                showRmtoStatus("❌ خطا در ذخیره تنظیمات (کد: " + status + ")", false);
            }
        });
    });

    var testRmtoBtn = $("#btn-test-rmto");
    if (testRmtoBtn) testRmtoBtn.addEventListener("click", function () {
        testRmtoBtn.disabled = true;
        testRmtoBtn.textContent = "در حال تست...";
        api("POST", "/api/rmto/reinit", {}, function (s, d) {
            testRmtoBtn.disabled = false;
            testRmtoBtn.textContent = "تست اتصال";
            if (s === 200 && d && d.success) {
                showRmtoStatus("✅ اتصال موفق — کاربر: " + (d.user || "-") + " | کد شرکت: " + (d.company || "-"), true);
            } else {
                showRmtoStatus("❌ خطا در اتصال به رهسام: " + ((d && d.error) || "WSDL یا اعتبارنامه را بررسی کنید"), false);
            }
        });
    });

    var settingsResetAuthBtn = $("#btn-settings-reset-auth");
    if (settingsResetAuthBtn) settingsResetAuthBtn.addEventListener("click", function () {
        if (!confirm("آیا مطمئن هستید؟ رکوردهای خطای اعتبارنامه برای ارسال مجدد بازنشانی می‌شوند.")) return;
        api("POST", "/api/rmto/reset-auth-errors", {}, function (status, data) {
            if (status === 200) {
                showRmtoStatus("✅ " + (data && data.reset || 0) + " رکورد برای ارسال مجدد بازنشانی شد", true);
            } else {
                showRmtoStatus("❌ خطا در بازنشانی", false);
            }
        });
    });

    // Server Time
    function loadServerTime() {
        api("GET", "/api/server/time", null, function (status, data) {
            if (status !== 200 || !data) return;
            var el = $("#server-time-display");
            if (el && data.local) el.textContent = data.local;
            else if (el && data.time) {
                var d = new Date(data.time);
                el.textContent = d.toLocaleString("fa-IR");
            }
            var tz = $("#server-timezone");
            if (tz) tz.textContent = data.timezone || "-";
            var ut = $("#server-uptime");
            if (ut && data.uptime) {
                var sec = Math.floor(data.uptime);
                var days = Math.floor(sec / 86400);
                var hrs = Math.floor((sec % 86400) / 3600);
                var mins = Math.floor((sec % 3600) / 60);
                ut.textContent = days + " روز " + hrs + " ساعت " + mins + " دقیقه";
            }
        });
    }

    var refreshTimeBtn = $("#btn-refresh-server-time");
    if (refreshTimeBtn) refreshTimeBtn.addEventListener("click", loadServerTime);

    // Change password
    var changePassBtn = $("#btn-change-pass");
    if (changePassBtn) changePassBtn.addEventListener("click", function () {
        var oldP = $("#setting-old-pass").value;
        var newP = $("#setting-new-pass").value;
        if (!oldP || !newP) { alert("لطفا هر دو فیلد را پر کنید"); return; }
        api("POST", "/api/auth/change-password", { old_password: oldP, new_password: newP }, function (status, data) {
            if (status === 200) { alert("رمز عبور تغییر کرد"); $("#setting-old-pass").value = ""; $("#setting-new-pass").value = ""; }
            else alert((data && data.error) || "خطا");
        });
    });

    // Logout
    var logoutBtn = $("#btn-logout");
    if (logoutBtn) logoutBtn.addEventListener("click", function () {
        api("POST", "/api/auth/logout", {}, function () {
            loginOverlay.classList.remove("hidden");
        });
    });

    // Backup download
    var backupDlBtn = $("#btn-backup-download");
    if (backupDlBtn) backupDlBtn.addEventListener("click", function () {
        window.location.href = "/api/backup/download";
    });

    // Backup restore
    var backupRestoreBtn = $("#btn-backup-restore");
    if (backupRestoreBtn) backupRestoreBtn.addEventListener("click", function () {
        var fileInput = $("#backup-file");
        if (!fileInput.files || !fileInput.files[0]) { alert("لطفا فایل پشتیبان را انتخاب کنید"); return; }
        var formData = new FormData();
        formData.append("backup", fileInput.files[0]);
        var statusEl = $("#backup-status");
        statusEl.textContent = "در حال آپلود و پردازش...";
        statusEl.style.color = "#475569";
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/backup/restore", true);
        xhr.withCredentials = true;
        xhr.onload = function () {
            var r;
            try { r = JSON.parse(xhr.responseText); } catch (e) { r = {}; }
            if (xhr.status === 200) {
                statusEl.textContent = r.message || "بازیابی انجام شد";
                statusEl.style.color = "#22c55e";
            } else {
                statusEl.textContent = r.error || "خطا در بازیابی";
                statusEl.style.color = "#ef4444";
            }
        };
        xhr.onerror = function () { statusEl.textContent = "خطا در ارتباط با سرور"; statusEl.style.color = "#ef4444"; };
        xhr.send(formData);
    });

    // ============================================================
    // Add Modal (shared)
    // ============================================================
    var currentAddMode = "";

    var addSaveBtn = $("#add-modal-save");
    if (addSaveBtn) addSaveBtn.addEventListener("click", function () {
        if (currentAddMode === "device") {
            var dcode = ($("#new-dev-code") || {}).value;
            var dname = ($("#new-dev-name") || {}).value;
            if (!dname || !dname.trim()) { alert("لطفا نام دستگاه را وارد کنید"); return; }
            var dtype = ($("#new-dev-type") || {}).value || "counter";
            var droute = ($("#new-dev-route") || {}).value || "";
            var dmehvar = ($("#new-dev-mehvar-code") || {}).value || "";
            var dmehvarCode = dmehvar ? parseInt(dmehvar, 10) : null;
            var dip = ($("#new-dev-ip") || {}).value || "";

            if (currentEditCode) {
                // Edit mode - PUT
                api("PUT", "/api/devices/" + currentEditCode, {
                    name: dname.trim(),
                    type: dtype,
                    route: droute,
                    ip: dip,
                    mehvar_code: dmehvarCode
                }, function (status) {
                    if (status === 200) {
                        $("#add-modal-overlay").classList.remove("active");
                        currentEditCode = null;
                        loadDevices();
                    } else {
                        alert("خطا در ویرایش");
                    }
                });
            } else {
                // Add mode - POST
                if (!dcode || !/^\d{1,8}$/.test(dcode)) { alert("کد دستگاه باید عددی و حداکثر ۸ رقم باشد"); return; }
                api("POST", "/api/devices", {
                    device_code: dcode,
                    name: dname.trim(),
                    type: dtype,
                    route: droute,
                    ip: dip,
                    mehvar_code: dmehvarCode
                }, function (status, data) {
                    if (status === 200) {
                        $("#add-modal-overlay").classList.remove("active");
                        loadDevices();
                    } else {
                        alert((data && data.error) || "خطا در ثبت دستگاه");
                    }
                });
            }
        }
    });

    // ============================================================
    // Modal Close Handlers
    // ============================================================
    ["modal-close", "modal-cancel"].forEach(function (id) {
        var el = $("#" + id);
        if (el) el.addEventListener("click", function () { $("#modal-overlay").classList.remove("active"); });
    });

    ["add-modal-close", "add-modal-cancel"].forEach(function (id) {
        var el = $("#" + id);
        if (el) el.addEventListener("click", function () { $("#add-modal-overlay").classList.remove("active"); });
    });

    ["modal-overlay", "add-modal-overlay"].forEach(function (id) {
        var el = $("#" + id);
        if (el) el.addEventListener("click", function (e) {
            if (e.target === el) el.classList.remove("active");
        });
    });

    // ============================================================
    // Shared: Table Info & Pagination
    // ============================================================
    function renderTableInfo(prefix, start, count, total) {
        var el = $("#" + prefix + "-table-info");
        if (!el) return;
        if (total === 0) {
            el.textContent = "داده‌ای یافت نشد";
        } else {
            el.textContent = "نمایش " + (start + 1) + " تا " + (start + count) + " از " + total + " ردیف";
        }
    }

    function renderPagination(prefix, state, total, renderFn) {
        var container = $("#" + prefix + "-pagination");
        if (!container) return;
        var pages = Math.ceil(total / PAGE_SIZE);
        if (pages <= 1) { container.innerHTML = ""; return; }

        var html = "";
        html += '<button class="page-btn" data-p="prev" ' + (state.page <= 1 ? "disabled" : "") + '>&laquo;</button>';
        var startPage = Math.max(1, state.page - 2);
        var endPage = Math.min(pages, startPage + 4);
        for (var i = startPage; i <= endPage; i++) {
            html += '<button class="page-btn ' + (i === state.page ? "active" : "") + '" data-p="' + i + '">' + i + '</button>';
        }
        html += '<button class="page-btn" data-p="next" ' + (state.page >= pages ? "disabled" : "") + '>&raquo;</button>';
        container.innerHTML = html;

        container.querySelectorAll(".page-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var p = btn.getAttribute("data-p");
                if (p === "prev") state.page = Math.max(1, state.page - 1);
                else if (p === "next") state.page = Math.min(pages, state.page + 1);
                else state.page = parseInt(p, 10);
                renderFn();
            });
        });
    }

    // ============================================================
    // Auto-refresh every 30s
    // ============================================================
    setInterval(function () {
        var activeView = document.querySelector(".view.active");
        if (!activeView) return;
        var id = activeView.id;
        if (id === "view-dashboard") loadDashboard();
        else if (id === "view-reception") loadReception();
    }, 30000);

})();
TCEOF_js_app_js

# === index.html ===
cat > "$TC_DIR/index.html" << 'TCEOF_index_html'
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>نوآوران جنوب شرق - TC Manager</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>

    <!-- Login Page -->
    <div class="login-overlay" id="login-overlay">
        <div class="login-box">
            <div class="login-logo">
                <div class="logo-icon" style="width:56px;height:56px;font-size:22px;margin:0 auto 12px">TC</div>
                <h2>نوآوران جنوب شرق</h2>
                <p>سامانه مدیریت ترددشمار هوشمند</p>
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
                    <span class="logo-title">نوآوران جنوب شرق</span>
                    <span class="logo-sub">TC Manager</span>
                </div>
            </div>
        </div>

        <nav class="sidebar-nav">
            <button class="nav-item active" data-view="dashboard">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1a1 1 0 0 0 .7-1.7l-9-9a1 1 0 0 0-1.4 0l-9 9A1 1 0 0 0 3 13zm7 7v-5h4v5h-4zm2-15.6 7 7V20h-3v-5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v5H5v-8.6l7-7z"/></svg>
                <span>داشبورد</span>
            </button>
            <button class="nav-item" data-view="devices">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/></svg>
                <span>دستگاه‌ها</span>
            </button>
            <button class="nav-item" data-view="reception">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                <span>دریافت داده</span>
            </button>
            <button class="nav-item" data-view="rmto">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M4.01 6.03l7.51 3.22-7.52-1 .01-2.22m7.5 8.72L4 17.97v-2.22l7.51-1M2.01 3L2 10l15 2-15 2 .01 7L23 12 2.01 3z"/></svg>
                <span>ارسال رهسام</span>
            </button>
            <button class="nav-item" data-view="mehvar">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zm-.5 1.5 1.96 2.5H17V9.5h2.5zM6 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm13 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
                <span>محورها</span>
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
                    <span class="user-name">اپراتور</span>
                    <span class="user-role">مدیر</span>
                </div>
            </div>
        </div>
    </aside>

    <!-- Main -->
    <div class="main-wrapper">

        <!-- Top Bar -->
        <header class="topbar">
            <button class="topbar-toggle" id="sidebar-toggle">
                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            </button>
            <div class="topbar-title" id="topbar-title">داشبورد</div>
            <div class="topbar-left">
                <span class="topbar-time" id="topbar-time"></span>
                <span class="topbar-badge" id="topbar-status">در انتظار اتصال</span>
                <span class="topbar-user-name" id="topbar-user" style="font-size:12px;color:#64748b"></span>
            </div>
        </header>

        <!-- Content Area -->
        <main class="content">

            <!-- ===== Dashboard ===== -->
            <section class="view active" id="view-dashboard">
                <div class="stats-row">
                    <div class="stat-card">
                        <div class="stat-icon blue">
                            <svg viewBox="0 0 24 24"><path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="stat-total-devices">-</div>
                            <div class="stat-label">کل دستگاه‌ها</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">
                            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="stat-online-devices">-</div>
                            <div class="stat-label">دستگاه آنلاین</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon orange">
                            <svg viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="stat-today-vehicles">-</div>
                            <div class="stat-label">تردد امروز</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon red">
                            <svg viewBox="0 0 24 24"><path d="M4.01 6.03l7.51 3.22-7.52-1 .01-2.22m7.5 8.72L4 17.97v-2.22l7.51-1M2.01 3L2 10l15 2-15 2 .01 7L23 12 2.01 3z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="stat-unsent-rmto">-</div>
                            <div class="stat-label">صف ارسال رهسام</div>
                        </div>
                    </div>
                </div>

                <!-- Live Monitor -->
                <div class="panel" style="margin-bottom:16px">
                    <div class="panel-header">
                        <h3 class="panel-title">مانیتور زنده (درخواست‌های ورودی)</h3>
                        <div class="panel-tools">
                            <label class="toggle-label" style="font-size:12px">
                                <input type="checkbox" id="live-auto-refresh" checked>
                                <span>بروزرسانی خودکار</span>
                            </label>
                            <button class="btn btn-sm btn-primary" id="btn-refresh-live">بروزرسانی</button>
                        </div>
                    </div>
                    <div class="table-wrapper" style="max-height:300px;overflow-y:auto">
                        <table class="data-table" id="live-table">
                            <thead>
                                <tr>
                                    <th>زمان</th>
                                    <th>نوع</th>
                                    <th>IP</th>
                                    <th>کد دستگاه</th>
                                    <th>جزئیات</th>
                                </tr>
                            </thead>
                            <tbody id="live-table-body">
                                <tr><td colspan="5" style="text-align:center;color:#94a3b8">منتظر داده...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- TCP Connected Devices -->
                <div class="panel" style="margin-bottom:16px">
                    <div class="panel-header">
                        <h3 class="panel-title">اتصالات TCP فعال</h3>
                        <div class="panel-tools">
                            <button class="btn btn-sm btn-primary" id="btn-refresh-tcp">بروزرسانی</button>
                        </div>
                    </div>
                    <div class="table-wrapper" style="max-height:200px;overflow-y:auto">
                        <table class="data-table" id="tcp-table">
                            <thead>
                                <tr>
                                    <th>کد دستگاه</th>
                                    <th>آدرس IP</th>
                                    <th>زمان اتصال</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody id="tcp-table-body">
                                <tr><td colspan="4" style="text-align:center;color:#94a3b8">دستگاهی متصل نیست</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Device Status Table -->
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">وضعیت دستگاه‌ها</h3>
                        <div class="panel-tools">
                            <button class="btn btn-sm btn-primary" id="btn-refresh-dashboard">بروزرسانی</button>
                        </div>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table" id="dashboard-table">
                            <thead>
                                <tr>
                                    <th>کد</th>
                                    <th>نام دستگاه</th>
                                    <th>نوع</th>
                                    <th>وضعیت</th>
                                    <th>آخرین اتصال</th>
                                </tr>
                            </thead>
                            <tbody id="dashboard-table-body">
                                <tr><td colspan="5" style="text-align:center;color:#94a3b8">در حال بارگذاری...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- ===== Devices ===== -->
            <section class="view" id="view-devices">
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">مدیریت دستگاه‌ها</h3>
                        <div class="panel-tools">
                            <button class="btn btn-primary" id="btn-add-device">+ دستگاه جدید</button>
                            <button class="btn btn-secondary" id="btn-import-devices">واردکردن از فایل</button>
                            <input type="file" id="import-devices-file" accept=".json,.csv" style="display:none">
                            <div class="search-box">
                                <label>جستجو:</label>
                                <input type="text" id="devices-search" class="search-input">
                            </div>
                        </div>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table" id="devices-table">
                            <thead>
                                <tr>
                                    <th>ردیف</th>
                                    <th>کد دستگاه</th>
                                    <th>نام دستگاه</th>
                                    <th>نوع</th>
                                    <th>محور</th>
                                    <th>شناسه محور (RID)</th>
                                    <th>وضعیت</th>
                                    <th>آخرین اتصال</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody id="devices-table-body">
                                <tr><td colspan="9" style="text-align:center;color:#94a3b8">در حال بارگذاری...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="table-footer">
                        <div class="table-info" id="devices-table-info"></div>
                        <div class="pagination" id="devices-pagination"></div>
                    </div>
                </div>
            </section>

            <!-- ===== Data Reception ===== -->
            <section class="view" id="view-reception">
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">داده‌های دریافتی از دستگاه‌ها</h3>
                        <div class="panel-tools">
                            <div class="search-box">
                                <label>کد دستگاه:</label>
                                <input type="text" id="reception-filter-code" class="search-input" placeholder="مثال: 1001" dir="ltr" style="width:100px">
                            </div>
                            <button class="btn btn-sm btn-primary" id="btn-refresh-reception">بروزرسانی</button>
                        </div>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table" id="reception-table">
                            <thead>
                                <tr>
                                    <th>کد دستگاه</th>
                                    <th>شروع</th>
                                    <th>پایان</th>
                                    <th>لاین</th>
                                    <th>موتور(a)</th>
                                    <th>سواری(b)</th>
                                    <th>ون(c)</th>
                                    <th>اتوبوس(d)</th>
                                    <th>کامیون(e)</th>
                                    <th>نامشخص(x)</th>
                                    <th>کل</th>
                                </tr>
                            </thead>
                            <tbody id="reception-table-body">
                                <tr><td colspan="11" style="text-align:center;color:#94a3b8">در حال بارگذاری...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="table-footer">
                        <div class="table-info" id="reception-table-info"></div>
                        <div class="pagination" id="reception-pagination"></div>
                    </div>
                </div>
            </section>

            <!-- ===== RMTO Send ===== -->
            <section class="view" id="view-rmto">
                <div class="stats-row" style="grid-template-columns: repeat(3, 1fr)">
                    <div class="stat-card">
                        <div class="stat-icon orange">
                            <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="rmto-unsent-count">-</div>
                            <div class="stat-label">در صف ارسال</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">
                            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="rmto-sent-count">-</div>
                            <div class="stat-label">ارسال شده</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon blue">
                            <svg viewBox="0 0 24 24"><path d="M4.01 6.03l7.51 3.22-7.52-1 .01-2.22m7.5 8.72L4 17.97v-2.22l7.51-1M2.01 3L2 10l15 2-15 2 .01 7L23 12 2.01 3z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="rmto-last-send">-</div>
                            <div class="stat-label">آخرین ارسال</div>
                        </div>
                    </div>
                </div>

                <div style="display:flex;gap:8px;margin-bottom:16px">
                    <button class="btn btn-primary" id="btn-rmto-send-now">ارسال الان</button>
                    <button class="btn btn-secondary" id="btn-rmto-aggregate">تجمیع و ارسال</button>
                    <button class="btn btn-secondary" id="btn-rmto-refresh">بروزرسانی</button>
                    <button class="btn btn-secondary" id="btn-rmto-reset-auth" style="display:none;background:#dc2626;color:#fff">بازنشانی خطاهای اعتبارنامه</button>
                </div>
                <div id="rmto-auth-warning" style="display:none;background:#fef2f2;border:1px solid #dc2626;color:#dc2626;border-radius:8px;padding:10px 16px;margin-bottom:12px;font-size:13px">
                    ⚠️ خطای احراز هویت RMTO: نام کاربری یا رمز عبور اشتباه است. لطفاً تنظیمات RMTO را بررسی و اصلاح کنید، سپس دکمه «بازنشانی خطاهای اعتبارنامه» را بزنید تا ارسال مجدد انجام شود.
                </div>

                <!-- Unsent Queue -->
                <div class="panel" style="margin-bottom:16px">
                    <div class="panel-header">
                        <h3 class="panel-title">صف ارسال (ارسال نشده)</h3>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>کد دستگاه</th>
                                    <th>شروع دوره</th>
                                    <th>پایان دوره</th>
                                    <th>تعداد خودرو</th>
                                    <th>سرعت متوسط</th>
                                    <th>SOAP</th>
                                </tr>
                            </thead>
                            <tbody id="rmto-unsent-body">
                                <tr><td colspan="6" style="text-align:center;color:#94a3b8">در حال بارگذاری...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Send Log -->
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">تاریخچه ارسال</h3>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>متد</th>
                                    <th>کد دستگاه</th>
                                    <th>وضعیت</th>
                                    <th>پاسخ</th>
                                    <th>زمان</th>
                                    <th>جزییات</th>
                                </tr>
                            </thead>
                            <tbody id="rmto-log-body">
                                <tr><td colspan="6" style="text-align:center;color:#94a3b8">در حال بارگذاری...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- ===== Mehvar (Routes) ===== -->
            <section class="view" id="view-mehvar">
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">مدیریت محورها</h3>
                        <div class="panel-tools">
                            <button class="btn btn-primary" id="btn-add-mehvar">+ محور جدید</button>
                            <button class="btn btn-secondary" id="btn-refresh-mehvar">بروزرسانی</button>
                        </div>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table" id="mehvar-table">
                            <thead>
                                <tr>
                                    <th>کد محور</th>
                                    <th>نام محور</th>
                                    <th>استان</th>
                                    <th>ارسال رهسام</th>
                                    <th>تحت تعمیر</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody id="mehvar-table-body">
                                <tr><td colspan="6" style="text-align:center;color:#94a3b8">در حال بارگذاری...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- ===== Settings ===== -->
            <section class="view" id="view-settings">
                <div class="settings-grid">
                    <!-- Server Time -->
                    <div class="panel">
                        <div class="panel-header">
                            <h3 class="panel-title">ساعت سرور</h3>
                        </div>
                        <div class="panel-body">
                            <div class="form-group">
                                <label>زمان فعلی سرور</label>
                                <div dir="ltr" id="server-time-display" style="font-size:22px;font-weight:700;color:#1e40af;margin:8px 0;font-family:monospace">--:--:--</div>
                            </div>
                            <div class="form-group">
                                <label>منطقه زمانی</label>
                                <div id="server-timezone" dir="ltr" style="color:#475569">-</div>
                            </div>
                            <div class="form-group">
                                <label>مدت روشن بودن سرور</label>
                                <div id="server-uptime" dir="ltr" style="color:#475569">-</div>
                            </div>
                            <button class="btn btn-secondary" id="btn-refresh-server-time">بروزرسانی</button>
                        </div>
                    </div>

                    <!-- RMTO Settings -->
                    <div class="panel">
                        <div class="panel-header">
                            <h3 class="panel-title">تنظیمات ارتباط رهسام (RMTO)</h3>
                        </div>
                        <div class="panel-body">
                            <div class="form-group">
                                <label>آدرس WSDL</label>
                                <input type="text" id="setting-rmto-wsdl" dir="ltr" placeholder="http://otf.rmto.ir/Companies/Companies.asmx?WSDL">
                            </div>
                            <div class="form-group">
                                <label>کد شرکت</label>
                                <input type="text" id="setting-rmto-company" dir="ltr" placeholder="58">
                            </div>
                            <div class="form-group">
                                <label>نام کاربری رهسام</label>
                                <input type="text" id="setting-rmto-user" dir="ltr">
                            </div>
                            <div class="form-group">
                                <label>رمز عبور رهسام</label>
                                <input type="password" id="setting-rmto-pass" dir="ltr">
                            </div>
                            <div id="rmto-save-status" style="margin-bottom:8px;font-size:13px;display:none"></div>
                            <button class="btn btn-primary" id="btn-save-rmto">ذخیره تنظیمات رهسام</button>
                            <button class="btn btn-secondary" id="btn-test-rmto" style="margin-right:8px">تست اتصال</button>
                            <button class="btn btn-danger" id="btn-settings-reset-auth" style="margin-right:8px;font-size:12px">بازنشانی خطاهای اعتبارنامه</button>
                        </div>
                    </div>

                    <!-- General Settings -->
                    <div class="panel">
                        <div class="panel-header">
                            <h3 class="panel-title">تنظیمات عمومی</h3>
                        </div>
                        <div class="panel-body">
                            <div class="form-group">
                                <label>نام سامانه</label>
                                <input type="text" id="setting-name" value="نوآوران جنوب شرق">
                            </div>
                            <div class="form-group">
                                <label>آدرس IP سرور</label>
                                <input type="text" id="setting-server" value="0.0.0.0" dir="ltr">
                            </div>
                            <div class="form-group">
                                <label>پورت HTTP سرور</label>
                                <input type="number" id="setting-port" value="3000" dir="ltr">
                            </div>
                            <div class="form-group">
                                <label>پورت TCP دستگاه‌ها</label>
                                <input type="number" id="setting-tcp-port" value="2022" dir="ltr">
                            </div>
                            <div class="form-group">
                                <label>فاصله ارسال به رهسام (دقیقه)</label>
                                <input type="number" id="setting-refresh" value="15" dir="ltr">
                            </div>
                            <div class="form-group">
                                <label>حداکثر سرعت مجاز (km/h)</label>
                                <input type="number" id="setting-max-speed" value="120" dir="ltr">
                            </div>
                            <div id="general-save-status" style="margin-bottom:8px;font-size:13px;display:none"></div>
                            <button class="btn btn-primary" id="btn-save-settings">ذخیره تنظیمات</button>
                        </div>
                    </div>

                    <!-- Password -->
                    <div class="panel">
                        <div class="panel-header">
                            <h3 class="panel-title">تغییر رمز عبور</h3>
                        </div>
                        <div class="panel-body">
                            <div class="form-group">
                                <label>رمز عبور فعلی</label>
                                <input type="password" id="setting-old-pass" dir="ltr">
                            </div>
                            <div class="form-group">
                                <label>رمز عبور جدید</label>
                                <input type="password" id="setting-new-pass" dir="ltr">
                            </div>
                            <button class="btn btn-primary" id="btn-change-pass">تغییر رمز</button>
                            <button class="btn btn-danger" id="btn-logout" style="margin-right:8px">خروج</button>
                        </div>
                    </div>

                    <!-- Backup -->
                    <div class="panel">
                        <div class="panel-header">
                            <h3 class="panel-title">پشتیبان‌گیری و بازیابی</h3>
                        </div>
                        <div class="panel-body">
                            <div class="form-group">
                                <button class="btn btn-primary" id="btn-backup-download">دانلود پشتیبان دیتابیس</button>
                            </div>
                            <div class="form-group">
                                <label>بازیابی از فایل (.db یا .sql.gz)</label>
                                <input type="file" id="backup-file" accept=".db,.sql,.gz,.sql.gz" style="margin-top:6px">
                            </div>
                            <button class="btn btn-danger" id="btn-backup-restore">آپلود و بازیابی</button>
                            <div id="backup-status" style="margin-top:12px;font-size:13px;color:#475569"></div>
                        </div>
                    </div>

                    <!-- About -->
                    <div class="panel">
                        <div class="panel-header">
                            <h3 class="panel-title">درباره</h3>
                        </div>
                        <div class="panel-body about-info">
                            <p><strong>نوآوران جنوب شرق</strong></p>
                            <p>نسخه: <span dir="ltr">1.2.0</span></p>
                            <p>سامانه مدیریت ترددشمار هوشمند</p>
                            <p>سازگار با TC Manager رهسام (RMTO)</p>
                        </div>
                    </div>
                </div>
            </section>

        </main>

        <!-- Footer -->
        <footer class="footer">
            <div class="footer-right">نوآوران جنوب شرق - TC Manager &copy; ۱۴۰۴</div>
            <div class="footer-left">
                <span class="footer-status" id="footer-device-count">0 دستگاه فعال</span>
            </div>
        </footer>
    </div>

    <!-- Modal -->
    <div class="modal-overlay" id="modal-overlay">
        <div class="modal">
            <div class="modal-header">
                <h3 id="modal-title">جزئیات</h3>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            <div class="modal-body" id="modal-body"></div>
            <div class="modal-footer" id="modal-footer">
                <button class="btn btn-secondary" id="modal-cancel">بستن</button>
                <button class="btn btn-primary" id="modal-save" style="display:none;">ذخیره</button>
            </div>
        </div>
    </div>

    <!-- Add Modal -->
    <div class="modal-overlay" id="add-modal-overlay">
        <div class="modal">
            <div class="modal-header">
                <h3 id="add-modal-title">افزودن</h3>
                <button class="modal-close" id="add-modal-close">&times;</button>
            </div>
            <div class="modal-body" id="add-modal-body"></div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="add-modal-cancel">انصراف</button>
                <button class="btn btn-primary" id="add-modal-save">ذخیره</button>
            </div>
        </div>
    </div>

    <script src="js/app.js"></script>
</body>
</html>
TCEOF_index_html

# === ecosystem.config.js ===
cat > "$TC_DIR/ecosystem.config.js" << 'TCEOF_ecosystem_config_js'
/**
 * PM2 ecosystem config — TC Manager
 * Usage:
 *   First time:    pm2 start ecosystem.config.js
 *   Update/Restart: pm2 restart tc-manager --update-env
 */
module.exports = {
    apps: [{
        name: "tc-manager",
        script: "server/index.js",
        cwd: "/opt/tc-manager",
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: "300M",
        restart_delay: 3000,
        min_uptime: 3000,
        kill_timeout: 6000,
        env: {
            NODE_ENV: "production",
            TZ: "Asia/Tehran"
        }
    }]
};
TCEOF_ecosystem_config_js

echo ""
echo "🔄 راه‌اندازی مجدد..."
pm2 start ecosystem.config.js --update-env 2>/dev/null || pm2 restart tc-manager --update-env
sleep 3
pm2 list
echo ""
echo "✅ Deploy کامل شد!"
echo "📌 گام بعدی: دستگاه‌ها → ویرایش → شناسه محور (RID) را تنظیم کنید"
