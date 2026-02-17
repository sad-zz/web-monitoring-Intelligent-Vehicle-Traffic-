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
    // Check if users table exists
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
 * Body: { device_id, create_at, stop, lane, a,b,c,d,e,x, sa..sx, sao..sxo, overtaking, tooclose }
 * Or batch: { device_id, records: [{...}, ...] }
 * Vehicle: a=motorcycle b=car c=van d=bus e=truck x=unknown
 * Speed: sa..sx = sum of speeds per class
 * Violations: sao..sxo = over-speed count per class
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
        } else if (origName.endsWith(".sql.gz") || origName.endsWith(".gz")) {
            // SQL dump - save for processing
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
