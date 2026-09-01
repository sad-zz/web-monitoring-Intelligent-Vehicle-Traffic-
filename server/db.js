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
    "  route_id TEXT,",
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
    "  route_id TEXT,",
    "  period_start TEXT NOT NULL,",
    "  period_end TEXT NOT NULL,",
    "  -- Volume classes (C1-C5: by vehicle size)",
    "  c1 INTEGER DEFAULT 0,",
    "  c2 INTEGER DEFAULT 0,",
    "  c3 INTEGER DEFAULT 0,",
    "  c4 INTEGER DEFAULT 0,",
    "  c5 INTEGER DEFAULT 0,",
    "  -- Average speed overall (ASP)",
    "  avg_speed REAL DEFAULT 0,",
    "  -- Average speed per class (S1-S5)",
    "  s1 REAL DEFAULT 0,",
    "  s2 REAL DEFAULT 0,",
    "  s3 REAL DEFAULT 0,",
    "  s4 REAL DEFAULT 0,",
    "  s5 REAL DEFAULT 0,",
    "  -- Speed violations total (SSO) and per class (SO1-SO5)",
    "  sso INTEGER DEFAULT 0,",
    "  so1 INTEGER DEFAULT 0,",
    "  so2 INTEGER DEFAULT 0,",
    "  so3 INTEGER DEFAULT 0,",
    "  so4 INTEGER DEFAULT 0,",
    "  so5 INTEGER,",
    "  -- Overtaking (OO) and too-close/headway (ESD)",
    "  oo INTEGER DEFAULT 0,",
    "  esd INTEGER DEFAULT 0,",
    "  sent INTEGER DEFAULT 0,",
    "  sent_at TEXT,",
    "  rmto_response TEXT,",
    "  retry_count INTEGER DEFAULT 0,",
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
    "  soap_xml TEXT,",
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

    // Indexes for the RMTO monitor queries - without them, ORDER BY / COUNT
    // on the ever-growing send_log and rmto_queue tables scan the whole table
    // and the monitor UI appears empty / frozen.
    "CREATE INDEX IF NOT EXISTS idx_sendlog_created ON send_log(created_at);",
    "CREATE INDEX IF NOT EXISTS idx_sendlog_success ON send_log(success, created_at);",
    "CREATE INDEX IF NOT EXISTS idx_rmto_sent_period ON rmto_queue(sent, period_start);",
    "CREATE INDEX IF NOT EXISTS idx_rmto_sent_sentat ON rmto_queue(sent, sent_at);",
    "CREATE INDEX IF NOT EXISTS idx_rmto5_sent_period ON rmto_queue_5class(sent, period_start);",

    // Settings (key-value store)
    "CREATE TABLE IF NOT EXISTS settings (",
    "  key TEXT PRIMARY KEY,",
    "  value TEXT",
    ");"
].join("\n"));

// Migration: if rmto_queue_5class has old column names, recreate it
try {
    var cols = db.prepare("PRAGMA table_info(rmto_queue_5class)").all();
    var colNames = cols.map(function(c) { return c.name; });
    if (colNames.indexOf("class1_count") !== -1) {
        console.log("[DB] Migrating rmto_queue_5class to new RMTO Add5 format...");
        db.exec("DROP TABLE IF EXISTS rmto_queue_5class");
        db.exec([
            "CREATE TABLE rmto_queue_5class (",
            "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
            "  device_code TEXT NOT NULL,",
            "  route_id TEXT,",
            "  period_start TEXT NOT NULL,",
            "  period_end TEXT NOT NULL,",
            "  c1 INTEGER DEFAULT 0, c2 INTEGER DEFAULT 0, c3 INTEGER DEFAULT 0, c4 INTEGER DEFAULT 0, c5 INTEGER DEFAULT 0,",
            "  avg_speed REAL DEFAULT 0,",
            "  s1 REAL DEFAULT 0, s2 REAL DEFAULT 0, s3 REAL DEFAULT 0, s4 REAL DEFAULT 0, s5 REAL DEFAULT 0,",
            "  sso INTEGER DEFAULT 0,",
            "  so1 INTEGER DEFAULT 0, so2 INTEGER DEFAULT 0, so3 INTEGER DEFAULT 0, so4 INTEGER DEFAULT 0, so5 INTEGER,",
            "  oo INTEGER DEFAULT 0, esd INTEGER DEFAULT 0,",
            "  sent INTEGER DEFAULT 0, sent_at TEXT, rmto_response TEXT,",
            "  created_at TEXT DEFAULT (datetime('now','localtime'))",
            ")"
        ].join("\n"));
        db.exec("CREATE INDEX IF NOT EXISTS idx_rmto5_unsent ON rmto_queue_5class(sent, device_code)");
        console.log("[DB] rmto_queue_5class migrated successfully");
    }
} catch(e) {
    // Table doesn't exist yet - will be created by schema above
}

