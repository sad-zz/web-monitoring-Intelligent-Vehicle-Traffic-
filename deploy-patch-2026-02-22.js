#!/usr/bin/env node
/**
 * deploy-patch-2026-02-22.js
 * ----------------------------------------------------------
 * اسکریپت پچ مستقل — بدون نیاز به git pull
 * تمام ۶ اصلاح را مستقیماً روی فایل‌های سرور اعمال می‌کند.
 *
 * اجرا روی سرور:
 *   cd /opt/tc-manager
 *   node deploy-patch-2026-02-22.js
 *   pm2 restart tc-manager
 * ----------------------------------------------------------
 */
"use strict";
var fs   = require("fs");
var path = require("path");

var ROOT = path.resolve(__dirname);
var ok   = 0;
var skip = 0;
var fail = 0;

function patch(label, filePath, findStr, replaceStr) {
    var abs = path.join(ROOT, filePath);
    if (!fs.existsSync(abs)) {
        console.log("[SKIP] " + label + " — file not found: " + abs);
        skip++;
        return;
    }
    var src = fs.readFileSync(abs, "utf8");
    if (src.indexOf(replaceStr) !== -1) {
        console.log("[SKIP] " + label + " — already applied");
        skip++;
        return;
    }
    if (src.indexOf(findStr) === -1) {
        console.log("[WARN] " + label + " — pattern not found (may already differ)");
        fail++;
        return;
    }
    // backup
    fs.writeFileSync(abs + ".patch22.bak", src);
    var result = src.split(findStr).join(replaceStr);
    fs.writeFileSync(abs, result);
    console.log("[OK]   " + label);
    ok++;
}

// Regex-based patch: matches even if whitespace/comments differ slightly
function patchRegex(label, filePath, findRe, skipStr, replaceStr) {
    var abs = path.join(ROOT, filePath);
    if (!fs.existsSync(abs)) {
        console.log("[SKIP] " + label + " — file not found: " + abs);
        skip++;
        return;
    }
    var src = fs.readFileSync(abs, "utf8");
    if (skipStr && src.indexOf(skipStr) !== -1) {
        console.log("[SKIP] " + label + " — already applied");
        skip++;
        return;
    }
    if (!findRe.test(src)) {
        console.log("[SKIP] " + label + " — pattern not present (already removed or different version)");
        skip++;
        return;
    }
    fs.writeFileSync(abs + ".patch22.bak", src);
    var result = src.replace(findRe, replaceStr);
    fs.writeFileSync(abs, result);
    console.log("[OK]   " + label);
    ok++;
}

// ============================================================
// FIX 1 — server/index.js: آمار تردد امروز با زمان UTC اشتباه
// ============================================================
patch(
    "Fix1: stats use local time",
    "server/index.js",
    // find
    "var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);\n    // Count today's vehicles from irawdata (where TCP/HTTP device data is stored)\n    var todayIraw = db.prepare(\"SELECT COALESCE(SUM(a+b+c+d+e+x), 0) as c FROM irawdata WHERE create_at >= ?\").get(todayStart.toISOString());",
    // replace
    "var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);\n    // Use local time format (irawdata.create_at is stored as local time, not UTC)\n    var todayStartStr = todayStart.getFullYear() + \"-\" +\n        String(todayStart.getMonth() + 1).padStart(2, \"0\") + \"-\" +\n        String(todayStart.getDate()).padStart(2, \"0\") + \"T00:00:00\";\n    // Count today's vehicles from irawdata (where TCP/HTTP device data is stored)\n    var todayIraw = db.prepare(\"SELECT COALESCE(SUM(a+b+c+d+e+x), 0) as c FROM irawdata WHERE create_at >= ?\").get(todayStartStr);"
);

// ============================================================
// FIX 3a — server/index.js: INSERT OR IGNORE (3 مکان)
// ============================================================
patch(
    "Fix3a: INSERT OR IGNORE irawdata",
    "server/index.js",
    "\"INSERT INTO irawdata (device_code, create_at,",
    "\"INSERT OR IGNORE INTO irawdata (device_code, create_at,"
);

// ============================================================
// FIX 6a — server/index.js: حذف CREATE TABLE users از initAdmin
// Uses regex to handle slight formatting differences between server versions
// ============================================================
patchRegex(
    "Fix6a: remove CREATE TABLE users from initAdmin",
    "server/index.js",
    // Matches the CREATE TABLE users block inside initAdmin, with any whitespace
    /\/\/ Check if users table exists\s*\n\s*db\.exec\(\[[\s\S]*?"CREATE TABLE IF NOT EXISTS users \("[\s\S]*?\]\.join\("\\n"\)\);\s*\n/,
    // skip marker — if this is already gone, skip
    null,
    // replace with nothing (removes the block entirely)
    ""
);

// ============================================================
// FIX 2 — server/scheduler.js: آفلاین شدن دستگاه‌های HTTP
// ============================================================
patch(
    "Fix2: checkOfflineDevices in scheduler",
    "server/scheduler.js",
    "/**\n * Start the scheduler.\n */\nfunction start() {",
    "/**\n * Check for HTTP devices that have gone silent and mark them offline.\n * TCP devices are already marked offline on socket disconnect (in index.js).\n * HTTP devices have no connection to drop, so we check last_seen periodically.\n */\nvar stmtGetOfflineTimeout = db.prepare(\"SELECT value FROM settings WHERE key = 'offline_timeout'\");\nvar stmtMarkOffline = db.prepare(\n    \"UPDATE devices SET status = 'offline' \" +\n    \"WHERE status = 'online' \" +\n    \"AND last_seen IS NOT NULL \" +\n    \"AND datetime(last_seen) < datetime(?)\"\n);\n\nfunction checkOfflineDevices() {\n    try {\n        var timeoutRow = stmtGetOfflineTimeout.get();\n        var timeoutMin = parseInt((timeoutRow && timeoutRow.value) || \"5\", 10);\n        if (isNaN(timeoutMin) || timeoutMin < 1) timeoutMin = 5;\n\n        // Calculate threshold in JavaScript and pass as a bound parameter\n        var threshold = new Date(Date.now() - timeoutMin * 60 * 1000);\n        var thresholdStr = toLocalISOString(threshold);\n\n        var updated = stmtMarkOffline.run(thresholdStr).changes;\n\n        if (updated > 0) {\n            console.log(\"[Scheduler] checkOfflineDevices: marked \" + updated + \" device(s) offline (timeout=\" + timeoutMin + \" min)\");\n        }\n    } catch (e) {\n        console.error(\"[Scheduler] checkOfflineDevices error:\", e.message);\n    }\n}\n\n/**\n * Start the scheduler.\n */\nfunction start() {"
);

// ============================================================
// Fix28 — server/scheduler.js: add missing toLocalISOString helper
// Fix2 added checkOfflineDevices which calls toLocalISOString, but the
// production scheduler.js (older version) never had this helper defined.
// Result: [Scheduler] checkOfflineDevices error: toLocalISOString is not defined
// ============================================================
patch(
    "Fix28: add toLocalISOString helper to scheduler.js (required by checkOfflineDevices)",
    "server/scheduler.js",
    "var INTERVAL = parseInt(process.env.SEND_INTERVAL_MINUTES, 10) || 15;",
    "var INTERVAL = parseInt(process.env.SEND_INTERVAL_MINUTES, 10) || 15;\n\n/**\n * Format Date as local ISO string (matching how device data is stored).\n * Device data is stored as \"YYYY-MM-DDTHH:MM:SS\" in LOCAL time (no Z suffix).\n * So scheduler queries must also use local time format.\n */\nfunction toLocalISOString(d) {\n    var y = d.getFullYear();\n    var mo = String(d.getMonth() + 1).padStart(2, \"0\");\n    var dy = String(d.getDate()).padStart(2, \"0\");\n    var h = String(d.getHours()).padStart(2, \"0\");\n    var mi = String(d.getMinutes()).padStart(2, \"0\");\n    var s = String(d.getSeconds()).padStart(2, \"0\");\n    return y + \"-\" + mo + \"-\" + dy + \"T\" + h + \":\" + mi + \":\" + s;\n}"
);

patch(
    "Fix2: schedule checkOfflineDevices",
    "server/scheduler.js",
    "    cron.schedule(cronExpr, function () {\n        aggregateAndSend();\n    });\n\n    // Also allow manual retry of unsent data every hour",
    "    cron.schedule(cronExpr, function () {\n        aggregateAndSend();\n    });\n\n    // Check for offline devices every minute (covers HTTP devices that stop sending)\n    cron.schedule(\"* * * * *\", function () {\n        checkOfflineDevices();\n    });\n\n    // Also allow manual retry of unsent data every hour"
);

patch(
    "Fix2: export checkOfflineDevices",
    "server/scheduler.js",
    "module.exports = {\n    start: start,\n    aggregateAndSend: aggregateAndSend,\n    sendUnsentData: sendUnsentData\n};",
    "module.exports = {\n    start: start,\n    aggregateAndSend: aggregateAndSend,\n    sendUnsentData: sendUnsentData,\n    checkOfflineDevices: checkOfflineDevices\n};"
);

// ============================================================
// FIX 3b + 6b — server/db.js: UNIQUE INDEX + جدول users
// ============================================================
patch(
    "Fix6b: add users table to db.js",
    "server/db.js",
    "    // Raw traffic data received from devices\n    \"CREATE TABLE IF NOT EXISTS traffic_data (",
    "    // Users for authentication (admin login)\n    \"CREATE TABLE IF NOT EXISTS users (\",\n    \"  id INTEGER PRIMARY KEY AUTOINCREMENT,\",\n    \"  username TEXT NOT NULL UNIQUE,\",\n    \"  password_hash TEXT NOT NULL,\",\n    \"  role TEXT DEFAULT 'admin',\",\n    \"  created_at TEXT DEFAULT (datetime('now','localtime'))\",\n    \");\",\n\n    // Raw traffic data received from devices\n    \"CREATE TABLE IF NOT EXISTS traffic_data ("
);

patch(
    "Fix3b: UNIQUE INDEX on irawdata",
    "server/db.js",
    "    \"CREATE INDEX IF NOT EXISTS idx_irawdata_device ON irawdata(device_code);\",\n    \"CREATE INDEX IF NOT EXISTS idx_irawdata_time ON irawdata(create_at);\",\n    \"CREATE INDEX IF NOT EXISTS idx_irawdata_read ON irawdata(is_read);\",\n\n    // Settings (key-value store)",
    "    \"CREATE INDEX IF NOT EXISTS idx_irawdata_device ON irawdata(device_code);\",\n    \"CREATE INDEX IF NOT EXISTS idx_irawdata_time ON irawdata(create_at);\",\n    \"CREATE INDEX IF NOT EXISTS idx_irawdata_read ON irawdata(is_read);\",\n    // Prevent duplicate interval records when a TCP device reconnects and re-sends the same interval\n    \"CREATE UNIQUE INDEX IF NOT EXISTS idx_irawdata_unique ON irawdata(device_code, create_at, stop, lane);\",\n\n    // Settings (key-value store)"
);

