/**
 * FIX 3: Patch for server/index.js – Change storeIrawdata to use INSERT OR IGNORE.
 *
 * Problem:
 *   storeIrawdata() uses plain INSERT INTO irawdata which creates duplicate records
 *   when a TCP device reconnects and re-sends the same interval data.
 *   With the UNIQUE INDEX added in improvements/server/db.js, duplicate INSERTs will
 *   throw an error unless we use INSERT OR IGNORE.
 *
 * IMPORTANT: Deploy improvements/server/db.js FIRST, then run this fix.
 *            Also run the migration SQL in ISSUES.md to clean existing duplicates.
 *
 * Run: node /opt/tc-manager/improvements/fix3-irawdata-ignore.js
 */
var fs = require("fs");
var idxFile = __dirname + "/../server/index.js";

var OLD = '"INSERT INTO irawdata (device_code, create_at, stop, lane, is_read, a,b,c,d,e,x, sa,sb,sc,sd,se,sx, sao,sbo,sco,sdo,seo,sxo, overtaking, tooclose) "';
var NEW = '"INSERT OR IGNORE INTO irawdata (device_code, create_at, stop, lane, is_read, a,b,c,d,e,x, sa,sb,sc,sd,se,sx, sao,sbo,sco,sdo,seo,sxo, overtaking, tooclose) "';
// More flexible regex in case column order doesn't exactly match
var INSERT_RE = /"INSERT INTO irawdata\s*\(/g;

if (!fs.existsSync(idxFile)) {
    console.error("ERROR: file not found:", idxFile);
    process.exit(1);
}

var src = fs.readFileSync(idxFile, "utf8");

if (src.indexOf("INSERT OR IGNORE INTO irawdata") !== -1) {
    console.log("[Fix 3] SKIP - already applied");
    process.exit(0);
}

if (src.indexOf('"INSERT INTO irawdata') === -1) {
    console.log("[Fix 3] WARN - pattern not found, may already be fixed or file differs");
    process.exit(0);
}

fs.writeFileSync(idxFile + ".fix3.bak", src);
// Use regex for flexible matching regardless of exact whitespace
var count = (src.match(INSERT_RE) || []).length;
var replaced = src.replace(INSERT_RE, '"INSERT OR IGNORE INTO irawdata (');

if (count === 0) {
    console.log("[Fix 3] WARN - no INSERT INTO irawdata found, may already be fixed");
    process.exit(0);
}

fs.writeFileSync(idxFile, replaced);
console.log("[Fix 3] OK - " + count + " INSERT INTO irawdata changed to INSERT OR IGNORE");
console.log("Run: pm2 restart tc-manager");
