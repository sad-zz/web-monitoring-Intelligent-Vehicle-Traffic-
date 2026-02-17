#!/bin/bash
# Part 4: Deploy CSS and app.js, then start service
set -e
cd /opt/tc-manager

echo "=== Deploying css/style.css ==="
mkdir -p css js

cat > css/style.css << 'ENDFILE'
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
:root { --sidebar-w: 240px; --sidebar-bg: #1e293b; --sidebar-active: #3b82f6; --topbar-h: 56px; --footer-h: 40px; --bg: #f1f5f9; --white: #ffffff; --border: #e2e8f0; --text: #334155; --text-light: #94a3b8; --primary: #3b82f6; --primary-dark: #2563eb; --success: #22c55e; --warning: #f59e0b; --error: #ef4444; --radius: 8px; --shadow: 0 1px 3px rgba(0,0,0,.08); --shadow-md: 0 4px 12px rgba(0,0,0,.1); }
body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; background: var(--bg); color: var(--text); direction: rtl; display: flex; min-height: 100vh; }
.sidebar { width: var(--sidebar-w); background: var(--sidebar-bg); color: #cbd5e1; display: flex; flex-direction: column; position: fixed; top: 0; right: 0; bottom: 0; z-index: 100; transition: transform .25s; }
.sidebar-header { padding: 20px 16px; border-bottom: 1px solid rgba(255,255,255,.08); }
.sidebar-logo { display: flex; align-items: center; gap: 12px; }
.logo-icon { width: 42px; height: 42px; background: var(--primary); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; color: white; letter-spacing: -1px; }
.logo-text { display: flex; flex-direction: column; }
.logo-title { font-size: 18px; font-weight: 700; color: white; }
.logo-sub { font-size: 11px; color: #64748b; }
.sidebar-nav { flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; }
.nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border: none; background: none; border-radius: var(--radius); color: #94a3b8; font-size: 14px; cursor: pointer; text-align: right; width: 100%; transition: all .15s; font-family: inherit; }
.nav-item:hover { background: rgba(255,255,255,.06); color: #e2e8f0; }
.nav-item.active { background: var(--sidebar-active); color: white; }
.nav-icon { width: 20px; height: 20px; fill: currentColor; flex-shrink: 0; }
.sidebar-footer { padding: 16px; border-top: 1px solid rgba(255,255,255,.08); }
.sidebar-user { display: flex; align-items: center; gap: 10px; }
.user-avatar { width: 36px; height: 36px; background: #475569; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; color: white; }
.user-info { display: flex; flex-direction: column; }
.user-name { font-size: 13px; color: #e2e8f0; }
.user-role { font-size: 11px; color: #64748b; }
.main-wrapper { margin-right: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
.topbar { height: var(--topbar-h); background: var(--white); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 24px; gap: 16px; position: sticky; top: 0; z-index: 50; }
.topbar-toggle { display: none; background: none; border: none; cursor: pointer; fill: var(--text); padding: 4px; }
.topbar-title { font-size: 16px; font-weight: 700; color: var(--text); }
.topbar-left { margin-right: auto; display: flex; align-items: center; gap: 12px; }
.topbar-time { font-size: 13px; color: var(--text-light); direction: ltr; }
.topbar-badge { font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: 600; }
.topbar-badge.online { background: rgba(34,197,94,.12); color: var(--success); }
.content { flex: 1; padding: 24px; }
.view { display: none; }
.view.active { display: block; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { background: var(--white); border-radius: var(--radius); padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: var(--shadow); }
.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.stat-icon svg { width: 24px; height: 24px; fill: white; }
.stat-icon.blue { background: var(--primary); }
.stat-icon.green { background: var(--success); }
.stat-icon.orange { background: var(--warning); }
.stat-icon.red { background: var(--error); }
.stat-body { display: flex; flex-direction: column; }
.stat-value { font-size: 26px; font-weight: 800; color: var(--text); direction: ltr; text-align: right; }
.stat-label { font-size: 12px; color: var(--text-light); margin-top: 2px; }
.panel { background: var(--white); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 12px; }
.panel-title { font-size: 15px; font-weight: 700; color: var(--text); }
.panel-tools { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.panel-body { padding: 20px; }
.export-btns { display: flex; gap: 0; }
.export-btn { padding: 6px 14px; border: 1px solid var(--border); background: var(--white); font-size: 12px; cursor: pointer; color: var(--text); font-family: inherit; transition: background .15s; }
.export-btn:first-child { border-radius: 0 var(--radius) var(--radius) 0; }
.export-btn:last-child { border-radius: var(--radius) 0 0 var(--radius); }
.export-btn:not(:last-child) { border-left: none; }
.export-btn:hover { background: var(--primary); color: white; border-color: var(--primary); }
.search-box { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-light); }
.search-input { padding: 6px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; width: 180px; font-family: inherit; direction: rtl; }
.search-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
.table-wrapper { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table thead { background: #f8fafc; }
.data-table th { text-align: right; padding: 12px 16px; font-weight: 600; color: var(--text-light); font-size: 12px; border-bottom: 2px solid var(--border); white-space: nowrap; cursor: pointer; user-select: none; }
.data-table th:hover { color: var(--primary); }
.data-table th.sort-asc::after { content: " \25B2"; font-size: 10px; }
.data-table th.sort-desc::after { content: " \25BC"; font-size: 10px; }
.data-table td { padding: 11px 16px; border-bottom: 1px solid #f1f5f9; color: var(--text); }
.data-table tbody tr:hover { background: #f8fafc; }
.data-table tbody tr:nth-child(even) { background: #fafbfc; }
.data-table tbody tr:nth-child(even):hover { background: #f1f5f9; }
.status-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
.status-badge.online { background: rgba(34,197,94,.1); color: var(--success); }
.status-badge.offline { background: rgba(148,163,184,.15); color: var(--text-light); }
.status-badge.warning { background: rgba(245,158,11,.1); color: var(--warning); }
.status-badge.error { background: rgba(239,68,68,.1); color: var(--error); }
.type-badge { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #f1f5f9; color: #475569; }
.table-footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-top: 1px solid var(--border); font-size: 13px; color: var(--text-light); }
.pagination { display: flex; gap: 4px; }
.page-btn { min-width: 32px; height: 32px; border: 1px solid var(--border); background: var(--white); border-radius: 6px; font-size: 12px; cursor: pointer; color: var(--text); font-family: inherit; display: flex; align-items: center; justify-content: center; transition: all .15s; }
.page-btn:hover { border-color: var(--primary); color: var(--primary); }
.page-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
.page-btn:disabled { opacity: .4; cursor: not-allowed; }
.btn { padding: 8px 18px; border: none; border-radius: var(--radius); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s; white-space: nowrap; }
.btn-primary { background: var(--primary); color: white; }
.btn-primary:hover { background: var(--primary-dark); }
.btn-secondary { background: #e2e8f0; color: var(--text); }
.btn-secondary:hover { background: #cbd5e1; }
.btn-danger { background: var(--error); color: white; }
.btn-danger:hover { background: #dc2626; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.action-btns { display: flex; gap: 6px; }
.form-group { margin-bottom: 16px; }
.form-group > label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
.form-group input[type="text"], .form-group input[type="number"], .form-group input[type="date"], .form-group select { width: 100%; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; font-family: inherit; direction: rtl; background: var(--white); }
.form-group input:focus, .form-group select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
.toggle-label { display: flex !important; align-items: center; gap: 10px; cursor: pointer; font-weight: 400 !important; }
.toggle-label input { accent-color: var(--primary); }
.report-filters { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; background: var(--white); padding: 16px 20px; border-radius: var(--radius); box-shadow: var(--shadow); }
.filter-group { display: flex; flex-direction: column; gap: 4px; }
.filter-group label { font-size: 12px; font-weight: 600; color: #475569; }
.filter-group select, .filter-group input { padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; font-family: inherit; min-width: 160px; }
.settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px; }
.about-info p { margin-bottom: 8px; font-size: 13px; color: #475569; line-height: 1.8; }
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 200; align-items: center; justify-content: center; }
.modal-overlay.active { display: flex; }
.modal { background: var(--white); border-radius: 12px; width: 92%; max-width: 520px; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid var(--border); }
.modal-header h3 { font-size: 16px; font-weight: 700; }
.modal-close { background: none; border: none; font-size: 22px; color: var(--text-light); cursor: pointer; line-height: 1; }
.modal-close:hover { color: var(--text); }
.modal-body { padding: 24px; }
.modal-footer { display: flex; justify-content: flex-start; gap: 10px; padding: 16px 24px; border-top: 1px solid var(--border); }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; }
.detail-label { font-size: 11px; color: var(--text-light); letter-spacing: .3px; }
.detail-value { font-size: 14px; font-weight: 600; color: var(--text); }
.footer { height: var(--footer-h); background: var(--white); border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; font-size: 12px; color: var(--text-light); }
.footer-status { display: inline-flex; align-items: center; gap: 6px; }
.footer-status::before { content: ""; width: 7px; height: 7px; background: var(--success); border-radius: 50%; }
@media (max-width: 1024px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) { .sidebar { transform: translateX(100%); } .sidebar.open { transform: translateX(0); } .main-wrapper { margin-right: 0; } .topbar-toggle { display: block; } .stats-row { grid-template-columns: 1fr; } .panel-header { flex-direction: column; align-items: flex-start; } .settings-grid { grid-template-columns: 1fr; } .detail-grid { grid-template-columns: 1fr; } .report-filters { flex-direction: column; align-items: stretch; } }
ENDFILE

echo "=== Deploying js/app.js ==="

cat > js/app.js << 'ENDFILE'
(function () {
    "use strict";
    var routes = JSON.parse(JSON.stringify(ROUTE_DATA));
    var devices = JSON.parse(JSON.stringify(DEVICE_DATA));
    var reports = JSON.parse(JSON.stringify(REPORT_DATA));
    var TYPE_LABELS = { camera: "\u062f\u0648\u0631\u0628\u06cc\u0646", sensor: "\u0633\u0646\u0633\u0648\u0631", "traffic-light": "\u0686\u0631\u0627\u063a \u0631\u0627\u0647\u0646\u0645\u0627\u06cc\u06cc", controller: "\u06a9\u0646\u062a\u0631\u0644\u0631" };
    var STATUS_LABELS = { online: "\u0622\u0646\u0644\u0627\u06cc\u0646", offline: "\u0622\u0641\u0644\u0627\u06cc\u0646", warning: "\u0647\u0634\u062f\u0627\u0631", error: "\u062e\u0637\u0627" };
    var VIEW_TITLES = { home: "\u062e\u0627\u0646\u0647", routes: "\u0645\u062d\u0648\u0631\u0647\u0627", devices: "\u062f\u0633\u062a\u06af\u0627\u0647\u200c\u0647\u0627", reports: "\u06af\u0632\u0627\u0631\u0634\u0627\u062a", settings: "\u062a\u0646\u0638\u06cc\u0645\u0627\u062a" };
    var PAGE_SIZE = 10;
    var $ = function (sel) { return document.querySelector(sel); };
    var $$ = function (sel) { return document.querySelectorAll(sel); };
    function escapeHtml(str) { if (str == null) return ""; var div = document.createElement("div"); div.appendChild(document.createTextNode(String(str))); return div.innerHTML; }
    function formatNumber(n) { return Number(n).toLocaleString("fa-IR"); }
    function formatTime(iso) { if (!iso) return "-"; var d = new Date(iso); var h = String(d.getHours()).padStart(2, "0"); var m = String(d.getMinutes()).padStart(2, "0"); var mo = String(d.getMonth() + 1).padStart(2, "0"); var dy = String(d.getDate()).padStart(2, "0"); return d.getFullYear() + "/" + mo + "/" + dy + " " + h + ":" + m; }
    $$(".nav-item").forEach(function (btn) { btn.addEventListener("click", function () { switchView(btn.getAttribute("data-view")); }); });
    function switchView(view) { $$(".nav-item").forEach(function (b) { b.classList.remove("active"); }); var activeBtn = document.querySelector('.nav-item[data-view="' + view + '"]'); if (activeBtn) activeBtn.classList.add("active"); $$(".view").forEach(function (v) { v.classList.remove("active"); }); var target = $("#view-" + view); if (target) target.classList.add("active"); $("#topbar-title").textContent = VIEW_TITLES[view] || view; if (view === "home") renderHome(); if (view === "routes") renderRoutes(); if (view === "devices") renderDevices(); if (view === "reports") renderReports(); }
    $("#sidebar-toggle").addEventListener("click", function () { $("#sidebar").classList.toggle("open"); });
    function updateClock() { var now = new Date(); var h = String(now.getHours()).padStart(2, "0"); var m = String(now.getMinutes()).padStart(2, "0"); var s = String(now.getSeconds()).padStart(2, "0"); $("#topbar-time").textContent = h + ":" + m + ":" + s; }
    updateClock(); setInterval(updateClock, 1000);
    var homeState = { page: 1, search: "", sortKey: "name", sortDir: "asc" };
    function renderHome() { var totalVehicles = routes.reduce(function (s, r) { return s + r.totalVehicles; }, 0); var activeRoutes = routes.filter(function (r) { return r.status === "online"; }).length; var totalErrors = routes.reduce(function (s, r) { return s + r.errors; }, 0); var speeds = routes.filter(function (r) { return r.avgSpeed > 0; }); var avgSpeed = speeds.length ? Math.round(speeds.reduce(function (s, r) { return s + r.avgSpeed; }, 0) / speeds.length) : 0; $("#stat-total-vehicles").textContent = formatNumber(totalVehicles); $("#stat-avg-speed").textContent = formatNumber(avgSpeed); $("#stat-active-routes").textContent = formatNumber(activeRoutes); $("#stat-errors").textContent = formatNumber(totalErrors); var onlineDevices = devices.filter(function (d) { return d.status === "online"; }).length; $("#footer-device-count").textContent = onlineDevices + " \u062f\u0633\u062a\u06af\u0627\u0647 \u0641\u0639\u0627\u0644"; renderHomeTable(); }
    function getFilteredRoutes() { var q = homeState.search.toLowerCase(); return routes.filter(function (r) { if (!q) return true; return r.name.toLowerCase().indexOf(q) !== -1; }); }
    function renderHomeTable() { var filtered = getFilteredRoutes(); filtered = sortArray(filtered, homeState.sortKey, homeState.sortDir); var total = filtered.length; var start = (homeState.page - 1) * PAGE_SIZE; var paged = filtered.slice(start, start + PAGE_SIZE); var tbody = $("#home-table-body"); tbody.innerHTML = paged.map(function (r) { return "<tr><td>" + escapeHtml(r.name) + "</td><td style=\"direction:ltr;text-align:right\">" + escapeHtml(formatTime(r.lastUpdate)) + "</td><td style=\"direction:ltr;text-align:right\">" + escapeHtml(formatNumber(r.totalVehicles)) + "</td><td style=\"direction:ltr;text-align:right\">" + escapeHtml(r.avgSpeed) + " km/h</td><td><span class=\"status-badge " + (r.errors > 0 ? "error" : "online") + "\">" + escapeHtml(r.errors > 0 ? r.errors + " \u062e\u0637\u0627" : "\u0628\u062f\u0648\u0646 \u062e\u0637\u0627") + "</span></td></tr>"; }).join(""); renderTableInfo("home", start, paged.length, total); renderPagination("home", homeState, total); applySortHeaders("home-table", homeState); }
    $("#home-search").addEventListener("input", function () { homeState.search = this.value.trim(); homeState.page = 1; renderHomeTable(); });
    bindTableSort("home-table", homeState, renderHomeTable);
    var routeState = { page: 1, search: "", sortKey: "name", sortDir: "asc" };
    function renderRoutes() { renderRouteTable(); }
    function getFilteredRoutesForTable() { var q = routeState.search.toLowerCase(); return routes.filter(function (r) { if (!q) return true; return r.name.toLowerCase().indexOf(q) !== -1 || r.origin.toLowerCase().indexOf(q) !== -1 || r.destination.toLowerCase().indexOf(q) !== -1; }); }
    function renderRouteTable() { var filtered = getFilteredRoutesForTable(); filtered = sortArray(filtered, routeState.sortKey, routeState.sortDir); var total = filtered.length; var start = (routeState.page - 1) * PAGE_SIZE; var paged = filtered.slice(start, start + PAGE_SIZE); var tbody = $("#routes-table-body"); tbody.innerHTML = paged.map(function (r, i) { return "<tr><td>" + (start + i + 1) + "</td><td><strong>" + escapeHtml(r.name) + "</strong></td><td>" + escapeHtml(r.origin) + "</td><td>" + escapeHtml(r.destination) + "</td><td style=\"direction:ltr;text-align:right\">" + escapeHtml(r.length) + "</td><td style=\"direction:ltr;text-align:right\">" + escapeHtml(r.deviceCount) + "</td><td><span class=\"status-badge " + r.status + "\">" + escapeHtml(STATUS_LABELS[r.status]) + "</span></td><td><div class=\"action-btns\"><button class=\"btn btn-sm btn-primary btn-route-detail\" data-id=\"" + escapeHtml(r.id) + "\">\u062c\u0632\u0626\u06cc\u0627\u062a</button><button class=\"btn btn-sm btn-danger btn-route-delete\" data-id=\"" + escapeHtml(r.id) + "\">\u062d\u0630\u0641</button></div></td></tr>"; }).join(""); tbody.querySelectorAll(".btn-route-detail").forEach(function (btn) { btn.addEventListener("click", function () { var r = routes.find(function (x) { return x.id === btn.getAttribute("data-id"); }); if (r) showRouteDetail(r); }); }); tbody.querySelectorAll(".btn-route-delete").forEach(function (btn) { btn.addEventListener("click", function () { var id = btn.getAttribute("data-id"); if (confirm("\u0622\u06cc\u0627 \u0627\u0632 \u062d\u0630\u0641 \u0627\u06cc\u0646 \u0645\u062d\u0648\u0631 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062a\u06cc\u062f\u061f")) { routes = routes.filter(function (x) { return x.id !== id; }); renderRouteTable(); } }); }); renderTableInfo("routes", start, paged.length, total); renderPagination("routes", routeState, total); applySortHeaders("routes-table", routeState); }
    $("#routes-search").addEventListener("input", function () { routeState.search = this.value.trim(); routeState.page = 1; renderRouteTable(); });
    bindTableSort("routes-table", routeState, renderRouteTable);
    function showRouteDetail(r) { $("#modal-title").textContent = r.name; $("#modal-save").style.display = "none"; $("#modal-body").innerHTML = '<div class="detail-grid"><div class="detail-item"><span class="detail-label">\u0634\u0646\u0627\u0633\u0647</span><span class="detail-value">' + escapeHtml(r.id) + '</span></div><div class="detail-item"><span class="detail-label">\u0645\u0628\u062f\u0623</span><span class="detail-value">' + escapeHtml(r.origin) + '</span></div><div class="detail-item"><span class="detail-label">\u0645\u0642\u0635\u062f</span><span class="detail-value">' + escapeHtml(r.destination) + '</span></div><div class="detail-item"><span class="detail-label">\u0637\u0648\u0644</span><span class="detail-value" dir="ltr">' + escapeHtml(r.length) + ' km</span></div><div class="detail-item"><span class="detail-label">\u062a\u0639\u062f\u0627\u062f \u062f\u0633\u062a\u06af\u0627\u0647</span><span class="detail-value">' + escapeHtml(r.deviceCount) + '</span></div><div class="detail-item"><span class="detail-label">\u0648\u0636\u0639\u06cc\u062a</span><span class="detail-value"><span class="status-badge ' + r.status + '">' + escapeHtml(STATUS_LABELS[r.status]) + '</span></span></div><div class="detail-item"><span class="detail-label">\u062e\u0648\u062f\u0631\u0648\u0647\u0627\u06cc \u0639\u0628\u0648\u0631\u06cc</span><span class="detail-value">' + escapeHtml(formatNumber(r.totalVehicles)) + '</span></div><div class="detail-item"><span class="detail-label">\u0633\u0631\u0639\u062a \u0645\u062a\u0648\u0633\u0637</span><span class="detail-value" dir="ltr">' + escapeHtml(r.avgSpeed) + ' km/h</span></div></div>'; $("#modal-overlay").classList.add("active"); }
    $("#btn-add-route").addEventListener("click", function () { $("#add-modal-title").textContent = "\u0627\u0641\u0632\u0648\u062f\u0646 \u0645\u062d\u0648\u0631 \u062c\u062f\u06cc\u062f"; $("#add-modal-body").innerHTML = '<form id="add-route-form"><div class="form-group"><label>\u0646\u0627\u0645 \u0645\u062d\u0648\u0631</label><input type="text" id="new-route-name" required></div><div class="form-group"><label>\u0645\u0628\u062f\u0623</label><input type="text" id="new-route-origin"></div><div class="form-group"><label>\u0645\u0642\u0635\u062f</label><input type="text" id="new-route-dest"></div><div class="form-group"><label>\u0637\u0648\u0644 (km)</label><input type="number" id="new-route-length" dir="ltr"></div></form>'; currentAddMode = "route"; $("#add-modal-overlay").classList.add("active"); });
    var deviceState = { page: 1, search: "", sortKey: "name", sortDir: "asc" };
    function renderDevices() { renderDeviceTable(); }
    function getFilteredDevices() { var q = deviceState.search.toLowerCase(); return devices.filter(function (d) { if (!q) return true; return d.name.toLowerCase().indexOf(q) !== -1 || d.id.toLowerCase().indexOf(q) !== -1 || d.ip.indexOf(q) !== -1; }); }
    function renderDeviceTable() { var filtered = getFilteredDevices(); filtered = sortArray(filtered, deviceState.sortKey, deviceState.sortDir); var total = filtered.length; var start = (deviceState.page - 1) * PAGE_SIZE; var paged = filtered.slice(start, start + PAGE_SIZE); var tbody = $("#devices-table-body"); tbody.innerHTML = paged.map(function (d, i) { var routeObj = routes.find(function (r) { return r.id === d.route; }); var routeName = routeObj ? routeObj.name : d.route; return "<tr><td>" + (start + i + 1) + "</td><td style=\"direction:ltr;text-align:right;font-weight:700\">" + escapeHtml(d.deviceCode || "-") + "</td><td><strong>" + escapeHtml(d.name) + "</strong></td><td><span class=\"type-badge\">" + escapeHtml(TYPE_LABELS[d.type] || d.type) + "</span></td><td>" + escapeHtml(routeName) + "</td><td style=\"direction:ltr;text-align:right\">" + escapeHtml(d.ip) + "</td><td><span class=\"status-badge " + d.status + "\">" + escapeHtml(STATUS_LABELS[d.status]) + "</span></td><td style=\"direction:ltr;text-align:right\">" + escapeHtml(formatTime(d.lastSeen)) + "</td><td><div class=\"action-btns\"><button class=\"btn btn-sm btn-primary btn-dev-detail\" data-id=\"" + escapeHtml(d.id) + "\">\u062c\u0632\u0626\u06cc\u0627\u062a</button><button class=\"btn btn-sm btn-danger btn-dev-delete\" data-id=\"" + escapeHtml(d.id) + "\">\u062d\u0630\u0641</button></div></td></tr>"; }).join(""); tbody.querySelectorAll(".btn-dev-detail").forEach(function (btn) { btn.addEventListener("click", function () { var d = devices.find(function (x) { return x.id === btn.getAttribute("data-id"); }); if (d) showDeviceDetail(d); }); }); tbody.querySelectorAll(".btn-dev-delete").forEach(function (btn) { btn.addEventListener("click", function () { var id = btn.getAttribute("data-id"); if (confirm("\u0622\u06cc\u0627 \u0627\u0632 \u062d\u0630\u0641 \u0627\u06cc\u0646 \u062f\u0633\u062a\u06af\u0627\u0647 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062a\u06cc\u062f\u061f")) { devices = devices.filter(function (x) { return x.id !== id; }); renderDeviceTable(); } }); }); renderTableInfo("devices", start, paged.length, total); renderPagination("devices", deviceState, total); applySortHeaders("devices-table", deviceState); }
    $("#devices-search").addEventListener("input", function () { deviceState.search = this.value.trim(); deviceState.page = 1; renderDeviceTable(); });
    bindTableSort("devices-table", deviceState, renderDeviceTable);
    function showDeviceDetail(d) { var routeObj = routes.find(function (r) { return r.id === d.route; }); var routeName = routeObj ? routeObj.name : d.route; $("#modal-title").textContent = d.name; $("#modal-save").style.display = "none"; $("#modal-body").innerHTML = '<div class="detail-grid"><div class="detail-item"><span class="detail-label">\u0634\u0646\u0627\u0633\u0647</span><span class="detail-value">' + escapeHtml(d.id) + '</span></div><div class="detail-item"><span class="detail-label">\u06a9\u062f \u062f\u0633\u062a\u06af\u0627\u0647 (\u06f4 \u0631\u0642\u0645\u06cc)</span><span class="detail-value" style="direction:ltr;font-weight:700;font-size:18px;color:#3b82f6">' + escapeHtml(d.deviceCode || "-") + '</span></div><div class="detail-item"><span class="detail-label">\u0646\u0648\u0639</span><span class="detail-value">' + escapeHtml(TYPE_LABELS[d.type]) + '</span></div><div class="detail-item"><span class="detail-label">\u0645\u062d\u0648\u0631</span><span class="detail-value">' + escapeHtml(routeName) + '</span></div><div class="detail-item"><span class="detail-label">\u0622\u062f\u0631\u0633 IP</span><span class="detail-value" dir="ltr">' + escapeHtml(d.ip) + '</span></div><div class="detail-item"><span class="detail-label">\u0648\u0636\u0639\u06cc\u062a</span><span class="detail-value"><span class="status-badge ' + d.status + '">' + escapeHtml(STATUS_LABELS[d.status]) + '</span></span></div><div class="detail-item"><span class="detail-label">\u0646\u0633\u062e\u0647 \u0641\u0631\u06cc\u0645\u0648\u0631</span><span class="detail-value" dir="ltr">' + escapeHtml(d.firmware) + '</span></div><div class="detail-item"><span class="detail-label">\u0622\u062e\u0631\u06cc\u0646 \u0627\u062a\u0635\u0627\u0644</span><span class="detail-value" dir="ltr">' + escapeHtml(formatTime(d.lastSeen)) + '</span></div></div>'; $("#modal-overlay").classList.add("active"); }
    $("#btn-add-device").addEventListener("click", function () { $("#add-modal-title").textContent = "\u0627\u0641\u0632\u0648\u062f\u0646 \u062f\u0633\u062a\u06af\u0627\u0647 \u062c\u062f\u06cc\u062f"; var routeOptions = routes.map(function (r) { return '<option value="' + escapeHtml(r.id) + '">' + escapeHtml(r.name) + '</option>'; }).join(""); $("#add-modal-body").innerHTML = '<form id="add-device-form"><div class="form-group"><label>\u06a9\u062f \u062f\u0633\u062a\u06af\u0627\u0647 (\u06f4 \u0631\u0642\u0645\u06cc)</label><input type="text" id="new-dev-code" maxlength="4" pattern="\\d{4}" dir="ltr" placeholder="\u0645\u062b\u0627\u0644: 1001" required></div><div class="form-group"><label>\u0646\u0627\u0645 \u062f\u0633\u062a\u06af\u0627\u0647</label><input type="text" id="new-dev-name" required></div><div class="form-group"><label>\u0646\u0648\u0639</label><select id="new-dev-type"><option value="camera">\u062f\u0648\u0631\u0628\u06cc\u0646</option><option value="sensor">\u0633\u0646\u0633\u0648\u0631</option><option value="traffic-light">\u0686\u0631\u0627\u063a \u0631\u0627\u0647\u0646\u0645\u0627\u06cc\u06cc</option><option value="controller">\u06a9\u0646\u062a\u0631\u0644\u0631</option></select></div><div class="form-group"><label>\u0645\u062d\u0648\u0631</label><select id="new-dev-route">' + routeOptions + '</select></div><div class="form-group"><label>\u0622\u062f\u0631\u0633 IP</label><input type="text" id="new-dev-ip" dir="ltr" placeholder="192.168.x.x"></div></form>'; currentAddMode = "device"; $("#add-modal-overlay").classList.add("active"); });
    var reportState = { page: 1 };
    function renderReports() { var sel = $("#report-route"); sel.innerHTML = '<option value="">\u0647\u0645\u0647 \u0645\u062d\u0648\u0631\u0647\u0627</option>'; routes.forEach(function (r) { sel.innerHTML += '<option value="' + escapeHtml(r.name) + '">' + escapeHtml(r.name) + '</option>'; }); renderReportTable(); }
    function getFilteredReports() { var routeFilter = $("#report-route").value; var from = $("#report-from").value; var to = $("#report-to").value; return reports.filter(function (r) { if (routeFilter && r.route !== routeFilter) return false; if (from && r.date < from) return false; if (to && r.date > to) return false; return true; }); }
    function renderReportTable() { var filtered = getFilteredReports(); var total = filtered.length; var start = (reportState.page - 1) * PAGE_SIZE; var paged = filtered.slice(start, start + PAGE_SIZE); var tbody = $("#report-table-body"); tbody.innerHTML = paged.map(function (r) { return "<tr><td style=\"direction:ltr;text-align:right\">" + escapeHtml(r.date) + "</td><td>" + escapeHtml(r.route) + "</td><td style=\"direction:ltr;text-align:right\">" + escapeHtml(formatNumber(r.vehicles)) + "</td><td style=\"direction:ltr;text-align:right\">" + escapeHtml(r.avgSpeed) + " km/h</td><td style=\"direction:ltr;text-align:right\">" + escapeHtml(r.maxSpeed) + " km/h</td><td style=\"direction:ltr;text-align:right\">" + escapeHtml(r.violations) + "</td></tr>"; }).join(""); renderTableInfo("report", start, paged.length, total); renderPagination("report", reportState, total); }
    $("#btn-generate-report").addEventListener("click", function () { reportState.page = 1; renderReportTable(); });
    $("#btn-save-settings").addEventListener("click", function () { alert("\u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u0639\u0645\u0648\u0645\u06cc \u0630\u062e\u06cc\u0631\u0647 \u0634\u062f."); });
    $("#btn-save-alerts").addEventListener("click", function () { alert("\u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u0647\u0634\u062f\u0627\u0631 \u0630\u062e\u06cc\u0631\u0647 \u0634\u062f."); });
    var currentAddMode = "";
    $("#add-modal-save").addEventListener("click", function () { if (currentAddMode === "route") { var name = ($("#new-route-name") || {}).value; if (!name || !name.trim()) { alert("\u0644\u0637\u0641\u0627 \u0646\u0627\u0645 \u0645\u062d\u0648\u0631 \u0631\u0627 \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f"); return; } var maxNum = 0; routes.forEach(function (r) { var n = parseInt(r.id.split("-")[1], 10); if (n > maxNum) maxNum = n; }); routes.push({ id: "R-" + String(maxNum + 1).padStart(3, "0"), name: name.trim(), origin: ($("#new-route-origin") || {}).value || "", destination: ($("#new-route-dest") || {}).value || "", length: parseFloat(($("#new-route-length") || {}).value) || 0, deviceCount: 0, status: "online", totalVehicles: 0, avgSpeed: 0, errors: 0, lastUpdate: new Date().toISOString() }); $("#add-modal-overlay").classList.remove("active"); renderRouteTable(); } else if (currentAddMode === "device") { var dcode = ($("#new-dev-code") || {}).value; var dname = ($("#new-dev-name") || {}).value; var ip = ($("#new-dev-ip") || {}).value; if (!dcode || !/^\d{4}$/.test(dcode)) { alert("\u06a9\u062f \u062f\u0633\u062a\u06af\u0627\u0647 \u0628\u0627\u06cc\u062f \u06f4 \u0631\u0642\u0645\u06cc \u0628\u0627\u0634\u062f"); return; } if (!dname || !dname.trim() || !ip || !ip.trim()) { alert("\u0644\u0637\u0641\u0627 \u0646\u0627\u0645 \u0648 IP \u0631\u0627 \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f"); return; } if (devices.some(function (d) { return d.deviceCode === dcode; })) { alert("\u06a9\u062f \u062f\u0633\u062a\u06af\u0627\u0647 \u062a\u06a9\u0631\u0627\u0631\u06cc \u0627\u0633\u062a"); return; } var type = ($("#new-dev-type") || {}).value || "camera"; var prefix = { camera: "CAM", sensor: "SEN", "traffic-light": "TL", controller: "CTR" }[type] || "DEV"; var dmax = 0; devices.forEach(function (d) { if (d.id.indexOf(prefix + "-") === 0) { var num = parseInt(d.id.split("-")[1], 10); if (num > dmax) dmax = num; } }); devices.push({ id: prefix + "-" + String(dmax + 1).padStart(3, "0"), deviceCode: dcode, name: dname.trim(), type: type, route: ($("#new-dev-route") || {}).value || "", ip: ip.trim(), status: "online", lastSeen: new Date().toISOString(), firmware: "v1.0.0" }); $("#add-modal-overlay").classList.remove("active"); renderDeviceTable(); } });
    ["modal-close", "modal-cancel"].forEach(function (id) { var el = $("#" + id); if (el) el.addEventListener("click", function () { $("#modal-overlay").classList.remove("active"); }); });
    ["add-modal-close", "add-modal-cancel"].forEach(function (id) { var el = $("#" + id); if (el) el.addEventListener("click", function () { $("#add-modal-overlay").classList.remove("active"); }); });
    ["modal-overlay", "add-modal-overlay"].forEach(function (id) { var el = $("#" + id); if (el) el.addEventListener("click", function (e) { if (e.target === el) el.classList.remove("active"); }); });
    $$(".export-btn").forEach(function (btn) { btn.addEventListener("click", function () { var action = btn.getAttribute("data-action"); var table = btn.closest(".panel").querySelector(".data-table"); if (!table) return; if (action === "copy") copyTableToClipboard(table); else if (action === "csv") downloadTableAsCSV(table); else if (action === "excel") downloadTableAsCSV(table, "xls"); else if (action === "pdf" || action === "print") printTable(table); }); });
    function copyTableToClipboard(table) { var text = tableToText(table); if (navigator.clipboard) { navigator.clipboard.writeText(text).then(function () { alert("\u06a9\u067e\u06cc \u0634\u062f!"); }); } }
    function downloadTableAsCSV(table, ext) { var text = tableToCSV(table); var blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" }); var link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "export." + (ext || "csv"); link.click(); }
    function printTable(table) { var win = window.open("", "_blank"); win.document.write('<html dir="rtl"><head><title>\u0686\u0627\u067e</title><style>body{font-family:Tahoma,sans-serif;direction:rtl}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:right}th{background:#f0f0f0}</style></head><body>'); win.document.write(table.outerHTML); win.document.write("</body></html>"); win.document.close(); win.print(); }
    function tableToText(table) { var rows = table.querySelectorAll("tr"); var lines = []; rows.forEach(function (row) { var cells = []; row.querySelectorAll("th, td").forEach(function (cell) { cells.push(cell.textContent.trim()); }); lines.push(cells.join("\t")); }); return lines.join("\n"); }
    function tableToCSV(table) { var rows = table.querySelectorAll("tr"); var lines = []; rows.forEach(function (row) { var cells = []; row.querySelectorAll("th, td").forEach(function (cell) { var val = cell.textContent.trim().replace(/"/g, '""'); cells.push('"' + val + '"'); }); lines.push(cells.join(",")); }); return lines.join("\n"); }
    function renderTableInfo(prefix, start, count, total) { var el = $("#" + prefix + "-table-info"); if (!el) return; if (total === 0) { el.textContent = "\u062f\u0627\u062f\u0647\u200c\u0627\u06cc \u06cc\u0627\u0641\u062a \u0646\u0634\u062f"; } else { el.textContent = "\u0646\u0645\u0627\u06cc\u0634 " + (start + 1) + " \u062a\u0627 " + (start + count) + " \u0627\u0632 " + total + " \u0631\u062f\u06cc\u0641"; } }
    function renderPagination(prefix, state, total) { var container = $("#" + prefix + "-pagination"); if (!container) return; var pages = Math.ceil(total / PAGE_SIZE); if (pages <= 1) { container.innerHTML = ""; return; } var html = '<button class="page-btn" data-p="prev" ' + (state.page <= 1 ? "disabled" : "") + '>&laquo;</button>'; for (var i = 1; i <= pages; i++) { html += '<button class="page-btn ' + (i === state.page ? "active" : "") + '" data-p="' + i + '">' + i + '</button>'; } html += '<button class="page-btn" data-p="next" ' + (state.page >= pages ? "disabled" : "") + '>&raquo;</button>'; container.innerHTML = html; container.querySelectorAll(".page-btn").forEach(function (btn) { btn.addEventListener("click", function () { var p = btn.getAttribute("data-p"); if (p === "prev") state.page = Math.max(1, state.page - 1); else if (p === "next") state.page = Math.min(pages, state.page + 1); else state.page = parseInt(p, 10); if (prefix === "home") renderHomeTable(); else if (prefix === "routes") renderRouteTable(); else if (prefix === "devices") renderDeviceTable(); else if (prefix === "report") renderReportTable(); }); }); }
    function sortArray(arr, key, dir) { return arr.slice().sort(function (a, b) { var va = a[key] != null ? a[key] : ""; var vb = b[key] != null ? b[key] : ""; if (typeof va === "number" && typeof vb === "number") return dir === "asc" ? va - vb : vb - va; va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); if (va < vb) return dir === "asc" ? -1 : 1; if (va > vb) return dir === "asc" ? 1 : -1; return 0; }); }
    function bindTableSort(tableId, state, renderFn) { var table = $("#" + tableId); if (!table) return; table.querySelectorAll("th[data-sort]").forEach(function (th) { th.addEventListener("click", function () { var key = th.getAttribute("data-sort"); if (state.sortKey === key) { state.sortDir = state.sortDir === "asc" ? "desc" : "asc"; } else { state.sortKey = key; state.sortDir = "asc"; } state.page = 1; renderFn(); }); }); }
    function applySortHeaders(tableId, state) { var table = $("#" + tableId); if (!table) return; table.querySelectorAll("th[data-sort]").forEach(function (th) { th.classList.remove("sort-asc", "sort-desc"); if (th.getAttribute("data-sort") === state.sortKey) th.classList.add("sort-" + state.sortDir); }); }
    renderHome();
})();
ENDFILE

echo ""
echo "=== All code deployed! ==="
echo "=== Starting tc-manager service ==="
systemctl restart tc-manager
sleep 2
systemctl status tc-manager --no-pager
echo ""
echo "=== Done! Dashboard: http://5.159.49.246 ==="
