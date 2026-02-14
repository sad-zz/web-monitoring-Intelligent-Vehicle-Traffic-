(function () {
    "use strict";

    // --- State ---
    var devices = JSON.parse(JSON.stringify(DEVICE_DATA));
    var activeFilters = { online: true, offline: true, warning: true, error: true };
    var activeTypeFilters = { camera: true, sensor: true, "traffic-light": true, controller: true };

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

    var TYPE_ICONS = {
        camera: "\uD83D\uDCF7",
        sensor: "\uD83D\uDCE1",
        "traffic-light": "\uD83D\uDEA6",
        controller: "\uD83D\uDDA5"
    };

    // --- DOM Refs ---
    var $ = function (sel) { return document.querySelector(sel); };
    var $$ = function (sel) { return document.querySelectorAll(sel); };

    // --- Navigation ---
    $$(".nav-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            $$(".nav-btn").forEach(function (b) { b.classList.remove("active"); });
            btn.classList.add("active");
            var view = btn.getAttribute("data-view");
            $$(".view").forEach(function (v) { v.classList.remove("active"); });
            $("#view-" + view).classList.add("active");
            if (view === "map") renderMap();
        });
    });

    // --- Filters ---
    $$("[data-filter]").forEach(function (cb) {
        cb.addEventListener("change", function () {
            activeFilters[cb.getAttribute("data-filter")] = cb.checked;
            renderDeviceTable();
            renderMap();
        });
    });

    $$("[data-type-filter]").forEach(function (cb) {
        cb.addEventListener("change", function () {
            activeTypeFilters[cb.getAttribute("data-type-filter")] = cb.checked;
            renderDeviceTable();
            renderMap();
        });
    });

    // --- Search ---
    $("#device-search").addEventListener("input", function () {
        renderDeviceTable();
    });

    // --- Filtered devices ---
    function getFilteredDevices() {
        var search = ($("#device-search").value || "").trim().toLowerCase();
        return devices.filter(function (d) {
            if (!activeFilters[d.status]) return false;
            if (!activeTypeFilters[d.type]) return false;
            if (search && d.name.toLowerCase().indexOf(search) === -1 &&
                d.id.toLowerCase().indexOf(search) === -1 &&
                d.ip.indexOf(search) === -1 &&
                d.location.toLowerCase().indexOf(search) === -1) {
                return false;
            }
            return true;
        });
    }

    // --- Dashboard Stats ---
    function renderStats() {
        var total = devices.length;
        var online = devices.filter(function (d) { return d.status === "online"; }).length;
        var warn = devices.filter(function (d) { return d.status === "warning"; }).length;
        var err = devices.filter(function (d) { return d.status === "error"; }).length;
        var offline = devices.filter(function (d) { return d.status === "offline"; }).length;

        $("#stat-total").textContent = total;
        $("#stat-online").textContent = online;
        $("#stat-warning").textContent = warn;
        $("#stat-error").textContent = err;

        $("#count-online").textContent = online;
        $("#count-offline").textContent = offline;
        $("#count-warning").textContent = warn;
        $("#count-error").textContent = err;

        $("#device-count-header").textContent = total + " دیوایس";
    }

    // --- Events ---
    function renderEvents() {
        var container = $("#event-list");
        var events = [];

        devices.forEach(function (d) {
            var msg = "";
            if (d.status === "error") msg = d.name + " دچار خطا شده است";
            else if (d.status === "warning") msg = d.name + " هشدار عملکرد دارد";
            else if (d.status === "offline") msg = d.name + " آفلاین شده است";
            else msg = d.name + " به درستی کار می‌کند";

            events.push({
                status: d.status,
                message: msg,
                time: formatTime(d.lastSeen)
            });
        });

        events.sort(function (a, b) { return a.time > b.time ? -1 : 1; });

        container.innerHTML = events.slice(0, 8).map(function (e) {
            return '<div class="event-item">' +
                '<span class="event-dot ' + e.status + '"></span>' +
                '<span>' + escapeHtml(e.message) + '</span>' +
                '<span class="event-time">' + escapeHtml(e.time) + '</span>' +
                '</div>';
        }).join("");
    }

    // --- Device Table ---
    function renderDeviceTable() {
        var tbody = $("#device-table-body");
        var filtered = getFilteredDevices();

        tbody.innerHTML = filtered.map(function (d) {
            return '<tr>' +
                '<td><strong>' + escapeHtml(d.id) + '</strong></td>' +
                '<td>' + escapeHtml(d.name) + '</td>' +
                '<td><span class="device-type-badge">' + escapeHtml(TYPE_LABELS[d.type] || d.type) + '</span></td>' +
                '<td><span class="device-status ' + d.status + '">' + escapeHtml(STATUS_LABELS[d.status]) + '</span></td>' +
                '<td style="direction:ltr;text-align:right;">' + escapeHtml(d.ip) + '</td>' +
                '<td>' + escapeHtml(d.location) + '</td>' +
                '<td style="direction:ltr;text-align:right;">' + escapeHtml(formatTime(d.lastSeen)) + '</td>' +
                '<td>' +
                    '<div class="action-btns">' +
                        '<button class="btn btn-sm btn-primary btn-detail" data-id="' + escapeHtml(d.id) + '">جزئیات</button>' +
                        '<button class="btn btn-sm btn-danger btn-delete" data-id="' + escapeHtml(d.id) + '">حذف</button>' +
                    '</div>' +
                '</td>' +
                '</tr>';
        }).join("");

        // Bind detail buttons
        tbody.querySelectorAll(".btn-detail").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var device = devices.find(function (d) { return d.id === btn.getAttribute("data-id"); });
                if (device) showDeviceDetail(device);
            });
        });

        // Bind delete buttons
        tbody.querySelectorAll(".btn-delete").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = btn.getAttribute("data-id");
                if (confirm("آیا از حذف دیوایس " + id + " مطمئن هستید؟")) {
                    devices = devices.filter(function (d) { return d.id !== id; });
                    renderAll();
                }
            });
        });
    }

    // --- Device Detail Modal ---
    function showDeviceDetail(device) {
        $("#modal-title").textContent = device.name;
        $("#modal-save").style.display = "none";

        var cpuClass = device.metrics.cpu < 60 ? "good" : device.metrics.cpu < 80 ? "medium" : "bad";
        var memClass = device.metrics.memory < 60 ? "good" : device.metrics.memory < 80 ? "medium" : "bad";
        var bwClass = device.metrics.bandwidth < 60 ? "good" : device.metrics.bandwidth < 80 ? "medium" : "bad";

        $("#modal-body").innerHTML =
            '<div class="detail-grid">' +
                '<div class="detail-item"><span class="detail-label">شناسه</span><span class="detail-value">' + escapeHtml(device.id) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">نوع</span><span class="detail-value">' + escapeHtml(TYPE_LABELS[device.type]) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">وضعیت</span><span class="detail-value"><span class="device-status ' + device.status + '">' + escapeHtml(STATUS_LABELS[device.status]) + '</span></span></div>' +
                '<div class="detail-item"><span class="detail-label">آدرس IP</span><span class="detail-value" style="direction:ltr">' + escapeHtml(device.ip) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">موقعیت</span><span class="detail-value">' + escapeHtml(device.location) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">نسخه فریمور</span><span class="detail-value" style="direction:ltr">' + escapeHtml(device.firmware) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">آپتایم</span><span class="detail-value">' + escapeHtml(device.uptime) + '</span></div>' +
                '<div class="detail-item"><span class="detail-label">آخرین اتصال</span><span class="detail-value" style="direction:ltr">' + escapeHtml(formatTime(device.lastSeen)) + '</span></div>' +
            '</div>' +
            '<div class="detail-section">' +
                '<h4>معیارهای عملکرد</h4>' +
                '<div class="metric-bar">' +
                    '<span class="metric-label">CPU</span>' +
                    '<div class="metric-track"><div class="metric-fill ' + cpuClass + '" style="width:' + device.metrics.cpu + '%"></div></div>' +
                    '<span class="metric-value">' + device.metrics.cpu + '%</span>' +
                '</div>' +
                '<div class="metric-bar">' +
                    '<span class="metric-label">حافظه</span>' +
                    '<div class="metric-track"><div class="metric-fill ' + memClass + '" style="width:' + device.metrics.memory + '%"></div></div>' +
                    '<span class="metric-value">' + device.metrics.memory + '%</span>' +
                '</div>' +
                '<div class="metric-bar">' +
                    '<span class="metric-label">پهنای باند</span>' +
                    '<div class="metric-track"><div class="metric-fill ' + bwClass + '" style="width:' + device.metrics.bandwidth + '%"></div></div>' +
                    '<span class="metric-value">' + device.metrics.bandwidth + '%</span>' +
                '</div>' +
            '</div>';

        $("#modal-overlay").classList.add("active");
    }

    // --- Map ---
    function renderMap() {
        var container = $("#map-grid");
        var filtered = getFilteredDevices();

        // Normalize lat/lng to viewport positions
        var lats = filtered.map(function (d) { return d.lat; });
        var lngs = filtered.map(function (d) { return d.lng; });
        var minLat = Math.min.apply(null, lats) - 0.01;
        var maxLat = Math.max.apply(null, lats) + 0.01;
        var minLng = Math.min.apply(null, lngs) - 0.01;
        var maxLng = Math.max.apply(null, lngs) + 0.01;

        container.innerHTML = filtered.map(function (d) {
            var top = 100 - ((d.lat - minLat) / (maxLat - minLat)) * 80 - 10;
            var left = ((d.lng - minLng) / (maxLng - minLng)) * 80 + 10;

            return '<div class="map-marker ' + d.status + '" ' +
                'style="top:' + top + '%;left:' + left + '%;" ' +
                'data-id="' + escapeHtml(d.id) + '" title="' + escapeHtml(d.name) + '">' +
                (TYPE_ICONS[d.type] || "?") +
                '<span class="map-marker-label">' + escapeHtml(d.name) + '</span>' +
                '</div>';
        }).join("");

        container.querySelectorAll(".map-marker").forEach(function (marker) {
            marker.addEventListener("click", function () {
                var device = devices.find(function (d) { return d.id === marker.getAttribute("data-id"); });
                if (device) showDeviceDetail(device);
            });
        });
    }

    // --- Add Device ---
    $("#btn-add-device").addEventListener("click", function () {
        $("#add-device-form").reset();
        $("#add-modal-overlay").classList.add("active");
    });

    $("#add-modal-save").addEventListener("click", function () {
        var name = $("#new-device-name").value.trim();
        var type = $("#new-device-type").value;
        var ip = $("#new-device-ip").value.trim();
        var location = $("#new-device-location").value.trim();
        var lat = parseFloat($("#new-device-lat").value) || 35.7 + Math.random() * 0.1;
        var lng = parseFloat($("#new-device-lng").value) || 51.35 + Math.random() * 0.1;

        if (!name || !ip) {
            alert("لطفا نام و آدرس IP را وارد کنید");
            return;
        }

        var prefix = { camera: "CAM", sensor: "SEN", "traffic-light": "TL", controller: "CTR" }[type] || "DEV";
        var maxNum = 0;
        devices.forEach(function (d) {
            if (d.id.indexOf(prefix + "-") === 0) {
                var num = parseInt(d.id.split("-")[1], 10);
                if (num > maxNum) maxNum = num;
            }
        });
        var newId = prefix + "-" + String(maxNum + 1).padStart(3, "0");

        devices.push({
            id: newId,
            name: name,
            type: type,
            status: "online",
            ip: ip,
            location: location || "نامشخص",
            lat: lat,
            lng: lng,
            lastSeen: new Date().toISOString(),
            firmware: "v1.0.0",
            uptime: "0 روز",
            metrics: { cpu: 10, memory: 15, bandwidth: 5 }
        });

        $("#add-modal-overlay").classList.remove("active");
        renderAll();
    });

    // --- Modal Close ---
    ["modal-close", "modal-cancel"].forEach(function (id) {
        $("#" + id).addEventListener("click", function () {
            $("#modal-overlay").classList.remove("active");
        });
    });

    ["add-modal-close", "add-modal-cancel"].forEach(function (id) {
        $("#" + id).addEventListener("click", function () {
            $("#add-modal-overlay").classList.remove("active");
        });
    });

    // Close on overlay click
    ["modal-overlay", "add-modal-overlay"].forEach(function (id) {
        $("#" + id).addEventListener("click", function (e) {
            if (e.target === this) this.classList.remove("active");
        });
    });

    // --- Helpers ---
    function formatTime(iso) {
        if (!iso) return "-";
        var d = new Date(iso);
        var hours = String(d.getHours()).padStart(2, "0");
        var mins = String(d.getMinutes()).padStart(2, "0");
        var month = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        return d.getFullYear() + "/" + month + "/" + day + " " + hours + ":" + mins;
    }

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // --- Render All ---
    function renderAll() {
        renderStats();
        renderEvents();
        renderDeviceTable();
    }

    // --- Init ---
    renderAll();

})();
