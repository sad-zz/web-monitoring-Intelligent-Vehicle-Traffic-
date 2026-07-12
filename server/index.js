/**
 * TC Manager Server (Noavaran Jonoob Shargh)
 * - Login authentication
 * - Backup / Restore
 * - Receives data from 100+ devices
 * - Aggregates and sends to RMTO via SOAP
 */

// Set timezone to Iran Standard Time (UTC+3:30) BEFORE any Date operations
// This ensures all new Date() calls return Iran local time
process.env.TZ = "Asia/Tehran";

// Global error handlers to prevent silent server crashes
process.on("uncaughtException", function (err) {
    console.error("[FATAL] Uncaught Exception:", err.message);
    console.error(err.stack);
    // Only exit on truly fatal errors (EADDRINUSE, out of memory, etc.)
    // For other errors, log and continue to avoid restart loops
    if (err.code === "EADDRINUSE" || err.code === "ERR_IPC_CHANNEL_CLOSED" ||
        err.message && err.message.indexOf("Cannot allocate memory") !== -1) {
        setTimeout(function () { process.exit(1); }, 1000);
    } else {
        console.error("[FATAL] Server continuing despite uncaught exception to avoid restart loop");
    }
});

process.on("unhandledRejection", function (reason) {
    console.error("[FATAL] Unhandled Promise Rejection:", reason);
});

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

// Build version for deployment verification
var BUILD_VERSION = "2026.04.07-v3";

// --- Session & Auth Setup ---
var SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
var ADMIN_USER = process.env.ADMIN_USER || "admin";
var ADMIN_PASS_HASH = null;

// Initialize admin password
(function initAdmin() {
    // Check if users table exists
    db.exec([
        "CREATE TABLE IF NOT EXISTS users (",
        "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
        "  username TEXT NOT NULL UNIQUE,",
        "  password_hash TEXT NOT NULL,",
        "  role TEXT DEFAULT 'admin',",
        "  created_at TEXT DEFAULT (datetime('now','localtime'))",
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
    rolling: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Multer for file uploads (backup restore)
var uploadsDir = path.join(__dirname, "uploads/");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
var upload = multer({ dest: uploadsDir, limits: { fileSize: 500 * 1024 * 1024 } });

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
        // Also store in traffic_data for RMTO aggregation
        var classes = [{cls:1,n:r.a||0,s:r.sa||0},{cls:2,n:r.b||0,s:r.sb||0},{cls:3,n:r.c||0,s:r.sc||0},{cls:4,n:r.d||0,s:r.sd||0},{cls:5,n:r.e||0,s:r.se||0}];
        classes.forEach(function(c){ if(c.n>0) insertTraffic.run(code, ca, c.cls, c.s/c.n, ln, JSON.stringify(r)); });
    }

    if (b.records && Array.isArray(b.records)) {
        try {
            db.transaction(function(recs){ recs.forEach(insertOne); })(b.records);
        } catch (txErr) {
            console.error("[HTTP] Transaction error for device " + code + ":", txErr.message);
            return res.status(500).json({ success: false, error: txErr.message });
        }
    } else {
        try {
            insertOne(b);
        } catch (insertErr) {
            console.error("[HTTP] Insert error for device " + code + ":", insertErr.message);
            return res.status(500).json({ success: false, error: insertErr.message });
        }
    }
    res.json({ success: true, received: count });
});

// Auto-register unknown devices
function autoRegisterDevice(code) {
    // Reject garbled/non-numeric codes (e.g. port scanners or stray bytes on TCP:2022
    // that happen to match a RATCX1/iccore prefix but aren't a real device handshake).
    if (!code || !/^\d+$/.test(code)) return;
    var existing = db.prepare("SELECT device_code, status, name FROM devices WHERE device_code = ?").get(code);
    if (!existing) {
        try { db.prepare("INSERT INTO devices (device_code, name, type, status) VALUES (?, ?, 'counter', 'online')").run(code, "Device " + code); } catch(e){}
        // Notify: new device connected for first time
        scheduler.sendBaleNotification && scheduler.sendBaleNotification("🟢 دستگاه جدید متصل شد\nکد: " + code);
    } else if (existing.status !== "online") {
        // Device was offline, now coming back online
        scheduler.sendBaleNotification && scheduler.sendBaleNotification("🟢 دستگاه آنلاین شد\nکد: " + code + "\nنام: " + (existing.name || code));
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
    var allowed = ["system_name", "server_ip", "server_port", "tcp_port", "refresh_interval", "max_speed", "alert_offline", "alert_speed", "alert_error", "offline_timeout", "rmto_company_code", "rmto_username", "rmto_password", "rmto_wsdl", "rmto_source_ip", "bale_bot_token", "bale_chat_id"];
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
        uptime: process.uptime(),
        build: BUILD_VERSION
    });
});

// ============================================================
// API: Server Restart (PM2 will auto-restart after process.exit)
// ============================================================
app.post("/api/server/restart", requireAuth, function (req, res) {
    res.json({ success: true, message: "سرور در حال ریستارت است..." });
    console.log("[SERVER] Restart requested by user:", req.session.user && req.session.user.username);
    setTimeout(function () { process.exit(0); }, 1500);
});

// ============================================================
// API: Bale notification test
// ============================================================
app.post("/api/bale/test", requireAuth, function (req, res) {
    var text = req.body.text || "🔔 تست اطلاع‌رسانی از TC Manager";
    scheduler.sendBaleNotification(text, function (err) {
        if (err) {
            res.json({ success: false, message: "خطا در ارسال: " + err.message });
        } else {
            res.json({ success: true, message: "پیام با موفقیت ارسال شد" });
        }
    });
});

// ============================================================
// API: RMTO Test Send - send configurable test data directly to RMTO
// ============================================================
app.post("/api/rmto/test-send", requireAuth, function (req, res) {
    var b = req.body;
    var rid = parseInt(b.rid, 10) || 0;
    if (!rid) return res.status(400).json({ error: "کد محور (RID) الزامی است" });

    var now = new Date();
    var periodEnd = new Date(now);
    periodEnd.setMinutes(Math.floor(periodEnd.getMinutes() / 5) * 5, 0, 0);
    var periodStart = new Date(periodEnd.getTime() - 5 * 60 * 1000);

    function localISO(d) {
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0") + "T" +
            String(d.getHours()).padStart(2, "0") + ":" +
            String(d.getMinutes()).padStart(2, "0") + ":00";
    }

    var c1 = parseInt(b.c1) || 0;
    var c2 = parseInt(b.c2) || 0;
    var c3 = parseInt(b.c3) || 0;
    var c4 = parseInt(b.c4) || 0;
    var c5 = parseInt(b.c5) || 0;
    var asp = parseInt(b.asp) || 60;
    var fid = parseInt(b.fid) || 0;
    var st = b.st || localISO(periodStart);
    var et = b.et || localISO(periodEnd);

    // Load source IP from settings for consistency with scheduler
    var sourceIpRow = db.prepare("SELECT value FROM settings WHERE key = 'rmto_source_ip'").get();
    var sourceIp = (sourceIpRow && sourceIpRow.value) ? sourceIpRow.value.trim() : "";

    rmto.sendAddData5({
        FID: fid,
        RID: rid,
        ST: st,
        ET: et,
        C1: c1, C2: c2, C3: c3, C4: c4, C5: c5,
        ASP: asp,
        S1: asp, S2: asp, S3: asp, S4: asp, S5: asp,
        SSO: 0, SO1: 0, SO2: 0, SO3: 0, SO4: 0, SO5: 0,
        OO: 0, ESD: 0,
        sourceIp: sourceIp
    }, function (err, response, soapXml) {
        var success = !err && response && (response.ID > 0 || response.CFL === 100);
        db.prepare(
            "INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message, soap_xml, source_ip) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).run("Add5-Test", "test", JSON.stringify({ rid: rid, c1: c1, c2: c2, c3: c3, c4: c4, c5: c5, asp: asp, st: st, et: et }),
            JSON.stringify(response), success ? 1 : 0, err ? err.message : null, soapXml || null, sourceIp || null);
        res.json({
            success: success,
            response: response,
            error: err ? err.message : null,
            soapXml: soapXml,
            sent: { rid: rid, c1: c1, c2: c2, c3: c3, c4: c4, c5: c5, asp: asp, st: st, et: et }
        });
    });
});