// Migration: add route_id column to rmto_queue if missing
try {
    var qCols = db.prepare("PRAGMA table_info(rmto_queue)").all();
    var qColNames = qCols.map(function(c) { return c.name; });
    if (qColNames.length > 0 && qColNames.indexOf("route_id") === -1) {
        console.log("[DB] Adding route_id column to rmto_queue...");
        db.exec("ALTER TABLE rmto_queue ADD COLUMN route_id TEXT");
        console.log("[DB] rmto_queue migrated successfully");
    }
} catch(e) {
    // Table doesn't exist yet
}

// Migration: add soap_xml column to send_log if missing
try {
    var slCols = db.prepare("PRAGMA table_info(send_log)").all();
    var slColNames = slCols.map(function(c) { return c.name; });
    if (slColNames.length > 0 && slColNames.indexOf("soap_xml") === -1) {
        console.log("[DB] Adding soap_xml column to send_log...");
        db.exec("ALTER TABLE send_log ADD COLUMN soap_xml TEXT");
    }
    if (slColNames.length > 0 && slColNames.indexOf("source_ip") === -1) {
        console.log("[DB] Adding source_ip column to send_log...");
        db.exec("ALTER TABLE send_log ADD COLUMN source_ip TEXT");
    }
} catch(e) {}

// Migration: add retry_count column to rmto_queue_5class if missing
try {
    var rmto5Cols = db.prepare("PRAGMA table_info(rmto_queue_5class)").all();
    var rmto5ColNames = rmto5Cols.map(function(c) { return c.name; });
    if (rmto5ColNames.length > 0 && rmto5ColNames.indexOf("retry_count") === -1) {
        console.log("[DB] Adding retry_count column to rmto_queue_5class...");
        db.exec("ALTER TABLE rmto_queue_5class ADD COLUMN retry_count INTEGER DEFAULT 0");
        console.log("[DB] rmto_queue_5class retry_count migration done");
    }
} catch(e) {
    console.error("[DB] rmto_queue_5class retry_count migration error:", e.message);
}

// Migration: add route1, route2, active columns to devices (replace single route column)
try {
    var devCols = db.prepare("PRAGMA table_info(devices)").all();
    var devColNames = devCols.map(function(c) { return c.name; });
    if (devColNames.indexOf("route1") === -1) {
        console.log("[DB] Adding route1, route2, active columns to devices...");
        db.exec("ALTER TABLE devices ADD COLUMN route1 TEXT DEFAULT ''");
        db.exec("ALTER TABLE devices ADD COLUMN route2 TEXT DEFAULT ''");
        // Copy existing route value to route1
        if (devColNames.indexOf("route") !== -1) {
            db.exec("UPDATE devices SET route1 = route WHERE route IS NOT NULL AND route != ''");
        }
        console.log("[DB] devices route1/route2 migration done");
    }
    if (devColNames.indexOf("active") === -1) {
        db.exec("ALTER TABLE devices ADD COLUMN active INTEGER DEFAULT 1");
        console.log("[DB] devices active column added");
    }
    // Migration: add rid1, rid2 columns for RMTO route ID per lane
    if (devColNames.indexOf("rid1") === -1) {
        console.log("[DB] Adding rid1, rid2 columns to devices (RMTO route ID per lane)...");
        db.exec("ALTER TABLE devices ADD COLUMN rid1 TEXT DEFAULT ''");
        db.exec("ALTER TABLE devices ADD COLUMN rid2 TEXT DEFAULT ''");
        console.log("[DB] devices rid1/rid2 migration done");
    }
    // Migration: add last_error_byte to track device error state for Bale notifications
    if (devColNames.indexOf("last_error_byte") === -1) {
        console.log("[DB] Adding last_error_byte column to devices...");
        db.exec("ALTER TABLE devices ADD COLUMN last_error_byte INTEGER DEFAULT 0");
        console.log("[DB] devices last_error_byte migration done");
    }
} catch(e) {
    console.error("[DB] devices migration error:", e.message);
}