// ============================================================
// FIX 4 — index.html: دکمه «محورها» در sidebar
// ============================================================
patch(
    "Fix4: mehvar nav button",
    "index.html",
    "            <button class=\"nav-item\" data-view=\"settings\">",
    "            <button class=\"nav-item\" data-view=\"mehvar\">\n                <svg class=\"nav-icon\" viewBox=\"0 0 24 24\"><path d=\"M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zm-.5 1.5 1.96 2.5H17V9.5h2.5zM6 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm13 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z\"/></svg>\n                <span>محورها</span>\n            </button>\n            <button class=\"nav-item\" data-view=\"settings\">"
);

// ============================================================
// FIX 4 — index.html: بخش view-mehvar
// ============================================================
patch(
    "Fix4: mehvar view section",
    "index.html",
    "\n            <!-- ===== Settings ===== -->\n            <section class=\"view\" id=\"view-settings\">",
    "\n            <!-- ===== Mehvar (Routes) ===== -->\n            <section class=\"view\" id=\"view-mehvar\">\n                <div class=\"panel\">\n                    <div class=\"panel-header\">\n                        <h3 class=\"panel-title\">مدیریت محورها</h3>\n                        <div class=\"panel-tools\">\n                            <button class=\"btn btn-primary\" id=\"btn-add-mehvar\">+ محور جدید</button>\n                            <button class=\"btn btn-secondary\" id=\"btn-refresh-mehvar\">بروزرسانی</button>\n                        </div>\n                    </div>\n                    <div class=\"table-wrapper\">\n                        <table class=\"data-table\" id=\"mehvar-table\">\n                            <thead>\n                                <tr>\n                                    <th>کد محور</th>\n                                    <th>نام محور</th>\n                                    <th>استان</th>\n                                    <th>ارسال رهسام</th>\n                                    <th>تحت تعمیر</th>\n                                    <th>عملیات</th>\n                                </tr>\n                            </thead>\n                            <tbody id=\"mehvar-table-body\">\n                                <tr><td colspan=\"6\" style=\"text-align:center;color:#94a3b8\">در حال بارگذاری...</td></tr>\n                            </tbody>\n                        </table>\n                    </div>\n                </div>\n            </section>\n\n            <!-- ===== Settings ===== -->\n            <section class=\"view\" id=\"view-settings\">"
);

// ============================================================
// FIX 5 — index.html: پنل TCP متصل در داشبورد
// ============================================================
patch(
    "Fix5: TCP connected panel in dashboard",
    "index.html",
    "                <!-- Device Status Table -->",
    "                <!-- TCP Connected Devices -->\n                <div class=\"panel\" style=\"margin-bottom:16px\">\n                    <div class=\"panel-header\">\n                        <h3 class=\"panel-title\">اتصالات TCP فعال</h3>\n                        <div class=\"panel-tools\">\n                            <button class=\"btn btn-sm btn-primary\" id=\"btn-refresh-tcp\">بروزرسانی</button>\n                        </div>\n                    </div>\n                    <div class=\"table-wrapper\" style=\"max-height:200px;overflow-y:auto\">\n                        <table class=\"data-table\" id=\"tcp-table\">\n                            <thead>\n                                <tr>\n                                    <th>کد دستگاه</th>\n                                    <th>آدرس IP</th>\n                                    <th>زمان اتصال</th>\n                                    <th>عملیات</th>\n                                </tr>\n                            </thead>\n                            <tbody id=\"tcp-table-body\">\n                                <tr><td colspan=\"4\" style=\"text-align:center;color:#94a3b8\">دستگاهی متصل نیست</td></tr>\n                            </tbody>\n                        </table>\n                    </div>\n                </div>\n\n                <!-- Device Status Table -->"
);

// ============================================================
// FIX 4+5 — js/app.js: VIEW_TITLES + mehvar
// ============================================================
patch(
    "Fix4: add mehvar to VIEW_TITLES",
    "js/app.js",
    "    var VIEW_TITLES = {\n        dashboard: \"داشبورد\",\n        devices: \"دستگاه‌ها\",\n        reception: \"دریافت داده\",\n        rmto: \"ارسال رهسام\",\n        settings: \"تنظیمات\"\n    };",
    "    var VIEW_TITLES = {\n        dashboard: \"داشبورد\",\n        devices: \"دستگاه‌ها\",\n        reception: \"دریافت داده\",\n        rmto: \"ارسال رهسام\",\n        mehvar: \"محورها\",\n        settings: \"تنظیمات\"\n    };"
);

patch(
    "Fix4: add mehvar to switchView",
    "js/app.js",
    "        else if (view === \"reception\") loadReception();\n        else if (view === \"rmto\") loadRMTO();\n        else if (view === \"settings\") loadSettings();",
    "        else if (view === \"reception\") loadReception();\n        else if (view === \"rmto\") loadRMTO();\n        else if (view === \"mehvar\") loadMehvar();\n        else if (view === \"settings\") loadSettings();"
);

patch(
    "Fix4+5: add loadTcpConnected, loadMehvar, and handlers",
    "js/app.js",
    "if (rmtoRefreshBtn) rmtoRefreshBtn.addEventListener(\"click\", loadRMTO);\n\n    // ============================================================\n    // Settings",
    "if (rmtoRefreshBtn) rmtoRefreshBtn.addEventListener(\"click\", loadRMTO);\n\n    // ============================================================\n    // Mehvar (Routes) Management\n    // ============================================================\n    function loadMehvar() {\n        api(\"GET\", \"/api/mehvar\", null, function (status, data) {\n            var tbody = $(\"#mehvar-table-body\");\n            if (status !== 200 || !data || !data.length) {\n                tbody.innerHTML = '<tr><td colspan=\"6\" style=\"text-align:center;color:#94a3b8\">محوری ثبت نشده</td></tr>';\n                return;\n            }\n            tbody.innerHTML = data.map(function (r) {\n                return \"<tr>\" +\n                    '<td dir=\"ltr\" style=\"text-align:center;font-weight:700\">' + escapeHtml(r.code) + \"</td>\" +\n                    \"<td>\" + escapeHtml(r.name) + \"</td>\" +\n                    \"<td>\" + escapeHtml(r.ostan || \"-\") + \"</td>\" +\n                    '<td style=\"text-align:center\"><span class=\"status-badge ' + (r.send_enable ? \"online\" : \"warning\") + '\">' +\n                        (r.send_enable ? \"فعال\" : \"غیرفعال\") + \"</span></td>\" +\n                    '<td style=\"text-align:center\"><span class=\"status-badge ' + (r.repair ? \"error\" : \"\") + '\">' +\n                        (r.repair ? \"بله\" : \"خیر\") + \"</span></td>\" +\n                    '<td><button class=\"btn btn-sm btn-danger\" data-action=\"delete-mehvar\" data-code=\"' + escapeHtml(String(r.code)) + '\">حذف</button></td>' +\n                    \"</tr>\";\n            }).join(\"\");\n        });\n    }\n\n    // Event delegation for mehvar table buttons\n    var mehvarTableEl = $(\"#mehvar-table-body\");\n    if (mehvarTableEl) mehvarTableEl.addEventListener(\"click\", function (e) {\n        var btn = e.target.closest(\"button[data-action='delete-mehvar']\");\n        if (!btn) return;\n        var code = btn.getAttribute(\"data-code\");\n        if (!confirm(\"محور \" + code + \" حذف شود؟\")) return;\n        api(\"DELETE\", \"/api/mehvar/\" + encodeURIComponent(code), null, function (status) {\n            if (status === 200) loadMehvar();\n            else alert(\"خطا در حذف محور\");\n        });\n    });\n\n    var addMehvarBtn = $(\"#btn-add-mehvar\");\n    if (addMehvarBtn) addMehvarBtn.addEventListener(\"click\", function () {\n        var addBody = $(\"#add-modal-body\");\n        var addTitle = $(\"#add-modal-title\");\n        if (!addBody || !addTitle) return;\n        addTitle.textContent = \"افزودن محور جدید\";\n        addBody.innerHTML =\n            '<div class=\"form-group\"><label>کد محور</label><input type=\"number\" id=\"new-mehvar-code\" placeholder=\"مثال: 101\" dir=\"ltr\"></div>' +\n            '<div class=\"form-group\"><label>نام محور</label><input type=\"text\" id=\"new-mehvar-name\" placeholder=\"مثال: تهران - مشهد\"></div>' +\n            '<div class=\"form-group\"><label>استان</label><input type=\"text\" id=\"new-mehvar-ostan\" placeholder=\"مثال: تهران\"></div>' +\n            '<div class=\"form-group\"><label>ارسال رهسام</label><select id=\"new-mehvar-send\">' +\n                '<option value=\"1\">فعال</option><option value=\"0\">غیرفعال</option>' +\n            '</select></div>' +\n            '<div class=\"form-group\"><label>تحت تعمیر</label><select id=\"new-mehvar-repair\">' +\n                '<option value=\"0\">خیر</option><option value=\"1\">بله</option>' +\n            '</select></div>';\n        $(\"#add-modal-overlay\").classList.add(\"active\");\n        $(\"#add-modal-save\").onclick = function () {\n            var code = parseInt($(\"#new-mehvar-code\").value, 10);\n            var name = ($(\"#new-mehvar-name\").value || \"\").trim();\n            if (!code || !name) { alert(\"کد و نام محور الزامی است\"); return; }\n            api(\"POST\", \"/api/mehvar\", {\n                code: code,\n                name: name,\n                ostan: ($(\"#new-mehvar-ostan\").value || \"\").trim(),\n                send_enable: parseInt($(\"#new-mehvar-send\").value, 10),\n                repair: parseInt($(\"#new-mehvar-repair\").value, 10)\n            }, function (status, data) {\n                if (status === 200) {\n                    $(\"#add-modal-overlay\").classList.remove(\"active\");\n                    loadMehvar();\n                } else {\n                    alert((data && data.error) || \"خطا در ثبت محور\");\n                }\n            });\n        };\n    });\n\n    var refreshMehvarBtn = $(\"#btn-refresh-mehvar\");\n    if (refreshMehvarBtn) refreshMehvarBtn.addEventListener(\"click\", loadMehvar);\n\n    // ============================================================\n    // Settings"
);

