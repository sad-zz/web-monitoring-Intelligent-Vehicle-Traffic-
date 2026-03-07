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

        var a = row.a || 0, b = row.b || 0, c = row.c || 0, d = row.d || 0;
        var e5 = (row.e || 0) + (row.x || 0);
        var totalCount = a + b + c + d + e5;
        var sa = row.sa || 0, sb = row.sb || 0, sc = row.sc || 0, sd = row.sd || 0;
        var se = (row.se || 0) + (row.sx || 0);
        var asp = totalCount > 0 ? Math.round((sa + sb + sc + sd + se) / totalCount) : 0;
        var s1 = a > 0 ? Math.round(sa / a) : 0;
        var s2 = b > 0 ? Math.round(sb / b) : 0;
        var s3 = c > 0 ? Math.round(sc / c) : 0;
        var s4 = d > 0 ? Math.round(sd / d) : 0;
        var s5 = e5 > 0 ? Math.round(se / e5) : 0;
        var so1 = row.sao || 0, so2 = row.sbo || 0, so3 = row.sco || 0;
        var so4 = row.sdo || 0, so5 = (row.seo || 0) + (row.sxo || 0);
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
            C1: isNull ? null : a,
            C2: isNull ? null : b,
            C3: isNull ? null : c,
            C4: isNull ? null : d,
            C5: isNull ? null : e5,
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

        var soapXml = '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n' +
            '  <soap:Body>\n' +
            '    <Add5 xmlns="http://otf.rmto.ir/">\n' +
            Object.keys(payload).map(function (k) {
                return "      <" + k + ">" + (payload[k] === null ? "" : payload[k]) + "</" + k + ">";
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
