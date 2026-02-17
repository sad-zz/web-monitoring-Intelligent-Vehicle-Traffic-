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
