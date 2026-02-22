/**
 * FIX 1: Patch for server/index.js – Fix "today's traffic" query using UTC instead of local time.
 *
 * Problem:
 *   The /api/stats endpoint uses todayStart.toISOString() which returns UTC time (e.g. "2026-02-21T20:30:00.000Z")
 *   but irawdata.create_at is stored in LOCAL time format (e.g. "2026-02-22T10:30:00").
 *   SQLite does string comparison, so records from today's local time get excluded.
 *
 * How to apply manually in server/index.js (around line 356):
 *
 * BEFORE:
 *   var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
 *   var todayIraw = db.prepare("SELECT COALESCE(SUM(a+b+c+d+e+x), 0) as c FROM irawdata WHERE create_at >= ?").get(todayStart.toISOString());
 *
 * AFTER:
 *   var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
 *   var todayStartStr = todayStart.getFullYear() + "-" +
 *       String(todayStart.getMonth() + 1).padStart(2, "0") + "-" +
 *       String(todayStart.getDate()).padStart(2, "0") + "T00:00:00";
 *   var todayIraw = db.prepare("SELECT COALESCE(SUM(a+b+c+d+e+x), 0) as c FROM irawdata WHERE create_at >= ?").get(todayStartStr);
 *
 * Run to apply automatically (backup first!):
 *   node /opt/tc-manager/improvements/fix1-stats.js
 */
var fs = require("fs");
var idxFile = __dirname + "/../server/index.js";

var NEW_REPLACEMENT = [
    "    // FIX 1: use local time format, not toISOString() (which is UTC)",
    "    var todayStartStr = todayStart.getFullYear() + \"-\" +",
    "        String(todayStart.getMonth() + 1).padStart(2, \"0\") + \"-\" +",
    "        String(todayStart.getDate()).padStart(2, \"0\") + \"T00:00:00\";",
    "    var todayIraw = db.prepare(\"SELECT COALESCE(SUM(a+b+c+d+e+x), 0) as c FROM irawdata WHERE create_at >= ?\").get(todayStartStr);"
].join("\n");

if (!fs.existsSync(idxFile)) {
    console.error("ERROR: file not found:", idxFile);
    process.exit(1);
}

var src = fs.readFileSync(idxFile, "utf8");

if (src.indexOf("todayStartStr") !== -1) {
    console.log("[Fix 1] SKIP - already applied");
    process.exit(0);
}

if (src.indexOf("todayStart.toISOString()") === -1) {
    console.log("[Fix 1] WARN - pattern not found, may already be fixed or file differs");
    process.exit(0);
}

fs.writeFileSync(idxFile + ".fix1.bak", src);

// Find the line with the query and replace the whole statement
// The match covers the irawdata SELECT statement that uses toISOString()
var lineRE = /var todayIraw\s*=\s*db\.prepare\([^)]+\)\.get\(todayStart\.toISOString\(\)\);/;
src = src.replace(lineRE, NEW_REPLACEMENT);

if (src.indexOf("todayStartStr") === -1) {
    console.log("[Fix 1] FAIL - replacement did not match. Apply manually (see comments in this file).");
    process.exit(1);
}

fs.writeFileSync(idxFile, src);
console.log("[Fix 1] OK - stats query now uses local time");
console.log("Run: pm2 restart tc-manager");