// Fix5: add loadDashboard with TCP panel
patch(
    "Fix5: loadDashboard calls loadTcpConnected",
    "js/app.js",
    "        api(\"GET\", \"/api/devices\", null, function (status, data) {\n            var tbody = $(\"#dashboard-table-body\");\n            if (status !== 200 || !data || !data.length) {\n                tbody.innerHTML = '<tr><td colspan=\"5\" style=\"text-align:center;color:#94a3b8\">دستگاهی ثبت نشده است</td></tr>';\n                return;\n            }\n            tbody.innerHTML = data.map(function (d) {\n                var st = d.status || \"offline\";\n                return \"<tr>\" +\n                    '<td dir=\"ltr\" style=\"text-align:right;font-weight:700\">' + escapeHtml(d.device_code) + \"</td>\" +\n                    \"<td>\" + escapeHtml(d.name) + \"</td>\" +\n                    '<td><span class=\"type-badge\">' + escapeHtml(TYPE_LABELS[d.type] || d.type) + \"</span></td>\" +\n                    '<td><span class=\"status-badge ' + st + '\">' + escapeHtml(STATUS_LABELS[st] || st) + \"</span></td>\" +\n                    '<td dir=\"ltr\" style=\"text-align:right\">' + escapeHtml(formatTime(d.last_seen)) + \"</td>\" +\n                    \"</tr>\";\n            }).join(\"\");\n        });\n    }\n\n    var refreshDashBtn = $(\"#btn-refresh-dashboard\");\n    if (refreshDashBtn) refreshDashBtn.addEventListener(\"click\", loadDashboard);",
    "        api(\"GET\", \"/api/devices\", null, function (status, data) {\n            var tbody = $(\"#dashboard-table-body\");\n            if (status !== 200 || !data || !data.length) {\n                tbody.innerHTML = '<tr><td colspan=\"5\" style=\"text-align:center;color:#94a3b8\">دستگاهی ثبت نشده است</td></tr>';\n                return;\n            }\n            tbody.innerHTML = data.map(function (d) {\n                var st = d.status || \"offline\";\n                return \"<tr>\" +\n                    '<td dir=\"ltr\" style=\"text-align:right;font-weight:700\">' + escapeHtml(d.device_code) + \"</td>\" +\n                    \"<td>\" + escapeHtml(d.name) + \"</td>\" +\n                    '<td><span class=\"type-badge\">' + escapeHtml(TYPE_LABELS[d.type] || d.type) + \"</span></td>\" +\n                    '<td><span class=\"status-badge ' + st + '\">' + escapeHtml(STATUS_LABELS[st] || st) + \"</span></td>\" +\n                    '<td dir=\"ltr\" style=\"text-align:right\">' + escapeHtml(formatTime(d.last_seen)) + \"</td>\" +\n                    \"</tr>\";\n            }).join(\"\");\n        });\n\n        loadTcpConnected();\n    }\n\n    function loadTcpConnected() {\n        api(\"GET\", \"/api/tcp/connected\", null, function (status, data) {\n            var tbody = $(\"#tcp-table-body\");\n            if (!tbody) return;\n            if (status !== 200 || !data || !Object.keys(data).length) {\n                tbody.innerHTML = '<tr><td colspan=\"4\" style=\"text-align:center;color:#94a3b8\">دستگاهی متصل نیست</td></tr>';\n                return;\n            }\n            var rows = Object.keys(data).map(function (code) {\n                var d = data[code];\n                return \"<tr>\" +\n                    '<td dir=\"ltr\" style=\"text-align:center;font-weight:700\">' + escapeHtml(code) + \"</td>\" +\n                    '<td dir=\"ltr\">' + escapeHtml(d.ip || \"-\") + \"</td>\" +\n                    '<td dir=\"ltr\" style=\"text-align:right\">' + escapeHtml(formatTime(d.connectedAt)) + \"</td>\" +\n                    '<td>' +\n                        '<button class=\"btn btn-sm btn-secondary\" data-action=\"tcp-sync\" data-code=\"' + escapeHtml(code) + '\">سینک ساعت</button> ' +\n                        '<button class=\"btn btn-sm btn-primary\" data-action=\"tcp-poll\" data-code=\"' + escapeHtml(code) + '\">دریافت داده</button>' +\n                    '</td>' +\n                    \"</tr>\";\n            });\n            tbody.innerHTML = rows.join(\"\");\n        });\n    }\n\n    // Event delegation for TCP action buttons\n    var tcpTableEl = $(\"#tcp-table-body\");\n    if (tcpTableEl) tcpTableEl.addEventListener(\"click\", function (e) {\n        var btn = e.target.closest(\"button[data-action]\");\n        if (!btn) return;\n        var action = btn.getAttribute(\"data-action\");\n        var code = btn.getAttribute(\"data-code\");\n        if (action === \"tcp-sync\") {\n            api(\"POST\", \"/api/tcp/sync-time\", { device_code: code }, function (s) {\n                if (s === 200) alert(\"دستور سینک ساعت ارسال شد: \" + code);\n                else alert(\"خطا در ارسال دستور\");\n            });\n        } else if (action === \"tcp-poll\") {\n            api(\"POST\", \"/api/tcp/poll\", { device_code: code }, function (s) {\n                if (s === 200) alert(\"درخواست داده ارسال شد: \" + code);\n                else alert(\"خطا در ارسال درخواست\");\n            });\n        }\n    });\n\n    var refreshTcpBtn = $(\"#btn-refresh-tcp\");\n    if (refreshTcpBtn) refreshTcpBtn.addEventListener(\"click\", loadTcpConnected);\n\n    var refreshDashBtn = $(\"#btn-refresh-dashboard\");\n    if (refreshDashBtn) refreshDashBtn.addEventListener(\"click\", loadDashboard);"
);

// ============================================================
// FIX 7 — server/index.js: startDataRequests از بازه in-progress می‌خواست
// (اگر Fix11c از قبل اعمال شده باشد، این پچ skip می‌شود — Fix11c کل تابع را عوض کرده)
// ============================================================
patchRegex(
    "Fix7: startDataRequests only requests completed intervals",
    "server/index.js",
    /for \(var i = 0; i < 3; i\+\+\) \{\s*\n\s*var t = new Date\(now\.getTime\(\) - i \* 5 \* 60 \* 1000\);/,
    // skip marker: if Fix11c already replaced the function, the loop won't exist
    "Fix11c: startDataRequests sends ONE 0197 only",
    "    for (var i = 1; i <= 3; i++) {\n        var t = new Date(now.getTime() - i * 5 * 60 * 1000);"
);

// ============================================================
// FIX 8 — server/index.js: ratcx1ToIrawdata مقدار stop اشتباه بود
// ============================================================
patch(
    "Fix8: ratcx1ToIrawdata set stop = create_at + 5min",
    "server/index.js",
    "/** Convert RATCX1 parsed interval to irawdata rows (one per lane) */\nfunction ratcx1ToIrawdata(parsed) {\n    var rows = [];\n    [{ lane: 1, data: parsed.lane1 }, { lane: 2, data: parsed.lane2 }].forEach(function (l) {\n        var d = l.data;\n        var totalCount = d.a.count + d.b.count + d.c.count + d.d.count + d.e.count + d.x.count;\n        if (totalCount === 0) return; // skip empty lane\n        rows.push({\n            device_code: parsed.device_code,\n            create_at: parsed.create_at,\n            stop: parsed.create_at,\n            lane: l.lane,",
    "/** Convert RATCX1 parsed interval to irawdata rows (one per lane) */\nfunction ratcx1ToIrawdata(parsed) {\n    // Calculate stop time = create_at + 5 minutes (each interval is a 5-min window)\n    var createDate = new Date(parsed.create_at);\n    var stopDate = new Date(createDate.getTime() + 5 * 60 * 1000);\n    var stopStr;\n    if (isNaN(stopDate.getTime())) {\n        stopStr = parsed.create_at; // fallback: same as create_at\n    } else {\n        stopStr = stopDate.getFullYear() + \"-\" +\n            String(stopDate.getMonth() + 1).padStart(2, \"0\") + \"-\" +\n            String(stopDate.getDate()).padStart(2, \"0\") + \"T\" +\n            String(stopDate.getHours()).padStart(2, \"0\") + \":\" +\n            String(stopDate.getMinutes()).padStart(2, \"0\") + \":00\";\n    }\n\n    var rows = [];\n    [{ lane: 1, data: parsed.lane1 }, { lane: 2, data: parsed.lane2 }].forEach(function (l) {\n        var d = l.data;\n        var totalCount = d.a.count + d.b.count + d.c.count + d.d.count + d.e.count + d.x.count;\n        if (totalCount === 0) return; // skip empty lane\n        rows.push({\n            device_code: parsed.device_code,\n            create_at: parsed.create_at,\n            stop: stopStr,\n            lane: l.lane,"
);

// ============================================================
// FIX 9 — server/index.js: TCP connected API + connectedAt tracking
// ============================================================
patch(
    "Fix9: store connectedAt on socket",
    "server/index.js",
    "                connectedDevices[deviceId] = socket;\n                console.log(\"[TCP] Device \" + deviceId + \" registered for commands\");",
    "                connectedDevices[deviceId] = socket;\n                socket._connectedAt = new Date().toISOString();\n                console.log(\"[TCP] Device \" + deviceId + \" registered for commands\");"
);

patch(
    "Fix9: /api/tcp/connected returns object keyed by device code",
    "server/index.js",
    "// API: Connected devices list & send command\napp.get(\"/api/tcp/connected\", requireAuth, function (req, res) {\n    var devices = Object.keys(connectedDevices).map(function (id) {\n        var s = connectedDevices[id];\n        return { device_code: id, ip: s.remoteAddress || \"\", connected: !s.destroyed };\n    }).filter(function (d) { return d.connected; });\n    res.json(devices);\n});",
    "// API: Connected devices list & send command\napp.get(\"/api/tcp/connected\", requireAuth, function (req, res) {\n    var result = {};\n    Object.keys(connectedDevices).forEach(function (id) {\n        var s = connectedDevices[id];\n        if (!s.destroyed) {\n            result[id] = { ip: s.remoteAddress || \"\", connectedAt: s._connectedAt || null };\n        }\n    });\n    res.json(result);\n});"
);

// ============================================================
// FIX 10 — server/index.js: فرمت دستور 0012 اشتباه بود
// فریم‌ور (DS1305_Lib.h rtc_write) فرمت yyMMddHHmmss انتظار دارد
// ولی کد قبلی YYYY.MM.DD-HH:MM:SS.0 می‌فرستاد (فرمت خروجی دستگاه، نه ورودی!)
// ============================================================
patchRegex(
    "Fix10: 0012 TIME_SYNC format yyMMddHHmmss",
    "server/index.js",
    // match the old verbose format function (any whitespace variant)
    /function formatDeviceDatetime\(date\) \{[\s\S]*?return [^;]*\+ "\." \+[^;]*\+ "\." \+[^;]*\+ "-" \+[^;]*\+ ":" \+[^;]*\+ ":" \+[^;]*\+ "\.0";\s*\}/,
    // skip marker: if new format already present, skip
    "return yy + mo + dy + h + m + s;  // 12 chars: yyMMddHHmmss",
    // replacement: correct yyMMddHHmmss format
    "function formatDeviceDatetime(date) {\n    var yy = String(date.getFullYear()).substring(2);\n    var mo = String(date.getMonth() + 1).padStart(2, \"0\");\n    var dy = String(date.getDate()).padStart(2, \"0\");\n    var h  = String(date.getHours()).padStart(2, \"0\");\n    var m  = String(date.getMinutes()).padStart(2, \"0\");\n    var s  = String(date.getSeconds()).padStart(2, \"0\");\n    return yy + mo + dy + h + m + s;  // 12 chars: yyMMddHHmmss\n}"
);

// ============================================================
// FIX 11 — server/index.js: پروتکل یک-دستور-در-هر-اتصال
// فریم‌ور RATCX1 فقط ONE دستور per TCP connection پردازش می‌کند:
// - buffer UART2 فقط 47 بایت است
// - وقتی سرور 0012 + 0197 با هم می‌فرستد، دستگاه در CIPSEND گیر می‌کند
// ============================================================

// 11a: حذف Step 2 (ارسال دوم syncDeviceTime) و تبدیل Step 3 به one-command
patchRegex(
    "Fix11a-1: remove second syncDeviceTime redundancy send",
    "server/index.js",
    /\/\/ Step 2: Second time sync \(3 seconds later, for redundancy\)\s*\n\s*setTimeout\(function \(\) \{[\s\S]*?\}, 3000\);/,
    "Step 2 removed: firmware processes ONE command per connection",
    "        // Step 2 removed: firmware processes ONE command per connection.\n        // If drift small, send ONE 0197. If large, next connection handles data.\n        if (!largeDrift) {\n            startDataRequests(deviceCode, socket);\n        }"
);

// 11b: دستگاه بلافاصله بعد از 8012 CIPSHUT می‌کند — 0197 نفرست
patchRegex(
    "Fix11b: after 8012 ACK clear drift only, no startDataRequests",
    "server/index.js",
    /\/\/ Clear drift tracking after successful sync[\s\S]*?\/\/ Start data requests \+ periodic polling if it was deferred due to large clock drift\s*\n\s*if \(shouldStartPoll && deferredSocket && !deferredSocket\.destroyed\) \{\s*\n\s*startDataRequests\(sid, deferredSocket\);\s*\n\s*\}/,
    "Do NOT call startDataRequests here: the device is about to CIPSHUT",
    "        // Clear drift so next 8000 connection takes the normal data poll path.\n        // Do NOT call startDataRequests here: the device is about to CIPSHUT after\n        // sending 8012. Writing 0197 to the socket now overflows the device's 47-byte\n        // UART2 buffer and it gets stuck waiting for modem SEND OK that never comes.\n        delete deviceClockDrift[sid];"
);

// 11c: فقط ONE 0197 ارسال کن (نه loop با delay)
patchRegex(
    "Fix11c: startDataRequests sends ONE 0197 only",
    "server/index.js",
    /var idx = 0;\s*\n\s*function sendNextRequest\(\) \{[\s\S]*?sendNextRequest\(\);/,
    "Sending more than one 0197 in one connection would overflow",
    "    // Send only the first (most recent completed) interval.\n    // Sending more than one 0197 in one connection would overflow the device's 47-byte\n    // UART2 buffer while it is replying, causing it to get stuck on modem SEND OK.\n    if (!socket.destroyed) {\n        sendToDevice(deviceCode, socket, \"0197\" + requests[requests.length - 1], \"DATA_REQ\");\n    }"
);

// ============================================================
// FIX 12 — server/index.js: حذف خطوط اضافه `}, 1000);` در startDevicePoll
// Fix11a به اشتباه ۳ خط اضافه باقی گذاشت که باعث SyntaxError می‌شود و سرور crash می‌کند.
// Remove 3 orphaned "}, 1000);" lines left by Fix11a that cause "SyntaxError: Unexpected token ','"
// Regex groups:
//   $1 = "    }, 1000);\n"  (correct closing of the single remaining setTimeout)
//   $2 = "}\n"              (correct closing of startDevicePoll function)
// ============================================================
patchRegex(
    "Fix12: remove orphaned }, 1000); lines causing SyntaxError in startDevicePoll",
    "server/index.js",
    /( {4}\}, 1000\);\n)\}, 1000\);\n\}, 1000\);\n\}, 1000\);\n(\}\n)/,
    "Fix12 already applied: startDevicePoll has correct single closing brace",
    "$1$2"
);

