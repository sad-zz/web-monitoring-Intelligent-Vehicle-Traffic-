/**
 * Reset admin password from command line.
 * Usage: node reset-password.js [new-password]
 *   If new-password is omitted, defaults to "admin123".
 *
 * Run on server:
 *   cd /opt/tc-manager && node server/reset-password.js MyNewPass123
 */
var bcrypt = require("bcryptjs");
var path = require("path");
var Database = require("better-sqlite3");

var DB_PATH = path.join(__dirname, "data.db");
var newPass = process.argv[2] || "admin123";
var username = process.argv[3] || "admin";

try {
    var db = new Database(DB_PATH);
    var hash = bcrypt.hashSync(newPass, 10);
    var result = db.prepare("UPDATE users SET password_hash = ? WHERE username = ?").run(hash, username);
    if (result.changes === 0) {
        // User doesn't exist — create them
        db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(username, hash);
        console.log("User '" + username + "' created with the given password.");
    } else {
        console.log("Password for user '" + username + "' has been updated successfully.");
    }
    db.close();
} catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
}
