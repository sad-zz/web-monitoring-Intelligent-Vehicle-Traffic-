(function () {
    "use strict";

    // --- Data copies ---
    var routes = JSON.parse(JSON.stringify(ROUTE_DATA));
    var devices = JSON.parse(JSON.stringify(DEVICE_DATA));
    var reports = JSON.parse(JSON.stringify(REPORT_DATA));

    var TYPE_LABELS = {
        camera: "دوربین",
        sensor: "سنسور",
        "traffic-light": "چراغ راهنمایی",
        controller: "کنترلر"
    };

    var STATUS_LABELS = {
        online: "آنلاین",
        offline: "آفلاین",
        warning: "هشدار",
        error: "خطا"
    };

    var VIEW_TITLES = {
        home: "خانه",
        routes: "محورها",
        devices: "دستگاه‌ها",
        reports: "گزارشات",
        settings: "تنظیمات"
    };

    var PAGE_SIZE = 10;

    // --- DOM Helpers ---
    var $ = function (sel) { return document.querySelector(sel); };
    var $$ = function (sel) { return document.querySelectorAll(sel); };

    function escapeHtml(str) {
        if (str == null) return "";
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    function formatNumber(n) {
        return Number(n).toLocaleString("fa-IR");
    }

    function formatTime(iso) {
        if (!iso) return "-";
        var d = new Date(iso);
        var h = String(d.getHours()).padStart(2, "0");
        var m = String(d.getMinutes()).padStart(2, "0");
        var mo = String(d.getMonth() + 1).padStart(2, "0");
        var dy = String(d.getDate()).padStart(2, "0");
        return d.getFullYear() + "/" + mo + "/" + dy + " " + h + ":" + m;
    }

    // --- Navigation ---
    $$(".nav-item").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var view = btn.getAttribute("data-view");
            switchView(view);
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

        // Render specific view data
        if (view === "home") renderHome();
        if (view === "routes") renderRoutes();
        if (view === "devices") renderDevices();
        if (view === "reports") renderReports();
    }

    // --- Sidebar Toggle (mobile) ---
    $("#sidebar-toggle").addEventListener("click", function () {
        $("#sidebar").classList.toggle("open");
    });

    // --- Clock ---
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
    // UI1: Home
    // ============================================================
    var homeState = { page: 1, search: "", sortKey: "name", sortDir: "asc" };

    function renderHome() {
        // Stats
        var totalVehicles = routes.reduce(function (s, r) { return s + r.totalVehicles; }, 0);
        var activeRoutes = routes.filter(function (r) { return r.status === "online"; }).length;
        var totalErrors = routes.reduce(function (s, r) { return s + r.errors; }, 0);
        var speeds = routes.filter(function (r) { return r.avgSpeed > 0; });
        var avgSpeed = speeds.length ? Math.round(speeds.reduce(function (s, r) { return s + r.avgSpeed; }, 0) / speeds.length) : 0;

        $("#stat-total-vehicles").textContent = formatNumber(totalVehicles);
        $("#stat-avg-speed").textContent = formatNumber(avgSpeed);
        $("#stat-active-routes").textContent = formatNumber(activeRoutes);
        $("#stat-errors").textContent = formatNumber(totalErrors);

        // Footer
        var onlineDevices = devices.filter(function (d) { return d.status === "online"; }).length;
        $("#footer-device-count").textContent = onlineDevices + " دستگاه فعال";

        renderHomeTable();
    }

    function getFilteredRoutes() {
        var q = homeState.search.toLowerCase();
        return routes.filter(function (r) {
            if (!q) return true;
            return r.name.toLowerCase().indexOf(q) !== -1;
        });
    }

    function renderHomeTable() {
        var filtered = getFilteredRoutes();
        filtered = sortArray(filtered, homeState.sortKey, homeState.sortDir);

        var total = filtered.length;
        var start = (homeState.page - 1) * PAGE_SIZE;
        var paged = filtered.slice(start, start + PAGE_SIZE);

        var tbody = $("#home-table-body");
        tbody.innerHTML = paged.map(function (r) {
            return "<tr>" +
                "<td>" + escapeHtml(r.name) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(formatTime(r.lastUpdate)) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(formatNumber(r.totalVehicles)) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(r.avgSpeed) + " km/h</td>" +
                '<td><span class="status-badge ' + (r.errors > 0 ? "error" : "online") + '">' +
                    escapeHtml(r.errors > 0 ? r.errors + " خطا" : "بدون خطا") + "</span></td>" +
                "</tr>";
        }).join("");

        renderTableInfo("home", start, paged.length, total);
        renderPagination("home", homeState, total);
        applySortHeaders("home-table", homeState);
    }

    $("#home-search").addEventListener("input", function () {
        homeState.search = this.value.trim();
        homeState.page = 1;
        renderHomeTable();
    });

    bindTableSort("home-table", homeState, renderHomeTable);

    // ============================================================
    // UI2: Routes
    // ============================================================
    var routeState = { page: 1, search: "", sortKey: "name", sortDir: "asc" };

    function renderRoutes() { renderRouteTable(); }

    function getFilteredRoutesForTable() {
        var q = routeState.search.toLowerCase();
        return routes.filter(function (r) {
            if (!q) return true;
            return r.name.toLowerCase().indexOf(q) !== -1 ||
                   r.origin.toLowerCase().indexOf(q) !== -1 ||
                   r.destination.toLowerCase().indexOf(q) !== -1;
        });
    }

    function renderRouteTable() {
        var filtered = getFilteredRoutesForTable();
        filtered = sortArray(filtered, routeState.sortKey, routeState.sortDir);

        var total = filtered.length;
        var start = (routeState.page - 1) * PAGE_SIZE;
        var paged = filtered.slice(start, start + PAGE_SIZE);

        var tbody = $("#routes-table-body");
        tbody.innerHTML = paged.map(function (r, i) {
            return "<tr>" +
                "<td>" + (start + i + 1) + "</td>" +
                "<td><strong>" + escapeHtml(r.name) + "</strong></td>" +
                "<td>" + escapeHtml(r.origin) + "</td>" +
                "<td>" + escapeHtml(r.destination) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(r.length) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(r.deviceCount) + "</td>" +
                '<td><span class="status-badge ' + r.status + '">' + escapeHtml(STATUS_LABELS[r.status]) + "</span></td>" +
                "<td>" +
                    '<div class="action-btns">' +
                        '<button class="btn btn-sm btn-primary btn-route-detail" data-id="' + escapeHtml(r.id) + '">جزئیات</button>' +
                        '<button class="btn btn-sm btn-danger btn-route-delete" data-id="' + escapeHtml(r.id) + '">حذف</button>' +
                    "</div>" +
                "</td>" +
                "</tr>";
        }).join("");

        // Bind events
        tbody.querySelectorAll(".btn-route-detail").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var r = routes.find(function (x) { return x.id === btn.getAttribute("data-id"); });
                if (r) showRouteDetail(r);
            });
        });

        tbody.querySelectorAll(".btn-route-delete").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = btn.getAttribute("data-id");
                if (confirm("آیا از حذف این محور مطمئن هستید؟")) {
                    routes = routes.filter(function (x) { return x.id !== id; });
                    renderRouteTable();
                }
            });
        });

        renderTableInfo("routes", start, paged.length, total);
        renderPagination("routes", routeState, total);
        applySortHeaders("routes-table", routeState);
    }

    $("#routes-search").addEventListener("input", function () {
        routeState.search = this.value.trim();
        routeState.page = 1;
        renderRouteTable();
    });

    bindTableSort("routes-table", routeState, renderRouteTable);

    function showRouteDetail(r) {
        $("#modal-title").textContent = r.name;
        $("#modal-save").style.display = "none";
        $("#modal-body").innerHTML =
            '<div class="detail-grid">' +
                '<div class="detail-item"><span class="detail-label">شناسه</span><span class="detail-value">' + escapeHtml(r.id) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">مبدأ</span><span class="detail-value">' + escapeHtml(r.origin) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">مقصد</span><span class="detail-value">' + escapeHtml(r.destination) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">طول</span><span class="detail-value" dir="ltr">' + escapeHtml(r.length) + ' km</span></div>' +
                '<div class="detail-item"><span class="detail-label">تعداد دستگاه</span><span class="detail-value">' + escapeHtml(r.deviceCount) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">وضعیت</span><span class="detail-value"><span class="status-badge ' + r.status + '">' + escapeHtml(STATUS_LABELS[r.status]) + '</span></span></div>' +
                '<div class="detail-item"><span class="detail-label">خودروهای عبوری</span><span class="detail-value">' + escapeHtml(formatNumber(r.totalVehicles)) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">سرعت متوسط</span><span class="detail-value" dir="ltr">' + escapeHtml(r.avgSpeed) + ' km/h</span></div>' +
            '</div>';
        $("#modal-overlay").classList.add("active");
    }

    // Add route
    $("#btn-add-route").addEventListener("click", function () {
        $("#add-modal-title").textContent = "افزودن محور جدید";
        $("#add-modal-body").innerHTML =
            '<form id="add-route-form">' +
                '<div class="form-group"><label>نام محور</label><input type="text" id="new-route-name" required></div>' +
                '<div class="form-group"><label>مبدأ</label><input type="text" id="new-route-origin"></div>' +
                '<div class="form-group"><label>مقصد</label><input type="text" id="new-route-dest"></div>' +
                '<div class="form-group"><label>طول (km)</label><input type="number" id="new-route-length" dir="ltr"></div>' +
            '</form>';
        currentAddMode = "route";
        $("#add-modal-overlay").classList.add("active");
    });

    // ============================================================
    // UI3: Devices
    // ============================================================
    var deviceState = { page: 1, search: "", sortKey: "name", sortDir: "asc" };

    function renderDevices() { renderDeviceTable(); }

    function getFilteredDevices() {
        var q = deviceState.search.toLowerCase();
        return devices.filter(function (d) {
            if (!q) return true;
            return d.name.toLowerCase().indexOf(q) !== -1 ||
                   d.id.toLowerCase().indexOf(q) !== -1 ||
                   d.ip.indexOf(q) !== -1;
        });
    }

    function renderDeviceTable() {
        var filtered = getFilteredDevices();
        filtered = sortArray(filtered, deviceState.sortKey, deviceState.sortDir);

        var total = filtered.length;
        var start = (deviceState.page - 1) * PAGE_SIZE;
        var paged = filtered.slice(start, start + PAGE_SIZE);

        var tbody = $("#devices-table-body");
        tbody.innerHTML = paged.map(function (d, i) {
            var routeObj = routes.find(function (r) { return r.id === d.route; });
            var routeName = routeObj ? routeObj.name : d.route;
            return "<tr>" +
                "<td>" + (start + i + 1) + "</td>" +
                '<td style="direction:ltr;text-align:right;font-weight:700">' + escapeHtml(d.deviceCode || "-") + "</td>" +
                "<td><strong>" + escapeHtml(d.name) + "</strong></td>" +
                '<td><span class="type-badge">' + escapeHtml(TYPE_LABELS[d.type] || d.type) + "</span></td>" +
                "<td>" + escapeHtml(routeName) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(d.ip) + "</td>" +
                '<td><span class="status-badge ' + d.status + '">' + escapeHtml(STATUS_LABELS[d.status]) + "</span></td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(formatTime(d.lastSeen)) + "</td>" +
                "<td>" +
                    '<div class="action-btns">' +
                        '<button class="btn btn-sm btn-primary btn-dev-detail" data-id="' + escapeHtml(d.id) + '">جزئیات</button>' +
                        '<button class="btn btn-sm btn-danger btn-dev-delete" data-id="' + escapeHtml(d.id) + '">حذف</button>' +
                    "</div>" +
                "</td>" +
                "</tr>";
        }).join("");

        tbody.querySelectorAll(".btn-dev-detail").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var d = devices.find(function (x) { return x.id === btn.getAttribute("data-id"); });
                if (d) showDeviceDetail(d);
            });
        });

        tbody.querySelectorAll(".btn-dev-delete").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = btn.getAttribute("data-id");
                if (confirm("آیا از حذف این دستگاه مطمئن هستید؟")) {
                    devices = devices.filter(function (x) { return x.id !== id; });
                    renderDeviceTable();
                }
            });
        });

        renderTableInfo("devices", start, paged.length, total);
        renderPagination("devices", deviceState, total);
        applySortHeaders("devices-table", deviceState);
    }

    $("#devices-search").addEventListener("input", function () {
        deviceState.search = this.value.trim();
        deviceState.page = 1;
        renderDeviceTable();
    });

    bindTableSort("devices-table", deviceState, renderDeviceTable);

    function showDeviceDetail(d) {
        var routeObj = routes.find(function (r) { return r.id === d.route; });
        var routeName = routeObj ? routeObj.name : d.route;

        $("#modal-title").textContent = d.name;
        $("#modal-save").style.display = "none";
        $("#modal-body").innerHTML =
            '<div class="detail-grid">' +
                '<div class="detail-item"><span class="detail-label">شناسه</span><span class="detail-value">' + escapeHtml(d.id) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">کد دستگاه (۴ رقمی)</span><span class="detail-value" style="direction:ltr;font-weight:700;font-size:18px;color:#3b82f6">' + escapeHtml(d.deviceCode || "-") + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">نوع</span><span class="detail-value">' + escapeHtml(TYPE_LABELS[d.type]) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">محور</span><span class="detail-value">' + escapeHtml(routeName) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">آدرس IP</span><span class="detail-value" dir="ltr">' + escapeHtml(d.ip) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">وضعیت</span><span class="detail-value"><span class="status-badge ' + d.status + '">' + escapeHtml(STATUS_LABELS[d.status]) + '</span></span></div>' +
                '<div class="detail-item"><span class="detail-label">نسخه فریمور</span><span class="detail-value" dir="ltr">' + escapeHtml(d.firmware) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">آخرین اتصال</span><span class="detail-value" dir="ltr">' + escapeHtml(formatTime(d.lastSeen)) + '</span></div>' +
            '</div>';
        $("#modal-overlay").classList.add("active");
    }

    // Add device
    $("#btn-add-device").addEventListener("click", function () {
        $("#add-modal-title").textContent = "افزودن دستگاه جدید";
        var routeOptions = routes.map(function (r) {
            return '<option value="' + escapeHtml(r.id) + '">' + escapeHtml(r.name) + '</option>';
        }).join("");

        $("#add-modal-body").innerHTML =
            '<form id="add-device-form">' +
                '<div class="form-group"><label>کد دستگاه (۴ رقمی)</label><input type="text" id="new-dev-code" maxlength="4" pattern="\\d{4}" dir="ltr" placeholder="مثال: 1001" required></div>' +
                '<div class="form-group"><label>نام دستگاه</label><input type="text" id="new-dev-name" required></div>' +
                '<div class="form-group"><label>نوع</label><select id="new-dev-type">' +
                    '<option value="camera">دوربین</option>' +
                    '<option value="sensor">سنسور</option>' +
                    '<option value="traffic-light">چراغ راهنمایی</option>' +
                    '<option value="controller">کنترلر</option>' +
                '</select></div>' +
                '<div class="form-group"><label>محور</label><select id="new-dev-route">' + routeOptions + '</select></div>' +
                '<div class="form-group"><label>آدرس IP</label><input type="text" id="new-dev-ip" dir="ltr" placeholder="192.168.x.x"></div>' +
            '</form>';
        currentAddMode = "device";
        $("#add-modal-overlay").classList.add("active");
    });

    // ============================================================
    // UI4: Reports
    // ============================================================
    var reportState = { page: 1 };

    function renderReports() {
        // Populate route dropdown
        var sel = $("#report-route");
        sel.innerHTML = '<option value="">همه محورها</option>';
        routes.forEach(function (r) {
            sel.innerHTML += '<option value="' + escapeHtml(r.name) + '">' + escapeHtml(r.name) + '</option>';
        });

        renderReportTable();
    }

    function getFilteredReports() {
        var routeFilter = $("#report-route").value;
        var from = $("#report-from").value;
        var to = $("#report-to").value;
        return reports.filter(function (r) {
            if (routeFilter && r.route !== routeFilter) return false;
            if (from && r.date < from) return false;
            if (to && r.date > to) return false;
            return true;
        });
    }

    function renderReportTable() {
        var filtered = getFilteredReports();
        var total = filtered.length;
        var start = (reportState.page - 1) * PAGE_SIZE;
        var paged = filtered.slice(start, start + PAGE_SIZE);

        var tbody = $("#report-table-body");
        tbody.innerHTML = paged.map(function (r) {
            return "<tr>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(r.date) + "</td>" +
                "<td>" + escapeHtml(r.route) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(formatNumber(r.vehicles)) + "</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(r.avgSpeed) + " km/h</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(r.maxSpeed) + " km/h</td>" +
                '<td style="direction:ltr;text-align:right">' + escapeHtml(r.violations) + "</td>" +
                "</tr>";
        }).join("");

        renderTableInfo("report", start, paged.length, total);
        renderPagination("report", reportState, total);
    }

    $("#btn-generate-report").addEventListener("click", function () {
        reportState.page = 1;
        renderReportTable();
    });

    // ============================================================
    // UI5: Settings (event handlers)
    // ============================================================
    $("#btn-save-settings").addEventListener("click", function () {
        alert("تنظیمات عمومی ذخیره شد.");
    });

    $("#btn-save-alerts").addEventListener("click", function () {
        alert("تنظیمات هشدار ذخیره شد.");
    });

    // ============================================================
    // Add Modal (shared)
    // ============================================================
    var currentAddMode = "";

    $("#add-modal-save").addEventListener("click", function () {
        if (currentAddMode === "route") {
            var name = ($("#new-route-name") || {}).value;
            if (!name || !name.trim()) { alert("لطفا نام محور را وارد کنید"); return; }
            var maxNum = 0;
            routes.forEach(function (r) {
                var n = parseInt(r.id.split("-")[1], 10);
                if (n > maxNum) maxNum = n;
            });
            routes.push({
                id: "R-" + String(maxNum + 1).padStart(3, "0"),
                name: name.trim(),
                origin: ($("#new-route-origin") || {}).value || "",
                destination: ($("#new-route-dest") || {}).value || "",
                length: parseFloat(($("#new-route-length") || {}).value) || 0,
                deviceCount: 0,
                status: "online",
                totalVehicles: 0,
                avgSpeed: 0,
                errors: 0,
                lastUpdate: new Date().toISOString()
            });
            $("#add-modal-overlay").classList.remove("active");
            renderRouteTable();
        } else if (currentAddMode === "device") {
            var dcode = ($("#new-dev-code") || {}).value;
            var dname = ($("#new-dev-name") || {}).value;
            var ip = ($("#new-dev-ip") || {}).value;
            if (!dcode || !/^\d{4}$/.test(dcode)) { alert("کد دستگاه باید ۴ رقمی باشد"); return; }
            if (!dname || !dname.trim() || !ip || !ip.trim()) { alert("لطفا نام و IP را وارد کنید"); return; }
            if (devices.some(function (d) { return d.deviceCode === dcode; })) { alert("کد دستگاه تکراری است"); return; }
            var type = ($("#new-dev-type") || {}).value || "camera";
            var prefix = { camera: "CAM", sensor: "SEN", "traffic-light": "TL", controller: "CTR" }[type] || "DEV";
            var dmax = 0;
            devices.forEach(function (d) {
                if (d.id.indexOf(prefix + "-") === 0) {
                    var num = parseInt(d.id.split("-")[1], 10);
                    if (num > dmax) dmax = num;
                }
            });
            devices.push({
                id: prefix + "-" + String(dmax + 1).padStart(3, "0"),
                deviceCode: dcode,
                name: dname.trim(),
                type: type,
                route: ($("#new-dev-route") || {}).value || "",
                ip: ip.trim(),
                status: "online",
                lastSeen: new Date().toISOString(),
                firmware: "v1.0.0"
            });
            $("#add-modal-overlay").classList.remove("active");
            renderDeviceTable();
        }
    });

    // ============================================================
    // Modal close handlers
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
    // Export Buttons
    // ============================================================
    $$(".export-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var action = btn.getAttribute("data-action");
            var table = btn.closest(".panel").querySelector(".data-table");
            if (!table) return;

            if (action === "copy") {
                copyTableToClipboard(table);
            } else if (action === "csv") {
                downloadTableAsCSV(table);
            } else if (action === "excel") {
                downloadTableAsCSV(table, "xls");
            } else if (action === "pdf" || action === "print") {
                printTable(table);
            }
        });
    });

    function copyTableToClipboard(table) {
        var text = tableToText(table);
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function () {
                alert("کپی شد!");
            });
        }
    }

    function downloadTableAsCSV(table, ext) {
        var text = tableToCSV(table);
        var blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" });
        var link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "export." + (ext || "csv");
        link.click();
    }

    function printTable(table) {
        var win = window.open("", "_blank");
        win.document.write('<html dir="rtl"><head><title>چاپ</title><style>body{font-family:Tahoma,sans-serif;direction:rtl}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:right}th{background:#f0f0f0}</style></head><body>');
        win.document.write(table.outerHTML);
        win.document.write("</body></html>");
        win.document.close();
        win.print();
    }

    function tableToText(table) {
        var rows = table.querySelectorAll("tr");
        var lines = [];
        rows.forEach(function (row) {
            var cells = [];
            row.querySelectorAll("th, td").forEach(function (cell) {
                cells.push(cell.textContent.trim());
            });
            lines.push(cells.join("\t"));
        });
        return lines.join("\n");
    }

    function tableToCSV(table) {
        var rows = table.querySelectorAll("tr");
        var lines = [];
        rows.forEach(function (row) {
            var cells = [];
            row.querySelectorAll("th, td").forEach(function (cell) {
                var val = cell.textContent.trim().replace(/"/g, '""');
                cells.push('"' + val + '"');
            });
            lines.push(cells.join(","));
        });
        return lines.join("\n");
    }

    // ============================================================
    // Shared: Pagination, Sorting, Table Info
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

    function renderPagination(prefix, state, total) {
        var container = $("#" + prefix + "-pagination");
        if (!container) return;
        var pages = Math.ceil(total / PAGE_SIZE);
        if (pages <= 1) { container.innerHTML = ""; return; }

        var html = "";
        html += '<button class="page-btn" data-p="prev" ' + (state.page <= 1 ? "disabled" : "") + '>&laquo;</button>';
        for (var i = 1; i <= pages; i++) {
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

                // Re-render
                if (prefix === "home") renderHomeTable();
                else if (prefix === "routes") renderRouteTable();
                else if (prefix === "devices") renderDeviceTable();
                else if (prefix === "report") renderReportTable();
            });
        });
    }

    function sortArray(arr, key, dir) {
        return arr.slice().sort(function (a, b) {
            var va = a[key] != null ? a[key] : "";
            var vb = b[key] != null ? b[key] : "";
            if (typeof va === "number" && typeof vb === "number") {
                return dir === "asc" ? va - vb : vb - va;
            }
            va = String(va).toLowerCase();
            vb = String(vb).toLowerCase();
            if (va < vb) return dir === "asc" ? -1 : 1;
            if (va > vb) return dir === "asc" ? 1 : -1;
            return 0;
        });
    }

    function bindTableSort(tableId, state, renderFn) {
        var table = $("#" + tableId);
        if (!table) return;
        table.querySelectorAll("th[data-sort]").forEach(function (th) {
            th.addEventListener("click", function () {
                var key = th.getAttribute("data-sort");
                if (state.sortKey === key) {
                    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
                } else {
                    state.sortKey = key;
                    state.sortDir = "asc";
                }
                state.page = 1;
                renderFn();
            });
        });
    }

    function applySortHeaders(tableId, state) {
        var table = $("#" + tableId);
        if (!table) return;
        table.querySelectorAll("th[data-sort]").forEach(function (th) {
            th.classList.remove("sort-asc", "sort-desc");
            if (th.getAttribute("data-sort") === state.sortKey) {
                th.classList.add("sort-" + state.sortDir);
            }
        });
    }

    // ============================================================
    // Init
    // ============================================================
    renderHome();

})();
