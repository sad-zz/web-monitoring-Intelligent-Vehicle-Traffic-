(function () {
    "use strict";

    // ============================================================
    // Helpers
    // ============================================================
    var $ = function (sel) { return document.querySelector(sel); };
    var $$ = function (sel) { return document.querySelectorAll(sel); };

    function escapeHtml(str) {
        if (str == null) return "";
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    function formatTime(iso) {
        if (!iso) return "-";
        var d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        var y = d.getFullYear();
        var mo = String(d.getMonth() + 1).padStart(2, "0");
        var dy = String(d.getDate()).padStart(2, "0");
        var h = String(d.getHours()).padStart(2, "0");
        var m = String(d.getMinutes()).padStart(2, "0");
        return y + "/" + mo + "/" + dy + " " + h + ":" + m;
    }

    function api(method, url, body, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.withCredentials = true;
        if (body && method !== "GET") {
            xhr.setRequestHeader("Content-Type", "application/json");
        }
        xhr.onload = function () {
            var data = null;
            try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
            callback(xhr.status, data);
        };
        xhr.onerror = function () { callback(0, null); };
        xhr.send(body ? JSON.stringify(body) : null);
    }

    var TYPE_LABELS = { counter: "ترددشمار", sensor: "سنسور", loop: "حلقه القایی", radar: "رادار" };
    var STATUS_LABELS = { online: "آنلاین", offline: "آفلاین", warning: "هشدار", error: "خطا" };

    var VIEW_TITLES = {
        dashboard: "داشبورد",
        devices: "دستگاه‌ها",
        reception: "دریافت داده",
        rmto: "ارسال به سامانه",
        "test-send": "ارسال تست",
        mehvar: "محورها",
        settings: "تنظیمات"
    };

    var PAGE_SIZE = 20;

    // c1=motorcycle, c2=car, c3=van, c4=bus, c5=truck+other (remainder)
    var VEHICLE_DIST = { c1: 0.05, c2: 0.60, c3: 0.15, c4: 0.05 };

    function calcVehicleDist(total) {
        var c1 = Math.round(total * VEHICLE_DIST.c1);
        var c2 = Math.round(total * VEHICLE_DIST.c2);
        var c3 = Math.round(total * VEHICLE_DIST.c3);
        var c4 = Math.round(total * VEHICLE_DIST.c4);
        var c5 = Math.max(0, total - c1 - c2 - c3 - c4);
        return { c1: c1, c2: c2, c3: c3, c4: c4, c5: c5 };
    }

    // Cached mehvar (route) list for device dropdowns
    var cachedMehvarList = [];

    function fetchMehvarList(callback) {
        api("GET", "/api/mehvar", null, function (status, data) {
            cachedMehvarList = (status === 200 && Array.isArray(data)) ? data : [];
            callback(cachedMehvarList);
        });
    }

    function buildMehvarOptions(selectedCode) {
        var opts = '<option value="">-----------</option>';
        cachedMehvarList.forEach(function (m) {
            var sel = (String(m.code) === String(selectedCode)) ? " selected" : "";
            opts += '<option value="' + escapeHtml(String(m.code)) + '"' + sel + '>' +
                escapeHtml(m.name) + '|' + escapeHtml(String(m.code)) + '</option>';
        });
        return opts;
    }

    function getMehvarName(code) {
        if (!code) return "";
        for (var i = 0; i < cachedMehvarList.length; i++) {
            if (String(cachedMehvarList[i].code) === String(code)) {
                return cachedMehvarList[i].name + "|" + cachedMehvarList[i].code;
            }
        }
        return String(code);
    }

    // ============================================================
    // Authentication
    // ============================================================
    var loginOverlay = $("#login-overlay");
    var loginForm = $("#login-form");
    var loginError = $("#login-error");
    var serverConnected = false;

    function checkAuth() {
        api("GET", "/api/auth/check", null, function (status, data) {
            if (status === 200 && data && data.loggedIn) {
                loginOverlay.classList.add("hidden");
                serverConnected = true;
                updateConnectionStatus(true);
                if (data.username) {
                    var u = $("#topbar-user"); if (u) u.textContent = data.username;
                    var n = $(".user-name"); if (n) n.textContent = data.username;
                }
                loadDashboard();
            } else if (status === 200) {
                loginOverlay.classList.remove("hidden");
                serverConnected = true;
                updateConnectionStatus(true);
            } else {
                serverConnected = false;
                updateConnectionStatus(false);
                loginOverlay.classList.remove("hidden");
            }
        });
    }

    function updateConnectionStatus(connected) {
        var badge = $("#topbar-status");
        if (!badge) return;
        if (connected) {
            badge.textContent = "متصل به سرور";
            badge.className = "topbar-badge online";
        } else {
            badge.textContent = "عدم اتصال";
            badge.className = "topbar-badge";
            badge.style.background = "rgba(239,68,68,.12)";
            badge.style.color = "#ef4444";
        }
    }

    if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();
            var user = $("#login-user").value;
            var pass = $("#login-pass").value;
            api("POST", "/api/auth/login", { username: user, password: pass }, function (status, data) {
                if (status === 200 && data && data.success) {
                    loginOverlay.classList.add("hidden");
                    loginError.style.display = "none";
                    serverConnected = true;
                    updateConnectionStatus(true);
                    if (data.username) {
                        var u = $("#topbar-user"); if (u) u.textContent = data.username;
                        var n = $(".user-name"); if (n) n.textContent = data.username;
                    }
                    loadDashboard();
                } else {
                    loginError.textContent = (data && data.error) || "نام کاربری یا رمز عبور اشتباه است";
                    loginError.style.display = "block";
                }
            });
        });
    }

    checkAuth();

    // ============================================================
    // Navigation
    // ============================================================
    $$(".nav-item").forEach(function (btn) {
        btn.addEventListener("click", function () {
            switchView(btn.getAttribute("data-view"));
        });
    });

    function switchView(view) {
        $$(".nav-item").forEach(function (b) { b.classList.remove("active"); });
        var activeBtn = document.querySelector('.nav-item[data-view="' + view + '"]');
        if (activeBtn) activeBtn.classList.add("active");
        $$(".view").forEach(function (v) { v.classList.remove("active"); });
        var target = $("#view-" + view);
        if (target) target.classList.add("active");
        $("#topbar-title").textContent = VIEW_TITLES[view] || view;

        // Update bottom nav active state
        $$(".bottom-nav-item").forEach(function (b) { b.classList.remove("active"); });
        var activeBottomBtn = document.querySelector('.bottom-nav-item[data-view="' + view + '"]');
        if (activeBottomBtn) activeBottomBtn.classList.add("active");

        // Close sidebar on mobile after navigation
        var sidebar = $("#sidebar");
        if (sidebar) sidebar.classList.remove("open");

        if (view === "dashboard") loadDashboard();
        else if (view === "devices") loadDevices();
        else if (view === "reception") loadReception();
        else if (view === "rmto") loadRMTO();
        else if (view === "test-send") loadTestSend();
        else if (view === "mehvar") loadMehvar();
        else if (view === "settings") loadSettings();
    }

    // Sidebar toggle (mobile)
    $("#sidebar-toggle").addEventListener("click", function () {
        $("#sidebar").classList.toggle("open");
    });

    // Bottom navigation (mobile)
    $$(".bottom-nav-item").forEach(function (btn) {
        btn.addEventListener("click", function () {
            switchView(btn.getAttribute("data-view"));
        });
    });

    // Clock
    function updateClock() {
        var now = new Date();
        var h = String(now.getHours()).padStart(2, "0");
        var m = String(now.getMinutes()).padStart(2, "0");
        var s = String(now.getSeconds()).padStart(2, "0");
        $("#topbar-time").textContent = h + ":" + m + ":" + s;
    }
    updateClock();
    setInterval(updateClock, 1000);

    // ============================================================
    // Dashboard
    // ============================================================
    function loadDashboard() {
        api("GET", "/api/stats", null, function (status, data) {
            if (status === 200 && data) {
                $("#stat-total-devices").textContent = data.totalDevices || 0;
                $("#stat-online-devices").textContent = data.onlineDevices || 0;
                $("#stat-today-vehicles").textContent = data.todayVehicles || 0;
                $("#stat-unsent-rmto").textContent = (data.unsentRMTO || 0) + (data.unsentRMTO5 || 0);
                $("#footer-device-count").textContent = (data.onlineDevices || 0) + " دستگاه فعال";
            }
        });

        api("GET", "/api/devices", null, function (status, data) {
            var tbody = $("#dashboard-table-body");
            if (status !== 200 || !data || !data.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">دستگاهی ثبت نشده است</td></tr>';
                return;
            }
            tbody.innerHTML = data.map(function (d) {
                var st = d.status || "offline";
                return "<tr>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(d.device_code) + "</td>" +
                    "<td>" + escapeHtml(d.name) + "</td>" +
                    '<td><span class="type-badge">' + escapeHtml(TYPE_LABELS[d.type] || d.type) + "</span></td>" +
                    '<td><span class="status-badge ' + st + '">' + escapeHtml(STATUS_LABELS[st] || st) + "</span></td>" +
                    '<td dir="ltr" style="text-align:right">' + escapeHtml(formatTime(d.last_seen)) + "</td>" +
                    "</tr>";
            }).join("");
        });

        loadTcpConnected();
        loadLive();
    }

    function loadTcpConnected() {
        api("GET", "/api/tcp/connected", null, function (status, data) {
            var tbody = $("#tcp-table-body");
            if (!tbody) return;
            if (status !== 200 || !data || !Object.keys(data).length) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8">دستگاهی متصل نیست</td></tr>';
                return;
            }
            var rows = Object.keys(data).map(function (code) {
                var d = data[code];
                return "<tr>" +
                    '<td dir="ltr" style="text-align:center;font-weight:700">' + escapeHtml(code) + "</td>" +
                    '<td dir="ltr">' + escapeHtml(d.ip || "-") + "</td>" +
                    '<td dir="ltr" style="text-align:right">' + escapeHtml(formatTime(d.connectedAt)) + "</td>" +
                    '<td>' +
                        '<button class="btn btn-sm btn-secondary" data-action="tcp-sync" data-code="' + escapeHtml(code) + '">سینک ساعت</button> ' +
                        '<button class="btn btn-sm btn-primary" data-action="tcp-poll" data-code="' + escapeHtml(code) + '">دریافت داده</button>' +
                    '</td>' +
                    "</tr>";
            });
            tbody.innerHTML = rows.join("");
        });
    }

    // Event delegation for TCP action buttons
    var tcpTableEl = $("#tcp-table-body");
    if (tcpTableEl) tcpTableEl.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-action]");
        if (!btn) return;
        var action = btn.getAttribute("data-action");
        var code = btn.getAttribute("data-code");
        if (action === "tcp-sync") {
            api("POST", "/api/tcp/sync-time", { device_code: code }, function (s) {
                if (s === 200) alert("دستور سینک ساعت ارسال شد: " + code);
                else alert("خطا در ارسال دستور");
            });
        } else if (action === "tcp-poll") {
            api("POST", "/api/tcp/poll", { device_code: code }, function (s) {
                if (s === 200) alert("درخواست داده ارسال شد: " + code);
                else alert("خطا در ارسال درخواست");
            });
        }
    });

    var refreshTcpBtn = $("#btn-refresh-tcp");
    if (refreshTcpBtn) refreshTcpBtn.addEventListener("click", loadTcpConnected);

    var refreshDashBtn = $("#btn-refresh-dashboard");
    if (refreshDashBtn) refreshDashBtn.addEventListener("click", loadDashboard);

    // ============================================================
    // Live Monitor
    // ============================================================
    var lastLiveTs = 0;

    function loadLive() {
        var url = "/api/live?limit=50";
        if (lastLiveTs > 0) url = "/api/live?since=" + lastLiveTs;

        api("GET", url, null, function (status, data) {
            var tbody = $("#live-table-body");
            if (status !== 200 || !data || !data.length) {
                if (lastLiveTs === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">هنوز داده‌ای دریافت نشده</td></tr>';
                }
                return;
            }

            if (lastLiveTs === 0) tbody.innerHTML = "";

            // Update timestamp
            if (data[0] && data[0].ts) lastLiveTs = data[0].ts;

            var newHtml = data.map(function (e) {
                var typeLabel = { data: "HTTP", irawdata: "HTTP-iraw", tcp: "TCP", "tcp-raw": "TCP-خام", "tcp-ratcx1": "RATCX1", unknown: "نامشخص" }[e.type] || e.type;
                var typeClass = { data: "online", irawdata: "online", tcp: "online", "tcp-raw": "warning", "tcp-ratcx1": "online", unknown: "warning" }[e.type] || "";
                var detail = "";
                if (e.type === "tcp-ratcx1" && e.total !== undefined) {
                    detail = "تردد=" + (e.total||0) + " | a:" + (e.a||0) + " b:" + (e.b||0) + " c:" + (e.c||0) + " d:" + (e.d||0) + " e:" + (e.e||0) + " x:" + (e.x||0);
                    if (e.battery !== undefined) detail += " | باتری:" + e.battery + " سولار:" + (e.solar||0);
                } else if (e.type === "tcp-ratcx1") {
                    detail = e.detail || "";
                } else if (e.type === "tcp") {
                    detail = "تردد=" + (e.total||0) + " | a:" + (e.a||0) + " b:" + (e.b||0) + " c:" + (e.c||0) + " d:" + (e.d||0) + " e:" + (e.e||0) + " x:" + (e.x||0) + " لاین:" + (e.lane||1);
                } else if (e.type === "tcp-raw") {
                    detail = e.detail || "raw data";
                } else if (e.type === "irawdata") {
                    detail = "a:" + (e.a||0) + " b:" + (e.b||0) + " c:" + (e.c||0) + " d:" + (e.d||0) + " e:" + (e.e||0) + " x:" + (e.x||0);
                } else if (e.type === "unknown") {
                    detail = escapeHtml(e.path || "");
                    if (e.body) {
                        var keys = Object.keys(e.body).slice(0, 5).join(",");
                        detail += " {" + keys + "}";
                    }
                } else if (e.type === "data") {
                    if (e.body && e.body.records) detail = e.body.records.length + " records";
                    else detail = "1 record";
                }
                var time = e.time || "";
                if (time) {
                    var d = new Date(time);
                    time = String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0") + ":" + String(d.getSeconds()).padStart(2,"0");
                }
                return "<tr>" +
                    '<td dir="ltr" style="text-align:right;font-size:12px;font-family:monospace">' + escapeHtml(time) + "</td>" +
                    '<td><span class="status-badge ' + typeClass + '">' + escapeHtml(typeLabel) + "</span></td>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(e.ip || "-") + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(e.device || "-") + "</td>" +
                    '<td dir="ltr" style="font-size:11px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(detail) + "</td>" +
                    "</tr>";
            }).join("");

            tbody.insertAdjacentHTML("afterbegin", newHtml);

            // Keep max 100 rows
            while (tbody.children.length > 100) tbody.removeChild(tbody.lastChild);
        });
    }

    var refreshLiveBtn = $("#btn-refresh-live");
    if (refreshLiveBtn) refreshLiveBtn.addEventListener("click", function () { lastLiveTs = 0; loadLive(); });

    // Auto-refresh live monitor every 3 seconds
    setInterval(function () {
        var autoCheck = $("#live-auto-refresh");
        var activeView = document.querySelector(".view.active");
        if (autoCheck && autoCheck.checked && activeView && activeView.id === "view-dashboard") {
            loadLive();
        }
    }, 3000);

    // ============================================================
    // Devices
    // ============================================================
    var allDevices = [];
    var deviceState = { page: 1, search: "" };

    function loadDevices() {
        fetchMehvarList(function () {
            api("GET", "/api/devices", null, function (status, data) {
                if (status === 200 && data) {
                    allDevices = data;
                } else {
                    allDevices = [];
                }
                deviceState.page = 1;
                renderDeviceTable();
                renderDeviceCards();
            });
        });
    }

    function renderDeviceTable() {
        var q = deviceState.search.toLowerCase();
        var filtered = allDevices.filter(function (d) {
            if (!q) return true;
            return (d.name || "").toLowerCase().indexOf(q) !== -1 ||
                   (d.device_code || "").indexOf(q) !== -1;
        });
        var total = filtered.length;
        var start = (deviceState.page - 1) * PAGE_SIZE;
        var paged = filtered.slice(start, start + PAGE_SIZE);

        var tbody = $("#devices-table-body");
        if (!paged.length) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8">دستگاهی یافت نشد</td></tr>';
        } else {
            tbody.innerHTML = paged.map(function (d, i) {
                var st = d.status || "offline";
                var r1 = d.route1 || d.route || "";
                var r2 = d.route2 || "";
                var r1Name = getMehvarName(r1);
                var r2Name = getMehvarName(r2);
                return "<tr>" +
                    "<td>" + (start + i + 1) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(d.device_code) + "</td>" +
                    "<td><strong>" + escapeHtml(d.name) + "</strong></td>" +
                    '<td><span class="type-badge">' + escapeHtml(TYPE_LABELS[d.type] || d.type) + "</span></td>" +
                    "<td>" + escapeHtml(r1Name || "-") + "</td>" +
                    "<td>" + escapeHtml(r2Name || "-") + "</td>" +
                    '<td><span class="status-badge ' + st + '">' + escapeHtml(STATUS_LABELS[st] || st) + "</span></td>" +
                    '<td dir="ltr" style="text-align:right">' + escapeHtml(formatTime(d.last_seen)) + "</td>" +
                    "<td>" +
                        '<div class="action-btns">' +
                            '<button class="btn btn-sm btn-primary btn-dev-edit" data-code="' + escapeHtml(d.device_code) + '">ویرایش</button>' +
                            '<button class="btn btn-sm btn-danger btn-dev-delete" data-code="' + escapeHtml(d.device_code) + '">حذف</button>' +
                        "</div></td>" +
                    "</tr>";
            }).join("");

            tbody.querySelectorAll(".btn-dev-edit").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var code = btn.getAttribute("data-code");
                    var dev = allDevices.filter(function (d) { return d.device_code === code; })[0];
                    if (!dev) return;
                    openDeviceEditModal(dev);
                });
            });

            tbody.querySelectorAll(".btn-dev-delete").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var code = btn.getAttribute("data-code");
                    if (confirm("آیا از حذف دستگاه " + code + " مطمئن هستید؟")) {
                        api("DELETE", "/api/devices/" + code, null, function (s) {
                            if (s === 200) loadDevices();
                            else alert("خطا در حذف");
                        });
                    }
                });
            });
        }

        renderTableInfo("devices", start, paged.length, total);
        renderPagination("devices", deviceState, total, renderDeviceTable);
    }

    var devSearch = $("#devices-search");
    if (devSearch) devSearch.addEventListener("input", function () {
        deviceState.search = this.value.trim();
        deviceState.page = 1;
        renderDeviceTable();
    });

    // ============================================================
    // Device Cards & Tabs
    // ============================================================

    // Device tab switching
    $$(".view-tab[data-dtab]").forEach(function (tab) {
        tab.addEventListener("click", function () {
            var tabName = tab.getAttribute("data-dtab");
            $$(".view-tab[data-dtab]").forEach(function (t) { t.classList.remove("active"); });
            tab.classList.add("active");

            var cardsView = $("#devices-cards-view");
            var tableView = $("#devices-table-view");
            var detailView = $("#devices-detail-view");
            if (cardsView) cardsView.classList.remove("active");
            if (tableView) tableView.classList.remove("active");
            if (detailView) detailView.classList.remove("active");

            if (tabName === "cards" && cardsView) cardsView.classList.add("active");
            else if (tabName === "table" && tableView) tableView.classList.add("active");
        });
    });

    // Device card search
    var devSearchCards = $("#devices-search-cards");
    if (devSearchCards) devSearchCards.addEventListener("input", function () {
        renderDeviceCards(this.value.trim());
    });

    function renderDeviceCards(searchTerm) {
        var container = $("#device-cards-container");
        if (!container) return;

        var q = (searchTerm || "").toLowerCase();
        var filtered = allDevices.filter(function (d) {
            if (!q) return true;
            return (d.name || "").toLowerCase().indexOf(q) !== -1 ||
                   (d.device_code || "").indexOf(q) !== -1;
        });

        if (!filtered.length) {
            container.innerHTML = '<div style="text-align:center;color:#94a3b8;grid-column:1/-1;padding:40px 0">دستگاهی یافت نشد</div>';
            return;
        }

        container.innerHTML = filtered.map(function (d) {
            var st = d.status || "offline";
            var typeSvg = {
                counter: '<path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/>',
                sensor: '<path d="M7 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-4c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm12.56-4.07l-1.07 1.07C16.6 5.68 14.7 4.92 12.76 4.74v-1.5c2.48.19 4.87 1.16 6.8 2.69zM18.49 7l1.07-1.07c.37.37.7.76 1 1.17l-1.22 1.22c-.28-.34-.56-.66-.85-.97zM21 12.76h1.5c-.18 1.94-.94 3.84-2.26 5.45l-1.07-1.07c1.01-1.23 1.64-2.75 1.83-4.38zm-3.73 6.95l1.07 1.07c-.37.37-.76.7-1.17 1l-1.22-1.22c.34-.28.66-.56.97-.85z"/>',
                loop: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>',
                radar: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95.49-7.42-2.98-6.93-6.93.24-1.94 1.42-3.58 3.07-4.46L12 12V4c4.42 0 8 3.58 8 8 0 4.07-3.07 7.43-7 7.93z"/>'
            };
            return '<div class="device-card" data-code="' + escapeHtml(d.device_code) + '">' +
                '<div class="device-card-status ' + st + '"></div>' +
                '<div class="device-card-icon"><svg viewBox="0 0 24 24">' + (typeSvg[d.type] || typeSvg.counter) + '</svg></div>' +
                '<div class="device-card-name">' + escapeHtml(d.name) + '</div>' +
                '<div class="device-card-code">' + escapeHtml(d.device_code) + '</div>' +
                '<div class="device-card-meta">' +
                    '<span class="type-badge">' + escapeHtml(TYPE_LABELS[d.type] || d.type) + '</span>' +
                    '<span class="status-badge ' + st + '">' + escapeHtml(STATUS_LABELS[st] || st) + '</span>' +
                '</div>' +
            '</div>';
        }).join("");

        // Click handler for device cards
        container.querySelectorAll(".device-card").forEach(function (card) {
            card.addEventListener("click", function () {
                var code = card.getAttribute("data-code");
                var dev = allDevices.filter(function (d) { return d.device_code === code; })[0];
                if (dev) showDeviceDetail(dev);
            });
        });
    }

    function showDeviceDetail(dev) {
        var panel = $("#device-detail-panel");
        if (!panel) return;

        var st = dev.status || "offline";
        var r1 = dev.route1 || dev.route || "";
        var r2 = dev.route2 || "";
        var r1Name = getMehvarName(r1);
        var r2Name = getMehvarName(r2);

        panel.innerHTML =
            '<div class="device-detail-header">' +
                '<button class="device-detail-back" id="btn-device-back">← بازگشت</button>' +
                '<div style="flex:1">' +
                    '<h3 style="font-size:16px;font-weight:700;margin-bottom:2px">' + escapeHtml(dev.name) + '</h3>' +
                    '<span dir="ltr" style="font-size:12px;color:#94a3b8">' + escapeHtml(dev.device_code) + '</span>' +
                '</div>' +
                '<span class="status-badge ' + st + '" style="font-size:13px;padding:5px 14px">' + escapeHtml(STATUS_LABELS[st] || st) + '</span>' +
            '</div>' +
            '<div class="device-detail-body">' +
                '<h4 style="font-size:14px;font-weight:700;margin-bottom:16px;color:#475569">اطلاعات ارتباطی</h4>' +
                '<div class="device-detail-grid">' +
                    '<div class="device-detail-item">' +
                        '<span class="label">آدرس IP</span>' +
                        '<span class="value" dir="ltr" style="text-align:right">' + escapeHtml(dev.ip || "تنظیم نشده") + '</span>' +
                    '</div>' +
                    '<div class="device-detail-item">' +
                        '<span class="label">وضعیت</span>' +
                        '<span class="value"><span class="status-badge ' + st + '">' + escapeHtml(STATUS_LABELS[st] || st) + '</span></span>' +
                    '</div>' +
                    '<div class="device-detail-item">' +
                        '<span class="label">آخرین اتصال</span>' +
                        '<span class="value" dir="ltr" style="text-align:right">' + escapeHtml(formatTime(dev.last_seen)) + '</span>' +
                    '</div>' +
                    '<div class="device-detail-item">' +
                        '<span class="label">فعال</span>' +
                        '<span class="value">' + (dev.active !== false && dev.active !== 0 ? "بله" : "خیر") + '</span>' +
                    '</div>' +
                '</div>' +
                '<h4 style="font-size:14px;font-weight:700;margin:20px 0 16px;color:#475569;border-top:1px solid #e2e8f0;padding-top:20px">اطلاعات تنظیمی</h4>' +
                '<div class="device-detail-grid">' +
                    '<div class="device-detail-item">' +
                        '<span class="label">نوع دستگاه</span>' +
                        '<span class="value"><span class="type-badge">' + escapeHtml(TYPE_LABELS[dev.type] || dev.type) + '</span></span>' +
                    '</div>' +
                    '<div class="device-detail-item">' +
                        '<span class="label">محور اول (لاین ۱)</span>' +
                        '<span class="value">' + escapeHtml(r1Name || "تنظیم نشده") + '</span>' +
                    '</div>' +
                    '<div class="device-detail-item">' +
                        '<span class="label">RID لاین ۱</span>' +
                        '<span class="value" dir="ltr" style="text-align:right">' + escapeHtml(dev.rid1 || "تنظیم نشده") + '</span>' +
                    '</div>' +
                    '<div class="device-detail-item">' +
                        '<span class="label">محور دوم (لاین ۲)</span>' +
                        '<span class="value">' + escapeHtml(r2Name || "تنظیم نشده") + '</span>' +
                    '</div>' +
                    '<div class="device-detail-item">' +
                        '<span class="label">RID لاین ۲</span>' +
                        '<span class="value" dir="ltr" style="text-align:right">' + escapeHtml(dev.rid2 || "تنظیم نشده") + '</span>' +
                    '</div>' +
                    '<div class="device-detail-item">' +
                        '<span class="label">فرمویر</span>' +
                        '<span class="value" dir="ltr" style="text-align:right">' + escapeHtml(dev.firmware || "-") + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="device-detail-actions">' +
                '<button class="btn btn-primary btn-dev-detail-edit" data-code="' + escapeHtml(dev.device_code) + '">ویرایش</button>' +
                '<button class="btn btn-danger btn-dev-detail-delete" data-code="' + escapeHtml(dev.device_code) + '">حذف</button>' +
            '</div>';

        // Show detail view, hide cards and tabs
        var cardsView = $("#devices-cards-view");
        var tableView = $("#devices-table-view");
        var detailView = $("#devices-detail-view");
        var tabsBar = document.querySelector("#view-devices .view-tabs");
        if (cardsView) cardsView.classList.remove("active");
        if (tableView) tableView.classList.remove("active");
        if (detailView) detailView.classList.add("active");
        if (tabsBar) tabsBar.style.display = "none";

        // Back button
        var backBtn = $("#btn-device-back");
        if (backBtn) backBtn.addEventListener("click", function () {
            if (detailView) detailView.classList.remove("active");
            if (tabsBar) tabsBar.style.display = "";
            // Restore the previously active tab
            var activeTab = document.querySelector(".view-tab[data-dtab].active");
            if (activeTab) {
                var tn = activeTab.getAttribute("data-dtab");
                if (tn === "cards" && cardsView) cardsView.classList.add("active");
                else if (tn === "table" && tableView) tableView.classList.add("active");
            } else if (cardsView) {
                cardsView.classList.add("active");
            }
        });

        // Edit button in detail view
        var editBtn = panel.querySelector(".btn-dev-detail-edit");
        if (editBtn) editBtn.addEventListener("click", function () {
            openDeviceEditModal(dev);
        });

        // Delete button in detail view
        var deleteBtn = panel.querySelector(".btn-dev-detail-delete");
        if (deleteBtn) deleteBtn.addEventListener("click", function () {
            if (confirm("آیا از حذف دستگاه " + dev.device_code + " مطمئن هستید؟")) {
                api("DELETE", "/api/devices/" + dev.device_code, null, function (s) {
                    if (s === 200) {
                        // Go back to cards view
                        if (detailView) detailView.classList.remove("active");
                        if (tabsBar) tabsBar.style.display = "";
                        if (cardsView) cardsView.classList.add("active");
                        loadDevices();
                    } else {
                        alert("خطا در حذف");
                    }
                });
            }
        });
    }

    // Add device button (from cards view)
    var addDevCardBtn = $("#btn-add-device-card");
    if (addDevCardBtn) addDevCardBtn.addEventListener("click", function () {
        // Trigger the same add device modal as the table view
        var addDevBtn = $("#btn-add-device");
        if (addDevBtn) addDevBtn.click();
    });

    // Add device
    var addDevBtn = $("#btn-add-device");
    if (addDevBtn) addDevBtn.addEventListener("click", function () {
        currentEditCode = null;
        $("#add-modal-title").textContent = "افزودن دستگاه جدید";
        fetchMehvarList(function () {
            $("#add-modal-body").innerHTML =
                '<form id="add-device-form">' +
                    '<div class="form-group"><label>کد دستگاه (حداکثر ۸ رقم)</label><input type="text" id="new-dev-code" maxlength="8" pattern="\\d{1,8}" dir="ltr" placeholder="مثال: 10010001" required></div>' +
                    '<div class="form-group"><label>نام دستگاه</label><input type="text" id="new-dev-name" required></div>' +
                    '<div class="form-group"><label>نوع</label><select id="new-dev-type">' +
                        '<option value="counter">ترددشمار</option>' +
                        '<option value="sensor">سنسور</option>' +
                        '<option value="loop">حلقه القایی</option>' +
                        '<option value="radar">رادار</option>' +
                    '</select></div>' +
                    '<div class="form-group"><label>وضعیت</label><label style="display:flex;align-items:center;gap:6px;margin-top:4px"><input type="checkbox" id="new-dev-active" checked> فعال</label></div>' +
                    '<div class="form-group"><label>محور اول (لاین ۱)</label><select id="new-dev-route1">' + buildMehvarOptions("") + '</select></div>' +
                    '<div class="form-group"><label>شماره محور RMTO لاین ۱ (RID)</label><input type="text" id="new-dev-rid1" dir="ltr" placeholder="مثال: 405060"><small style="color:#94a3b8;display:block;margin-top:2px">این شماره هنگام ارسال داده لاین ۱ به RMTO استفاده می‌شود</small></div>' +
                    '<div class="form-group"><label>محور دوم (لاین ۲)</label><select id="new-dev-route2">' + buildMehvarOptions("") + '</select></div>' +
                    '<div class="form-group"><label>شماره محور RMTO لاین ۲ (RID)</label><input type="text" id="new-dev-rid2" dir="ltr" placeholder="مثال: 405061"><small style="color:#94a3b8;display:block;margin-top:2px">این شماره هنگام ارسال داده لاین ۲ به RMTO استفاده می‌شود</small></div>' +
                    '<div class="form-group"><label>آدرس IP</label><input type="text" id="new-dev-ip" dir="ltr" placeholder="مثال: 192.168.1.1"></div>' +
                '</form>';
            currentAddMode = "device";
            $("#add-modal-overlay").classList.add("active");
        });
    });

    // Edit device modal
    var currentEditCode = null;

    function openDeviceEditModal(dev) {
        $("#add-modal-title").textContent = "ویرایش دستگاه " + dev.device_code;
        fetchMehvarList(function () {
            $("#add-modal-body").innerHTML =
                '<form id="add-device-form">' +
                    '<div class="form-group"><label>کد دستگاه</label><input type="text" id="new-dev-code" value="' + escapeHtml(dev.device_code) + '" dir="ltr" disabled style="background:#f1f5f9"></div>' +
                    '<div class="form-group"><label>نام دستگاه</label><input type="text" id="new-dev-name" value="' + escapeHtml(dev.name) + '" required></div>' +
                    '<div class="form-group"><label>نوع</label><select id="new-dev-type">' +
                        '<option value="counter"' + (dev.type === "counter" ? " selected" : "") + '>ترددشمار</option>' +
                        '<option value="sensor"' + (dev.type === "sensor" ? " selected" : "") + '>سنسور</option>' +
                        '<option value="loop"' + (dev.type === "loop" ? " selected" : "") + '>حلقه القایی</option>' +
                        '<option value="radar"' + (dev.type === "radar" ? " selected" : "") + '>رادار</option>' +
                    '</select></div>' +
                    '<div class="form-group"><label>وضعیت</label><label style="display:flex;align-items:center;gap:6px;margin-top:4px"><input type="checkbox" id="new-dev-active"' + (dev.active !== false && dev.active !== 0 ? " checked" : "") + '> فعال</label></div>' +
                    '<div class="form-group"><label>محور اول (لاین ۱)</label><select id="new-dev-route1">' + buildMehvarOptions(dev.route1 || dev.route || "") + '</select></div>' +
                    '<div class="form-group"><label>شماره محور RMTO لاین ۱ (RID)</label><input type="text" id="new-dev-rid1" value="' + escapeHtml(dev.rid1 || "") + '" dir="ltr" placeholder="مثال: 405060"><small style="color:#94a3b8;display:block;margin-top:2px">این شماره هنگام ارسال داده لاین ۱ به RMTO استفاده می‌شود</small></div>' +
                    '<div class="form-group"><label>محور دوم (لاین ۲)</label><select id="new-dev-route2">' + buildMehvarOptions(dev.route2 || "") + '</select></div>' +
                    '<div class="form-group"><label>شماره محور RMTO لاین ۲ (RID)</label><input type="text" id="new-dev-rid2" value="' + escapeHtml(dev.rid2 || "") + '" dir="ltr" placeholder="مثال: 405061"><small style="color:#94a3b8;display:block;margin-top:2px">این شماره هنگام ارسال داده لاین ۲ به RMTO استفاده می‌شود</small></div>' +
                    '<div class="form-group"><label>آدرس IP</label><input type="text" id="new-dev-ip" value="' + escapeHtml(dev.ip || "") + '" dir="ltr" placeholder="مثال: 192.168.1.1"></div>' +
                '</form>';
            currentAddMode = "device";
            currentEditCode = dev.device_code;
            $("#add-modal-overlay").classList.add("active");
        });
    }

    // Import devices from JSON/CSV file
    var importBtn = $("#btn-import-devices");
    var importFile = $("#import-devices-file");
    if (importBtn && importFile) {
        importBtn.addEventListener("click", function () { importFile.click(); });
        importFile.addEventListener("change", function () {
            var file = importFile.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function (e) {
                var text = e.target.result;
                var devices = [];
                try {
                    // Try JSON first
                    var parsed = JSON.parse(text);
                    devices = Array.isArray(parsed) ? parsed : (parsed.devices || []);
                } catch (_) {
                    // Try CSV: device_code,name,type,route1,route2
                    var lines = text.split(/[\r\n]+/).filter(function (l) { return l.trim(); });
                    for (var i = 0; i < lines.length; i++) {
                        var parts = lines[i].split(",");
                        if (parts.length >= 1 && /^\d{1,8}$/.test(parts[0].trim())) {
                            devices.push({
                                device_code: parts[0].trim(),
                                name: parts[1] ? parts[1].trim() : ("Device " + parts[0].trim()),
                                type: parts[2] ? parts[2].trim() : "counter",
                                route1: parts[3] ? parts[3].trim() : "",
                                route2: parts[4] ? parts[4].trim() : ""
                            });
                        }
                    }
                }
                if (!devices.length) { alert("هیچ دستگاهی در فایل یافت نشد"); return; }
                if (!confirm(devices.length + " دستگاه یافت شد. وارد شوند؟")) return;
                api("POST", "/api/devices/import", { devices: devices }, function (status, data) {
                    if (status === 200) {
                        alert((data && data.imported || 0) + " دستگاه وارد شد");
                        loadDevices();
                    } else {
                        alert("خطا در واردکردن");
                    }
                });
            };
            reader.readAsText(file);
            importFile.value = "";
        });
    }

    // ============================================================
    // Data Reception (irawdata)
    // ============================================================
    var receptionState = { page: 1, total: 0, filterCode: "" };

    function loadReception() {
        var code = receptionState.filterCode;
        var offset = (receptionState.page - 1) * PAGE_SIZE;
        var url = "/api/irawdata/list?limit=" + PAGE_SIZE + "&offset=" + offset;
        if (code) url += "&device_code=" + encodeURIComponent(code);

        api("GET", url, null, function (status, data) {
            var tbody = $("#reception-table-body");
            if (status !== 200 || !data || !data.rows || !data.rows.length) {
                tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#94a3b8">داده‌ای دریافت نشده</td></tr>';
                receptionState.total = 0;
                renderTableInfo("reception", 0, 0, 0);
                renderPagination("reception", receptionState, 0, loadReception);
                return;
            }

            receptionState.total = data.total;
            var rows = data.rows;
            var start = (receptionState.page - 1) * PAGE_SIZE;

            tbody.innerHTML = rows.map(function (r) {
                var total = (r.a||0) + (r.b||0) + (r.c||0) + (r.d||0) + (r.e||0) + (r.x||0);
                return "<tr>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(r.device_code) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(formatTime(r.create_at)) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(formatTime(r.stop)) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.lane||1) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.a||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.b||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.c||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.d||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.e||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.x||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center;font-weight:700">' + total + "</td>" +
                    "</tr>";
            }).join("");

            renderTableInfo("reception", start, rows.length, data.total);
            renderPagination("reception", receptionState, data.total, loadReception);
        });
    }

    var recFilter = $("#reception-filter-code");
    if (recFilter) recFilter.addEventListener("change", function () {
        receptionState.filterCode = this.value.trim();
        receptionState.page = 1;
        loadReception();
    });

    var recRefresh = $("#btn-refresh-reception");
    if (recRefresh) recRefresh.addEventListener("click", function () {
        receptionState.page = 1;
        loadReception();
    });

    // ============================================================
    // RMTO Send
    // ============================================================
    var rmtoLogFilter = "all";

    function loadRMTO() {
        loadRMTOQueue();
        loadRMTOMonitor();
        loadRMTOLogs();
    }

    function loadRMTOQueue() {
        api("GET", "/api/rmto/queue", null, function (status, data) {
            if (status !== 200 || !data) return;

            // Unsent
            var ubody = $("#rmto-unsent-body");
            if (data.unsent && data.unsent.length) {
                ubody.innerHTML = data.unsent.map(function (r) {
                    return "<tr>" +
                        '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(r.device_code) + "</td>" +
                        '<td dir="ltr" style="text-align:right">' + escapeHtml(formatTime(r.period_start)) + "</td>" +
                        '<td dir="ltr" style="text-align:center">' + (r.total_vehicles||0) + "</td>" +
                        '<td dir="ltr" style="text-align:center">' + (r.avg_speed||0) + "</td>" +
                        '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(formatTime(r.created_at)) + "</td>" +
                        "</tr>";
                }).join("");
                $("#rmto-unsent-count").textContent = data.unsent.length;
            } else {
                ubody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">صف ارسال خالی</td></tr>';
                $("#rmto-unsent-count").textContent = "0";
            }

            // Sent
            if (data.sent && data.sent.length) {
                $("#rmto-sent-count").textContent = data.sent.length + "+";
                var lastSent = data.sent[0];
                if (lastSent && lastSent.sent_at) {
                    $("#rmto-last-send").textContent = formatTime(lastSent.sent_at);
                }
            } else {
                $("#rmto-sent-count").textContent = "0";
                $("#rmto-last-send").textContent = "-";
            }

            // Error count
            var errEl = $("#rmto-error-count");
            if (errEl) errEl.textContent = data.todayErrors || "0";
        });
    }

    function loadRMTOMonitor() {
        var filter = rmtoLogFilter;
        api("GET", "/api/rmto/logs?limit=50&filter=" + filter, null, function (status, data) {
            var mbody = $("#rmto-monitor-body");
            if (status !== 200 || !data || !data.length) {
                mbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8">هنوز ارسالی انجام نشده</td></tr>';
                return;
            }
            mbody.innerHTML = data.map(function (r) {
                var ok = r.success === 1;
                var resp = r.response_data || "-";
                var respShort = resp;
                if (respShort.length > 80) respShort = respShort.substring(0, 80) + "...";
                var errMsg = r.error_message || "-";
                var errShort = errMsg;
                if (errShort.length > 80) errShort = errShort.substring(0, 80) + "...";
                return "<tr class='rmto-log-row " + (ok ? "" : "rmto-error-row") + "'>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px;white-space:nowrap">' + escapeHtml(formatTime(r.created_at)) + "</td>" +
                    '<td style="font-size:12px">' + escapeHtml(r.method) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(r.device_code) + "</td>" +
                    '<td><span class="status-badge ' + (ok ? "online" : "error") + '">' + (ok ? "موفق" : "خطا") + "</span></td>" +
                    '<td dir="ltr" style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(resp) + '">' + escapeHtml(respShort) + "</td>" +
                    '<td dir="ltr" style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + (ok ? '#94a3b8' : '#ef4444') + '" title="' + escapeHtml(errMsg) + '">' + escapeHtml(ok ? "-" : errShort) + "</td>" +
                    '<td><button class="btn btn-sm btn-secondary btn-rmto-detail" data-id="' + r.id + '">مشاهده</button></td>' +
                    "</tr>";
            }).join("");

            // Detail button click handlers
            mbody.querySelectorAll(".btn-rmto-detail").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    showRMTODetail(parseInt(btn.getAttribute("data-id"), 10));
                });
            });
        });
    }

    function loadRMTOLogs() {
        api("GET", "/api/rmto/logs?limit=30", null, function (status, data) {
            var lbody = $("#rmto-log-body");
            if (status !== 200 || !data || !data.length) {
                lbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">هنوز ارسالی انجام نشده</td></tr>';
                return;
            }
            lbody.innerHTML = data.map(function (r) {
                var ok = r.success === 1;
                var resp = r.response_data || "";
                if (resp.length > 60) resp = resp.substring(0, 60) + "...";
                return "<tr>" +
                    "<td>" + escapeHtml(r.method) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(r.device_code) + "</td>" +
                    '<td><span class="status-badge ' + (ok ? "online" : "error") + '">' + (ok ? "موفق" : "خطا") + "</span></td>" +
                    '<td dir="ltr" style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(resp) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(formatTime(r.created_at)) + "</td>" +
                    "</tr>";
            }).join("");
        });
    }

    function showRMTODetail(logId) {
        api("GET", "/api/rmto/log/" + logId, null, function (status, data) {
            if (status !== 200 || !data) { alert("خطا در بارگذاری جزئیات"); return; }
            var ok = data.success === 1;
            var reqData = "-";
            var respData = "-";
            try { reqData = JSON.stringify(JSON.parse(data.request_data), null, 2); } catch (e) { reqData = data.request_data || "-"; }
            try { respData = JSON.stringify(JSON.parse(data.response_data), null, 2); } catch (e) { respData = data.response_data || "-"; }

            // Format SOAP XML nicely
            var soapXml = data.soap_xml || "";
            var soapSection = "";
            if (soapXml) {
                // Simple XML formatting
                var formatted = soapXml
                    .replace(/></g, ">\n<")
                    .replace(/\n\s*\n/g, "\n");
                soapSection =
                    '<div style="margin-bottom:12px">' +
                        '<strong style="color:#7c3aed">SOAP XML ارسالی:</strong>' +
                        '<pre dir="ltr" style="margin:6px 0 0;background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px;white-space:pre-wrap;word-break:break-all;font-size:11px;max-height:300px;overflow-y:auto;font-family:monospace;line-height:1.5">' + escapeHtml(formatted) + '</pre>' +
                    '</div>';
            }

            $("#modal-title").textContent = "جزئیات ارسال سامانه - " + data.method;
            $("#modal-body").innerHTML =
                '<div style="margin-bottom:16px">' +
                    '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px">' +
                        '<div><strong>متد:</strong> ' + escapeHtml(data.method) + '</div>' +
                        '<div><strong>کد دستگاه:</strong> <span dir="ltr">' + escapeHtml(data.device_code) + '</span></div>' +
                        '<div><strong>زمان:</strong> <span dir="ltr">' + escapeHtml(formatTime(data.created_at)) + '</span></div>' +
                        '<div><strong>وضعیت:</strong> <span class="status-badge ' + (ok ? "online" : "error") + '">' + (ok ? "موفق" : "خطا") + '</span></div>' +
                    '</div>' +
                '</div>' +
                (data.error_message ?
                    '<div style="margin-bottom:12px;padding:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px">' +
                        '<strong style="color:#ef4444">پیام خطا:</strong>' +
                        '<pre dir="ltr" style="margin:6px 0 0;white-space:pre-wrap;word-break:break-all;font-size:12px;color:#dc2626;font-family:monospace">' + escapeHtml(data.error_message) + '</pre>' +
                    '</div>'
                : '') +
                soapSection +
                '<div style="margin-bottom:12px">' +
                    '<strong>داده‌های ارسالی (Request):</strong>' +
                    '<pre dir="ltr" style="margin:6px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;white-space:pre-wrap;word-break:break-all;font-size:12px;max-height:200px;overflow-y:auto;font-family:monospace">' + escapeHtml(reqData) + '</pre>' +
                '</div>' +
                '<div>' +
                    '<strong>پاسخ RMTO (Response):</strong>' +
                    '<pre dir="ltr" style="margin:6px 0 0;background:' + (ok ? '#f0fdf4' : '#fef2f2') + ';border:1px solid ' + (ok ? '#bbf7d0' : '#fecaca') + ';border-radius:8px;padding:10px;white-space:pre-wrap;word-break:break-all;font-size:12px;max-height:200px;overflow-y:auto;font-family:monospace">' + escapeHtml(respData) + '</pre>' +
                '</div>';
            $("#modal-overlay").classList.add("active");
        });
    }

    function showSendResult(data) {
        var resultEl = $("#rmto-send-result");
        if (!resultEl) return;
        resultEl.style.display = "inline-block";
        if (data.total === 0) {
            resultEl.innerHTML = '<span style="color:#94a3b8">صف ارسال خالی است</span>';
        } else if (data.sent_failed === 0) {
            resultEl.innerHTML = '<span style="color:#22c55e;font-weight:700">' + data.sent_success + ' رکورد با موفقیت ارسال شد</span>';
        } else if (data.sent_success === 0) {
            resultEl.innerHTML = '<span style="color:#ef4444;font-weight:700">خطا در ارسال ' + data.sent_failed + ' رکورد</span>';
        } else {
            resultEl.innerHTML = '<span style="color:#f59e0b;font-weight:700">' + data.sent_success + ' موفق، ' + data.sent_failed + ' خطا</span>';
        }
        // Show errors if any
        if (data.errors && data.errors.length) {
            var errList = data.errors.slice(0, 3).map(function (e) {
                return escapeHtml(e.method + " [" + e.device_code + "]: " + e.error);
            }).join("<br>");
            if (data.errors.length > 3) errList += "<br>...و " + (data.errors.length - 3) + " خطای دیگر";
            resultEl.innerHTML += '<div style="margin-top:6px;padding:8px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:6px;font-size:11px;color:#dc2626;direction:ltr;text-align:left">' + errList + '</div>';
        }
        // Auto-hide after 30s
        setTimeout(function () { resultEl.style.display = "none"; }, 30000);
    }

    var rmtoSendBtn = $("#btn-rmto-send-now");
    if (rmtoSendBtn) rmtoSendBtn.addEventListener("click", function () {
        rmtoSendBtn.disabled = true;
        rmtoSendBtn.textContent = "در حال ارسال...";
        var resultEl = $("#rmto-send-result");
        if (resultEl) { resultEl.style.display = "inline-block"; resultEl.innerHTML = '<span style="color:#64748b">منتظر پاسخ RMTO...</span>'; }
        api("POST", "/api/rmto/send-now", {}, function (status, data) {
            rmtoSendBtn.disabled = false;
            rmtoSendBtn.textContent = "ارسال الان";
            if (status === 200 && data) {
                showSendResult(data);
                loadRMTO();
            } else {
                if (resultEl) { resultEl.style.display = "inline-block"; resultEl.innerHTML = '<span style="color:#ef4444;font-weight:700">خطا در ارتباط با سرور</span>'; }
            }
        });
    });

    var rmtoAggBtn = $("#btn-rmto-aggregate");
    if (rmtoAggBtn) rmtoAggBtn.addEventListener("click", function () {
        rmtoAggBtn.disabled = true;
        rmtoAggBtn.textContent = "در حال تجمیع...";
        api("POST", "/api/rmto/aggregate", {}, function (status, data) {
            rmtoAggBtn.disabled = false;
            rmtoAggBtn.textContent = "تجمیع و ارسال";
            if (status === 200) {
                var resultEl = $("#rmto-send-result");
                if (resultEl) {
                    resultEl.style.display = "inline-block";
                    resultEl.innerHTML = '<span style="color:#22c55e">تجمیع انجام شد. ارسال در پس‌زمینه...</span>';
                }
                // Reload after a short delay to show send results
                setTimeout(loadRMTO, 3000);
            } else {
                var resultEl2 = $("#rmto-send-result");
                if (resultEl2) { resultEl2.style.display = "inline-block"; resultEl2.innerHTML = '<span style="color:#ef4444;font-weight:700">خطا در تجمیع</span>'; }
            }
        });
    });

    var rmtoRefreshBtn = $("#btn-rmto-refresh");
    if (rmtoRefreshBtn) rmtoRefreshBtn.addEventListener("click", loadRMTO);

    // Monitor filter
    var rmtoFilterEl = $("#rmto-log-filter");
    if (rmtoFilterEl) rmtoFilterEl.addEventListener("change", function () {
        rmtoLogFilter = this.value;
        loadRMTOMonitor();
    });

    var rmtoRefreshLogsBtn = $("#btn-refresh-rmto-logs");
    if (rmtoRefreshLogsBtn) rmtoRefreshLogsBtn.addEventListener("click", loadRMTOMonitor);

    // ============================================================
    // Test Send
    // ============================================================
    var testSendLogs = [];

    function loadTestSend() {
        // Populate route and device dropdowns
        fetchMehvarList(function () {
            var routeSelect = $("#test-send-route");
            if (routeSelect) {
                routeSelect.innerHTML = '<option value="">انتخاب محور...</option>';
                cachedMehvarList.forEach(function (m) {
                    routeSelect.innerHTML += '<option value="' + escapeHtml(String(m.code)) + '">' +
                        escapeHtml(m.name) + ' | ' + escapeHtml(String(m.code)) + '</option>';
                });
            }
        });

        api("GET", "/api/devices", null, function (status, data) {
            var devSelect = $("#test-send-device");
            if (!devSelect) return;
            devSelect.innerHTML = '<option value="">انتخاب دستگاه...</option>';
            if (status === 200 && data) {
                data.forEach(function (d) {
                    devSelect.innerHTML += '<option value="' + escapeHtml(d.device_code) + '">' +
                        escapeHtml(d.name) + ' | ' + escapeHtml(d.device_code) + '</option>';
                });
            }
        });

        // Set default date range (today)
        var now = new Date();
        var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);
        var endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 55);
        var startInput = $("#test-send-start");
        var endInput = $("#test-send-end");
        if (startInput && !startInput.value) {
            startInput.value = toLocalISO(startOfDay);
        }
        if (endInput && !endInput.value) {
            endInput.value = toLocalISO(endOfDay);
        }

        renderTestSendLogs();
    }

    function toLocalISO(d) {
        var y = d.getFullYear();
        var mo = String(d.getMonth() + 1).padStart(2, "0");
        var dy = String(d.getDate()).padStart(2, "0");
        var h = String(d.getHours()).padStart(2, "0");
        var m = String(d.getMinutes()).padStart(2, "0");
        return y + "-" + mo + "-" + dy + "T" + h + ":" + m;
    }

    function renderTestSendLogs() {
        var tbody = $("#test-send-log-body");
        if (!tbody) return;
        if (!testSendLogs.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8">هنوز ارسال تستی انجام نشده</td></tr>';
            return;
        }
        tbody.innerHTML = testSendLogs.map(function (log) {
            var ok = log.success;
            return "<tr>" +
                '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(log.time) + "</td>" +
                "<td>" + escapeHtml(log.route) + "</td>" +
                '<td dir="ltr" style="text-align:right">' + escapeHtml(log.device) + "</td>" +
                '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(log.range) + "</td>" +
                '<td dir="ltr" style="text-align:center">' + escapeHtml(String(log.vehicles)) + "</td>" +
                '<td><span class="status-badge ' + (ok ? "online" : "error") + '">' + (ok ? "موفق" : "خطا") + "</span></td>" +
                '<td dir="ltr" style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(log.response || "-") + "</td>" +
                "</tr>";
        }).join("");
    }

    var testSendBtn = $("#btn-test-send");
    if (testSendBtn) testSendBtn.addEventListener("click", function () {
        var route = ($("#test-send-route") || {}).value;
        var device = ($("#test-send-device") || {}).value;
        var start = ($("#test-send-start") || {}).value;
        var end = ($("#test-send-end") || {}).value;
        var vehicles = parseInt(($("#test-send-vehicles") || {}).value || "100", 10);
        var speed = parseInt(($("#test-send-speed") || {}).value || "80", 10);

        if (!route) { alert("لطفا محور را انتخاب کنید"); return; }
        if (!device) { alert("لطفا دستگاه را انتخاب کنید"); return; }
        if (!start || !end) { alert("لطفا بازه تاریخی را مشخص کنید"); return; }

        var resultEl = $("#test-send-result");
        testSendBtn.disabled = true;
        testSendBtn.textContent = "در حال ارسال...";
        if (resultEl) {
            resultEl.style.display = "block";
            resultEl.className = "test-send-result";
            resultEl.textContent = "در حال ارسال داده تست به سامانه...";
        }

        var dist = calcVehicleDist(vehicles);

        var body = {
            device_code: device,
            route_code: route,
            start_time: new Date(start).toISOString(),
            end_time: new Date(end).toISOString(),
            c1: dist.c1, c2: dist.c2, c3: dist.c3, c4: dist.c4, c5: dist.c5,
            avg_speed: speed,
            total_vehicles: vehicles
        };

        api("POST", "/api/rmto/test-send", body, function (status, data) {
            testSendBtn.disabled = false;
            testSendBtn.textContent = "ارسال تست به سامانه";

            var routeName = "";
            for (var i = 0; i < cachedMehvarList.length; i++) {
                if (String(cachedMehvarList[i].code) === String(route)) {
                    routeName = cachedMehvarList[i].name;
                    break;
                }
            }

            var logEntry = {
                time: formatTime(new Date().toISOString()),
                route: routeName || route,
                device: device,
                range: formatTime(new Date(start).toISOString()) + " - " + formatTime(new Date(end).toISOString()),
                vehicles: vehicles,
                success: false,
                response: ""
            };

            if (status === 200 && data) {
                logEntry.success = !data.error;
                logEntry.response = data.message || data.response || JSON.stringify(data);
                if (resultEl) {
                    resultEl.className = "test-send-result " + (data.error ? "error" : "success");
                    resultEl.textContent = data.error ?
                        ("خطا: " + (data.error || "خطا در ارسال")) :
                        (data.message || "داده تست با موفقیت ارسال شد");
                }
            } else {
                logEntry.response = "خطا در ارتباط با سرور";
                if (resultEl) {
                    resultEl.className = "test-send-result error";
                    resultEl.textContent = "خطا در ارتباط با سرور";
                }
            }

            testSendLogs.unshift(logEntry);
            if (testSendLogs.length > 20) testSendLogs.pop();
            renderTestSendLogs();
        });
    });

    var testPreviewBtn = $("#btn-test-preview");
    if (testPreviewBtn) testPreviewBtn.addEventListener("click", function () {
        var route = ($("#test-send-route") || {}).value;
        var device = ($("#test-send-device") || {}).value;
        var start = ($("#test-send-start") || {}).value;
        var end = ($("#test-send-end") || {}).value;
        var vehicles = parseInt(($("#test-send-vehicles") || {}).value || "100", 10);
        var speed = parseInt(($("#test-send-speed") || {}).value || "80", 10);

        if (!route || !device || !start || !end) {
            alert("لطفا تمام فیلدها را پر کنید");
            return;
        }

        var dist = calcVehicleDist(vehicles);

        var resultEl = $("#test-send-result");
        if (resultEl) {
            resultEl.style.display = "block";
            resultEl.className = "test-send-result";
            resultEl.innerHTML =
                '<strong>پیش‌نمایش داده ارسالی:</strong>' +
                '<pre dir="ltr" style="margin:8px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-family:monospace;font-size:12px;white-space:pre-wrap;line-height:1.6">' +
                    'Route Code: ' + escapeHtml(route) + '\n' +
                    'Device Code: ' + escapeHtml(device) + '\n' +
                    'Start: ' + escapeHtml(new Date(start).toISOString()) + '\n' +
                    'End: ' + escapeHtml(new Date(end).toISOString()) + '\n' +
                    'C1 (Motorcycle): ' + dist.c1 + '\n' +
                    'C2 (Car): ' + dist.c2 + '\n' +
                    'C3 (Van): ' + dist.c3 + '\n' +
                    'C4 (Bus): ' + dist.c4 + '\n' +
                    'C5 (Truck+Other): ' + dist.c5 + '\n' +
                    'Total: ' + vehicles + '\n' +
                    'Avg Speed: ' + speed + ' km/h' +
                '</pre>';
        }
    });

    // ============================================================
    // Mehvar (Routes) Management
    // ============================================================
    function loadMehvar() {
        api("GET", "/api/mehvar", null, function (status, data) {
            var tbody = $("#mehvar-table-body");
            if (status !== 200 || !data || !data.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8">محوری ثبت نشده</td></tr>';
                return;
            }
            tbody.innerHTML = data.map(function (r) {
                return "<tr>" +
                    '<td dir="ltr" style="text-align:center;font-weight:700">' + escapeHtml(r.code) + "</td>" +
                    "<td>" + escapeHtml(r.name) + "</td>" +
                    "<td>" + escapeHtml(r.ostan || "-") + "</td>" +
                    '<td style="text-align:center"><span class="status-badge ' + (r.send_enable ? "online" : "warning") + '">' +
                        (r.send_enable ? "فعال" : "غیرفعال") + "</span></td>" +
                    '<td style="text-align:center"><span class="status-badge ' + (r.repair ? "error" : "") + '">' +
                        (r.repair ? "بله" : "خیر") + "</span></td>" +
                    '<td>' +
                        '<button class="btn btn-sm" data-action="edit-mehvar" data-code="' + escapeHtml(String(r.code)) + '" data-name="' + escapeHtml(r.name) + '" data-ostan="' + escapeHtml(r.ostan || "") + '" data-send="' + (r.send_enable ? 1 : 0) + '" data-repair="' + (r.repair ? 1 : 0) + '">ویرایش</button> ' +
                        '<button class="btn btn-sm btn-danger" data-action="delete-mehvar" data-code="' + escapeHtml(String(r.code)) + '">حذف</button>' +
                    '</td>' +
                    "</tr>";
            }).join("");
        });
    }

    // Event delegation for mehvar table buttons
    var mehvarTableEl = $("#mehvar-table-body");
    if (mehvarTableEl) mehvarTableEl.addEventListener("click", function (e) {
        var deleteBtn = e.target.closest("button[data-action='delete-mehvar']");
        if (deleteBtn) {
            var code = deleteBtn.getAttribute("data-code");
            if (!confirm("محور " + code + " حذف شود؟")) return;
            api("DELETE", "/api/mehvar/" + encodeURIComponent(code), null, function (status) {
                if (status === 200) loadMehvar();
                else alert("خطا در حذف محور");
            });
            return;
        }
        var editBtn = e.target.closest("button[data-action='edit-mehvar']");
        if (editBtn) {
            var ecode = editBtn.getAttribute("data-code");
            var ename = editBtn.getAttribute("data-name");
            var eostan = editBtn.getAttribute("data-ostan");
            var esend = editBtn.getAttribute("data-send");
            var erepair = editBtn.getAttribute("data-repair");
            $("#add-modal-title").textContent = "ویرایش محور " + ecode;
            $("#add-modal-body").innerHTML =
                '<div class="form-group"><label>کد محور</label><input type="number" id="new-mehvar-code" value="' + escapeHtml(ecode) + '" dir="ltr" disabled style="background:#f1f5f9"></div>' +
                '<div class="form-group"><label>نام محور</label><input type="text" id="new-mehvar-name" value="' + escapeHtml(ename) + '"></div>' +
                '<div class="form-group"><label>استان</label><input type="text" id="new-mehvar-ostan" value="' + escapeHtml(eostan) + '"></div>' +
                '<div class="form-group"><label>ارسال به سامانه</label><select id="new-mehvar-send">' +
                    '<option value="1"' + (esend === "1" ? " selected" : "") + '>فعال</option>' +
                    '<option value="0"' + (esend === "0" ? " selected" : "") + '>غیرفعال</option>' +
                '</select></div>' +
                '<div class="form-group"><label>تحت تعمیر</label><select id="new-mehvar-repair">' +
                    '<option value="0"' + (erepair === "0" ? " selected" : "") + '>خیر</option>' +
                    '<option value="1"' + (erepair === "1" ? " selected" : "") + '>بله</option>' +
                '</select></div>';
            currentAddMode = "mehvar-edit";
            currentEditMehvarCode = ecode;
            $("#add-modal-overlay").classList.add("active");
        }
    });

    var addMehvarBtn = $("#btn-add-mehvar");
    if (addMehvarBtn) addMehvarBtn.addEventListener("click", function () {
        var addBody = $("#add-modal-body");
        var addTitle = $("#add-modal-title");
        if (!addBody || !addTitle) return;
        addTitle.textContent = "افزودن محور جدید";
        addBody.innerHTML =
            '<div class="form-group"><label>کد محور (کد عددی RMTO)</label><input type="number" id="new-mehvar-code" min="1" placeholder="مثال: 405060" dir="ltr"><small style="color:#94a3b8;display:block;margin-top:2px">این کد باید همان کد محور در سامانه RMTO باشد</small></div>' +
            '<div class="form-group"><label>نام محور</label><input type="text" id="new-mehvar-name" placeholder="مثال: تهران - مشهد"></div>' +
            '<div class="form-group"><label>استان</label><input type="text" id="new-mehvar-ostan" placeholder="مثال: تهران"></div>' +
            '<div class="form-group"><label>ارسال به سامانه</label><select id="new-mehvar-send">' +
                '<option value="1">فعال</option><option value="0">غیرفعال</option>' +
            '</select></div>' +
            '<div class="form-group"><label>تحت تعمیر</label><select id="new-mehvar-repair">' +
                '<option value="0">خیر</option><option value="1">بله</option>' +
            '</select></div>';
        currentAddMode = "mehvar";
        $("#add-modal-overlay").classList.add("active");
    });

    var refreshMehvarBtn = $("#btn-refresh-mehvar");
    if (refreshMehvarBtn) refreshMehvarBtn.addEventListener("click", loadMehvar);

    // ============================================================
    // Settings
    // ============================================================
    function loadSettings() {
        loadServerTime();
        api("GET", "/api/settings", null, function (status, data) {
            if (status !== 200 || !data) return;
            if (data.system_name) $("#setting-name").value = data.system_name;
            if (data.server_ip) $("#setting-server").value = data.server_ip;
            if (data.server_port) $("#setting-port").value = data.server_port;
            if (data.tcp_port) { var tp = $("#setting-tcp-port"); if (tp) tp.value = data.tcp_port; }
            if (data.refresh_interval) $("#setting-refresh").value = data.refresh_interval;
            if (data.max_speed) $("#setting-max-speed").value = data.max_speed;
            // RMTO
            if (data.rmto_wsdl) $("#setting-rmto-wsdl").value = data.rmto_wsdl;
            if (data.rmto_company_code) $("#setting-rmto-company").value = data.rmto_company_code;
            if (data.rmto_username) $("#setting-rmto-user").value = data.rmto_username;
            if (data.rmto_password) $("#setting-rmto-pass").value = data.rmto_password;
        });
    }

    function saveSettings(body, msg) {
        api("POST", "/api/settings", body, function (status) {
            if (status === 200) alert(msg || "ذخیره شد");
            else alert("خطا در ذخیره");
        });
    }

    var saveSettingsBtn = $("#btn-save-settings");
    if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", function () {
        var tcpPort = $("#setting-tcp-port");
        saveSettings({
            system_name: $("#setting-name").value,
            server_ip: $("#setting-server").value,
            server_port: $("#setting-port").value,
            tcp_port: tcpPort ? tcpPort.value : "2022",
            refresh_interval: $("#setting-refresh").value,
            max_speed: $("#setting-max-speed").value
        }, "تنظیمات عمومی ذخیره شد.");
    });

    var saveRmtoBtn = $("#btn-save-rmto");
    if (saveRmtoBtn) saveRmtoBtn.addEventListener("click", function () {
        saveSettings({
            rmto_wsdl: $("#setting-rmto-wsdl").value,
            rmto_company_code: $("#setting-rmto-company").value,
            rmto_username: $("#setting-rmto-user").value,
            rmto_password: $("#setting-rmto-pass").value
        }, "تنظیمات سامانه ذخیره شد.");
    });

    // Server Time
    function loadServerTime() {
        api("GET", "/api/server/time", null, function (status, data) {
            if (status !== 200 || !data) return;
            var el = $("#server-time-display");
            if (el && data.local) el.textContent = data.local;
            else if (el && data.time) {
                var d = new Date(data.time);
                el.textContent = d.toLocaleString("fa-IR");
            }
            var tz = $("#server-timezone");
            if (tz) tz.textContent = data.timezone || "-";
            var ut = $("#server-uptime");
            if (ut && data.uptime) {
                var sec = Math.floor(data.uptime);
                var days = Math.floor(sec / 86400);
                var hrs = Math.floor((sec % 86400) / 3600);
                var mins = Math.floor((sec % 3600) / 60);
                ut.textContent = days + " روز " + hrs + " ساعت " + mins + " دقیقه";
            }
        });
    }

    var refreshTimeBtn = $("#btn-refresh-server-time");
    if (refreshTimeBtn) refreshTimeBtn.addEventListener("click", loadServerTime);

    // Change password
    var changePassBtn = $("#btn-change-pass");
    if (changePassBtn) changePassBtn.addEventListener("click", function () {
        var oldP = $("#setting-old-pass").value;
        var newP = $("#setting-new-pass").value;
        if (!oldP || !newP) { alert("لطفا هر دو فیلد را پر کنید"); return; }
        api("POST", "/api/auth/change-password", { old_password: oldP, new_password: newP }, function (status, data) {
            if (status === 200) { alert("رمز عبور تغییر کرد"); $("#setting-old-pass").value = ""; $("#setting-new-pass").value = ""; }
            else alert((data && data.error) || "خطا");
        });
    });

    // Logout
    var logoutBtn = $("#btn-logout");
    if (logoutBtn) logoutBtn.addEventListener("click", function () {
        api("POST", "/api/auth/logout", {}, function () {
            loginOverlay.classList.remove("hidden");
        });
    });

    // Backup download
    var backupDlBtn = $("#btn-backup-download");
    if (backupDlBtn) backupDlBtn.addEventListener("click", function () {
        window.location.href = "/api/backup/download";
    });

    // Backup restore
    var backupRestoreBtn = $("#btn-backup-restore");
    if (backupRestoreBtn) backupRestoreBtn.addEventListener("click", function () {
        var fileInput = $("#backup-file");
        if (!fileInput.files || !fileInput.files[0]) { alert("لطفا فایل پشتیبان را انتخاب کنید"); return; }
        var formData = new FormData();
        formData.append("backup", fileInput.files[0]);
        var statusEl = $("#backup-status");
        statusEl.textContent = "در حال آپلود و پردازش...";
        statusEl.style.color = "#475569";
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/backup/restore", true);
        xhr.withCredentials = true;
        xhr.onload = function () {
            var r;
            try { r = JSON.parse(xhr.responseText); } catch (e) { r = {}; }
            if (xhr.status === 200) {
                statusEl.textContent = r.message || "بازیابی انجام شد";
                statusEl.style.color = "#22c55e";
            } else {
                statusEl.textContent = r.error || "خطا در بازیابی";
                statusEl.style.color = "#ef4444";
            }
        };
        xhr.onerror = function () { statusEl.textContent = "خطا در ارتباط با سرور"; statusEl.style.color = "#ef4444"; };
        xhr.send(formData);
    });

    // ============================================================
    // Add Modal (shared)
    // ============================================================
    var currentAddMode = "";
    var currentEditMehvarCode = null;

    var addSaveBtn = $("#add-modal-save");
    if (addSaveBtn) addSaveBtn.addEventListener("click", function () {
        if (currentAddMode === "mehvar-edit") {
            var mname = ($("#new-mehvar-name").value || "").trim();
            if (!mname) { alert("نام محور الزامی است"); return; }
            api("PUT", "/api/mehvar/" + encodeURIComponent(currentEditMehvarCode), {
                name: mname,
                ostan: ($("#new-mehvar-ostan").value || "").trim(),
                send_enable: parseInt($("#new-mehvar-send").value, 10),
                repair: parseInt($("#new-mehvar-repair").value, 10)
            }, function (status) {
                if (status === 200) {
                    $("#add-modal-overlay").classList.remove("active");
                    currentEditMehvarCode = null;
                    loadMehvar();
                    fetchMehvarList(function () {});
                } else {
                    alert("خطا در ویرایش محور");
                }
            });
        } else if (currentAddMode === "mehvar") {
            var mcode = parseInt($("#new-mehvar-code").value, 10);
            var mname = ($("#new-mehvar-name").value || "").trim();
            if (!mcode || isNaN(mcode) || mcode <= 0) { alert("کد محور باید عدد مثبت باشد (کد RMTO)"); return; }
            if (!mname) { alert("نام محور الزامی است"); return; }
            api("POST", "/api/mehvar", {
                code: mcode,
                name: mname,
                ostan: ($("#new-mehvar-ostan").value || "").trim(),
                send_enable: parseInt($("#new-mehvar-send").value, 10),
                repair: parseInt($("#new-mehvar-repair").value, 10)
            }, function (status, data) {
                if (status === 200) {
                    $("#add-modal-overlay").classList.remove("active");
                    loadMehvar();
                } else {
                    alert((data && data.error) || "خطا در ثبت محور");
                }
            });
        } else if (currentAddMode === "device") {
            var dcode = ($("#new-dev-code") || {}).value;
            var dname = ($("#new-dev-name") || {}).value;
            if (!dname || !dname.trim()) { alert("لطفا نام دستگاه را وارد کنید"); return; }
            var dtype = ($("#new-dev-type") || {}).value || "counter";
            var droute1 = ($("#new-dev-route1") || {}).value || "";
            var droute2 = ($("#new-dev-route2") || {}).value || "";
            var drid1 = ($("#new-dev-rid1") || {}).value || "";
            var drid2 = ($("#new-dev-rid2") || {}).value || "";
            var dip = ($("#new-dev-ip") || {}).value || "";
            var dactive = $("#new-dev-active") ? ($("#new-dev-active").checked ? 1 : 0) : 1;
            // Ensure route values are numeric (mehvar code)
            if (droute1 && isNaN(parseInt(droute1, 10))) droute1 = "";
            if (droute2 && isNaN(parseInt(droute2, 10))) droute2 = "";

            if (currentEditCode) {
                // Edit mode - PUT
                api("PUT", "/api/devices/" + currentEditCode, {
                    name: dname.trim(),
                    type: dtype,
                    route1: droute1,
                    route2: droute2,
                    rid1: drid1,
                    rid2: drid2,
                    ip: dip,
                    active: dactive
                }, function (status) {
                    if (status === 200) {
                        $("#add-modal-overlay").classList.remove("active");
                        currentEditCode = null;
                        loadDevices();
                    } else {
                        alert("خطا در ویرایش");
                    }
                });
            } else {
                // Add mode - POST
                if (!dcode || !/^\d{1,8}$/.test(dcode)) { alert("کد دستگاه باید عددی و حداکثر ۸ رقم باشد"); return; }
                api("POST", "/api/devices", {
                    device_code: dcode,
                    name: dname.trim(),
                    type: dtype,
                    route1: droute1,
                    route2: droute2,
                    rid1: drid1,
                    rid2: drid2,
                    ip: dip,
                    active: dactive
                }, function (status, data) {
                    if (status === 200) {
                        $("#add-modal-overlay").classList.remove("active");
                        loadDevices();
                    } else {
                        alert((data && data.error) || "خطا در ثبت دستگاه");
                    }
                });
            }
        }
    });

    // ============================================================
    // Modal Close Handlers
    // ============================================================
    ["modal-close", "modal-cancel"].forEach(function (id) {
        var el = $("#" + id);
        if (el) el.addEventListener("click", function () { $("#modal-overlay").classList.remove("active"); });
    });

    ["add-modal-close", "add-modal-cancel"].forEach(function (id) {
        var el = $("#" + id);
        if (el) el.addEventListener("click", function () { $("#add-modal-overlay").classList.remove("active"); });
    });

    ["modal-overlay", "add-modal-overlay"].forEach(function (id) {
        var el = $("#" + id);
        if (el) el.addEventListener("click", function (e) {
            if (e.target === el) el.classList.remove("active");
        });
    });

    // ============================================================
    // Shared: Table Info & Pagination
    // ============================================================
    function renderTableInfo(prefix, start, count, total) {
        var el = $("#" + prefix + "-table-info");
        if (!el) return;
        if (total === 0) {
            el.textContent = "داده‌ای یافت نشد";
        } else {
            el.textContent = "نمایش " + (start + 1) + " تا " + (start + count) + " از " + total + " ردیف";
        }
    }

    function renderPagination(prefix, state, total, renderFn) {
        var container = $("#" + prefix + "-pagination");
        if (!container) return;
        var pages = Math.ceil(total / PAGE_SIZE);
        if (pages <= 1) { container.innerHTML = ""; return; }

        var html = "";
        html += '<button class="page-btn" data-p="prev" ' + (state.page <= 1 ? "disabled" : "") + '>&laquo;</button>';
        var startPage = Math.max(1, state.page - 2);
        var endPage = Math.min(pages, startPage + 4);
        for (var i = startPage; i <= endPage; i++) {
            html += '<button class="page-btn ' + (i === state.page ? "active" : "") + '" data-p="' + i + '">' + i + '</button>';
        }
        html += '<button class="page-btn" data-p="next" ' + (state.page >= pages ? "disabled" : "") + '>&raquo;</button>';
        container.innerHTML = html;

        container.querySelectorAll(".page-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var p = btn.getAttribute("data-p");
                if (p === "prev") state.page = Math.max(1, state.page - 1);
                else if (p === "next") state.page = Math.min(pages, state.page + 1);
                else state.page = parseInt(p, 10);
                renderFn();
            });
        });
    }

    // ============================================================
    // Auto-refresh every 30s
    // ============================================================
    setInterval(function () {
        var activeView = document.querySelector(".view.active");
        if (!activeView) return;
        var id = activeView.id;
        if (id === "view-dashboard") loadDashboard();
        else if (id === "view-reception") loadReception();
    }, 30000);

})();
