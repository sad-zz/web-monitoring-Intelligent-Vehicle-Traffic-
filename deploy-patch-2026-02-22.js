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