// ============================================================
// FIX 13 — server/index.js: اضافه کردن process.on('uncaughtException')
// بدون این handler، هر خطای ناخواسته سرور را crash می‌کند و PM2 restart می‌شود.
// علت restart count بالا (131→191) همین بود: SyntaxError از Fix11a.
// ============================================================
patch(
    "Fix13: add uncaughtException handler to prevent crash-restarts",
    "server/index.js",
    "// ============================================================\n// Start HTTP Server\n// ============================================================\napp.listen(PORT, HOST, function () {",
    "// ============================================================\n// Global Error Handlers \u2014 prevent process crash on unexpected errors\n// ============================================================\nprocess.on(\"uncaughtException\", function (err) {\n    console.error(\"[FATAL] Uncaught exception (server kept running):\", err.message, err.stack || \"\");\n});\nprocess.on(\"unhandledRejection\", function (reason) {\n    console.error(\"[FATAL] Unhandled promise rejection (server kept running):\", reason);\n});\n\n// ============================================================\n// Start HTTP Server\n// ============================================================\napp.listen(PORT, HOST, function () {"
);

// ============================================================
// Fix14: اصلاح EADDRINUSE handler — close() قبل از retry + max retry
// ============================================================
patch(
    "Fix14: EADDRINUSE — close() before retry + max 10 retries then exit",
    "server/index.js",
    "tcpServer.on(\"error\", function (err) {\n    if (err.code === \"EADDRINUSE\") {\n        console.error(\"[TCP] Port \" + TCP_PORT + \" already in use, will retry in 5s\");\n        setTimeout(function () { tcpServer.listen(TCP_PORT, \"0.0.0.0\"); }, 5000);\n    }\n});",
    "var _tcpRetries = 0;\nvar TCP_MAX_RETRIES = 10;\ntcpServer.on(\"error\", function (err) {\n    if (err.code === \"EADDRINUSE\") {\n        _tcpRetries++;\n        if (_tcpRetries > TCP_MAX_RETRIES) {\n            console.error(\"[TCP] Port \" + TCP_PORT + \" still in use after \" + TCP_MAX_RETRIES + \" retries \u2014 exiting so PM2 can restart cleanly\");\n            process.exit(1);\n        }\n        console.error(\"[TCP] Port \" + TCP_PORT + \" already in use, retry \" + _tcpRetries + \"/\" + TCP_MAX_RETRIES + \" in 5s\");\n        setTimeout(function () {\n            tcpServer.close(function () {\n                tcpServer.listen(TCP_PORT, \"0.0.0.0\");\n            });\n        }, 5000);\n    }\n});"
);

// ============================================================
// Fix15 — server/index.js: uncaughtException باید روی EADDRINUSE هم exit کند
// بدون این، HTTP port 3000 "in use" توسط uncaughtException گرفته می‌شد
// و "server kept running" چاپ می‌شد ولی HTTP listen انجام نشده بود.
// ============================================================
patch(
    "Fix15: uncaughtException exits on EADDRINUSE",
    "server/index.js",
    "process.on(\"uncaughtException\", function (err) {\n    console.error(\"[FATAL] Uncaught exception (server kept running):\", err.message, err.stack || \"\");\n});",
    "process.on(\"uncaughtException\", function (err) {\n    if (err.code === \"EADDRINUSE\") {\n        console.error(\"[FATAL] Port already in use (\" + (err.port || \"unknown\") + \") \u2014 exiting for clean PM2 restart\");\n        process.exit(1);\n    }\n    console.error(\"[FATAL] Uncaught exception (server kept running):\", err.message, err.stack || \"\");\n});"
);

// ============================================================
// Fix16 — server/index.js: اضافه کردن error handler روی HTTP server
// app.listen() باید به var httpServer تبدیل شود و error event داشته باشد.
// ============================================================
patch(
    "Fix16: app.listen → httpServer + httpServer.on('error') for EADDRINUSE",
    "server/index.js",
    "app.listen(PORT, HOST, function () {",
    "var httpServer = app.listen(PORT, HOST, function () {"
);
patch(
    "Fix16b: add httpServer error handler after listen callback",
    "server/index.js",
    "    scheduler.start();\n});",
    "    scheduler.start();\n});\nhttpServer.on(\"error\", function (err) {\n    if (err.code === \"EADDRINUSE\") {\n        console.error(\"[HTTP] Port \" + PORT + \" already in use \u2014 exiting for clean PM2 restart\");\n        process.exit(1);\n    }\n    throw err;\n});"
);

// ============================================================
// Fix17 — server/index.js: normalize sysId (strip leading zeros) in 8000 handler
// Affects devices whose code has leading zeros (e.g. "00001125" → "1125").
// No-op for devices without leading zeros (e.g. "10001125" stays "10001125").
// ============================================================
patch(
    "Fix17: strip leading zeros from sysId in 8000 handler so deviceClockDrift key matches",
    "server/index.js",
    "        var sysId = clean.substring(25, 33);\n        var rest = clean.substring(33);",
    "        var sysId = clean.substring(25, 33).replace(/^0+/, \"\") || \"0\";\n        var rest = clean.substring(33);"
);

