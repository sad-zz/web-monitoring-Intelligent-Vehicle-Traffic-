/**
 * Patch2 - fixes NaN clock drift, deferred polling, timestamp correction
 * Run on server: node /opt/tc-manager/patch2.js
 * Must run AFTER patch.js
 */
var fs = require("fs");
var idxFile = __dirname + "/server/index.js";
var idx = fs.readFileSync(idxFile, "utf8");
var count = 0;

// Backup
fs.writeFileSync(idxFile + ".patch2.bak", idx);

// =============================================
// Fix A: Add deviceClockDrift tracking variable
// =============================================
if (idx.indexOf("deviceClockDrift") === -1) {
    idx = idx.replace(
        "var pendingSyncs = {};",
        "var pendingSyncs = {};\n\n// Track clock drift per device (device_code -> drift in minutes)\nvar deviceClockDrift = {};"
    );
    count++;
    console.log("[Fix A] OK - added deviceClockDrift variable");
} else {
    console.log("[Fix A] SKIP - deviceClockDrift already exists");
}

// =============================================
// Fix B: Add deferDataRequest fields to pendingSyncs init
// =============================================
if (idx.indexOf("retries: 0, deferDataRequest") === -1 && idx.indexOf("retries: 0 }") !== -1) {
    idx = idx.replace(
        "{ retries: 0 }",
        "{ retries: 0, deferDataRequest: false, socket: null }"
    );
    count++;
    console.log("[Fix B] OK - added deferDataRequest to pendingSyncs");
} else {
    console.log("[Fix B] SKIP - already patched or not found");
}

// =============================================
// Fix C: Replace handshake clock drift detection to handle invalid dates (month=26)
// =============================================
var oldDriftBlock = 'var devDate = new Date(devTimeParts[1] + "-" + devTimeParts[2] + "-" + devTimeParts[3] + "T" + devTimeParts[4] + ":" + devTimeParts[5] + ":" + devTimeParts[6]);\n            var srvDate = new Date();\n            var driftM = Math.round(Math.abs(srvDate.getTime() - devDate.getTime()) / 60000);\n            console.log("[TCP] Device " + sysId + " clock drift: " + driftM + " minutes");\n            if (driftM > 2) {\n                console.log("[TCP] WARNING: Device " + sysId + " clock drift detected: " + driftM + " minutes - will sync");\n            }';

var newDriftBlock = 'var devMonth = parseInt(devTimeParts[2], 10);\n            var devDay = parseInt(devTimeParts[3], 10);\n            var devDate = new Date(devTimeParts[1] + "-" + devTimeParts[2] + "-" + devTimeParts[3] + "T" + devTimeParts[4] + ":" + devTimeParts[5] + ":" + devTimeParts[6]);\n            var srvDate = new Date();\n            var driftM;\n            if (devMonth < 1 || devMonth > 12 || devDay < 1 || devDay > 31 || isNaN(devDate.getTime())) {\n                driftM = 9999;\n                console.log("[TCP] Device " + sysId + " clock INVALID date: " + devTimeParts[1] + "-" + devTimeParts[2] + "-" + devTimeParts[3] + " (month=" + devMonth + ") - treating as large drift");\n            } else {\n                driftM = Math.round(Math.abs(srvDate.getTime() - devDate.getTime()) / 60000);\n            }\n            deviceClockDrift[sysId] = driftM;\n            console.log("[TCP] Device " + sysId + " clock drift: " + driftM + " minutes");\n            if (driftM > 5) {\n                console.log("[TCP] WARNING: Device " + sysId + " clock drift too large (" + driftM + " min) - will sync first, then start polling");\n            } else if (driftM > 2) {\n                console.log("[TCP] WARNING: Device " + sysId + " clock drift detected: " + driftM + " minutes - will sync");\n            }';