// Migration: purge phantom devices registered from corrupted TCP frames.
// The TCP handlers used to call autoRegisterDevice with unvalidated substrings
// of the raw stream, so garbled GSM frames created devices with junk codes.
// Runs only while invalid rows exist; once the code validation is in place no
// new ones appear.
try {
    var invalidDevCount = db.prepare("SELECT COUNT(*) as c FROM devices WHERE device_code = '' OR device_code = '0' OR device_code GLOB '*[^0-9]*'").get().c;
    if (invalidDevCount > 0) {
        console.log("[DB] Purging " + invalidDevCount + " phantom devices with invalid codes...");
        db.prepare("DELETE FROM devices WHERE device_code = '' OR device_code = '0' OR device_code GLOB '*[^0-9]*'").run();
        var invIraw = db.prepare("DELETE FROM irawdata WHERE device_code = '' OR device_code = '0' OR device_code GLOB '*[^0-9]*'").run();
        var invTraffic = db.prepare("DELETE FROM traffic_data WHERE device_code = '' OR device_code = '0' OR device_code GLOB '*[^0-9]*'").run();
        console.log("[DB] Phantom device purge done (irawdata: " + invIraw.changes + ", traffic_data: " + invTraffic.changes + " rows removed)");
    }
} catch (e) {
    console.error("[DB] phantom device purge error:", e.message);
}

// Migration: merge zero-padded duplicate devices. The 8000 handshake used to
// register the raw 8-char system id (e.g. "00123456") while 8821 data stripped
// leading zeros ("123456"), so one physical device could appear twice.
try {
    var paddedDevs = db.prepare("SELECT device_code FROM devices WHERE device_code LIKE '0%'").all();
    paddedDevs.forEach(function (r) {
        var stripped = r.device_code.replace(/^0+/, "");
        if (!stripped || stripped === r.device_code) return;
        var existsStripped = db.prepare("SELECT 1 AS x FROM devices WHERE device_code = ?").get(stripped);
        if (existsStripped) {
            db.prepare("DELETE FROM devices WHERE device_code = ?").run(r.device_code);
        } else {
            db.prepare("UPDATE devices SET device_code = ? WHERE device_code = ?").run(stripped, r.device_code);
        }
        console.log("[DB] Merged zero-padded device " + r.device_code + " -> " + stripped);
    });
} catch (e) {
    console.error("[DB] zero-padded device merge error:", e.message);
}

// Migration: dedupe irawdata and add UNIQUE index.
// The TCP server re-polls recent intervals on every device reconnect (0197),
// and storeIrawdata uses INSERT OR IGNORE which only works with a UNIQUE
// constraint. Without it, every re-poll inserted a duplicate row, inflating
// aggregated counts sent to RMTO and growing the database without bound.
try {
    var hasUniqueIdx = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_irawdata_unique'").get();
    if (!hasUniqueIdx) {
        console.log("[DB] Deduplicating irawdata (one-time, may take a while on large databases)...");
        var dedupeInfo = db.prepare(
            "DELETE FROM irawdata WHERE id NOT IN (SELECT MIN(id) FROM irawdata GROUP BY device_code, create_at, lane)"
        ).run();
        console.log("[DB] Removed " + dedupeInfo.changes + " duplicate irawdata rows");
        db.exec("CREATE UNIQUE INDEX idx_irawdata_unique ON irawdata(device_code, create_at, lane)");
        console.log("[DB] Unique index idx_irawdata_unique created");
    }
} catch (e) {
    console.error("[DB] irawdata dedupe migration error:", e.message);
}

// Migration: consolidate dual-lane source IPs into single rmto_source_ip
try {
    var liveIpRow = db.prepare("SELECT value FROM settings WHERE key = 'rmto_live_source_ip'").get();
    if (liveIpRow) {
        var liveVal = (liveIpRow.value || "").trim();
        // Copy live IP to new unified key if not already set
        var existingUnified = db.prepare("SELECT value FROM settings WHERE key = 'rmto_source_ip'").get();
        if (!existingUnified && liveVal) {
            db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('rmto_source_ip', ?)").run(liveVal);
        }
        db.prepare("DELETE FROM settings WHERE key IN ('rmto_live_source_ip', 'rmto_backlog_source_ip')").run();
        console.log("[DB] Migrated rmto_live/backlog_source_ip -> rmto_source_ip");
    }
} catch(e) {
    // ignore
}

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
    rmto_wsdl: "http://otf.rmto.ir/Companies/Companies.asmx?WSDL",
    rmto_source_ip: "",
    bale_bot_token: "",
    bale_chat_id: "",
    retention_raw_days: "90",
    retention_log_days: "30"
};
var insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
Object.keys(defaultSettings).forEach(function (k) {
    insertSetting.run(k, defaultSettings[k]);
});

module.exports = db;
