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
            // Global 401 handler: session expired → show login overlay
            if (xhr.status === 401 && url.indexOf("/api/auth/") === -1) {
                serverConnected = true;
                updateConnectionStatus(true);
                loginOverlay.classList.remove("hidden");
                return;
            }
            callback(xhr.status, data);
        };
        xhr.onerror = function () { callback(0, null); };
        xhr.send(body ? JSON.stringify(body) : null);
    }

    var TYPE_LABELS = { counter: "ترددشمار", sensor: "سنسور", loop: "حلقه القایی", radar: "رادار" };
    var STATUS_LABELS = { online: "آنلاین", offline: "آفلاین", warning: "هشدار", error: "خطا" };

    var ERROR_BITS = {
        1:   'MMC_ERR - کارت حافظه',
        2:   'LP1_ERR - لوپ ۱',
        4:   'LP2_ERR - لوپ ۲',
        8:   'LP3_ERR - لوپ ۳',
        16:  'LP4_ERR - لوپ ۴',
        32:  'VMN_ERR - ولتاژ شبانه',
        64:  'SOL_ERR - پنل خورشیدی',
        128: 'LBT_ERR - باتری ضعیف',
        256: 'L1D_ERR - جهت لاین ۱',
        512: 'L2D_ERR - جهت لاین ۲'
    };
    function decodeErrorByte(code) {
        if (!code) return [];
        return Object.keys(ERROR_BITS).filter(function(bit) {
            return (code & parseInt(bit, 10)) !== 0;
        }).map(function(bit) { return ERROR_BITS[bit]; });
    }

    var VIEW_TITLES = {
        dashboard: "داشبورد",
        devices: "دستگاه‌ها",
        reception: "دریافت داده",
        rmto: "ارسال به سامانه",
        mehvar: "محورها",
        "test-sender": "ارسال تست",
        history: "تاریخچه",
        settings: "تنظیمات"
    };

    var PAGE_SIZE = 20;

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

        if (view === "dashboard") loadDashboard();
        else if (view === "devices") loadDevices();
        else if (view === "reception") loadReception();
        else if (view === "rmto") loadRMTO();
        else if (view === "mehvar") loadMehvar();
        else if (view === "test-sender") initTestSender();
        else if (view === "history") loadHistory(1);
        else if (view === "settings") loadSettings();

        // Auto-refresh server time only on settings page
        if (view === "settings") startServerTimeRefresh();
        else stopServerTimeRefresh();
    }

    // Sidebar toggle (mobile)
    $("#sidebar-toggle").addEventListener("click", function () {
        $("#sidebar").classList.toggle("open");
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
            var grid = $("#device-grid");
            if (!grid) return;
            if (status !== 200) return; // Keep existing data on error
            if (!data || !data.length) {
                grid.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;grid-column:1/-1">دستگاهی ثبت نشده است</div>';
                updateDeviceFilterCount(0);
                return;
            }

            var VALID_STATUSES = ["online", "offline", "warning", "error"];
            var allCards = data.map(function (d) {
                var st = (d.status && VALID_STATUSES.indexOf(d.status) !== -1) ? d.status : "offline";
                var statusLabel = escapeHtml(STATUS_LABELS[st] || st);
                var code = escapeHtml(d.device_code || "");
                var name = escapeHtml(d.name || d.device_code || "");
                var route = escapeHtml(d.route1 || d.route || "");
                var lastSeen = escapeHtml(formatTime(d.last_seen));
                var dotColor = { online: "#22c55e", offline: "#94a3b8", warning: "#f59e0b", error: "#ef4444" }[st] || "#94a3b8";
                var cardHtml =
                    '<div class="device-card device-card-v2 ' + st + '" data-status="' + st + '">' +
                        '<div class="dcv2-icon">' +
                            '<svg viewBox="0 0 24 24"><path d="M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14zm-5 2c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-3V7h2v11h-2z"/></svg>' +
                        '</div>' +
                        '<div class="dcv2-body">' +
                            '<div class="dcv2-code">' + (code || name) + '</div>' +
                            '<div class="dcv2-row">' +
                                '<span class="dcv2-label">آخرین داده:</span>' +
                                '<span class="dcv2-val ltr">' + lastSeen + '</span>' +
                            '</div>' +
                            '<div class="dcv2-row">' +
                                '<span class="dcv2-label">وضعیت:</span>' +
                                '<span class="dcv2-status" style="color:' + dotColor + '">&#9679; ' + statusLabel + '</span>' +
                            '</div>' +
                            '<div class="dcv2-row">' +
                                '<span class="dcv2-label">محور:</span>' +
                                '<span class="dcv2-val">' + (route || name || '-') + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
                return { html: cardHtml, status: st };
            });

            var activeFilter = ($("#device-filter-bar .dfb-btn.active") || {}).dataset && $("#device-filter-bar .dfb-btn.active").dataset.filter || "all";
            renderDeviceCards(grid, allCards, activeFilter);

            var filterBar = $("#device-filter-bar");
            if (filterBar) {
                filterBar.querySelectorAll(".dfb-btn").forEach(function (btn) {
                    btn.onclick = function () {
                        filterBar.querySelectorAll(".dfb-btn").forEach(function (b) { b.classList.remove("active"); });
                        btn.classList.add("active");
                        renderDeviceCards(grid, allCards, btn.dataset.filter || "all");
                    };
                });
            }
        });

        loadTcpConnected();
        loadLive();
    }

    function renderDeviceCards(grid, allCards, filter) {
        var visible = filter === "all" ? allCards : allCards.filter(function (c) { return c.status === filter; });
        if (!visible.length) {
            grid.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;grid-column:1/-1">دستگاهی یافت نشد</div>';
        } else {
            grid.innerHTML = visible.map(function (c) { return c.html; }).join("");
        }
        updateDeviceFilterCount(visible.length);
    }

    function updateDeviceFilterCount(n) {
        var el = $("#device-filter-count");
        if (el) el.textContent = n + " دستگاه";
    }

    function loadTcpConnected() {
        api("GET", "/api/tcp/connected", null, function (status, data) {
            var tbody = $("#tcp-table-body");
            if (!tbody) return;
            if (status !== 200) return; // Keep existing data on error
            if (!data || !Object.keys(data).length) {
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
        if (!serverConnected || !loginOverlay.classList.contains("hidden")) return;
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
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#94a3b8">دستگاهی یافت نشد</td></tr>';
        } else {
            tbody.innerHTML = paged.map(function (d, i) {
                var st = d.status || "offline";
                var r1 = d.route1 || d.route || "";
                var r2 = d.route2 || "";
                var r1Name = getMehvarName(r1);
                var r2Name = getMehvarName(r2);
                var errCode = d.last_error_byte || 0;
                var errLabels = decodeErrorByte(errCode);
                var errCell = errCode > 0
                    ? '<span class="status-badge error" title="' + escapeHtml(errLabels.join(' | ')) + '" style="cursor:help">' + escapeHtml(String(errCode)) + '</span>'
                    : '<span style="color:#94a3b8">—</span>';
                return "<tr>" +
                    "<td>" + (start + i + 1) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(d.device_code) + "</td>" +
                    "<td><strong>" + escapeHtml(d.name) + "</strong></td>" +
                    '<td><span class="type-badge">' + escapeHtml(TYPE_LABELS[d.type] || d.type) + "</span></td>" +
                    "<td>" + escapeHtml(r1Name || "-") + "</td>" +
                    "<td>" + escapeHtml(r2Name || "-") + "</td>" +
                    '<td><span class="status-badge ' + st + '">' + escapeHtml(STATUS_LABELS[st] || st) + "</span></td>" +
                    "<td>" + errCell + "</td>" +
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
            if (status !== 200) return; // Keep existing data on error
            if (!data || !data.rows || !data.rows.length) {
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

    function extractRmtoError(r) {
        var msg = r.error_message || "";
        if (!msg) {
            try {
                var ro = JSON.parse(r.response_data || "{}");
                if (ro.ERR) msg = ro.ERR;
                else if (r.success !== 1 && ro.ID === 0 && ro.SRVDT === "0001-01-01T00:00:00") msg = "تاریخ نامعتبر از سامانه (ID=0)";
            } catch (e) {}
        }
        return msg;
    }

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
                mbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8">هنوز ارسالی انجام نشده</td></tr>';
                return;
            }
            mbody.innerHTML = data.map(function (r) {
                var ok = r.success === 1;
                var resp = r.response_data || "-";
                var respShort = resp;
                if (respShort.length > 80) respShort = respShort.substring(0, 80) + "...";

                // Extract ERR from response_data JSON
                var errMsg = extractRmtoError(r);
                var errShort = errMsg;
                if (errShort.length > 80) errShort = errShort.substring(0, 80) + "...";

                return "<tr class='rmto-log-row " + (ok ? "" : "rmto-error-row") + "'>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px;white-space:nowrap">' + escapeHtml(formatTime(r.created_at)) + "</td>" +
                    '<td style="font-size:12px">' + escapeHtml(r.method) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(r.device_code) + "</td>" +
                    '<td><span class="status-badge ' + (ok ? "online" : "error") + '">' + (ok ? "موفق" : "خطا") + "</span></td>" +
                    '<td dir="ltr" style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(resp) + '">' + escapeHtml(respShort) + "</td>" +
                    '<td dir="ltr" style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + (ok ? '#94a3b8' : '#ef4444') + '" title="' + escapeHtml(errMsg) + '">' + escapeHtml(ok ? "-" : errShort) + "</td>" +
                    '<td dir="ltr" style="font-size:10px;color:#64748b">' + escapeHtml(r.source_ip || "-") + "</td>" +
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
                var errDetail = extractRmtoError(r);
                var statusCell = '<span class="status-badge ' + (ok ? "online" : "error") + '">' + (ok ? "موفق" : "خطا") + "</span>" +
                    (!ok && errDetail ? '<div style="font-size:10px;color:#ef4444;margin-top:2px;white-space:normal;max-width:160px">' + escapeHtml(errDetail.substring(0, 80)) + '</div>' : "");
                return "<tr>" +
                    "<td>" + escapeHtml(r.method) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(r.device_code) + "</td>" +
                    "<td>" + statusCell + "</td>" +
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

    // Connectivity check
    var rmtoConnBtn = $("#btn-rmto-connectivity");
    if (rmtoConnBtn) rmtoConnBtn.addEventListener("click", function () {
        var panel = $("#panel-connectivity");
        var resultEl = $("#connectivity-result");
        var hostEl = $("#connectivity-host");
        panel.style.display = "";
        resultEl.innerHTML = '<div style="color:#94a3b8;font-size:13px">در حال بررسی اتصال...</div>';
        if (hostEl) hostEl.textContent = "";
        rmtoConnBtn.disabled = true;
        api("GET", "/api/rmto/connectivity-check", null, function (status, data) {
            rmtoConnBtn.disabled = false;
            if (status !== 200 || !data) {
                resultEl.innerHTML = '<div style="color:#ef4444;font-size:13px">خطا در دریافت نتیجه</div>';
                return;
            }
            if (hostEl) hostEl.textContent = data.host + ":" + data.port;
            var html = '<div style="display:grid;gap:8px">';
            (data.checks || []).forEach(function (c) {
                var color = c.ok ? "#16a34a" : "#ef4444";
                var badge = c.ok
                    ? '<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:12px;font-size:12px">✓ متصل</span>'
                    : '<span style="background:#fee2e2;color:#ef4444;padding:2px 8px;border-radius:12px;font-size:12px">✗ قطع</span>';
                var latency = c.ok ? ' &nbsp;<span style="color:#64748b;font-size:12px">' + c.latencyMs + 'ms</span>' : "";
                var errMsg = c.error ? ' &nbsp;<span style="color:#ef4444;font-size:12px;direction:ltr">' + escapeHtml(c.error) + "</span>" : "";
                html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">' +
                    '<span style="min-width:160px;font-size:13px">' + escapeHtml(c.label) + "</span>" +
                    '<span style="color:#64748b;font-size:12px;direction:ltr;min-width:120px">' + escapeHtml(c.ip) + "</span>" +
                    badge + latency + errMsg +
                    "</div>";
            });
            var ts = data.checkedAt ? ' <span style="font-size:11px;color:#94a3b8">' + escapeHtml(data.checkedAt.replace("T", " ").substring(0, 19)) + "</span>" : "";
            html += "</div>" + ts;
            resultEl.innerHTML = html;
        });
    });


    var rmtoFilterEl = $("#rmto-log-filter");
    if (rmtoFilterEl) rmtoFilterEl.addEventListener("change", function () {
        rmtoLogFilter = this.value;
        loadRMTOMonitor();
    });

    var rmtoRefreshLogsBtn = $("#btn-refresh-rmto-logs");
    if (rmtoRefreshLogsBtn) rmtoRefreshLogsBtn.addEventListener("click", loadRMTOMonitor);

    // ============================================================
    // Mehvar (Routes) Management
    // ============================================================
    function loadMehvar() {
        api("GET", "/api/mehvar", null, function (status, data) {
            var tbody = $("#mehvar-table-body");
            if (status !== 200) return; // Keep existing data on error
            if (!data || !data.length) {
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
            var liveIpEl = $("#setting-rmto-source-ip");
            if (liveIpEl && data.rmto_source_ip !== undefined) liveIpEl.value = data.rmto_source_ip;
            // Bale
            var tokenEl = $("#setting-bale-token");
            var chatEl = $("#setting-bale-chat");
            if (tokenEl && data.bale_bot_token !== undefined) tokenEl.value = data.bale_bot_token;
            if (chatEl && data.bale_chat_id !== undefined) chatEl.value = data.bale_chat_id;
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
            rmto_password: $("#setting-rmto-pass").value,
            rmto_source_ip: ($("#setting-rmto-source-ip") && $("#setting-rmto-source-ip").value) || ""
        }, "تنظیمات سامانه ذخیره شد.");
    });

    // Server Time
    var serverTimeTimer = null;
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
            var bv = $("#server-build-version");
            if (bv && data.build) bv.textContent = data.build;
        });
    }

    function startServerTimeRefresh() {
        if (serverTimeTimer) clearInterval(serverTimeTimer);
        serverTimeTimer = setInterval(loadServerTime, 10000);
    }
    function stopServerTimeRefresh() {
        if (serverTimeTimer) { clearInterval(serverTimeTimer); serverTimeTimer = null; }
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
            if (xhr.status === 401) {
                statusEl.textContent = "نشست منقضی شده. لطفا دوباره وارد شوید";
                statusEl.style.color = "#ef4444";
                loginOverlay.classList.remove("hidden");
                return;
            }
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
        if (!serverConnected || !loginOverlay.classList.contains("hidden")) return;
        var activeView = document.querySelector(".view.active");
        if (!activeView) return;
        var id = activeView.id;
        if (id === "view-dashboard") loadDashboard();
        else if (id === "view-reception") loadReception();
    }, 30000);

// ============================================================
    // History
    // ============================================================
    var historyType = "sent";
    var historyPage = 1;

    (function initHistoryTabs() {
        var btnSent = $("#hist-tab-sent");
        var btnReceived = $("#hist-tab-received");
        if (btnSent) btnSent.addEventListener("click", function () {
            historyType = "sent";
            historyPage = 1;
            renderHistoryHeaders();
            loadHistory(1);
        });
        if (btnReceived) btnReceived.addEventListener("click", function () {
            historyType = "received";
            historyPage = 1;
            renderHistoryHeaders();
            loadHistory(1);
        });
        var searchBtn = $("#hist-btn-search");
        if (searchBtn) searchBtn.addEventListener("click", function () {
            historyPage = 1;
            loadHistory(1);
        });
    })();

    function renderHistoryHeaders() {
        var thead = $("#hist-thead");
        if (!thead) return;
        if (historyType === "sent") {
            thead.innerHTML =
                "<th>#</th><th>زمان ارسال</th><th>دستگاه</th><th>وضعیت</th>" +
                "<th>IP</th><th>پاسخ</th><th>عملیات</th>";
        } else {
            thead.innerHTML =
                "<th>#</th><th>شروع دوره</th><th>پایان دوره</th><th>دستگاه</th>" +
                "<th>محور</th><th>مجموع خودرو</th><th>سرعت میانگین</th>" +
                "<th>وضعیت ارسال</th><th>عملیات</th>";
        }
    }

    function loadHistory(page) {
        historyPage = page || 1;
        var device = ($("#hist-filter-device") && $("#hist-filter-device").value) || "";
        var route = ($("#hist-filter-route") && $("#hist-filter-route").value) || "";
        var from = ($("#hist-filter-from") && $("#hist-filter-from").value) || "";
        var to = ($("#hist-filter-to") && $("#hist-filter-to").value) || "";

        var url = "/api/history?type=" + historyType +
            "&page=" + historyPage + "&limit=50" +
            (device ? "&device=" + encodeURIComponent(device) : "") +
            (route ? "&route=" + encodeURIComponent(route) : "") +
            (from ? "&from=" + encodeURIComponent(from) : "") +
            (to ? "&to=" + encodeURIComponent(to) : "");

        renderHistoryHeaders();
        var tbody = $("#hist-tbody");
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8">در حال بارگذاری...</td></tr>';

        api("GET", url, null, function (status, data) {
            var tbody = $("#hist-tbody");
            var summary = $("#hist-summary");
            var pagination = $("#hist-pagination");
            if (!tbody) return;
            if (status !== 200 || !data) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#ef4444">خطا در بارگذاری</td></tr>';
                return;
            }
            var total = data.total || 0;
            var totalPages = Math.ceil(total / 50) || 1;
            if (summary) summary.textContent = "مجموع: " + total + " رکورد — صفحه " + historyPage + " از " + totalPages;
            var rows = data.rows || [];
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8">رکوردی یافت نشد</td></tr>';
                if (pagination) pagination.innerHTML = "";
                return;
            }
            if (historyType === "sent") {
                tbody.innerHTML = rows.map(function (r, i) {
                    var ok = r.success ? '<span class="status-badge online">موفق</span>' : '<span class="status-badge error">ناموفق</span>';
                    var resp = "";
                    try {
                        var rd = JSON.parse(r.response_data || "{}");
                        resp = (rd && (rd.ID !== undefined)) ? "ID=" + rd.ID + " CFL=" + rd.CFL : (r.error_message || "-");
                    } catch(e) { resp = r.error_message || "-"; }
                    return "<tr>" +
                        "<td>" + ((historyPage - 1) * 50 + i + 1) + "</td>" +
                        '<td dir="ltr">' + escapeHtml(r.created_at || "-") + "</td>" +
                        "<td>" + escapeHtml(r.device_code || "-") + "</td>" +
                        "<td>" + ok + "</td>" +
                        '<td dir="ltr">' + escapeHtml(r.source_ip || "-") + "</td>" +
                        "<td>" + escapeHtml(resp.substring(0, 40)) + "</td>" +
                        "<td></td>" +
                        "</tr>";
                }).join("");
            } else {
                tbody.innerHTML = rows.map(function (r, i) {
                    var total = (r.c1 || 0) + (r.c2 || 0) + (r.c3 || 0) + (r.c4 || 0) + (r.c5 || 0);
                    var sentBadge = r.sent ? '<span class="status-badge online">ارسال شده</span>' : '<span class="status-badge offline">در صف</span>';
                    return "<tr>" +
                        "<td>" + ((historyPage - 1) * 50 + i + 1) + "</td>" +
                        '<td dir="ltr">' + escapeHtml(r.period_start || "-") + "</td>" +
                        '<td dir="ltr">' + escapeHtml(r.period_end || "-") + "</td>" +
                        "<td>" + escapeHtml(r.device_code || "-") + "</td>" +
                        "<td>" + escapeHtml(r.route_id || "-") + "</td>" +
                        "<td>" + total + "</td>" +
                        "<td>" + Math.round(r.avg_speed || 0) + "</td>" +
                        "<td>" + sentBadge + "</td>" +
                        "<td><button class='btn btn-secondary' style='padding:3px 10px;font-size:12px' onclick='histLoadToTestSender(" + r.id + ")'>📤 بارگذاری</button></td>" +
                        "</tr>";
                }).join("");
            }
            // Pagination
            if (pagination) {
                var pages = [];
                var start = Math.max(1, historyPage - 2);
                var end = Math.min(totalPages, start + 4);
                if (historyPage > 1) pages.push('<button class="btn btn-secondary" style="padding:4px 10px;font-size:12px" onclick="loadHistory(' + (historyPage - 1) + ')">‹</button>');
                for (var p = start; p <= end; p++) {
                    pages.push('<button class="btn ' + (p === historyPage ? 'btn-primary' : 'btn-secondary') + '" style="padding:4px 10px;font-size:12px" onclick="loadHistory(' + p + ')">' + p + '</button>');
                }
                if (historyPage < totalPages) pages.push('<button class="btn btn-secondary" style="padding:4px 10px;font-size:12px" onclick="loadHistory(' + (historyPage + 1) + ')">›</button>');
                pagination.innerHTML = pages.join("");
            }
        });
    }

    // Expose for inline onclick in history table
    window.loadHistory = loadHistory;
    window.histLoadToTestSender = function (id) {
        api("GET", "/api/history/record/" + id, null, function (status, row) {
            if (status !== 200 || !row) { alert("خطا در بارگذاری رکورد"); return; }
            switchView("test-sender");
            // Pre-fill test-sender form with the historical record
            var ridEl = $("#test-rid");
            var stEl = $("#test-st");
            var etEl = $("#test-et");
            var c1El = $("#test-c1"); var c2El = $("#test-c2"); var c3El = $("#test-c3");
            var c4El = $("#test-c4"); var c5El = $("#test-c5");
            var aspEl = $("#test-asp");
            if (ridEl) ridEl.value = row.route_id || "";
            if (stEl) stEl.value = (row.period_start || "").replace(" ", "T").substring(0, 16);
            if (etEl) etEl.value = (row.period_end || "").replace(" ", "T").substring(0, 16);
            if (c1El) c1El.value = row.c1 || 0;
            if (c2El) c2El.value = row.c2 || 0;
            if (c3El) c3El.value = row.c3 || 0;
            if (c4El) c4El.value = row.c4 || 0;
            if (c5El) c5El.value = row.c5 || 0;
            if (aspEl) aspEl.value = Math.round(row.avg_speed || 0);
            var s1El = $("#test-s1"); var s2El = $("#test-s2"); var s3El = $("#test-s3");
            var s4El = $("#test-s4"); var s5El = $("#test-s5");
            var ssoEl = $("#test-sso");
            var so1El = $("#test-so1"); var so2El = $("#test-so2"); var so3El = $("#test-so3");
            var so4El = $("#test-so4"); var so5El = $("#test-so5");
            var ooEl = $("#test-oo"); var esdEl = $("#test-esd");
            if (s1El) s1El.value = Math.round(row.s1 || 0);
            if (s2El) s2El.value = Math.round(row.s2 || 0);
            if (s3El) s3El.value = Math.round(row.s3 || 0);
            if (s4El) s4El.value = Math.round(row.s4 || 0);
            if (s5El) s5El.value = Math.round(row.s5 || 0);
            if (ssoEl) ssoEl.value = row.sso || 0;
            if (so1El) so1El.value = row.so1 || 0;
            if (so2El) so2El.value = row.so2 || 0;
            if (so3El) so3El.value = row.so3 || 0;
            if (so4El) so4El.value = row.so4 || 0;
            if (so5El) so5El.value = row.so5 || 0;
            if (ooEl) ooEl.value = row.oo || 0;
            if (esdEl) esdEl.value = row.esd || 0;
        });
    };

    // ============================================================
    // Test Sender
    // ============================================================
    var testSenderInited = false;
    function initTestSender() {
        if (testSenderInited) return;
        testSenderInited = true;

        // Populate default times: last completed 5-min period
        function defaultPeriod() {
            var now = new Date();
            var end = new Date(now);
            end.setMinutes(Math.floor(end.getMinutes() / 5) * 5, 0, 0);
            var start = new Date(end.getTime() - 5 * 60 * 1000);
            function toLocalInput(d) {
                return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" +
                    String(d.getDate()).padStart(2,"0") + "T" +
                    String(d.getHours()).padStart(2,"0") + ":" +
                    String(d.getMinutes()).padStart(2,"0");
            }
            var stEl = $("#test-st"), etEl = $("#test-et");
            if (stEl && !stEl.value) stEl.value = toLocalInput(start);
            if (etEl && !etEl.value) etEl.value = toLocalInput(end);
        }
        defaultPeriod();

        var sendBtn = $("#btn-test-send");
        if (sendBtn) sendBtn.addEventListener("click", function () {
            var rid = parseInt($("#test-rid").value, 10);
            if (!rid || rid <= 0) { alert("کد محور (RID) الزامی است"); return; }

            var stVal = $("#test-st").value || "";
            var etVal = $("#test-et").value || "";
            var st = stVal ? stVal + ":00" : "";
            var et = etVal ? etVal + ":00" : "";

            var body = {
                rid: rid,
                fid: parseInt($("#test-fid").value, 10) || 0,
                c1: parseInt($("#test-c1").value, 10) || 0,
                c2: parseInt($("#test-c2").value, 10) || 0,
                c3: parseInt($("#test-c3").value, 10) || 0,
                c4: parseInt($("#test-c4").value, 10) || 0,
                c5: parseInt($("#test-c5").value, 10) || 0,
                asp: parseInt($("#test-asp").value, 10) || 60,
                s1: parseInt($("#test-s1").value, 10) || 0,
                s2: parseInt($("#test-s2").value, 10) || 0,
                s3: parseInt($("#test-s3").value, 10) || 0,
                s4: parseInt($("#test-s4").value, 10) || 0,
                s5: parseInt($("#test-s5").value, 10) || 0,
                sso: parseInt($("#test-sso").value, 10) || 0,
                so1: parseInt($("#test-so1").value, 10) || 0,
                so2: parseInt($("#test-so2").value, 10) || 0,
                so3: parseInt($("#test-so3").value, 10) || 0,
                so4: parseInt($("#test-so4").value, 10) || 0,
                so5: parseInt($("#test-so5").value, 10) || 0,
                oo: parseInt($("#test-oo").value, 10) || 0,
                esd: parseInt($("#test-esd").value, 10) || 0
            };
            if (st) body.st = st;
            if (et) body.et = et;

            sendBtn.disabled = true;
            sendBtn.textContent = "در حال ارسال...";

            var resultEl = $("#test-send-result");
            var detailEl = $("#test-send-detail");

            api("POST", "/api/rmto/test-send", body, function (status, data) {
                sendBtn.disabled = false;
                sendBtn.textContent = "📤 ارسال به سامانه";

                if (!data) {
                    resultEl.style.display = "block";
                    resultEl.innerHTML = '<div style="background:#fef2f2;border:1px solid #fca5a5;padding:10px;border-radius:6px;color:#991b1b">خطا: عدم ارتباط با سرور</div>';
                    return;
                }

                var isOk = data.success;
                var resp = data.response || {};
                var errMsg = data.error || (resp.ERR ? resp.ERR : "");

                resultEl.style.display = "block";
                if (isOk) {
                    resultEl.innerHTML = '<div style="background:#f0fdf4;border:1px solid #86efac;padding:10px;border-radius:6px;color:#166534">✅ ارسال موفق! ID=' + escapeHtml(String(resp.ID || "-")) + ' CFL=' + escapeHtml(String(resp.CFL || "-")) + '</div>';
                } else {
                    resultEl.innerHTML = '<div style="background:#fef2f2;border:1px solid #fca5a5;padding:10px;border-radius:6px;color:#991b1b">❌ خطا: ' + escapeHtml(errMsg || "پاسخ نامعتبر") + '</div>';
                }

                if (detailEl) {
                    detailEl.textContent = JSON.stringify(data, null, 2);
                }
            });
        });

        // ---- Archive Send ----
        function toLocalInputVal(d) {
            return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" +
                String(d.getDate()).padStart(2,"0") + "T" +
                String(d.getHours()).padStart(2,"0") + ":" +
                String(d.getMinutes()).padStart(2,"0");
        }

        function applyArchivePreset(minutes) {
            var now = new Date();
            var to = new Date(now);
            to.setSeconds(0, 0);
            var from = new Date(to.getTime() - minutes * 60 * 1000);
            var fromEl = $("#arch-from"), toEl = $("#arch-to");
            if (fromEl) fromEl.value = toLocalInputVal(from);
            if (toEl) toEl.value = toLocalInputVal(to);
        }

        var presets = { "arch-preset-15m": 15, "arch-preset-1h": 60, "arch-preset-6h": 360,
            "arch-preset-1d": 1440, "arch-preset-3d": 4320, "arch-preset-7d": 10080, "arch-preset-15d": 21600 };
        Object.keys(presets).forEach(function (id) {
            var el = $("#" + id);
            if (el) el.addEventListener("click", function () { applyArchivePreset(presets[id]); });
        });

        var archPreviewBtn = $("#btn-arch-preview");
        if (archPreviewBtn) archPreviewBtn.addEventListener("click", function () {
            var from = ($("#arch-from") && $("#arch-from").value) ? $("#arch-from").value + ":00" : "";
            var to = ($("#arch-to") && $("#arch-to").value) ? $("#arch-to").value + ":00" : "";
            var rid = ($("#arch-rid") && $("#arch-rid").value) ? parseInt($("#arch-rid").value, 10) : "";
            var infoEl = $("#arch-preview-info");
            if (!from || !to) { if (infoEl) infoEl.textContent = "⚠️ لطفاً بازه زمانی را وارد کنید"; return; }
            var url = "/api/rmto/archive-records?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to);
            if (rid) url += "&rid=" + rid;
            if (infoEl) infoEl.textContent = "در حال بارگذاری...";
            api("GET", url, null, function (status, data) {
                if (!data || !infoEl) return;
                infoEl.innerHTML = '🔎 <strong>' + escapeHtml(String(data.total || 0)) + '</strong> رکورد یافت شد' +
                    (rid ? ' برای محور <strong>' + escapeHtml(String(rid)) + '</strong>' : '') +
                    ' در بازه انتخابی';
            });
        });

        var archSendBtn = $("#btn-arch-send");
        if (archSendBtn) archSendBtn.addEventListener("click", function () {
            var from = ($("#arch-from") && $("#arch-from").value) ? $("#arch-from").value + ":00" : "";
            var to = ($("#arch-to") && $("#arch-to").value) ? $("#arch-to").value + ":00" : "";
            var rid = ($("#arch-rid") && $("#arch-rid").value) ? parseInt($("#arch-rid").value, 10) : null;
            var infoEl = $("#arch-preview-info");
            if (!from || !to) { if (infoEl) infoEl.textContent = "⚠️ لطفاً بازه زمانی را وارد کنید"; return; }
            var body = { from: from, to: to };
            if (rid) body.rid = rid;
            archSendBtn.disabled = true;
            archSendBtn.textContent = "در حال شروع...";
            api("POST", "/api/rmto/archive-send", body, function (status, data) {
                archSendBtn.disabled = false;
                archSendBtn.textContent = "📤 شروع ارسال";
                if (!data || status !== 200) {
                    if (infoEl) infoEl.textContent = "❌ خطا: " + ((data && data.error) || "ارتباط با سرور برقرار نشد");
                    return;
                }
                if (infoEl) infoEl.innerHTML = '✅ ارسال آرشیو شروع شد — شناسه کار: <strong>' + escapeHtml(String(data.jobId)) + '</strong> / ' + escapeHtml(String(data.total)) + ' رکورد';
                refreshArchiveJobs();
            });
        });

        var archRefreshBtn = $("#btn-arch-refresh");
        if (archRefreshBtn) archRefreshBtn.addEventListener("click", refreshArchiveJobs);

        function refreshArchiveJobs() {
            api("GET", "/api/rmto/archive-jobs", null, function (status, jobs) {
                var tbody = $("#arch-jobs-tbody");
                if (!tbody || !jobs) return;
                if (!jobs.length) {
                    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8">هنوز ارسالی شروع نشده</td></tr>';
                    return;
                }
                var html = "";
                jobs.slice().reverse().forEach(function (j) {
                    var pct = j.total > 0 ? Math.round(j.sent / j.total * 100) : 0;
                    var statusHtml = j.status === "running"
                        ? '<span class="status-badge warning">در حال ارسال</span>'
                        : j.status === "stopped"
                            ? '<span class="status-badge offline">متوقف</span>'
                            : '<span class="status-badge online">تمام شد</span>';
                    var stopBtn = (j.status === "running")
                        ? '<button class="btn btn-secondary" style="font-size:11px;padding:3px 8px" onclick="stopArchiveJob(' + j.id + ')">⏹ توقف</button>'
                        : "-";
                    html += "<tr>" +
                        "<td dir='ltr'>" + escapeHtml(String(j.id)) + "</td>" +
                        "<td dir='ltr'>" + escapeHtml(j.rid ? String(j.rid) : "همه") + "</td>" +
                        "<td dir='ltr' style='font-size:11px'>" + escapeHtml((j.from || "").replace("T", " ").substring(0, 16)) + "</td>" +
                        "<td dir='ltr' style='font-size:11px'>" + escapeHtml((j.to || "").replace("T", " ").substring(0, 16)) + "</td>" +
                        "<td dir='ltr'>" + escapeHtml(String(j.sent)) + " / " + escapeHtml(String(j.total)) + " (" + escapeHtml(String(pct)) + "%)</td>" +
                        "<td style='color:#166534'>" + escapeHtml(String(j.success)) + "</td>" +
                        "<td style='color:#991b1b'>" + escapeHtml(String(j.failed)) + "</td>" +
                        "<td>" + statusHtml + "</td>" +
                        "<td>" + stopBtn + "</td>" +
                        "</tr>";
                });
                tbody.innerHTML = html;
            });
        }

        // Auto-refresh jobs table every 3 seconds while on test-sender view
        setInterval(function () {
            if (!serverConnected || !loginOverlay.classList.contains("hidden")) return;
            var v = document.querySelector(".view.active");
            if (v && v.id === "view-test-sender") {
                refreshArchiveJobs();
                refreshSchedJobs();
            }
        }, 3000);

        // ---- Scheduled Test Send ----
        var schedCopyBtn = $("#btn-sched-copy");
        if (schedCopyBtn) schedCopyBtn.addEventListener("click", function () {
            var fields = ["c1", "c2", "c3", "c4", "c5", "asp", "s1", "s2", "s3", "s4", "s5", "sso", "so1", "so2", "so3", "so4", "so5", "oo", "esd"];
            fields.forEach(function (f) {
                var src = $("#test-" + f);
                var dst = $("#sched-" + f);
                if (src && dst) dst.value = src.value;
            });
            var ridSrc = $("#test-rid");
            var ridDst = $("#sched-rid");
            if (ridSrc && ridDst) ridDst.value = ridSrc.value;
            var resultEl = $("#sched-result");
            if (resultEl) {
                resultEl.style.display = "block";
                resultEl.innerHTML = '<div style="background:#f0fdf4;border:1px solid #86efac;padding:8px;border-radius:6px;color:#166534;font-size:13px">✅ مقادیر از بخش ارسال تست کپی شد</div>';
                setTimeout(function () { resultEl.style.display = "none"; }, 3000);
            }
        });

        var schedStartBtn = $("#btn-sched-start");
        if (schedStartBtn) schedStartBtn.addEventListener("click", function () {
            var rid = parseInt(($("#sched-rid") && $("#sched-rid").value) || "", 10);
            if (!rid || rid <= 0) { alert("کد محور (RID) الزامی است"); return; }
            var days = parseInt(($("#sched-days") && $("#sched-days").value) || "1", 10);
            if (days < 1 || days > 15) { alert("مدت ارسال باید بین ۱ تا ۱۵ روز باشد"); return; }
            if (!confirm("آیا از شروع ارسال زمانبندی شده هر ۵ دقیقه برای " + days + " روز مطمئن هستید؟")) return;

            var body = {
                rid: rid,
                durationDays: days,
                c1: parseInt(($("#sched-c1") && $("#sched-c1").value) || "0", 10),
                c2: parseInt(($("#sched-c2") && $("#sched-c2").value) || "0", 10),
                c3: parseInt(($("#sched-c3") && $("#sched-c3").value) || "0", 10),
                c4: parseInt(($("#sched-c4") && $("#sched-c4").value) || "0", 10),
                c5: parseInt(($("#sched-c5") && $("#sched-c5").value) || "0", 10),
                asp: parseInt(($("#sched-asp") && $("#sched-asp").value) || "60", 10),
                s1: parseInt(($("#sched-s1") && $("#sched-s1").value) || "0", 10),
                s2: parseInt(($("#sched-s2") && $("#sched-s2").value) || "0", 10),
                s3: parseInt(($("#sched-s3") && $("#sched-s3").value) || "0", 10),
                s4: parseInt(($("#sched-s4") && $("#sched-s4").value) || "0", 10),
                s5: parseInt(($("#sched-s5") && $("#sched-s5").value) || "0", 10),
                sso: parseInt(($("#sched-sso") && $("#sched-sso").value) || "0", 10),
                so1: parseInt(($("#sched-so1") && $("#sched-so1").value) || "0", 10),
                so2: parseInt(($("#sched-so2") && $("#sched-so2").value) || "0", 10),
                so3: parseInt(($("#sched-so3") && $("#sched-so3").value) || "0", 10),
                so4: parseInt(($("#sched-so4") && $("#sched-so4").value) || "0", 10),
                so5: parseInt(($("#sched-so5") && $("#sched-so5").value) || "0", 10),
                oo: parseInt(($("#sched-oo") && $("#sched-oo").value) || "0", 10),
                esd: parseInt(($("#sched-esd") && $("#sched-esd").value) || "0", 10)
            };

            schedStartBtn.disabled = true;
            schedStartBtn.textContent = "در حال شروع...";
            var resultEl = $("#sched-result");

            api("POST", "/api/rmto/test-schedule", body, function (status, data) {
                schedStartBtn.disabled = false;
                schedStartBtn.textContent = "⏱ شروع ارسال زمانبندی شده";
                if (resultEl) {
                    resultEl.style.display = "block";
                    if (data && data.success) {
                        resultEl.innerHTML = '<div style="background:#f0fdf4;border:1px solid #86efac;padding:10px;border-radius:6px;color:#166534">✅ ' + escapeHtml(data.message || "شروع شد") + ' — شناسه: ' + escapeHtml(String(data.jobId)) + '</div>';
                    } else {
                        resultEl.innerHTML = '<div style="background:#fef2f2;border:1px solid #fca5a5;padding:10px;border-radius:6px;color:#991b1b">❌ خطا: ' + escapeHtml((data && data.error) || "ارتباط برقرار نشد") + '</div>';
                    }
                }
                refreshSchedJobs();
            });
        });

        var schedRefreshBtn = $("#btn-sched-refresh");
        if (schedRefreshBtn) schedRefreshBtn.addEventListener("click", refreshSchedJobs);

        function refreshSchedJobs() {
            api("GET", "/api/rmto/test-schedule", null, function (status, jobs) {
                var tbody = $("#sched-jobs-tbody");
                if (!tbody || !jobs) return;
                if (!jobs.length) {
                    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#94a3b8">هنوز ارسال زمانبندی شده‌ای شروع نشده</td></tr>';
                    return;
                }
                var html = "";
                jobs.slice().reverse().forEach(function (j) {
                    var statusHtml = j.status === "running"
                        ? '<span class="status-badge warning">در حال ارسال</span>'
                        : j.status === "stopped"
                            ? '<span class="status-badge offline">متوقف</span>'
                            : j.status === "expired"
                                ? '<span class="status-badge online">پایان یافت</span>'
                                : '<span class="status-badge">' + escapeHtml(j.status) + '</span>';
                    var stopBtn = (j.status === "running")
                        ? '<button class="btn btn-secondary" style="font-size:11px;padding:3px 8px" onclick="stopSchedJob(' + j.id + ')">⏹ توقف</button>'
                        : "-";
                    var lastSend = j.lastSendAt ? j.lastSendAt.replace("T", " ").substring(0, 19) : "-";
                    html += "<tr>" +
                        "<td dir='ltr'>" + escapeHtml(String(j.id)) + "</td>" +
                        "<td dir='ltr'>" + escapeHtml(String(j.rid)) + "</td>" +
                        "<td>" + escapeHtml(String(j.durationDays)) + "</td>" +
                        "<td dir='ltr'>" + escapeHtml(String(j.sendCount)) + "</td>" +
                        "<td style='color:#166534'>" + escapeHtml(String(j.successCount)) + "</td>" +
                        "<td style='color:#991b1b'>" + escapeHtml(String(j.failedCount)) + "</td>" +
                        "<td dir='ltr' style='font-size:11px'>" + escapeHtml(lastSend) + "</td>" +
                        "<td>" + statusHtml + "</td>" +
                        "<td>" + stopBtn + "</td>" +
                        "</tr>";
                });
                tbody.innerHTML = html;
            });
        }
    }

    // Expose stop job function globally for inline onclick
    window.stopArchiveJob = function (jobId) {
        api("DELETE", "/api/rmto/archive-send/" + jobId, null, function (status, data) {
            if (status === 200) {
                var infoEl = $("#arch-preview-info");
                if (infoEl) infoEl.textContent = "⏹ ارسال شناسه " + jobId + " متوقف شد";
                // force refresh
                var tbody = $("#arch-jobs-tbody");
                if (tbody) {
                    api("GET", "/api/rmto/archive-jobs", null, function (s, jobs) {
                        if (!jobs) return;
                        // trigger re-render by calling refreshArchiveJobs equivalent inline
                        var evt = document.createEvent("Event");
                        evt.initEvent("click", true, true);
                        var rb = $("#btn-arch-refresh");
                        if (rb) rb.dispatchEvent(evt);
                    });
                }
            }
        });
    };

    window.stopSchedJob = function (jobId) {
        api("DELETE", "/api/rmto/test-schedule/" + jobId, null, function (status, data) {
            if (status === 200) {
                var resultEl = $("#sched-result");
                if (resultEl) {
                    resultEl.style.display = "block";
                    resultEl.innerHTML = '<div style="background:#fef9c3;border:1px solid #fde68a;padding:8px;border-radius:6px;color:#854d0e;font-size:13px">⏹ ارسال زمانبندی شده شناسه ' + escapeHtml(String(jobId)) + ' متوقف شد</div>';
                }
                var rb = $("#btn-sched-refresh");
                if (rb) {
                    var evt = document.createEvent("Event");
                    evt.initEvent("click", true, true);
                    rb.dispatchEvent(evt);
                }
            }
        });
    };

    // ============================================================
    // Settings: Bale, Server Restart, Log Monitor
    // ============================================================

    var saveBaleBtn = $("#btn-save-bale");
    if (saveBaleBtn) saveBaleBtn.addEventListener("click", function () {
        var token = ($("#setting-bale-token").value || "").trim();
        var chat = ($("#setting-bale-chat").value || "").trim();
        api("POST", "/api/settings", { bale_bot_token: token, bale_chat_id: chat }, function (status, data) {
            var statusEl = $("#bale-test-status");
            if (status === 200) {
                statusEl.textContent = "✅ تنظیمات بله ذخیره شد";
                statusEl.style.color = "#22c55e";
            } else {
                statusEl.textContent = "❌ خطا در ذخیره";
                statusEl.style.color = "#ef4444";
            }
        });
    });

    var testBaleBtn = $("#btn-test-bale");
    if (testBaleBtn) testBaleBtn.addEventListener("click", function () {
        var statusEl = $("#bale-test-status");
        statusEl.textContent = "در حال ارسال...";
        statusEl.style.color = "#475569";
        api("POST", "/api/bale/test", { text: "🔔 پیام آزمایشی از TC Manager - سامانه مدیریت ترددشمار" }, function (status, data) {
            if (status === 200) {
                statusEl.textContent = "✅ درخواست ارسال شد (اگر توکن معتبر باشد پیام می‌رسد)";
                statusEl.style.color = "#22c55e";
            } else {
                statusEl.textContent = "❌ خطا در ارسال";
                statusEl.style.color = "#ef4444";
            }
        });
    });

    var restartBtn = $("#btn-server-restart");
    if (restartBtn) restartBtn.addEventListener("click", function () {
        if (!confirm("آیا مطمئنید؟ سرور ریستارت خواهد شد و اتصال موقتاً قطع می‌شود.")) return;
        var statusEl = $("#restart-status");
        statusEl.textContent = "در حال ریستارت...";
        statusEl.style.color = "#f59e0b";
        api("POST", "/api/server/restart", {}, function (status, data) {
            if (status === 200) {
                statusEl.textContent = "✅ سرور ریستارت شد. صفحه را پس از چند ثانیه رفرش کنید.";
                statusEl.style.color = "#22c55e";
                setTimeout(function () { location.reload(); }, 5000);
            } else {
                statusEl.textContent = "❌ خطا در ریستارت";
                statusEl.style.color = "#ef4444";
            }
        });
    });

    // Live Log Monitor
    var logMonitorTimer = null;
    var logLastTs = 0;
    var logMonitorActive = false;

    var logToggleBtn = $("#btn-log-toggle");
    var logClearBtn = $("#btn-log-clear");
    var logContainer = $("#live-log-monitor");

    function appendLogLine(entry) {
        if (!logContainer) return;
        var line = document.createElement("div");
        var time = entry.time ? entry.time.replace("T", " ").substring(0, 19) : "";
        var color = "#94a3b8";
        if (entry.type === "tcp-ratcx1") color = "#34d399";
        else if (entry.type === "irawdata") color = "#60a5fa";
        else if (entry.type === "data") color = "#a78bfa";
        else if (entry.type === "tcp-raw") color = "#f87171";
        var total = (entry.total !== undefined) ? " total=" + entry.total : "";
        var text = "[" + escapeHtml(time) + "] [" + escapeHtml(entry.type || "-") + "] " +
            (entry.device ? "dev=" + escapeHtml(entry.device) + " " : "") +
            (entry.ip ? "ip=" + escapeHtml(entry.ip) + " " : "") +
            total +
            (entry.detail ? " " + escapeHtml(entry.detail) : "");
        line.style.color = color;
        line.style.borderBottom = "1px solid #1e293b";
        line.style.padding = "2px 0";
        line.textContent = text;
        logContainer.insertBefore(line, logContainer.firstChild);
        // Keep max 200 lines
        while (logContainer.children.length > 200) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    function pollLiveLogs() {
        api("GET", "/api/live?since=" + logLastTs + "&limit=50", null, function (status, data) {
            if (status !== 200 || !Array.isArray(data)) return;
            if (data.length > 0) {
                logLastTs = data[0].ts;
                data.forEach(function (entry) { appendLogLine(entry); });
            }
        });
    }

    if (logToggleBtn) logToggleBtn.addEventListener("click", function () {
        logMonitorActive = !logMonitorActive;
        if (logMonitorActive) {
            logToggleBtn.textContent = "⏸ توقف مانیتور";
            logToggleBtn.classList.remove("btn-secondary");
            logToggleBtn.classList.add("btn-primary");
            if (logContainer) {
                logContainer.innerHTML = "";
                logLastTs = 0;
            }
            pollLiveLogs();
            logMonitorTimer = setInterval(pollLiveLogs, 3000);
        } else {
            logToggleBtn.textContent = "▶ شروع مانیتور";
            logToggleBtn.classList.remove("btn-primary");
            logToggleBtn.classList.add("btn-secondary");
            if (logMonitorTimer) { clearInterval(logMonitorTimer); logMonitorTimer = null; }
        }
    });

    if (logClearBtn) logClearBtn.addEventListener("click", function () {
        if (logContainer) {
            logContainer.innerHTML = '<span style="color:#64748b">— پاک شد —</span>';
            logLastTs = 0;
        }
    });


})();