if (idx.indexOf(oldDriftBlock) !== -1) {
    idx = idx.replace(oldDriftBlock, newDriftBlock);
    count++;
    console.log("[Fix C] OK - handshake detects invalid dates (month=26 etc)");
} else if (idx.indexOf("deviceClockDrift[sysId] = driftM") !== -1) {
    console.log("[Fix C] SKIP - already patched");
} else {
    console.log("[Fix C] WARN - could not find old drift block, trying alternative...");
    // Try to find and patch even if whitespace differs
    if (idx.indexOf("var driftM = Math.round") !== -1 && idx.indexOf("deviceClockDrift[sysId]") === -1) {
        // Replace the simpler version
        idx = idx.replace(
            /var devDate = new Date\(devTimeParts\[1\].*?\n\s+var srvDate = new Date\(\);\n\s+var driftM = Math\.round\(Math\.abs\(srvDate\.getTime\(\) - devDate\.getTime\(\)\) \/ 60000\);\n\s+console\.log\("\[TCP\] Device " \+ sysId \+ " clock drift: " \+ driftM \+ " minutes"\);\n\s+if \(driftM > 2\) \{\n\s+console\.log\("\[TCP\] WARNING.*?will sync"\);\n\s+\}/,
            newDriftBlock
        );
        if (idx.indexOf("deviceClockDrift[sysId]") !== -1) {
            count++;
            console.log("[Fix C] OK (alt) - patched with regex");
        } else {
            console.log("[Fix C] FAIL - could not patch");
        }
    } else {
        console.log("[Fix C] SKIP - may already be partially patched");
    }
}

// =============================================
// Fix D: Replace startDevicePoll to defer data when large drift
// =============================================
var oldStartPoll = /function startDevicePoll\(deviceCode, socket\) \{\n\s+console\.log\("\[TCP\] ====== Starting poll sequence for device " \+ deviceCode \+ " ======"\);/;

var newStartPoll = 'function startDevicePoll(deviceCode, socket) {\n    var drift = deviceClockDrift[deviceCode] || 0;\n    var largeDrift = drift > 5;\n    console.log("[TCP] ====== Starting poll sequence for device " + deviceCode + " (drift=" + drift + "min, largeDrift=" + largeDrift + ") ======");';

if (oldStartPoll.test(idx)) {
    idx = idx.replace(oldStartPoll, newStartPoll);
    count++;
    console.log("[Fix D] OK - startDevicePoll checks drift");
} else if (idx.indexOf("largeDrift") !== -1) {
    console.log("[Fix D] SKIP - already patched");
} else {
    console.log("[Fix D] WARN - startDevicePoll pattern not found");
}

// =============================================
// Fix E: In startDevicePoll, after first syncDeviceTime, add defer logic
// =============================================
// Find the block after first syncDeviceTime that does the second sync + data request
var oldStep2 = '// Step 2: Second time sync (3 seconds later, for redundancy)\n            setTimeout(function () {\n                if (socket.destroyed) return;\n                syncDeviceTime(deviceCode, socket);\n\n                // Step 3: Request last 15 minutes of data (3 intervals)\n                // Wait 5 seconds after time sync for device to set its clock\n                setTimeout(function () {\n                    if (socket.destroyed) return;\n                    startDataRequests(deviceCode, socket);\n                }, 5000);\n            }, 3000);';

var newStep2 = '// If large drift, mark deferred\n            if (largeDrift && pendingSyncs[deviceCode]) {\n                pendingSyncs[deviceCode].deferDataRequest = true;\n                pendingSyncs[deviceCode].socket = socket;\n                console.log("[TCP] Device " + deviceCode + ": large clock drift (" + drift + " min) - deferring data request until TIME_SYNC ACK");\n            }\n\n            // Step 2: Second time sync (3 seconds later, for redundancy)\n            setTimeout(function () {\n                if (socket.destroyed) return;\n                syncDeviceTime(deviceCode, socket);\n\n                if (largeDrift && pendingSyncs[deviceCode]) {\n                    pendingSyncs[deviceCode].deferDataRequest = true;\n                    pendingSyncs[deviceCode].socket = socket;\n                }\n\n                if (!largeDrift) {\n                    setTimeout(function () {\n                        if (socket.destroyed) return;\n                        startDataRequests(deviceCode, socket);\n                    }, 5000);\n                } else {\n                    console.log("[TCP] Device " + deviceCode + ": skipping old data request (drift=" + drift + "min) - waiting for TIME_SYNC ACK");\n                }\n            }, 3000);';

if (idx.indexOf(oldStep2) !== -1) {
    idx = idx.replace(oldStep2, newStep2);
    count++;
    console.log("[Fix E] OK - startDevicePoll defers data on large drift");
} else if (idx.indexOf("deferDataRequest") !== -1 && idx.indexOf("largeDrift") !== -1) {
    console.log("[Fix E] SKIP - already patched");
} else {
    console.log("[Fix E] WARN - step2 pattern not found (may need manual edit)");
}

// =============================================
// Fix F: In 8821 data handler, correct timestamps when drift > 30min
// =============================================
var oldTimestampCheck = '        var serverNow = new Date();\n        var deviceTime = new Date(parsed.create_at);\n        if (!isNaN(deviceTime.getTime())) {\n            var driftMs = Math.abs(serverNow.getTime() - deviceTime.getTime());\n            var driftMinutes = Math.round(driftMs / 60000);\n            if (driftMinutes > 30) {\n                console.log("[TCP] WARNING: Device " + parsed.device_code + " clock drift = " + driftMinutes + " min (device=" + parsed.create_at + " server=" + serverNow.toISOString() + ")");\n                addLiveLog({ ts: Date.now(), time: serverNow.toISOString(), type: "tcp-ratcx1", ip: ip, device: parsed.device_code, detail: "اختلاف ساعت: " + driftMinutes + " دقیقه - سینک مجدد" });';

var newTimestampCheck = '        var serverNow = new Date();\n        var deviceTime = new Date(parsed.create_at);\n        var timestampCorrected = false;\n        if (!isNaN(deviceTime.getTime())) {\n            var driftMs = Math.abs(serverNow.getTime() - deviceTime.getTime());\n            var driftMinutes = Math.round(driftMs / 60000);\n            if (driftMinutes > 30) {\n                console.log("[TCP] WARNING: Device " + parsed.device_code + " clock drift = " + driftMinutes + " min (device=" + parsed.create_at + " server=" + serverNow.toISOString() + ")");\n                var corrected = new Date(serverNow);\n                corrected.setMinutes(Math.floor(corrected.getMinutes() / 5) * 5, 0, 0);\n                var correctedStr = corrected.getFullYear() + "-" + String(corrected.getMonth() + 1).padStart(2, "0") + "-" + String(corrected.getDate()).padStart(2, "0") + "T" + String(corrected.getHours()).padStart(2, "0") + ":" + String(corrected.getMinutes()).padStart(2, "0") + ":00";\n                console.log("[TCP] Correcting timestamp: " + parsed.create_at + " -> " + correctedStr);\n                parsed.create_at = correctedStr;\n                timestampCorrected = true;\n                addLiveLog({ ts: Date.now(), time: serverNow.toISOString(), type: "tcp-ratcx1", ip: ip, device: parsed.device_code, detail: "اختلاف ساعت " + driftMinutes + " دقیقه - زمان اصلاح شد به " + correctedStr });';

if (idx.indexOf(oldTimestampCheck) !== -1) {
    idx = idx.replace(oldTimestampCheck, newTimestampCheck);
    count++;
    console.log("[Fix F] OK - data timestamps corrected when drift > 30min");
} else if (idx.indexOf("timestampCorrected") !== -1) {
    console.log("[Fix F] SKIP - already patched");
} else {
    console.log("[Fix F] WARN - timestamp check pattern not found");
}

// =============================================
// Fix G: Also handle NaN deviceTime (invalid date in data)
// =============================================
// After the if (!isNaN block, add handling for NaN
if (idx.indexOf("timestampCorrected") !== -1 && idx.indexOf("} else if (isNaN(deviceTime.getTime()))") === -1) {
    // Find the closing of the drift check block and add NaN handler
    var nanTarget = '        } else if (isNaN(deviceTime.getTime())) {';
    // We need to add this - but it's complex. Let's just ensure NaN dates get corrected too.
    // The create_at from a device with month=26 will produce "NaN" date
    // We can add a pre-check before the existing if block
    var preCheck = '        // Pre-check: if device date is NaN (e.g. month=26), correct it now\n        if (isNaN(deviceTime.getTime())) {\n            var corrNow = new Date();\n            corrNow.setMinutes(Math.floor(corrNow.getMinutes() / 5) * 5, 0, 0);\n            var corrStr = corrNow.getFullYear() + "-" + String(corrNow.getMonth() + 1).padStart(2, "0") + "-" + String(corrNow.getDate()).padStart(2, "0") + "T" + String(corrNow.getHours()).padStart(2, "0") + ":" + String(corrNow.getMinutes()).padStart(2, "0") + ":00";\n            console.log("[TCP] Device " + parsed.device_code + " has INVALID date: " + parsed.create_at + " -> correcting to " + corrStr);\n            parsed.create_at = corrStr;\n            timestampCorrected = true;\n        }\n';
    var insertPoint = '        var timestampCorrected = false;\n        if (!isNaN(deviceTime.getTime()))';
    if (idx.indexOf(insertPoint) !== -1) {
        idx = idx.replace(insertPoint, '        var timestampCorrected = false;\n' + preCheck + '        if (!isNaN(deviceTime.getTime()))');
        count++;
        console.log("[Fix G] OK - NaN date correction added");
    } else {
        console.log("[Fix G] WARN - insert point not found");
    }
} else {
    console.log("[Fix G] SKIP - already handled or timestampCorrected not found");
}

// =============================================
// Fix H: In TIME_SYNC ACK (8012), add deferred polling start
// =============================================
var oldAckBlock = '        if (pendingSyncs[sid]) {\n            clearTimeout(pendingSyncs[sid].timer);\n            delete pendingSyncs[sid];\n            console.log("[TCP]   TIME_SYNC confirmed for " + sid);\n        }';

var newAckBlock = '        var shouldStartPoll = false;\n        var deferredSocket = null;\n        if (pendingSyncs[sid]) {\n            if (pendingSyncs[sid].deferDataRequest) {\n                shouldStartPoll = true;\n                deferredSocket = pendingSyncs[sid].socket;\n                console.log("[TCP]   TIME_SYNC confirmed for " + sid + " - starting deferred data requests (clock was out of sync)");\n            } else {\n                console.log("[TCP]   TIME_SYNC confirmed for " + sid);\n            }\n            clearTimeout(pendingSyncs[sid].timer);\n            delete pendingSyncs[sid];\n        }\n        delete deviceClockDrift[sid];\n\n        if (shouldStartPoll && deferredSocket && !deferredSocket.destroyed) {\n            startDataRequests(sid, deferredSocket);\n        }';

if (idx.indexOf(oldAckBlock) !== -1) {
    idx = idx.replace(oldAckBlock, newAckBlock);
    count++;
    console.log("[Fix H] OK - TIME_SYNC ACK starts deferred polling");
} else if (idx.indexOf("shouldStartPoll") !== -1) {
    console.log("[Fix H] SKIP - already patched");
} else {
    console.log("[Fix H] WARN - ACK block pattern not found");
}

// =============================================
// Fix I: Update stored log to show timestamp correction
// =============================================
var oldStoredLog = 'console.log("[TCP] RATCX1 stored: device=" + parsed.device_code + " vehicles=" + totalAll + " lanes=" + rows.length + " bat=" + parsed.battery + " sol=" + parsed.solar);';
var newStoredLog = 'console.log("[TCP] RATCX1 stored: device=" + parsed.device_code + " vehicles=" + totalAll + " lanes=" + rows.length + " bat=" + parsed.battery + " sol=" + parsed.solar + (timestampCorrected ? " (timestamp corrected)" : ""));';

if (idx.indexOf(oldStoredLog) !== -1) {
    idx = idx.replace(oldStoredLog, newStoredLog);
    count++;
    console.log("[Fix I] OK - stored log shows timestamp correction");
} else {
    console.log("[Fix I] SKIP - already patched or not found");
}

fs.writeFileSync(idxFile, idx);
console.log("\n[index.js] " + count + " fix(es) applied");
console.log("=== DONE! Now run: pm2 restart tc-manager ===");