// ============================================================
// Fix18 — server/index.js: clear deviceClockDrift when socket closes after 0012
// ROOT CAUSE: pendingSyncs is cleaned on disconnect but deviceClockDrift is NOT.
// If firmware never sends 8012 ACK (which logs show it doesn't for RATCX1),
// deviceClockDrift stays at 13M minutes forever → infinite 0012 loop → no data.
// Fix: delete deviceClockDrift[deviceId] in end/error handlers AND in max-retry.
// ============================================================
patch(
    "Fix18a: clear deviceClockDrift on socket end (was keeping drift forever → infinite 0012 loop)",
    "server/index.js",
    "        // Clean up pending time syncs\n        if (deviceId && pendingSyncs[deviceId]) {\n            clearTimeout(pendingSyncs[deviceId].timer);\n            delete pendingSyncs[deviceId];\n        }\n        // Mark device offline when it disconnects",
    "        // Clean up pending time syncs\n        if (deviceId && pendingSyncs[deviceId]) {\n            clearTimeout(pendingSyncs[deviceId].timer);\n            delete pendingSyncs[deviceId];\n            // Clear drift so next connection takes the data-poll path.\n            // The firmware may not send 8012 ACK; if the socket closes without ACK,\n            // assume 0012 was processed and let the next connection try 0197.\n            delete deviceClockDrift[deviceId];\n        }\n        // Mark device offline when it disconnects"
);
patch(
    "Fix18b: clear deviceClockDrift in socket error handler",
    "server/index.js",
    "        // Clean up pending time syncs\n        if (deviceId && pendingSyncs[deviceId]) {\n            clearTimeout(pendingSyncs[deviceId].timer);\n            delete pendingSyncs[deviceId];\n        }\n        if (deviceId) {\n            try { db.prepare(\"UPDATE devices SET status = 'offline' WHERE device_code = ?\").run(deviceId); } catch(e){}\n        }\n        console.error(\"[TCP] Error from \" + clientIP",
    "        // Clean up pending time syncs\n        if (deviceId && pendingSyncs[deviceId]) {\n            clearTimeout(pendingSyncs[deviceId].timer);\n            delete pendingSyncs[deviceId];\n            delete deviceClockDrift[deviceId]; // clear drift so next connection tries data poll\n        }\n        if (deviceId) {\n            try { db.prepare(\"UPDATE devices SET status = 'offline' WHERE device_code = ?\").run(deviceId); } catch(e){}\n        }\n        console.error(\"[TCP] Error from \" + clientIP"
);
patch(
    "Fix18c: clear deviceClockDrift in syncDeviceTime max-retry handler",
    "server/index.js",
    "            console.log(\"[TCP] TIME_SYNC failed for \" + deviceCode + \" after 3 retries — next connection will retry\");\n            // Do NOT call startDataRequests here: the socket is likely destroyed\n            // (device CIPSHUTs after each command).  The next 8000 connection will\n            // call startDevicePoll which will retry 0012 if drift is still large.\n            delete pendingSyncs[deviceCode];",
    "            console.log(\"[TCP] TIME_SYNC failed for \" + deviceCode + \" after 3 retries — clearing drift so next connection polls data\");\n            delete pendingSyncs[deviceCode];\n            // Clear drift so the next 8000 connection takes the data-poll path.\n            // The device may not implement 8012 ACK; clearing here prevents the\n            // infinite 0012-only loop.\n            delete deviceClockDrift[deviceCode];"
);

// ============================================================
// Fix19 — server/index.js: use device-adjusted time in 0197 requests
// When device RTC battery is dead (year=2000), server time requests (2026) never
// match device's stored intervals → no data returned.
// Fix: store device's reported clock in deviceLastSeen and use it (+ elapsed)
// as the reference timestamp for 0197 commands.
// ============================================================
patchRegex(
    "Fix19a: add deviceLastSeen tracking variable",
    "server/index.js",
    /\/\/ Track clock drift per device \(device_code -> drift in minutes\)\nvar deviceClockDrift = \{\};/,
    // skipStr: already applied marker
    "var deviceLastSeen = {};",
    // replaceStr (5th param — was missing before, causing undefined replacement bug!)
    "// Track clock drift per device (device_code -> drift in minutes)\nvar deviceClockDrift = {};\n\n// Track device's last known reported time (device_code -> { devTime: Date, serverTime: Date })\n// Used to send 0197 with device-matching timestamps even when RTC is dead\nvar deviceLastSeen = {};"
);
patchRegex(
    "Fix19b: save deviceLastSeen in 8000 processRawData handler",
    "server/index.js",
    /\/\/ Store drift so startDevicePoll can decide whether to request old data\n            deviceClockDrift\[sysId\] = driftM;/,
    // skipStr
    "deviceLastSeen[sysId] = { devTime: devDate, serverTime: new Date() };",
    // replaceStr
    "// Store device's reported time for use in 0197 requests\n            // (so we can send 0197 with device-matching timestamps even when RTC is dead)\n            if (!isNaN(devDate.getTime())) {\n                deviceLastSeen[sysId] = { devTime: devDate, serverTime: new Date() };\n            }\n            // Store drift so startDevicePoll can decide whether to request old data\n            deviceClockDrift[sysId] = driftM;"
);
patchRegex(
    "Fix19c: update startDataRequests to use device-adjusted time for 0197",
    "server/index.js",
    /function startDataRequests\(deviceCode, socket\) \{\n    if \(socket\.destroyed\) return;\n\n    \/\/ Request the last COMPLETED 5-minute interval \(current - 5 min\)\n    var now = new Date\(\);\n    var t = new Date\(now\.getTime\(\) - 5 \* 60 \* 1000\);\n    t\.setMinutes\(Math\.floor\(t\.getMinutes\(\) \/ 5\) \* 5, 0, 0\);\n    var ts = formatPollTimestamp\(t\);\n\n    var cmd = "0197" \+ ts;\n    sendToDevice\(deviceCode, socket, cmd, "DATA_REQ"\);\n    console\.log\("\[TCP\] Sent single 0197 for device " \+ deviceCode \+ " interval " \+ ts\);\n\}/,
    // skipStr
    "Fix25: Use last stored DB record",
    // replaceStr
    "function startDataRequests(deviceCode, socket) {\n    if (socket.destroyed) return;\n\n    var now = new Date();\n    var seen = deviceLastSeen[deviceCode];\n    var refTime;\n\n    if (seen && !isNaN(seen.devTime.getTime())) {\n        // Use device's reported time adjusted for elapsed time since handshake.\n        // This works even when the device RTC battery is dead (year=2000).\n        var elapsedMs = Math.max(0, now.getTime() - seen.serverTime.getTime());\n        refTime = new Date(seen.devTime.getTime() + elapsedMs - 5 * 60 * 1000);\n        console.log(\"[TCP] 0197 using device-clock ref: devTime=\" + seen.devTime.toISOString() +\n            \" elapsed=\" + Math.round(elapsedMs / 1000) + \"s ref=\" + refTime.toISOString());\n    } else {\n        refTime = new Date(now.getTime() - 5 * 60 * 1000);\n    }\n    refTime.setMinutes(Math.floor(refTime.getMinutes() / 5) * 5, 0, 0);\n\n    var ts = formatPollTimestamp(refTime);\n    var cmd = \"0197\" + ts;\n    sendToDevice(deviceCode, socket, cmd, \"DATA_REQ\");\n    console.log(\"[TCP] Sent single 0197 for device \" + deviceCode + \" interval \" + ts);\n}"
);

// ============================================================
// Fix20 — server/index.js: socket.setNoDelay(true) for immediate command delivery
// Without this, Nagle's algorithm may buffer small packets, delaying 0012/0197.
// ============================================================
patch(
    "Fix20: socket.setNoDelay(true) — disable Nagle for immediate command delivery",
    "server/index.js",
    "    var clientIP = socket.remoteAddress || \"\";\n    var buffer = \"\";\n    var deviceId = null;\n    var pollStarted = false;\n    console.log(\"[TCP] New connection from \" + clientIP);",
    "    var clientIP = socket.remoteAddress || \"\";\n    var buffer = \"\";\n    var deviceId = null;\n    var pollStarted = false;\n    socket.setNoDelay(true); // disable Nagle — send commands immediately without buffering\n    console.log(\"[TCP] New connection from \" + clientIP);"
);

// ============================================================
// Fix21 — server/index.js: don't subtract 5min for dead-clock devices (year<2020)
// When device clock is stuck at 2000.01.01, the -5min pushed refTime to 1999.
// Fix: use devTime+elapsed directly for dead-clock devices.
// ============================================================
patch(
    "Fix21: 0197 no -5min offset for dead-clock devices (year<2020)",
    "server/index.js",
    "        var elapsedMs = Math.max(0, now.getTime() - seen.serverTime.getTime());\n        refTime = new Date(seen.devTime.getTime() + elapsedMs - 5 * 60 * 1000);\n        console.log(\"[TCP] 0197 using device-clock ref: devTime=\" + seen.devTime.toISOString() +\n            \" elapsed=\" + Math.round(elapsedMs / 1000) + \"s ref=\" + refTime.toISOString());",
    "        var elapsedMs = Math.max(0, now.getTime() - seen.serverTime.getTime());\n        var deadClock = seen.devTime.getFullYear() < 2020;\n        refTime = new Date(seen.devTime.getTime() + elapsedMs - (deadClock ? 0 : 5 * 60 * 1000));\n        console.log(\"[TCP] 0197 using device-clock ref: devTime=\" + seen.devTime.toISOString() +\n            \" elapsed=\" + Math.round(elapsedMs / 1000) + \"s ref=\" + refTime.toISOString() + (deadClock ? \" [dead-clock]\" : \"\"));"
);

// ============================================================
// Fix22a — server/index.js: track intervalCount + lastDataReqTs on socket
// ============================================================
patch(
    "Fix22a: init socket._intervalCount and _lastDataReqTs in checkHandshake",
    "server/index.js",
    "                connectedDevices[deviceId] = socket;\n                socket._connectedAt = new Date().toISOString();\n                console.log(\"[TCP] Device \" + deviceId + \" registered for commands\");",
    "                connectedDevices[deviceId] = socket;\n                socket._connectedAt = new Date().toISOString();\n                socket._intervalCount = 0;  // count 8821 responses per connection\n                socket._lastDataReqTs = null;\n                console.log(\"[TCP] Device \" + deviceId + \" registered for commands\");"
);

// ============================================================
// Fix22b — server/index.js: after 8012 ACK send 0197 immediately
// The device has NOT CIPSHUTted — it's waiting for the data request.
// ============================================================
patch(
    "Fix22b: after 8012 ACK send 0197 immediately (device waiting for data request)",
    "server/index.js",
    "        // Clear drift so next 8000 connection takes the \"normal data poll\" path\n        delete deviceClockDrift[sid];",
    "        // Clear drift so next 8000 connection takes the \"normal data poll\" path\n        delete deviceClockDrift[sid];\n\n        // IMPORTANT: After 8012 ACK the device has NOT CIPSHUTted — it is waiting\n        // for a 0197 data request.  Send it immediately using the old device-clock\n        // reference (deviceLastSeen still holds the pre-sync 2000.01.01 time so the\n        // 0197 timestamp will match the intervals stored in the device's buffer).\n        var activeSock = connectedDevices[sid] || socket;\n        if (activeSock && !activeSock.destroyed) {\n            startDataRequests(sid, activeSock);\n        }"
);