// ============================================================
// API: Archive Test Send - send historical records from rmto_queue_5class
// ============================================================

// In-memory job tracking for archive send operations
var archiveSendJobs = {};
var archiveJobSeq = 0;

// GET /api/rmto/archive-records - preview records matching route/date range
app.get("/api/rmto/archive-records", requireAuth, function (req, res) {
    var rid = req.query.rid ? parseInt(req.query.rid, 10) : null;
    var from = req.query.from || "";
    var to = req.query.to || "";
    var limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);

    var sql = "SELECT id, device_code, route_id, period_start, period_end, " +
        "c1, c2, c3, c4, c5, avg_speed, sso, oo, esd, sent, sent_at " +
        "FROM rmto_queue_5class WHERE 1=1";
    var params = [];
    if (rid) { sql += " AND route_id = ?"; params.push(String(rid)); }
    if (from) { sql += " AND period_start >= ?"; params.push(from); }
    if (to) { sql += " AND period_start <= ?"; params.push(to); }
    sql += " ORDER BY period_start ASC LIMIT ?";
    params.push(limit);

    var rows = db.prepare(sql).all.apply(db.prepare(sql), params);
    res.json({ total: rows.length, rows: rows });
});

// POST /api/rmto/archive-send - start an archive batch send job
app.post("/api/rmto/archive-send", requireAuth, function (req, res) {
    var b = req.body;
    var from = b.from || "";
    var to = b.to || "";
    var rid = b.rid ? parseInt(b.rid, 10) : null;

    if (!from || !to) return res.status(400).json({ error: "from و to الزامی است" });

    var sql = "SELECT * FROM rmto_queue_5class WHERE 1=1";
    var params = [];
    if (rid) { sql += " AND route_id = ?"; params.push(String(rid)); }
    sql += " AND period_start >= ? AND period_start <= ? ORDER BY period_start ASC";
    params.push(from, to);

    var rawRecords = db.prepare(sql).all.apply(db.prepare(sql), params);
    if (rawRecords.length === 0) return res.status(404).json({ error: "رکوردی در بازه مشخص‌شده یافت نشد" });

    // Merge records sharing the same route_id + period_start to prevent RMTO duplicates
    var mergeMap = {};
    rawRecords.forEach(function (r) {
        if (!r.route_id) return;
        var key = r.route_id + "|" + r.period_start;
        if (!mergeMap[key]) {
            mergeMap[key] = JSON.parse(JSON.stringify(r));
        } else {
            var e = mergeMap[key];
            var eTotal = (e.c1||0) + (e.c2||0) + (e.c3||0) + (e.c4||0) + (e.c5||0);
            var rTotal = (r.c1||0) + (r.c2||0) + (r.c3||0) + (r.c4||0) + (r.c5||0);
            var ns1 = (e.c1||0) + (r.c1||0) > 0 ? Math.round(((e.c1||0) * (e.s1||0) + (r.c1||0) * (r.s1||0)) / ((e.c1||0) + (r.c1||0))) : 0;
            var ns2 = (e.c2||0) + (r.c2||0) > 0 ? Math.round(((e.c2||0) * (e.s2||0) + (r.c2||0) * (r.s2||0)) / ((e.c2||0) + (r.c2||0))) : 0;
            var ns3 = (e.c3||0) + (r.c3||0) > 0 ? Math.round(((e.c3||0) * (e.s3||0) + (r.c3||0) * (r.s3||0)) / ((e.c3||0) + (r.c3||0))) : 0;
            var ns4 = (e.c4||0) + (r.c4||0) > 0 ? Math.round(((e.c4||0) * (e.s4||0) + (r.c4||0) * (r.s4||0)) / ((e.c4||0) + (r.c4||0))) : 0;
            var ns5 = (e.c5||0) + (r.c5||0) > 0 ? Math.round(((e.c5||0) * (e.s5||0) + (r.c5||0) * (r.s5||0)) / ((e.c5||0) + (r.c5||0))) : 0;
            var nTotal = eTotal + rTotal;
            e.avg_speed = nTotal > 0 ? Math.round((eTotal * (e.avg_speed||0) + rTotal * (r.avg_speed||0)) / nTotal) : 0;
            e.c1 = (e.c1||0) + (r.c1||0); e.c2 = (e.c2||0) + (r.c2||0); e.c3 = (e.c3||0) + (r.c3||0);
            e.c4 = (e.c4||0) + (r.c4||0); e.c5 = (e.c5||0) + (r.c5||0);
            e.s1 = ns1; e.s2 = ns2; e.s3 = ns3; e.s4 = ns4; e.s5 = ns5;
            e.sso = (e.sso||0) + (r.sso||0);
            e.so1 = (e.so1||0) + (r.so1||0); e.so2 = (e.so2||0) + (r.so2||0); e.so3 = (e.so3||0) + (r.so3||0);
            e.so4 = (e.so4||0) + (r.so4||0); e.so5 = (e.so5||0) + (r.so5||0);
            e.oo = (e.oo||0) + (r.oo||0); e.esd = (e.esd||0) + (r.esd||0);
            e.device_code = e.device_code + "+" + r.device_code;
        }
    });
    var records = Object.keys(mergeMap).map(function (k) { return mergeMap[k]; });
    if (records.length < rawRecords.length) {
        console.log("[ArchiveSend] Merged " + rawRecords.length + " records into " + records.length + " (same-route dedup)");
    }

    var jobId = ++archiveJobSeq;
    var sourceIpRow = db.prepare("SELECT value FROM settings WHERE key = 'rmto_source_ip'").get();
    var sourceIp = (sourceIpRow && sourceIpRow.value) ? sourceIpRow.value.trim() : "";

    var job = {
        id: jobId,
        rid: rid,
        from: from,
        to: to,
        total: records.length,
        sent: 0,
        success: 0,
        failed: 0,
        stopped: false,
        status: "running",
        startedAt: new Date().toISOString(),
        errors: []
    };
    archiveSendJobs[jobId] = job;

    var SEND_DELAY_MS = 800;
    var idx = 0;

    function sendNextArchive() {
        if (job.stopped || idx >= records.length) {
            job.status = job.stopped ? "stopped" : "done";
            console.log("[ArchiveSend] Job #" + jobId + " " + job.status + " (" + job.success + "/" + job.total + " success)");
            return;
        }
        var row = records[idx++];
        if (!row.route_id) {
            job.sent++;
            setTimeout(sendNextArchive, SEND_DELAY_MS);
            return;
        }
        rmto.sendAddData5({
            FID: row.id,
            RID: parseInt(row.route_id, 10),
            ST: row.period_start,
            ET: row.period_end,
            C1: row.c1, C2: row.c2, C3: row.c3, C4: row.c4, C5: row.c5,
            ASP: Math.round(row.avg_speed || 0),
            S1: row.s1 || 0, S2: row.s2 || 0, S3: row.s3 || 0, S4: row.s4 || 0, S5: row.s5 || 0,
            SSO: row.sso || 0,
            SO1: row.so1 || 0, SO2: row.so2 || 0, SO3: row.so3 || 0, SO4: row.so4 || 0, SO5: row.so5 || 0,
            OO: row.oo || 0,
            ESD: row.esd || 0,
            sourceIp: sourceIp
        }, function (err, response, soapXml) {
            var success = !err && response && (response.ID > 0 || response.CFL === 100);
            job.sent++;
            if (success) { job.success++; } else { job.failed++; job.errors.push({ id: row.id, rid: row.route_id, error: err ? err.message : (response && response.ERR ? response.ERR : "خطا") }); }
            db.prepare("INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message, soap_xml, source_ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                .run("Add5-Archive", row.device_code, JSON.stringify(row), JSON.stringify(response), success ? 1 : 0, err ? err.message : null, soapXml || null, sourceIp || null);
            setTimeout(sendNextArchive, SEND_DELAY_MS);
        });
    }

    res.json({ jobId: jobId, total: records.length, message: "ارسال آرشیو شروع شد" });
    setTimeout(sendNextArchive, 100);
});

// GET /api/rmto/archive-jobs - list all active/recent jobs
app.get("/api/rmto/archive-jobs", requireAuth, function (req, res) {
    var jobs = Object.keys(archiveSendJobs).map(function (k) { return archiveSendJobs[k]; });
    res.json(jobs);
});

// DELETE /api/rmto/archive-send/:jobId - stop a job
app.delete("/api/rmto/archive-send/:jobId", requireAuth, function (req, res) {
    var jobId = parseInt(req.params.jobId, 10);
    var job = archiveSendJobs[jobId];
    if (!job) return res.status(404).json({ error: "job not found" });
    job.stopped = true;
    job.status = "stopped";
    res.json({ success: true, message: "ارسال متوقف شد" });
});

// ============================================================
// API: Scheduled Test Send - replay data every 5 min for up to 15 days
// ============================================================
var testScheduleJobs = {};
var testScheduleSeq = 0;

// POST /api/rmto/test-schedule - start a scheduled test send
app.post("/api/rmto/test-schedule", requireAuth, function (req, res) {
    var b = req.body;
    var rid = parseInt(b.rid, 10) || 0;
    if (!rid || rid <= 0) return res.status(400).json({ error: "کد محور (RID) الزامی است" });

    var durationDays = Math.min(Math.max(parseInt(b.durationDays, 10) || 1, 1), 15);
    var c1 = parseInt(b.c1) || 0;
    var c2 = parseInt(b.c2) || 0;
    var c3 = parseInt(b.c3) || 0;
    var c4 = parseInt(b.c4) || 0;
    var c5 = parseInt(b.c5) || 0;
    var asp = parseInt(b.asp) || 60;
    var s1 = parseInt(b.s1) || asp;
    var s2 = parseInt(b.s2) || asp;
    var s3 = parseInt(b.s3) || asp;
    var s4 = parseInt(b.s4) || asp;
    var s5 = parseInt(b.s5) || asp;

    var jobId = ++testScheduleSeq;
    var expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    var sourceIpRow = db.prepare("SELECT value FROM settings WHERE key = 'rmto_source_ip'").get();
    var sourceIp = (sourceIpRow && sourceIpRow.value) ? sourceIpRow.value.trim() : "";

    function localISO(d) {
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0") + "T" +
            String(d.getHours()).padStart(2, "0") + ":" +
            String(d.getMinutes()).padStart(2, "0") + ":00";
    }

    var job = {
        id: jobId,
        rid: rid,
        data: { c1: c1, c2: c2, c3: c3, c4: c4, c5: c5, asp: asp, s1: s1, s2: s2, s3: s3, s4: s4, s5: s5 },
        durationDays: durationDays,
        expiresAt: expiresAt.toISOString(),
        startedAt: new Date().toISOString(),
        sendCount: 0,
        successCount: 0,
        failedCount: 0,
        lastSendAt: null,
        lastError: null,
        stopped: false,
        status: "running"
    };

    function sendOnce() {
        if (job.stopped || new Date() >= expiresAt) {
            job.status = job.stopped ? "stopped" : "expired";
            if (job.timerId) { clearInterval(job.timerId); job.timerId = null; }
            console.log("[TestSchedule] Job #" + jobId + " " + job.status + " (" + job.successCount + "/" + job.sendCount + " success)");
            return;
        }
        var now = new Date();
        var periodEnd = new Date(now);
        periodEnd.setMinutes(Math.floor(periodEnd.getMinutes() / 5) * 5, 0, 0);
        var periodStart = new Date(periodEnd.getTime() - 5 * 60 * 1000);
        var st = localISO(periodStart);
        var et = localISO(periodEnd);

        job.sendCount++;
        rmto.sendAddData5({
            FID: 0, RID: rid, ST: st, ET: et,
            C1: c1, C2: c2, C3: c3, C4: c4, C5: c5,
            ASP: asp, S1: s1, S2: s2, S3: s3, S4: s4, S5: s5,
            SSO: 0, SO1: 0, SO2: 0, SO3: 0, SO4: 0, SO5: 0,
            OO: 0, ESD: 0, sourceIp: sourceIp
        }, function (err, response, soapXml) {
            var success = !err && response && (response.ID > 0 || response.CFL === 100);
            job.lastSendAt = new Date().toISOString();
            if (success) {
                job.successCount++;
                job.lastError = null;
            } else {
                job.failedCount++;
                job.lastError = err ? err.message : (response && response.ERR ? response.ERR : "خطا");
            }
            try {
                db.prepare("INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message, soap_xml, source_ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                    .run("Add5-Scheduled", "test-schedule-" + jobId,
                        JSON.stringify({ rid: rid, c1: c1, c2: c2, c3: c3, c4: c4, c5: c5, asp: asp, st: st, et: et }),
                        JSON.stringify(response), success ? 1 : 0, err ? err.message : null, soapXml || null, sourceIp || null);
            } catch (e) { console.error("[TestSchedule] Log error:", e.message); }
        });
    }

    // Send immediately, then every 5 minutes
    sendOnce();
    job.timerId = setInterval(sendOnce, 5 * 60 * 1000);
    testScheduleJobs[jobId] = job;

    console.log("[TestSchedule] Job #" + jobId + " started: RID=" + rid + " for " + durationDays + " days");
    res.json({ success: true, jobId: jobId, message: "ارسال زمانبندی شده شروع شد (" + durationDays + " روز)" });
});

// GET /api/rmto/test-schedule - list active scheduled jobs
app.get("/api/rmto/test-schedule", requireAuth, function (req, res) {
    var jobs = Object.keys(testScheduleJobs).map(function (k) {
        var j = testScheduleJobs[k];
        return { id: j.id, rid: j.rid, data: j.data, durationDays: j.durationDays,
            expiresAt: j.expiresAt, startedAt: j.startedAt, sendCount: j.sendCount,
            successCount: j.successCount, failedCount: j.failedCount,
            lastSendAt: j.lastSendAt, lastError: j.lastError, stopped: j.stopped, status: j.status };
    });
    res.json(jobs);
});

// DELETE /api/rmto/test-schedule/:jobId - stop a scheduled job
app.delete("/api/rmto/test-schedule/:jobId", requireAuth, function (req, res) {
    var jobId = parseInt(req.params.jobId, 10);
    var job = testScheduleJobs[jobId];
    if (!job) return res.status(404).json({ error: "job not found" });
    job.stopped = true;
    job.status = "stopped";
    if (job.timerId) { clearInterval(job.timerId); job.timerId = null; }
    res.json({ success: true, message: "ارسال زمانبندی شده متوقف شد" });
});

// ============================================================
// API: Device Management
// ============================================================
app.get("/api/devices", function (req, res) {
    // Hide garbled/non-numeric device_code rows (junk from stray TCP:2022 traffic) from monitoring views.
    res.json(db.prepare("SELECT * FROM devices WHERE is_numeric(device_code) = 1 ORDER BY device_code").all());
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
    // Sanitize route values - must be numeric (mehvar code) or empty
    var r1 = b.route1 || b.route || "";
    var r2 = b.route2 || "";
    if (r1 && isNaN(parseInt(r1, 10))) r1 = "";
    if (r2 && isNaN(parseInt(r2, 10))) r2 = "";
    var rid1 = b.rid1 || "";
    var rid2 = b.rid2 || "";
    try {
        db.prepare("INSERT INTO devices (device_code, name, type, route, route1, route2, rid1, rid2, ip, status, firmware, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
            b.device_code, b.name, b.type || "sensor",
            r1, r1, r2, rid1, rid2,
            b.ip || "", "offline", b.firmware || "",
            b.active !== undefined ? (b.active ? 1 : 0) : 1
        );
        res.json({ success: true, device_code: b.device_code });
    } catch (e) {
        if (e.message.indexOf("UNIQUE") !== -1) return res.status(409).json({ error: "duplicate device_code" });
        res.status(500).json({ error: e.message });
    }
});

app.put("/api/devices/:code", function (req, res) {
    var b = req.body;
    var route1 = b.route1 !== undefined ? b.route1 : (b.route !== undefined ? b.route : null);
    var route2 = b.route2 !== undefined ? b.route2 : null;
    var rid1 = b.rid1 !== undefined ? b.rid1 : null;
    var rid2 = b.rid2 !== undefined ? b.rid2 : null;
    // Sanitize route values - must be numeric (mehvar code) or empty
    if (route1 !== null && route1 !== "" && isNaN(parseInt(route1, 10))) route1 = "";
    if (route2 !== null && route2 !== "" && isNaN(parseInt(route2, 10))) route2 = "";
    try {
        db.prepare(
            "UPDATE devices SET name = COALESCE(?, name), type = COALESCE(?, type), " +
            "route = COALESCE(?, route), route1 = COALESCE(?, route1), route2 = COALESCE(?, route2), " +
            "rid1 = COALESCE(?, rid1), rid2 = COALESCE(?, rid2), " +
            "ip = COALESCE(?, ip), firmware = COALESCE(?, firmware), active = COALESCE(?, active) " +
            "WHERE device_code = ?"
        ).run(
            b.name !== undefined ? b.name : null,
            b.type !== undefined ? b.type : null,
            route1, route1, route2,
            rid1, rid2,
            b.ip !== undefined ? b.ip : null,
            b.firmware !== undefined ? b.firmware : null,
            b.active !== undefined ? (b.active ? 1 : 0) : null,
            req.params.code
        );
        res.json({ success: true });
    } catch (e) {
        console.error("[API] PUT /api/devices/" + req.params.code + " error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.delete("/api/devices/:code", function (req, res) {
    db.prepare("DELETE FROM devices WHERE device_code = ?").run(req.params.code);
    res.json({ success: true });
});

// Import multiple devices from JSON array
app.post("/api/devices/import", function (req, res) {
    var devices = req.body.devices;
    if (!Array.isArray(devices) || !devices.length) return res.status(400).json({ error: "devices array required" });
    var insert = db.prepare("INSERT OR IGNORE INTO devices (device_code, name, type, route, route1, route2, rid1, rid2, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'offline')");
    var imported = 0;
    var tx = db.transaction(function () {
        devices.forEach(function (d) {
            if (!d.device_code || !/^\d{1,8}$/.test(String(d.device_code))) return;
            var r1 = d.route1 || d.route || "";
            var r2 = d.route2 || "";
            insert.run(String(d.device_code), d.name || ("Device " + d.device_code), d.type || "counter", r1, r1, r2, d.rid1 || "", d.rid2 || "");
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
    var totalDevices = db.prepare("SELECT COUNT(*) as c FROM devices WHERE is_numeric(device_code) = 1").get().c;
    var onlineDevices = db.prepare("SELECT COUNT(*) as c FROM devices WHERE is_numeric(device_code) = 1 AND status = 'online'").get().c;
    var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    // Count today's vehicles from irawdata (where TCP/HTTP device data is stored)
    var todayIraw = db.prepare("SELECT COALESCE(SUM(a+b+c+d+e+x), 0) as c FROM irawdata WHERE create_at >= ?").get(todayStart.toISOString());
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
    var filter = req.query.filter || "all"; // all, error, success
    var sql = "SELECT * FROM send_log";
    if (filter === "error") sql += " WHERE success = 0";
    else if (filter === "success") sql += " WHERE success = 1";
    sql += " ORDER BY created_at DESC LIMIT ?";
    res.json(db.prepare(sql).all(limit));
});

app.get("/api/rmto/log/:id", function (req, res) {
    var row = db.prepare("SELECT * FROM send_log WHERE id = ?").get(parseInt(req.params.id, 10));
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
});

app.post("/api/rmto/send-now", function (req, res) {
    var responded = false;
    // Timeout: if SOAP takes too long, respond with partial info
    var timer = setTimeout(function () {
        if (!responded) {
            responded = true;
            res.json({ success: false, total: 0, sent_success: 0, sent_failed: 0, errors: [{ error: "زمان ارسال طولانی شد - نتیجه را در مانیتور ببینید" }], timeout: true });
        }
    }, 60000);

    scheduler.sendUnsentData(function (results) {
        clearTimeout(timer);
        if (!responded) {
            responded = true;
            res.json({
                success: results.failed === 0 && results.total > 0,
                total: results.total,
                sent_success: results.success,
                sent_failed: results.failed,
                errors: results.errors
            });
        }
    });
});

app.post("/api/rmto/aggregate", function (req, res) {
    scheduler.aggregateAndSend();
    // aggregateAndSend calls sendUnsentData internally, respond after aggregation
    res.json({ success: true, message: "تجمیع انجام شد. ارسال در پس‌زمینه ادامه دارد." });
});

// ============================================================
// API: RMTO Connectivity Check
// Tests TCP reachability of the RMTO host from each configured source IP.
// ============================================================
app.get("/api/rmto/connectivity-check", requireAuth, function (req, res) {
    var net = require("net");
    var url = require("url");

    // Reload latest settings from DB
    var settingsRows = db.prepare(
        "SELECT key, value FROM settings WHERE key IN ('rmto_wsdl', 'rmto_url', 'rmto_source_ip')"
    ).all();
    var cfg = {};
    settingsRows.forEach(function (r) { cfg[r.key] = r.value || ""; });

    var rmtoUrl = cfg.rmto_url || (cfg.rmto_wsdl
        ? cfg.rmto_wsdl.replace("?WSDL", "").replace("?wsdl", "")
        : "http://otf.rmto.ir/Companies/Companies.asmx");

    var parsedUrl = url.parse(rmtoUrl);
    var host = parsedUrl.hostname || "otf.rmto.ir";
    var port = parseInt(parsedUrl.port, 10) || 80;

    var ipsToCheck = [
        { label: "IP پیش‌فرض سرور", ip: "" },
        { label: "IP ارسال (rmto_source_ip)", ip: cfg.rmto_source_ip || "" }
    ];

    var results = [];
    var remaining = ipsToCheck.length;
    var TIMEOUT_MS = 8000;

    function checkOne(entry, done) {
        var start = Date.now();
        var timedOut = false;
        var sock = new net.Socket();

        var connectOpts = { host: host, port: port };
        if (entry.ip) connectOpts.localAddress = entry.ip;

        var timer = setTimeout(function () {
            timedOut = true;
            sock.destroy();
            done({ label: entry.label, ip: entry.ip || "(پیش‌فرض)", host: host, port: port,
                   ok: false, latencyMs: null, error: "timeout (" + TIMEOUT_MS + "ms)" });
        }, TIMEOUT_MS);

        sock.connect(connectOpts, function () {
            clearTimeout(timer);
            var latency = Date.now() - start;
            sock.destroy();
            done({ label: entry.label, ip: entry.ip || "(پیش‌فرض)", host: host, port: port,
                   ok: true, latencyMs: latency, error: null });
        });

        sock.on("error", function (err) {
            if (timedOut) return;
            clearTimeout(timer);
            sock.destroy();
            done({ label: entry.label, ip: entry.ip || "(پیش‌فرض)", host: host, port: port,
                   ok: false, latencyMs: null, error: err.message });
        });
    }

    ipsToCheck.forEach(function (entry) {
        checkOne(entry, function (result) {
            results.push(result);
            remaining--;
            if (remaining === 0) {
                res.json({ host: host, port: port, url: rmtoUrl, checks: results, checkedAt: new Date().toISOString() });
            }
        });
    });
});

app.get("/api/rmto/queue", function (req, res) {
    var unsent = db.prepare("SELECT device_code, period_start, total_vehicles, avg_speed, created_at FROM rmto_queue WHERE sent = 0 ORDER BY period_start DESC LIMIT 100").all();
    var sent = db.prepare("SELECT device_code, period_start, total_vehicles, avg_speed, sent_at, rmto_response FROM rmto_queue WHERE sent = 1 ORDER BY sent_at DESC LIMIT 50").all();
    // Error stats
    var errorCount = db.prepare("SELECT COUNT(*) as c FROM send_log WHERE success = 0").get().c;
    var todayErrors = 0;
    try {
        var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        todayErrors = db.prepare("SELECT COUNT(*) as c FROM send_log WHERE success = 0 AND created_at >= ?").get(todayStart.toISOString()).c;
    } catch (e) { /* ok */ }
    res.json({ unsent: unsent, sent: sent, errorCount: errorCount, todayErrors: todayErrors });
});

// ============================================================
// API: History (received data + RMTO send log, searchable, paginated)
// ============================================================
app.get("/api/history", requireAuth, function (req, res) {
    var page = Math.max(1, parseInt(req.query.page, 10) || 1);
    var limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    var offset = (page - 1) * limit;
    var type = req.query.type === "received" ? "received" : "sent";
    var device = (req.query.device || "").trim();
    var route = (req.query.route || "").trim();
    var from = (req.query.from || "").trim();
    var to = (req.query.to || "").trim();

    var conds = [];
    var params = [];

    if (type === "received") {
        if (device) { conds.push("device_code = ?"); params.push(device); }
        if (route) { conds.push("route_id = ?"); params.push(route); }
        if (from) { conds.push("period_start >= ?"); params.push(from); }
        if (to) { conds.push("period_start <= ?"); params.push(to); }

        var where = conds.length ? "WHERE " + conds.join(" AND ") : "";
        var totalRow = db.prepare("SELECT COUNT(*) as c FROM rmto_queue_5class " + where).get.apply(
            db.prepare("SELECT COUNT(*) as c FROM rmto_queue_5class " + where), params);
        var rows = db.prepare(
            "SELECT id, device_code, route_id, period_start, period_end, " +
            "c1, c2, c3, c4, c5, avg_speed, sso, sent, sent_at, retry_count, created_at " +
            "FROM rmto_queue_5class " + where +
            " ORDER BY period_start DESC LIMIT ? OFFSET ?"
        ).all.apply(db.prepare(
            "SELECT id, device_code, route_id, period_start, period_end, " +
            "c1, c2, c3, c4, c5, avg_speed, sso, sent, sent_at, retry_count, created_at " +
            "FROM rmto_queue_5class " + where +
            " ORDER BY period_start DESC LIMIT ? OFFSET ?"
        ), params.concat([limit, offset]));

        return res.json({ total: totalRow.c, page: page, limit: limit, rows: rows });
    } else {
        if (device) { conds.push("device_code = ?"); params.push(device); }
        if (from) { conds.push("created_at >= ?"); params.push(from); }
        if (to) { conds.push("created_at <= ?"); params.push(to); }

        var where = conds.length ? "WHERE " + conds.join(" AND ") : "";
        var totalRow = db.prepare("SELECT COUNT(*) as c FROM send_log " + where).get.apply(
            db.prepare("SELECT COUNT(*) as c FROM send_log " + where), params);
        var rows = db.prepare(
            "SELECT id, method, device_code, success, error_message, source_ip, created_at, response_data " +
            "FROM send_log " + where +
            " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        ).all.apply(db.prepare(
            "SELECT id, method, device_code, success, error_message, source_ip, created_at, response_data " +
            "FROM send_log " + where +
            " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        ), params.concat([limit, offset]));

        return res.json({ total: totalRow.c, page: page, limit: limit, rows: rows });
    }
});

// Load full detail of a history record for re-send in test-sender
app.get("/api/history/record/:id", requireAuth, function (req, res) {
    var id = parseInt(req.params.id, 10);
    var row = db.prepare("SELECT * FROM rmto_queue_5class WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "not found" });
    return res.json(row);
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
    var codeNum = parseInt(b.code, 10);
    if (isNaN(codeNum) || codeNum <= 0) {
        return res.status(400).json({ error: "کد محور باید عدد مثبت باشد (کد RMTO)" });
    }
    try {
        db.prepare("INSERT INTO mehvar (code, name, send_enable, repair, ostan) VALUES (?, ?, ?, ?, ?)").run(codeNum, b.name, b.send_enable !== undefined ? parseInt(b.send_enable, 10) : 1, b.repair ? parseInt(b.repair, 10) : 0, b.ostan || "");
        res.json({ success: true });
    } catch (e) {
        if (e.message.indexOf("UNIQUE") !== -1) return res.status(409).json({ error: "duplicate code" });
        res.status(500).json({ error: e.message });
    }
});

app.put("/api/mehvar/:code", function (req, res) {
    var b = req.body;
    try {
        db.prepare(
            "UPDATE mehvar SET name = COALESCE(?, name), send_enable = COALESCE(?, send_enable), " +
            "repair = COALESCE(?, repair), ostan = COALESCE(?, ostan) WHERE code = ?"
        ).run(
            b.name !== undefined ? b.name : null,
            b.send_enable !== undefined ? parseInt(b.send_enable) : null,
            b.repair !== undefined ? parseInt(b.repair) : null,
            b.ostan !== undefined ? b.ostan : null,
            parseInt(req.params.code)
        );
        res.json({ success: true });
    } catch (e) {
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
        "INSERT INTO irawdata (device_code, create_at, stop, lane, is_read, a,b,c,d,e,x, sa,sb,sc,sd,se,sx, sao,sbo,sco,sdo,seo,sxo, overtaking, tooclose) " +
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
            try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch (e) { /* ok */ }
            db.close();
            fs.copyFileSync(tmpPath, dbPath);
            try { fs.unlinkSync(tmpPath); } catch (e) { /* ok */ }
            // Re-open database
            delete require.cache[require.resolve("./db")];
            db = require("./db");
            res.json({ success: true, message: "بازیابی انجام شد. سرویس در حال ریستارت..." });
            // Auto-restart to ensure clean state
            setTimeout(function () { process.exit(0); }, 2000);
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

/** RATCX1 error_byte bitmask — from firmware/Main/Variables.h */
var ERROR_BITS = {
    1:   'MMC_ERR  - خطای کارت حافظه',
    2:   'LP1_ERR  - خطای لوپ ۱',
    4:   'LP2_ERR  - خطای لوپ ۲',
    8:   'LP3_ERR  - خطای لوپ ۳',
    16:  'LP4_ERR  - خطای لوپ ۴',
    32:  'VMN_ERR  - خطای ولتاژ شبانه',
    64:  'SOL_ERR  - خطای پنل خورشیدی',
    128: 'LBT_ERR  - خطای باتری ضعیف',
    256: 'L1D_ERR  - خطای جهت لاین ۱',
    512: 'L2D_ERR  - خطای جهت لاین ۲'
};

/** Decode an error_byte integer into a readable list of active error names */
function decodeErrorByte(code) {
    var active = [];
    Object.keys(ERROR_BITS).forEach(function(bit) {
        if ((code & parseInt(bit, 10)) !== 0) active.push(ERROR_BITS[bit]);
    });
    return active.length ? active.join('\n  ') : '';
}

/** Convert RATCX1 parsed interval to irawdata rows (one per lane) */
function ratcx1ToIrawdata(parsed) {
    // Compute stop time = create_at + 5 minutes
    var startDate = new Date(parsed.create_at);
    var stopDate = new Date(startDate.getTime() + 5 * 60 * 1000);
    var stopStr;
    if (isNaN(stopDate.getTime())) {
        stopStr = parsed.create_at; // fallback if date is invalid
    } else {
        stopStr = stopDate.getFullYear() + "-" + String(stopDate.getMonth() + 1).padStart(2, "0") + "-" + String(stopDate.getDate()).padStart(2, "0") + "T" + String(stopDate.getHours()).padStart(2, "0") + ":" + String(stopDate.getMinutes()).padStart(2, "0") + ":00";
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
 * Format date for time sync command "0012" (compact: yyMMddHHmmss).
 * Example: 2026-02-22 10:01:27 → "260222100127"
 */
function formatDeviceDatetime(date) {
    var y = String(date.getFullYear()).slice(2);
    var mo = String(date.getMonth() + 1).padStart(2, "0");
    var dy = String(date.getDate()).padStart(2, "0");
    var h = String(date.getHours()).padStart(2, "0");
    var m = String(date.getMinutes()).padStart(2, "0");
    var s = String(date.getSeconds()).padStart(2, "0");
    return y + mo + dy + h + m + s;
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
 * Format: "0012yyMMddHHmmss" (4+12 = 16 bytes)
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
            console.log("[TCP] TIME_SYNC failed for " + deviceCode + " after 3 retries");
            // Fallback: if data polling was deferred due to large drift, start it anyway
            // so the device doesn't stay stuck without polling
            var failedSync = pendingSyncs[deviceCode];
            if (failedSync && failedSync.deferDataRequest && failedSync.socket && !failedSync.socket.destroyed) {
                console.log("[TCP] Starting deferred polling for " + deviceCode + " despite TIME_SYNC failure (fallback)");
                addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1", ip: "", device: deviceCode, detail: "تنظیم ساعت ناموفق - شروع پولینگ بدون تنظیم ساعت" });
                startDataRequests(deviceCode, failedSync.socket);
            }
            delete pendingSyncs[deviceCode];
        }
    }, 10000); // Wait 10 seconds for ACK

    return true;
}

/**
 * Start polling device for interval data after handshake.
 * Sequence:
 *   1. Send time sync (1s after handshake)
 *   2. Send time sync again (4s after first - redundancy)
 *   3a. If clock drift <= 5 min: request last 15min of data (normal)
 *   3b. If clock drift > 5 min: defer data request until TIME_SYNC ACK
 *   4. Start periodic polling every 5 minutes
 */
function startDevicePoll(deviceCode, socket) {
    var drift = deviceClockDrift[deviceCode] || 0;
    var largeDrift = drift > 5; // more than 5 minutes drift
    console.log("[TCP] ====== Starting poll sequence for device " + deviceCode + " (drift=" + drift + "min, largeDrift=" + largeDrift + ") ======");

    // Step 1: First time sync (1 second after handshake)
    setTimeout(function () {
        if (socket.destroyed) return;
        syncDeviceTime(deviceCode, socket);

        // If large drift, mark that we should defer data requests until ACK
        if (largeDrift && pendingSyncs[deviceCode]) {
            pendingSyncs[deviceCode].deferDataRequest = true;
            pendingSyncs[deviceCode].socket = socket;
            console.log("[TCP] Device " + deviceCode + ": اختلاف ساعت زیاد (" + drift + " دقیقه) - درخواست داده تا تایید سینک به تعویق افتاد");
            addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1", ip: "", device: deviceCode, detail: "اختلاف ساعت " + drift + " دقیقه - منتظر تنظیم ساعت قبل از درخواست داده" });
        }

        // Step 2: Second time sync (3 seconds later, for redundancy)
        setTimeout(function () {
            if (socket.destroyed) return;
            syncDeviceTime(deviceCode, socket);

            // Preserve deferDataRequest flag on the new pendingSync entry
            if (largeDrift && pendingSyncs[deviceCode]) {
                pendingSyncs[deviceCode].deferDataRequest = true;
                pendingSyncs[deviceCode].socket = socket;
            }

            // Step 3: Only request old data if clock drift was small
            if (!largeDrift) {
                setTimeout(function () {
                    if (socket.destroyed) return;
                    startDataRequests(deviceCode, socket);
                }, 5000);
            } else {
                console.log("[TCP] Device " + deviceCode + ": skipping old data request (drift=" + drift + "min) - waiting for TIME_SYNC ACK to start polling");
            }
        }, 3000);
    }, 1000);
}

/**
 * Request recent interval data from device using "0197" command.
 * Requests last 3 completed 5-minute intervals, then starts periodic polling.
 */
function startDataRequests(deviceCode, socket) {
    var now = new Date();
    var requests = [];
    for (var i = 0; i < 3; i++) {
        var t = new Date(now.getTime() - i * 5 * 60 * 1000);
        t.setMinutes(Math.floor(t.getMinutes() / 5) * 5, 0, 0);
        requests.push(formatPollTimestamp(t));
    }
    requests.reverse(); // oldest first

    console.log("[TCP] Requesting " + requests.length + " intervals from device " + deviceCode + ": " + requests.join(", "));

    var idx = 0;
    function sendNextRequest() {
        if (socket.destroyed || idx >= requests.length) {
            // Done catching up, start periodic polling
            startPeriodicPoll(deviceCode, socket);
            return;
        }
        var cmd = "0197" + requests[idx];
        sendToDevice(deviceCode, socket, cmd, "DATA_REQ[" + (idx + 1) + "/" + requests.length + "]");
        idx++;
        setTimeout(sendNextRequest, 5000); // 5 seconds between requests (device needs time)
    }

    sendNextRequest();
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

var tcpServer = net.createServer(function (socket) {
    var clientIP = socket.remoteAddress || "";
    var buffer = "";
    var deviceId = null;
    var pollStarted = false;
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
        }
        // Do NOT mark device offline immediately on disconnect.
        // The scheduler will mark it offline after 2×INTERVAL minutes of inactivity.
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
        }
        if (deviceId) {
            // Do NOT mark offline on error; scheduler handles it after 2×INTERVAL minutes
        }
        console.error("[TCP] Error from " + clientIP + (deviceId ? " (device " + deviceId + ")" : "") + ": " + err.message);
    });
});

function storeIrawdata(parsed) {
    var total = (parsed.a||0) + (parsed.b||0) + (parsed.c||0) + (parsed.d||0) + (parsed.e||0) + (parsed.x||0);
    console.log("[DB] INSERT irawdata: device=" + parsed.device_code + " create_at=" + parsed.create_at + " stop=" + parsed.stop + " lane=" + parsed.lane + " total=" + total);
    var insertRaw = db.prepare(
        "INSERT OR IGNORE INTO irawdata (device_code, create_at, stop, lane, is_read, a,b,c,d,e,x, sa,sb,sc,sd,se,sx, sao,sbo,sco,sdo,seo,sxo, overtaking, tooclose) " +
        "VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    insertRaw.run(
        parsed.device_code, parsed.create_at, parsed.stop, parsed.lane,
        parsed.a||0, parsed.b||0, parsed.c||0, parsed.d||0, parsed.e||0, parsed.x||0,
        parsed.sa||0, parsed.sb||0, parsed.sc||0, parsed.sd||0, parsed.se||0, parsed.sx||0,
        parsed.sao||0, parsed.sbo||0, parsed.sco||0, parsed.sdo||0, parsed.seo||0, parsed.sxo||0,
        parsed.overtaking||0, parsed.tooclose||0
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
        var sysId = clean.substring(25, 33);
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
        var originalCreateAt = parsed.create_at;
        var deviceTime = new Date(parsed.create_at);
        var timestampCorrected = false;

        // Helper: round server time to nearest 5-min interval for correction
        function correctedServerTime() {
            var c = new Date();
            c.setMinutes(Math.floor(c.getMinutes() / 5) * 5, 0, 0);
            return c.getFullYear() + "-" + String(c.getMonth() + 1).padStart(2, "0") + "-" + String(c.getDate()).padStart(2, "0") + "T" + String(c.getHours()).padStart(2, "0") + ":" + String(c.getMinutes()).padStart(2, "0") + ":00";
        }

        // Pre-check: if device date is NaN (e.g. month=26), correct it to server time
        if (isNaN(deviceTime.getTime())) {
            var corrStr = correctedServerTime();
            console.log("[TCP] Device " + parsed.device_code + " has INVALID date: " + originalCreateAt + " -> correcting to " + corrStr);
            parsed.create_at = corrStr;
            timestampCorrected = true;
            addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1", ip: ip, device: parsed.device_code, detail: "تاریخ نامعتبر: " + originalCreateAt + " - اصلاح شد به " + corrStr });
        } else {
            var driftMs = Math.abs(serverNow.getTime() - deviceTime.getTime());
            var driftMinutes = Math.round(driftMs / 60000);
            if (driftMinutes > 30) {
                // > 30 min drift in data: Replace timestamp with server time
                var correctedStr = correctedServerTime();
                console.log("[TCP] WARNING: Device " + parsed.device_code + " clock drift = " + driftMinutes + " min (device=" + originalCreateAt + " server=" + serverNow.toISOString() + ") -> correcting to " + correctedStr);
                parsed.create_at = correctedStr;
                timestampCorrected = true;
                addLiveLog({ ts: Date.now(), time: serverNow.toISOString(), type: "tcp-ratcx1", ip: ip, device: parsed.device_code, detail: "اختلاف ساعت " + driftMinutes + " دقیقه - زمان اصلاح شد: " + originalCreateAt + " → " + correctedStr });
                // Force re-sync
                var sock = connectedDevices[parsed.device_code];
                if (sock && !sock.destroyed) {
                    syncDeviceTime(parsed.device_code, sock);
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

            // Send Bale notification when error_byte transitions from 0 to non-zero
            if (parsed.error_byte > 0) {
                var devRow = db.prepare("SELECT name, last_error_byte FROM devices WHERE device_code = ?").get(parsed.device_code);
                var prevErr = devRow ? (devRow.last_error_byte || 0) : 0;
                if (prevErr === 0) {
                    // New error onset — notify
                    var devName = devRow ? (devRow.name || parsed.device_code) : parsed.device_code;
                    var errLabels = decodeErrorByte(parsed.error_byte);
                    scheduler.sendBaleNotification && scheduler.sendBaleNotification(
                        "⚠️ خطا از دستگاه\n" +
                        "کد: " + parsed.device_code + "\n" +
                        "نام: " + devName + "\n" +
                        "کد خطا: " + parsed.error_byte + "\n" +
                        (errLabels ? "خطاها:\n  " + errLabels + "\n" : "") +
                        "باتری: " + parsed.battery + "  سولار: " + parsed.solar + "\n" +
                        "تردد: " + totalAll + "\n" +
                        "IP: " + ip
                    );
                    console.log("[TCP] Bale error notification sent for device=" + parsed.device_code + " error=" + parsed.error_byte);
                }
                db.prepare("UPDATE devices SET last_error_byte = ? WHERE device_code = ?").run(parsed.error_byte, parsed.device_code);
            } else if (parsed.error_byte === 0) {
                // Error cleared — reset so next error triggers a new notification
                db.prepare("UPDATE devices SET last_error_byte = 0 WHERE device_code = ?").run(parsed.device_code);
            }
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

        // Check if we need to start deferred data polling after large drift
        var shouldStartPoll = false;
        var deferredSocket = null;
        if (pendingSyncs[sid]) {
            if (pendingSyncs[sid].deferDataRequest) {
                shouldStartPoll = true;
                deferredSocket = pendingSyncs[sid].socket;
                if (syncVerified) {
                    console.log("[TCP]   TIME_SYNC confirmed for " + sid + " - starting deferred periodic polling (clock was out of sync)");
                    addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1", ip: ip, device: sid, detail: "ساعت تنظیم شد - شروع دریافت داده‌های جدید" });
                } else {
                    console.log("[TCP]   TIME_SYNC ACK received for " + sid + " but clock not verified - starting polling anyway (data timestamps from server)");
                    addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "tcp-ratcx1", ip: ip, device: sid, detail: "ساعت تنظیم نشد ولی پولینگ شروع می‌شود (تاریخ از سرور)" });
                }
            } else {
                console.log("[TCP]   TIME_SYNC confirmed for " + sid + (syncVerified ? "" : " (clock not verified)"));
            }
            clearTimeout(pendingSyncs[sid].timer);
            delete pendingSyncs[sid];
        }

        // Clear drift tracking after successful sync (even if not verified - data timestamps come from server)
        delete deviceClockDrift[sid];

        // Start data requests + periodic polling if it was deferred due to large clock drift
        if (shouldStartPoll && deferredSocket && !deferredSocket.destroyed) {
            startDataRequests(sid, deferredSocket);
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
    var devices = Object.keys(connectedDevices).map(function (id) {
        var s = connectedDevices[id];
        return { device_code: id, ip: s.remoteAddress || "", connected: !s.destroyed };
    }).filter(function (d) { return d.connected; });
    res.json(devices);
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

var httpServer = null;

var TCP_RETRY_COUNT = 0;
var TCP_MAX_RETRIES = 5;
var HTTP_RETRY_COUNT = 0;
var HTTP_MAX_RETRIES = 5;

tcpServer.listen(TCP_PORT, "0.0.0.0", function () {
    TCP_RETRY_COUNT = 0;
    console.log("[TCP] Listening on port " + TCP_PORT + " for raw device data");
});

tcpServer.on("error", function (err) {
    if (err.code === "EADDRINUSE") {
        TCP_RETRY_COUNT++;
        if (TCP_RETRY_COUNT > TCP_MAX_RETRIES) {
            console.error("[TCP] Port " + TCP_PORT + " still in use after " + TCP_MAX_RETRIES + " retries, giving up");
            return;
        }
        console.error("[TCP] Port " + TCP_PORT + " already in use, retry " + TCP_RETRY_COUNT + "/" + TCP_MAX_RETRIES + " in 5s");
        setTimeout(function () { tcpServer.listen(TCP_PORT, "0.0.0.0"); }, 5000);
    }
});

// ============================================================
// Start HTTP Server
// ============================================================
function startHttpServer() {
    httpServer = app.listen(PORT, HOST, function () {
        HTTP_RETRY_COUNT = 0;
        console.log("============================================");
        console.log("  TC Manager Server (Noavaran Jonoob Shargh)");
        console.log("  Build: " + BUILD_VERSION);
        console.log("  HTTP: http://" + HOST + ":" + PORT);
        console.log("  TCP:  port " + TCP_PORT + " (device data)");
        console.log("  Login: admin / admin123");
        console.log("============================================");

        rmto.initClient(function (err) {
            if (err) console.error("[RMTO] Will retry on first send");
        });

        scheduler.start();

        // Send Bale startup notification (if configured)
        try {
            scheduler.sendBaleNotification("✅ سرور TC Manager راه‌اندازی شد\n📦 نسخه: " + BUILD_VERSION + "\n⏰ " + new Date().toLocaleString("fa-IR"));
        } catch (e) { /* ignore startup notification errors */ }
    });

    httpServer.on("error", function (err) {
        if (err.code === "EADDRINUSE") {
            HTTP_RETRY_COUNT++;
            if (HTTP_RETRY_COUNT > HTTP_MAX_RETRIES) {
                console.error("[HTTP] Port " + PORT + " still in use after " + HTTP_MAX_RETRIES + " retries, exiting.");
                process.exit(1);
            }
            console.error("[HTTP] Port " + PORT + " already in use, retry " + HTTP_RETRY_COUNT + "/" + HTTP_MAX_RETRIES + " in 5s");
            setTimeout(startHttpServer, 5000);
        }
    });
}

startHttpServer();

// ============================================================
// Graceful Shutdown
// ============================================================
var isShuttingDown = false;
function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log("\n[SERVER] " + signal + " received, shutting down gracefully...");
    scheduler.stop();

    // Stop all scheduled test-send jobs
    Object.keys(testScheduleJobs).forEach(function (k) {
        var job = testScheduleJobs[k];
        if (job.timerId) { clearInterval(job.timerId); job.timerId = null; }
        job.stopped = true;
        job.status = "stopped";
    });

    // Close all active TCP device connections first
    Object.keys(connectedDevices).forEach(function (key) {
        try { connectedDevices[key].destroy(); } catch (e) {}
    });

    var closed = 0;
    var total = 2;
    function checkDone() {
        closed++;
        if (closed >= total) {
            console.log("[SERVER] All servers closed, exiting");
            process.exit(0);
        }
    }

    if (httpServer) {
        httpServer.close(function () {
            console.log("[SERVER] HTTP server closed");
            checkDone();
        });
    } else {
        checkDone();
    }

    tcpServer.close(function () {
        console.log("[SERVER] TCP server closed");
        checkDone();
    });

    setTimeout(function () {
        console.log("[SERVER] Forcing exit after timeout");
        process.exit(0);
    }, 4000);
}

process.on("SIGTERM", function () { gracefulShutdown("SIGTERM"); });
process.on("SIGINT", function () { gracefulShutdown("SIGINT"); });
