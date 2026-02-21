/**
 * Patch script - fixes 4 bugs in TC Manager
 * Run on server: node /opt/tc-manager/patch.js
 */
var fs = require("fs");

// === Fix index.js ===
var idxFile = __dirname + "/server/index.js";
var idx = fs.readFileSync(idxFile, "utf8");

// Backup
fs.writeFileSync(idxFile + ".bak", idx);

// Fix 0: Add \r\n terminator to sendToDevice (CRITICAL - device won't process commands without it)
var count = 0;
if (idx.indexOf('socket.write(cmd)') !== -1 && idx.indexOf('socket.write(cmd + "\\r\\n")') === -1) {
    idx = idx.replace('socket.write(cmd)', 'socket.write(cmd + "\\r\\n")');
    count++;
    console.log("[Fix 0] OK - added \\r\\n terminator to sendToDevice");
} else {
    console.log("[Fix 0] SKIP - already patched");
}

// Fix 1: After TIME_SYNC ACK, use startDataRequests instead of startPeriodicPoll
if (idx.indexOf("startPeriodicPoll(sid, deferredSocket)") !== -1) {
    idx = idx.replace("startPeriodicPoll(sid, deferredSocket)", "startDataRequests(sid, deferredSocket)");
    count++;
    console.log("[Fix 1] OK - startDataRequests after TIME_SYNC ACK");
} else {
    console.log("[Fix 1] SKIP - already patched");
}

// Fix 2+3: Replace startPeriodicPoll function (add immediate poll + request completed interval)
var oldFnRegex = /function startPeriodicPoll\(deviceCode, socket\) \{[\s\S]*?socket\._pollInterval = intervalId;\n\}/;
var newFn = 'function startPeriodicPoll(deviceCode, socket) {\n' +
'    console.log("[TCP] Starting periodic poll for device " + deviceCode + " (every 5 min)");\n' +
'\n' +
'    // Immediate first request for the last completed interval (don\'t wait 5 min)\n' +
'    if (!socket.destroyed) {\n' +
'        var firstReq = new Date();\n' +
'        firstReq.setMinutes(Math.floor(firstReq.getMinutes() / 5) * 5, 0, 0);\n' +
'        firstReq = new Date(firstReq.getTime() - 5 * 60 * 1000);\n' +
'        var firstCmd = "0197" + formatPollTimestamp(firstReq);\n' +
'        sendToDevice(deviceCode, socket, firstCmd, "IMMEDIATE_POLL");\n' +
'    }\n' +
'\n' +
'    var intervalId = setInterval(function () {\n' +
'        if (socket.destroyed) {\n' +
'            clearInterval(intervalId);\n' +
'            return;\n' +
'        }\n' +
'        var now = new Date();\n' +
'\n' +
'        // Re-sync time every 15 minutes (at :00, :15, :30, :45)\n' +
'        if (now.getMinutes() % 15 === 0) {\n' +
'            syncDeviceTime(deviceCode, socket);\n' +
'        }\n' +
'\n' +
'        // Request last COMPLETED interval (current - 5min) instead of in-progress one\n' +
'        var reqTime = new Date(now);\n' +
'        reqTime.setMinutes(Math.floor(reqTime.getMinutes() / 5) * 5, 0, 0);\n' +
'        reqTime = new Date(reqTime.getTime() - 5 * 60 * 1000);\n' +
'        var cmd = "0197" + formatPollTimestamp(reqTime);\n' +
'        sendToDevice(deviceCode, socket, cmd, "PERIODIC_POLL");\n' +
'    }, 5 * 60 * 1000);\n' +
'\n' +
'    socket._pollInterval = intervalId;\n' +
'}';

if (oldFnRegex.test(idx)) {
    idx = idx.replace(oldFnRegex, newFn);
    count++;
    console.log("[Fix 2] OK - immediate poll + request completed interval");
} else {
    console.log("[Fix 2] SKIP - already patched");
}

fs.writeFileSync(idxFile, idx);
console.log("[index.js] " + count + " fix(es) applied\n");

// === Fix scheduler.js ===
var schFile = __dirname + "/server/scheduler.js";
var sch = fs.readFileSync(schFile, "utf8");
var schCount = 0;

// Fix 4a: Add toLocalISOString function
if (sch.indexOf("toLocalISOString") === -1) {
    var localFn = '\nfunction toLocalISOString(d) {\n' +
    '    var y = d.getFullYear();\n' +
    '    var mo = String(d.getMonth() + 1).padStart(2, "0");\n' +
    '    var dy = String(d.getDate()).padStart(2, "0");\n' +
    '    var h = String(d.getHours()).padStart(2, "0");\n' +
    '    var mi = String(d.getMinutes()).padStart(2, "0");\n' +
    '    var s2 = String(d.getSeconds()).padStart(2, "0");\n' +
    '    return y + "-" + mo + "-" + dy + "T" + h + ":" + mi + ":" + s2;\n' +
    '}\n\n';
    sch = sch.replace("var INTERVAL", localFn + "var INTERVAL");
    schCount++;
    console.log("[Fix 3a] OK - added toLocalISOString function");
} else {
    console.log("[Fix 3a] SKIP - already exists");
}

// Fix 4b: Use local time in queries
if (sch.indexOf("periodStart.toISOString()") !== -1) {
    sch = sch.replace("periodStart.toISOString()", "toLocalISOString(periodStart)");
    sch = sch.replace("periodEnd.toISOString()", "toLocalISOString(periodEnd)");
    schCount++;
    console.log("[Fix 3b] OK - scheduler uses local time now");
} else {
    console.log("[Fix 3b] SKIP - already patched");
}

fs.writeFileSync(schFile, sch);
console.log("[scheduler.js] " + schCount + " fix(es) applied\n");

console.log("=== DONE! Now run: pm2 restart tc-manager ===");