// ============================================================
// Fix23 — server/index.js: after 8821 send next 0197 to drain device buffer
// The device stays connected and sends all buffered intervals one by one.
// ============================================================
patch(
    "Fix23: after 8821 data send next 0197 to drain device buffer (max 200 per connection)",
    "server/index.js",
    "            detail: \"تردد=\" + totalAll + \" باتری=\" + parsed.battery + \" سولار=\" + parsed.solar + \" خطا=\" + parsed.error_byte\n        });\n        return;\n    }",
    "            detail: \"تردد=\" + totalAll + \" باتری=\" + parsed.battery + \" سولار=\" + parsed.solar + \" خطا=\" + parsed.error_byte\n        });\n\n        // Request next 5-min interval: device stays connected until its buffer is drained.\n        // Limit to 200 intervals per connection to prevent runaway loops.\n        var sock = connectedDevices[parsed.device_code];\n        if (sock && !sock.destroyed) {\n            if (!sock._intervalCount) sock._intervalCount = 0;\n            sock._intervalCount++;\n            if (sock._intervalCount < 200) {\n                var nextStart = new Date(new Date(parsed.create_at).getTime() + 5 * 60 * 1000);\n                nextStart.setSeconds(0, 0);\n                var nextTs = formatPollTimestamp(nextStart);\n                sendToDevice(parsed.device_code, sock, \"0197\" + nextTs, \"DATA_REQ_NEXT #\" + sock._intervalCount);\n            } else {\n                console.log(\"[TCP] Max 200 intervals per connection reached for \" + parsed.device_code + \" \u2014 stopping poll\");\n            }\n        }\n        return;\n    }"
);

// ============================================================
// Fix24 — server/index.js: remove zero-vehicle filter in ratcx1ToIrawdata
// Zero-vehicle intervals should still be stored so the reception view shows data.
// ============================================================
patch(
    "Fix24: store zero-vehicle intervals (remove totalCount===0 skip filter)",
    "server/index.js",
    "        var totalCount = d.a.count + d.b.count + d.c.count + d.d.count + d.e.count + d.x.count;\n        if (totalCount === 0) return; // skip empty lane\n        rows.push({",
    "        rows.push({"
);

// ============================================================
// Fix25 — server/index.js: startDataRequests uses DB last record
// Request the interval AFTER the last stored one, not device-clock-based guessing.
// ============================================================
patch(
    "Fix25: startDataRequests uses DB last record + 5min instead of dead-clock ref",
    "server/index.js",
    "    if (seen && !isNaN(seen.devTime.getTime())) {\n        // Use device's reported time + elapsed wall time since it connected.\n        // This works even when the device RTC battery is dead (year=2000).\n        // NOTE: when device clock is dead (year<2020), do NOT subtract 5min because\n        // that would push refTime into 1999 and the device has no such intervals.\n        var elapsedMs = Math.max(0, now.getTime() - seen.serverTime.getTime());\n        var deadClock = seen.devTime.getFullYear() < 2020;\n        refTime = new Date(seen.devTime.getTime() + elapsedMs - (deadClock ? 0 : 5 * 60 * 1000));\n        console.log(\"[TCP] 0197 using device-clock ref: devTime=\" + seen.devTime.toISOString() +\n            \" elapsed=\" + Math.round(elapsedMs / 1000) + \"s ref=\" + refTime.toISOString() + (deadClock ? \" [dead-clock]\" : \"\"));\n    } else {\n        // Fallback: use server time\n        refTime = new Date(now.getTime() - 5 * 60 * 1000);\n    }\n    refTime.setMinutes(Math.floor(refTime.getMinutes() / 5) * 5, 0, 0);",
    "    // Fix25: Use last stored DB record + 5min so we continue from where we left off.\n    try {\n        var lastRec = db.prepare(\"SELECT create_at FROM irawdata WHERE device_code = ? ORDER BY create_at DESC LIMIT 1\").get(deviceCode);\n        if (lastRec && lastRec.create_at) {\n            var lastDate = new Date(lastRec.create_at);\n            if (!isNaN(lastDate.getTime()) && lastDate.getFullYear() >= 2000) {\n                refTime = new Date(lastDate.getTime() + 5 * 60 * 1000);\n                console.log(\"[TCP] 0197 using DB last record: last=\" + lastRec.create_at + \" next=\" + refTime.toISOString());\n            }\n        }\n    } catch (e) { /* DB not ready yet */ }\n\n    if (!refTime) {\n        refTime = new Date(now.getTime() - 5 * 60 * 1000);\n        console.log(\"[TCP] 0197 no DB record for \" + deviceCode + \" \u2014 using server time - 5min: \" + refTime.toISOString());\n    }\n    if (refTime.getTime() > now.getTime()) {\n        refTime = new Date(now.getTime() - 5 * 60 * 1000);\n    }\n    refTime.setSeconds(0, 0);\n    refTime.setMinutes(Math.floor(refTime.getMinutes() / 5) * 5);"
);

// ============================================================
// Fix26 — server/index.js: skip old intervals in 8821 drain loop
// If interval is >1 hour behind server time, jump to server_time-5min.
// ============================================================
patch(
    "Fix26: 8821 drain loop — skip to server time when interval is >1 hour behind",
    "server/index.js",
    "            if (sock._intervalCount < 200) {\n                var nextStart = new Date(new Date(parsed.create_at).getTime() + 5 * 60 * 1000);\n                nextStart.setSeconds(0, 0);\n                var nextTs = formatPollTimestamp(nextStart);",
    "            if (sock._intervalCount < 200) {\n                var dataDate = new Date(parsed.create_at);\n                var srvNowFix26 = new Date();\n                var behindMs = srvNowFix26.getTime() - dataDate.getTime();\n                var nextStart;\n                if (!isNaN(dataDate.getTime()) && behindMs > 60 * 60 * 1000) {\n                    nextStart = new Date(srvNowFix26.getTime() - 5 * 60 * 1000);\n                    console.log(\"[TCP] Fix26: \" + parsed.device_code + \" interval \" + parsed.create_at +\n                        \" is \" + Math.round(behindMs / 60000) + \"min behind \u2014 jumping to \" + nextStart.toISOString());\n                } else {\n                    nextStart = new Date(dataDate.getTime() + 5 * 60 * 1000);\n                }\n                nextStart.setSeconds(0, 0);\n                nextStart.setMinutes(Math.floor(nextStart.getMinutes() / 5) * 5);\n                var nextTs = formatPollTimestamp(nextStart);"
);

// ============================================================
// Fix27 — server/index.js: restore missing var deviceClockDrift = {}
// ROOT CAUSE: Fix19a had a bug — patchRegex was called with 4 args instead of 5.
// The 4th arg was treated as skipStr; replaceStr was `undefined`.
// So src.replace(regex, undefined) replaced the matched text with "undefined" string.
// Fix27a: robust patchRegex that handles "undefined" where deviceClockDrift should be.
// Fix27b: direct file write if deviceClockDrift is still absent after 27a.
// ============================================================
patchRegex(
    "Fix27a: restore var deviceClockDrift = {} — replace 'undefined' left by Fix19a bug",
    "server/index.js",
    // Match "undefined" sitting alone on a line between pendingSyncs and whatever follows
    /var pendingSyncs = \{\};\s*\n+undefined\s*\n/,
    // skipStr: if deviceClockDrift is already properly declared, skip
    "var deviceClockDrift = {};",
    // replaceStr
    "var pendingSyncs = {};\n\n// Track clock drift per device (device_code -> drift in minutes)\nvar deviceClockDrift = {};\n\n"
);
// Fix27b: fallback — if deviceClockDrift is STILL missing after Fix27a,
// inject the declaration before the TCP Time sync comment block.
(function fix27b() {
    var abs = path.join(ROOT, "server/index.js");
    if (!fs.existsSync(abs)) return;
    var src = fs.readFileSync(abs, "utf8");
    if (src.indexOf("var deviceClockDrift") !== -1) {
        console.log("[SKIP] Fix27b: var deviceClockDrift = {} — already present");
        skip++;
        return;
    }
    var marker = "// ============================================================\n// TCP: Time sync";
    if (src.indexOf(marker) === -1) {
        console.log("[WARN] Fix27b: TCP Time sync marker not found — cannot inject deviceClockDrift");
        fail++;
        return;
    }
    fs.writeFileSync(abs + ".patch22.bak", src);
    var injection = "// Track clock drift per device (device_code -> drift in minutes)\nvar deviceClockDrift = {};\n\n" +
        "// Track device's last known reported time (device_code -> { devTime: Date, serverTime: Date })\n" +
        "// Used to send 0197 with device-matching timestamps even when RTC is dead\nvar deviceLastSeen = {};\n\n";
    fs.writeFileSync(abs, src.replace(marker, injection + marker));
    console.log("[OK]   Fix27b: injected var deviceClockDrift = {} and var deviceLastSeen = {} before TCP section");
    ok++;
}());

// ============================================================
// Fix29: RMTO per-interval pipeline (Add5 + irawdata columns)
// ============================================================

// Fix29a: Add RMTO columns to irawdata in db.js
patch("Fix29a: irawdata RMTO columns in db.js",
    "server/db.js",
    `    "CREATE TABLE IF NOT EXISTS settings (",
    "  key TEXT PRIMARY KEY,",
    "  value TEXT",
    ");"
].join("\\n"));`,
    `    "CREATE TABLE IF NOT EXISTS settings (",
    "  key TEXT PRIMARY KEY,",
    "  value TEXT",
    ");"
].join("\\n"));

// Add RMTO tracking columns to irawdata (safe migration for existing databases)
["rmto_id INTEGER", "rmto_cfl INTEGER", "rmto_srvdt TEXT", "rmto_bil INTEGER", "rmto_err TEXT"].forEach(function (col) {
    try { db.exec("ALTER TABLE irawdata ADD COLUMN " + col); } catch (e) { /* already exists */ }
});

// Reset any in-flight records (rmto_id = -1) left by a previous crash
try { db.exec("UPDATE irawdata SET rmto_id = NULL WHERE rmto_id = -1"); } catch (e) {}`
);

// Fix29b: Add sendAdd5() to rmto-client.js
patch("Fix29b: sendAdd5() in rmto-client.js",
    "server/rmto-client.js",
    "module.exports = {\n    initClient: initClient,\n    sendAddData: sendAddData,\n    sendAddData5: sendAddData5,\n    sendAddData8: sendAddData8\n};",
    `
/** Add5 SOAP method — matches Companies.asmx WSDL exactly */
function sendAdd5(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);
        var isNull = (data.c1 == null);
        var args = {
            CID: parseInt(COMPANY_CODE, 10) || 58,
            UID: USERNAME, PWD: PASSWORD,
            FID: data.fid, RID: data.rid, ST: data.st, ET: data.et,
            C1: isNull ? null : (data.c1 || 0), C2: isNull ? null : (data.c2 || 0),
            C3: isNull ? null : (data.c3 || 0), C4: isNull ? null : (data.c4 || 0),
            C5: isNull ? null : (data.c5 || 0), ASP: isNull ? null : (data.asp || 0),
            S1: isNull ? null : (data.s1 || 0), S2: isNull ? null : (data.s2 || 0),
            S3: isNull ? null : (data.s3 || 0), S4: isNull ? null : (data.s4 || 0),
            S5: isNull ? null : (data.s5 || 0), SSO: isNull ? null : (data.sso || 0),
            SO1: isNull ? null : (data.so1 || 0), SO2: isNull ? null : (data.so2 || 0),
            SO3: isNull ? null : (data.so3 || 0), SO4: isNull ? null : (data.so4 || 0),
            SO5: isNull ? null : (data.so5 || 0), OO: isNull ? null : (data.oo || 0),
            ESD: isNull ? null : (data.esd || 0)
        };
        console.log("[RMTO] Add5 fid=" + data.fid + " rid=" + data.rid + " total=" + ((data.c1||0)+(data.c2||0)+(data.c3||0)+(data.c4||0)+(data.c5||0)));
        soapClient.Add5(args, function (err, result) {
            if (err) { console.error("[RMTO] Add5 error:", err.message); return callback(err, null); }
            var response = result && result.Add5Result;
            callback(null, response);
        });
    });
}

module.exports = {
    initClient: initClient,
    sendAddData: sendAddData,
    sendAddData5: sendAddData5,
    sendAddData8: sendAddData8,
    sendAdd5: sendAdd5
};`
);

