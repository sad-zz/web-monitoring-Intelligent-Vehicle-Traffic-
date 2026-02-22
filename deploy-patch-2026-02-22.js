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
// نتیجه نهایی
// ============================================================
console.log("\n======================================");
console.log("نتیجه پچ:");
console.log("  ✅ اعمال شد:    " + ok);
console.log("  ⏩ از قبل بود:  " + skip);
if (fail > 0) console.log("  ❌ پیدا نشد:   " + fail + "  (بررسی دستی لازم)");
console.log("======================================");

if (ok > 0) {
    console.log("\nقدم بعدی:");
    console.log("  pm2 restart tc-manager");
} else if (skip > 0 && fail === 0) {
    console.log("\nهمه پچ‌ها قبلاً اعمال شده‌اند — نیازی به restart نیست.");
} else {
    console.log("\nبرخی پچ‌ها اعمال نشدند — لاگ بالا را بررسی کنید.");
}