// Fix29c: processAndSendIrawdata() in scheduler.js
patch("Fix29c: processAndSendIrawdata() in scheduler.js",
    "server/scheduler.js",
    "module.exports = {\n    start: start,\n    aggregateAndSend: aggregateAndSend,\n    sendUnsentData: sendUnsentData,\n    checkOfflineDevices: checkOfflineDevices\n};",
    `
function processAndSendIrawdata() {
    var companyCode = 58;
    try { var r = db.prepare("SELECT value FROM settings WHERE key = 'rmto_company_code'").get(); companyCode = parseInt((r && r.value) || "58", 10) || 58; } catch (e) {}
    var rows;
    try { rows = db.prepare("SELECT * FROM irawdata WHERE rmto_id IS NULL ORDER BY create_at ASC LIMIT 100").all(); } catch (e) { return; }
    if (!rows || rows.length === 0) return;
    console.log("[Scheduler] processAndSendIrawdata: " + rows.length + " record(s) to send");
    rows.forEach(function (row) {
        try { db.prepare("UPDATE irawdata SET rmto_id = -1 WHERE id = ? AND rmto_id IS NULL").run(row.id); } catch (e) { return; }
        var a = row.a||0, b = row.b||0, c = row.c||0, d = row.d||0, e5 = (row.e||0)+(row.x||0);
        var total = a+b+c+d+e5;
        var sa = row.sa||0, sb = row.sb||0, sc = row.sc||0, sd = row.sd||0, se = (row.se||0)+(row.sx||0);
        var asp = total > 0 ? Math.round((sa+sb+sc+sd+se)/total) : 0;
        var s1 = a>0 ? Math.round(sa/a) : 0, s2 = b>0 ? Math.round(sb/b) : 0;
        var s3 = c>0 ? Math.round(sc/c) : 0, s4 = d>0 ? Math.round(sd/d) : 0;
        var s5 = e5>0 ? Math.round(se/e5) : 0;
        var so1=row.sao||0, so2=row.sbo||0, so3=row.sco||0, so4=row.sdo||0, so5=(row.seo||0)+(row.sxo||0);
        var isNull = (total === 0);
        rmto.sendAdd5({ cid: companyCode, fid: row.id, rid: parseInt(row.device_code,10)||0,
            st: row.create_at, et: row.stop,
            c1: isNull?null:a, c2: isNull?null:b, c3: isNull?null:c, c4: isNull?null:d, c5: isNull?null:e5,
            asp: isNull?null:asp, s1: isNull?null:s1, s2: isNull?null:s2, s3: isNull?null:s3, s4: isNull?null:s4, s5: isNull?null:s5,
            sso: isNull?null:(so1+so2+so3+so4+so5), so1: isNull?null:so1, so2: isNull?null:so2, so3: isNull?null:so3, so4: isNull?null:so4, so5: isNull?null:so5,
            oo: row.overtaking||0, esd: row.tooclose||0
        }, function (err, response) {
            try {
                var rmtoId = 0, cfl = null, srvdt = null, bil = null, errMsg = null;
                if (isNull) { rmtoId = 1; cfl = 0; bil = 0; errMsg = "NULL SENT"; }
                else if (response) { rmtoId = response.ID||0; cfl = response.CFL||0; srvdt = response.SRVDT?String(response.SRVDT):null; bil = response.BIL||0; errMsg = response.ERR||null; }
                else { rmtoId = 0; errMsg = err ? err.message : "no response"; }
                db.prepare("UPDATE irawdata SET rmto_id=?, rmto_cfl=?, rmto_srvdt=?, rmto_bil=?, rmto_err=? WHERE id=?").run(rmtoId, cfl, srvdt, bil, errMsg, row.id);
                db.prepare("INSERT INTO send_log (method,device_code,request_data,response_data,success,error_message) VALUES (?,?,?,?,?,?)").run("Add5", row.device_code, JSON.stringify({fid:row.id,rid:row.device_code,st:row.create_at,et:row.stop,total:total}), JSON.stringify(response), (rmtoId&&rmtoId>0)?1:0, errMsg);
            } catch (dbErr) { console.error("[Scheduler] RMTO update error:", dbErr.message); }
        });
    });
}

module.exports = {
    start: start,
    aggregateAndSend: processAndSendIrawdata,
    processAndSendIrawdata: processAndSendIrawdata,
    sendUnsentData: sendUnsentData,
    checkOfflineDevices: checkOfflineDevices
};`
);

// Fix29d: /api/rmto/queue in index.js
patch("Fix29d: /api/rmto/queue shows irawdata records",
    "server/index.js",
    "app.post(\"/api/rmto/send-now\", function (req, res) {\n    scheduler.sendUnsentData();\n    res.json({ success: true });\n});\n\napp.post(\"/api/rmto/aggregate\", function (req, res) {\n    scheduler.aggregateAndSend();\n    res.json({ success: true });\n});\n\napp.get(\"/api/rmto/queue\", function (req, res) {\n    var unsent = db.prepare(\"SELECT device_code, period_start, total_vehicles, avg_speed, created_at FROM rmto_queue WHERE sent = 0 ORDER BY period_start DESC LIMIT 100\").all();\n    var sent = db.prepare(\"SELECT device_code, period_start, total_vehicles, avg_speed, sent_at, rmto_response FROM rmto_queue WHERE sent = 1 ORDER BY sent_at DESC LIMIT 50\").all();\n    res.json({ unsent: unsent, sent: sent });\n});",
    `app.post("/api/rmto/send-now", function (req, res) {
    scheduler.processAndSendIrawdata();
    scheduler.sendUnsentData();
    res.json({ success: true });
});

app.post("/api/rmto/aggregate", function (req, res) {
    scheduler.processAndSendIrawdata();
    res.json({ success: true });
});

app.get("/api/rmto/queue", function (req, res) {
    var unsent = db.prepare("SELECT id, device_code, create_at, stop, (a+b+c+d+e+x) as total_vehicles, CASE WHEN (a+b+c+d+e+x)>0 THEN ROUND((sa+sb+sc+sd+se+sx)*1.0/(a+b+c+d+e+x)) ELSE 0 END as avg_speed, received_at as created_at FROM irawdata WHERE (rmto_id IS NULL OR rmto_id = 0) ORDER BY create_at DESC LIMIT 100").all();
    var sent = db.prepare("SELECT id, device_code, create_at, stop, (a+b+c+d+e+x) as total_vehicles, CASE WHEN (a+b+c+d+e+x)>0 THEN ROUND((sa+sb+sc+sd+se+sx)*1.0/(a+b+c+d+e+x)) ELSE 0 END as avg_speed, rmto_id, rmto_cfl, rmto_srvdt, rmto_bil, rmto_err FROM irawdata WHERE rmto_id IS NOT NULL AND rmto_id > 0 ORDER BY create_at DESC LIMIT 50").all();
    res.json({ unsent: unsent, sent: sent });
});`
);

// ============================================================
// Fix30 — منطقه زمانی ایران (CRITICAL: device clocks + data timestamps)
// ============================================================
// Fix30a: server/index.js — before require("dotenv")
patch("Fix30a: set TZ=Asia/Tehran in server/index.js (fix UTC device clock + empty data)",
    "server/index.js",
    ' */\nrequire("dotenv").config();',
    ' */\n// Set Iran Standard Time (UTC+3:30) BEFORE any require() or Date operation.\n// Without this, a UTC-timezone VPS sends UTC time via 0012 → device clocks are\n// 3.5 hours wrong → 0197 requests miss stored intervals → data appears empty.\nif (!process.env.TZ) process.env.TZ = "Asia/Tehran";\nrequire("dotenv").config();'
);

// Fix30b: server/scheduler.js — before require("node-cron")
patch("Fix30b: set TZ=Asia/Tehran in server/scheduler.js",
    "server/scheduler.js",
    ' */\nvar cron = require("node-cron");',
    ' */\n// Set Iran timezone before any Date operations (mirrors server/index.js)\nif (!process.env.TZ) process.env.TZ = "Asia/Tehran";\nvar cron = require("node-cron");'
);

// Fix30c: server/db.js — before require("better-sqlite3")
patch("Fix30c: set TZ=Asia/Tehran in server/db.js (affects SQLite localtime)",
    "server/db.js",
    ' */\nvar Database = require("better-sqlite3");',
    ' */\n// Set Iran timezone before any SQLite `datetime(\'now\',\'localtime\')` calls\nif (!process.env.TZ) process.env.TZ = "Asia/Tehran";\nvar Database = require("better-sqlite3");'
);

// Fix30d: create ecosystem.config.js for PM2 (sets TZ before node process starts)
(function() {
    var ecosystemPath = path.join(ROOT, "ecosystem.config.js");
    var ecosystemContent = [
        "module.exports = {",
        "    apps: [{",
        "        name: \"tc-manager\",",
        "        script: \"server/index.js\",",
        "        cwd: \"/opt/tc-manager\",",
        "        instances: 1,",
        "        autorestart: true,",
        "        watch: false,",
        "        max_memory_restart: \"300M\",",
        "        env: {",
        "            NODE_ENV: \"production\",",
        "            TZ: \"Asia/Tehran\"",
        "        }",
        "    }]",
        "};"
    ].join("\n");
    if (fs.existsSync(ecosystemPath)) {
        var existing = fs.readFileSync(ecosystemPath, "utf8");
        if (existing.indexOf("Asia/Tehran") !== -1) {
            console.log("[SKIP] Fix30d: ecosystem.config.js — already applied");
            skip++;
        } else {
            fs.writeFileSync(ecosystemPath, ecosystemContent);
            console.log("[OK]   Fix30d: ecosystem.config.js — TZ=Asia/Tehran added to PM2 config");
            ok++;
        }
    } else {
        fs.writeFileSync(ecosystemPath, ecosystemContent);
        console.log("[OK]   Fix30d: ecosystem.config.js — created with TZ=Asia/Tehran");
        ok++;
    }
})();

// Fix31a: remove over-aggressive timestamp correction in 8821 handler
// (was correcting ALL >30min-old timestamps to "now" → UNIQUE collision → irawdata empty)
patchRegex("Fix31a: only correct future/dead-clock timestamps in 8821 handler (main data-loss bug)",
    "server/index.js",
    /if \(!isNaN\(deviceTime\.getTime\(\)\)\) \{\s*var driftMs[\s\S]*?syncDeviceTime\([^)]+\);\s*\}\s*\}\s*\}/,
    "Fix31 correcting timestamp",
    'Fix31: Only correct FUTURE timestamps (device clock ahead) or dead-clock (year<2020).\n        // Past valid-year timestamps are backlogged intervals requested via 0197 and must be\n        // stored with their original time.  Correcting all >30min-old timestamps to "now"\n        // caused every interval to get the same bucket → INSERT OR IGNORE discarded all but\n        // the first → irawdata appeared empty.\n        if (!isNaN(deviceTime.getTime())) {\n            var isFuture = deviceTime.getTime() > serverNow.getTime() + 10 * 60 * 1000; // >10min ahead\n            var isDeadClock = deviceTime.getFullYear() < 2020;\n            if (isFuture || isDeadClock) {\n                var corrected = new Date(serverNow);\n                corrected.setMinutes(Math.floor(corrected.getMinutes() / 5) * 5, 0, 0);\n                var correctedStr = corrected.getFullYear() + "-" + String(corrected.getMonth() + 1).padStart(2, "0") + "-" + String(corrected.getDate()).padStart(2, "0") + "T" + String(corrected.getHours()).padStart(2, "0") + ":" + String(corrected.getMinutes()).padStart(2, "0") + ":00";\n                var reason = isFuture ? "ساعت دستگاه جلو است" : "ساعت دستگاه dead-clock (year<2020)";\n                console.log("[TCP] Fix31 correcting timestamp (" + reason + "): " + parsed.create_at + " -> " + correctedStr);\n                parsed.create_at = correctedStr;\n                timestampCorrected = true;\n                addLiveLog({ ts: Date.now(), time: serverNow.toISOString(), type: "tcp-ratcx1", ip: ip, device: parsed.device_code, detail: reason + " — زمان اصلاح شد به " + correctedStr });\n            } else {\n                var pastDriftMin = Math.round((serverNow.getTime() - deviceTime.getTime()) / 60000);\n                if (pastDriftMin > 5) {\n                    console.log("[TCP] Backlog interval: " + parsed.device_code + " create_at=" + parsed.create_at + " (" + pastDriftMin + "min ago) — stored as-is");\n                }\n            }\n        }'
);

// Fix32: add received_at migration to db.js (safety for old DBs)
patch("Fix32: add received_at migration to irawdata in db.js",
    "server/db.js",
    '["rmto_id INTEGER", "rmto_cfl INTEGER", "rmto_srvdt TEXT", "rmto_bil INTEGER", "rmto_err TEXT"].forEach(function (col) {',
    '["received_at TEXT DEFAULT (datetime(\'now\',\'localtime\'))", "rmto_id INTEGER", "rmto_cfl INTEGER", "rmto_srvdt TEXT", "rmto_bil INTEGER", "rmto_err TEXT"].forEach(function (col) {'
);


// Fix33: SIGTERM graceful shutdown + EADDRINUSE 8s delay (prevent crash loop)
patch("Fix33a: add SIGTERM handler before uncaughtException (prevents port-in-use crash loop)",
    "server/index.js",
    '// ============================================================\n// Global Error Handlers — prevent process crash on unexpected errors\n// ============================================================\nprocess.on("uncaughtException", function (err) {\n    if (err.code === "EADDRINUSE") {\n        console.error("[FATAL] Port already in use (" + (err.port || "unknown") + ") — exiting for clean PM2 restart");\n        process.exit(1);\n    }',
    '// ============================================================\n// Graceful shutdown — close servers so PM2 restart finds ports free\n// ============================================================\nfunction gracefulShutdown(signal) {\n    console.log("[SHUTDOWN] " + signal + " received — closing servers gracefully...");\n    tcpServer.close(function () { console.log("[SHUTDOWN] TCP server closed"); });\n    httpServer.close(function () {\n        console.log("[SHUTDOWN] HTTP server closed — exiting");\n        process.exit(0);\n    });\n    setTimeout(function () {\n        console.error("[SHUTDOWN] Force exit after 8s timeout");\n        process.exit(0);\n    }, 8000);\n}\nprocess.on("SIGTERM", function () { gracefulShutdown("SIGTERM"); });\nprocess.on("SIGINT",  function () { gracefulShutdown("SIGINT"); });\n\n// ============================================================\n// Global Error Handlers — prevent process crash on unexpected errors\n// ============================================================\nprocess.on("uncaughtException", function (err) {\n    if (err.code === "EADDRINUSE") {\n        console.error("[FATAL] Port already in use (" + (err.port || "unknown") + ") — waiting 8s then exiting for clean PM2 restart");\n        setTimeout(function () { process.exit(1); }, 8000);\n        return;\n    }'
);

patch("Fix33b: HTTP EADDRINUSE add 8s delay before exit (prevents tight crash loop)",
    "server/index.js",
    'console.error("[HTTP] Port " + PORT + " already in use \u2014 exiting for clean PM2 restart");\n        process.exit(1);',
    'console.error("[HTTP] Port " + PORT + " already in use \u2014 waiting 8s then exiting for clean PM2 restart");\n        setTimeout(function () { process.exit(1); }, 8000);\n        return;'
);

(function fix33c() {
    var ecoPath = "ecosystem.config.js";
    if (!fs.existsSync(ecoPath)) { skip++; return; }
    var eco = fs.readFileSync(ecoPath, "utf8");
    if (eco.includes("restart_delay")) { console.log("[SKIP] Fix33c: ecosystem.config.js restart_delay — already applied"); skip++; return; }
    // Insert restart_delay/kill_timeout after max_memory_restart line
    var updated = eco.replace(
        /max_memory_restart: "300M",/,
        'max_memory_restart: "300M",\n        restart_delay: 5000,\n        min_uptime: 3000,\n        kill_timeout: 10000,'
    );
    if (updated === eco) { console.log("[WARN] Fix33c: ecosystem.config.js — max_memory_restart not found"); fail++; return; }
    fs.writeFileSync(ecoPath, updated);
    console.log("[OK]   Fix33c: ecosystem.config.js — added restart_delay:5000 kill_timeout:10000");
    ok++;
})();

// Fix34: startDataRequests — skip stale DB records older than 4h (UTC-era records)
// When Fix30 (TZ=Asia/Tehran) is applied, old records have UTC timestamps (e.g. 17:15).
// These cause 0197 to request "2602271720" while device is at Iran 20:44 → device
// drains 48+ empty intervals before Fix26 jumps to current time → reception shows total=0.
patch("Fix34: skip stale DB record (>4h) in startDataRequests — prevents UTC-era empty intervals",
    "server/index.js",
    '    if (!refTime) {\n        // No DB record for this device: request last completed server-time interval\n        refTime = new Date(now.getTime() - 5 * 60 * 1000);\n        console.log("[TCP] 0197 no DB record for " + deviceCode + " \u2014 using server time - 5min: " + refTime.toISOString());\n    }\n\n    // If refTime is in the future, use server time - 5min instead\n    if (refTime.getTime() > now.getTime()) {\n        refTime = new Date(now.getTime() - 5 * 60 * 1000);\n    }',
    '    if (!refTime) {\n        // No DB record for this device: request last completed server-time interval\n        refTime = new Date(now.getTime() - 5 * 60 * 1000);\n        console.log("[TCP] 0197 no DB record for " + deviceCode + " \u2014 using server time - 5min: " + refTime.toISOString());\n    }\n\n    // Fix34: If refTime is more than 4 hours behind server time, the DB record is stale\n    // (e.g., stored before Fix30/TZ change when server was UTC, now server is Iran time).\n    // Requesting a 4h-old interval wastes connection cycles (device will drain 48+ empty\n    // intervals via Fix26 before reaching current time).  Jump directly to now - 5min.\n    var staleLimitMs = 4 * 60 * 60 * 1000; // 4 hours\n    if (now.getTime() - refTime.getTime() > staleLimitMs) {\n        console.log("[TCP] Fix34: stale DB record for " + deviceCode +\n            " (refTime=" + refTime.toISOString() + " is " +\n            Math.round((now.getTime() - refTime.getTime()) / 60000) +\n            "min behind server) \u2014 jumping to server time - 5min");\n        refTime = new Date(now.getTime() - 5 * 60 * 1000);\n    }\n\n    // If refTime is in the future, use server time - 5min instead\n    if (refTime.getTime() > now.getTime()) {\n        refTime = new Date(now.getTime() - 5 * 60 * 1000);\n    }'
);

// ============================================================
// نتیجه نهایی
// ============================================================
console.log("\n======================================");
console.log("نتیجه پچ:");
console.log("  ✅ اعمال شد:    " + ok);
console.log("  ⏩ از قبل بود:  " + skip);
if (fail > 0) console.log("  ❌ پیدا نشد:   " + fail + "  (بررسی دستی لازم)");
console.log("======================================");

if (ok > 0 && fail === 0) {
    console.log("\nقدم بعدی:");
    console.log("  pm2 restart tc-manager --update-env");
    console.log("  (--update-env ضروری است تا TZ=Asia/Tehran اعمال شود)");
} else if (skip > 0 && fail === 0 && ok === 0) {
    console.log("\nهمه پچ‌ها قبلاً اعمال شده‌اند — نیازی به restart نیست.");
} else if (fail >= 3) {
    console.log("\n⚠️  تعداد زیادی پچ پیدا نشدند (" + fail + " مورد).");
    console.log("   این به این معناست که نسخه فایل‌های سرور با الگوهای پچ فرق دارد.");
    console.log("   ===> از deploy-full.sh استفاده کنید که فایل‌ها را کامل جایگزین می‌کند: <===");
    console.log("");
    console.log("   wget -q \"https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/review-project-issues/deploy-full.sh\" -O deploy-full.sh");
    console.log("   bash deploy-full.sh");
    console.log("");
    console.log("   (پچ‌های اعمال‌شده امروز [OK] در بالا باقی می‌مانند — deploy-full.sh آنها را هم cover می‌کند)");
} else if (fail > 0) {
    console.log("\nبرخی پچ‌ها (" + fail + " مورد) اعمال نشدند.");
    if (ok > 0) console.log("  pm2 restart tc-manager");
    console.log("  لاگ WARN بالا را بررسی کنید یا از deploy-full.sh استفاده کنید.");
}
