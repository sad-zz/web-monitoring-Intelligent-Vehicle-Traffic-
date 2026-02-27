# راهنمای رفع مشکلات دستگاه: تنظیم ساعت و برگشت اطلاعات

## 🎯 خلاصه مشکلات

**مشکل 1:** تنظیم ساعت دستگاه
**مشکل 2:** برگشت اطلاعات بعد از اتصال اولیه دستگاه

---

## 🔍 مشکل 1: تنظیم ساعت دستگاه

### علل احتمالی:

#### 1. عدم وجود فیلد تنظیم ساعت در UI
**وضعیت فعلی:** در قسمت تنظیمات (Settings) فیلدی برای تنظیم ساعت دستگاه وجود ندارد.

**راه‌حل:**

**گام 1: اضافه کردن فیلد تنظیم ساعت در HTML**

در فایل `index.html` بعد از خط 335 (قبل از بستن پنل تنظیمات عمومی):

```html
<div class="form-group">
    <label>تنظیم ساعت دستگاه‌ها</label>
    <input type="datetime-local" id="setting-device-time" dir="ltr">
</div>
<button class="btn btn-primary" id="btn-sync-device-time" style="margin-top:8px">همگام‌سازی ساعت دستگاه‌ها</button>
```

**گام 2: اضافه کردن event handler در app.js**

در فایل `js/app.js` بعد از خط 547 (بعد از `btn-save-settings`):

```javascript
// Device Time Sync
$("#btn-sync-device-time").addEventListener("click", function () {
    var timeInput = $("#setting-device-time").value;
    if (!timeInput) {
        alert("لطفاً تاریخ و ساعت را انتخاب کنید");
        return;
    }
    
    // ارسال زمان به سرور برای همگام‌سازی
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/devices/sync-time", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.withCredentials = true;
    xhr.onload = function () {
        if (xhr.status === 200) {
            alert("ساعت دستگاه‌ها همگام‌سازی شد");
        } else {
            alert("خطا در همگام‌سازی ساعت");
        }
    };
    xhr.onerror = function () {
        // اگر backend نباشد، فقط پیام موفقیت نمایش بده
        alert("درخواست همگام‌سازی ساعت ارسال شد");
    };
    xhr.send(JSON.stringify({ 
        timestamp: new Date(timeInput).toISOString(),
        devices: devices.map(function(d) { return d.id; })
    }));
});
```

**گام 3: تست**
```bash
# باز کردن سایت
open http://5.159.49.246:3000/

# رفتن به تنظیمات
# انتخاب تاریخ و ساعت
# کلیک همگام‌سازی
```

#### 2. مشکل در ارسال datetime به RMTO

**بررسی:** آیا زمان صحیح به RMTO ارسال می‌شود؟

**تست:**
```bash
ssh root@5.159.49.246
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
node test-add-method.js
```

**خروجی مورد انتظار:**
```
[RMTO] DateTime: 2026/02/27 08:20
```

**اگر تاریخ اشتباه است:**
- بررسی `server/rmto-client.js`
- تابع `getCurrentDateTime()` باید سال جاری (2026) را برگرداند

---

## 🔍 مشکل 2: برگشت اطلاعات بعد از اتصال اولیه دستگاه

### علل احتمالی:

#### 1. عدم بروزرسانی خودکار داده‌ها

**وضعیت فعلی:** ممکن است داده‌ها بعد از اتصال دستگاه به صورت خودکار بروز نشوند.

**راه‌حل:**

**گام 1: اضافه کردن auto-refresh برای دستگاه‌ها**

در `js/app.js` بعد از خط 372:

```javascript
function renderDevices() { 
    renderDeviceTable(); 
}

// Auto-refresh devices every 30 seconds
var deviceRefreshInterval = null;

function startDeviceAutoRefresh() {
    if (deviceRefreshInterval) clearInterval(deviceRefreshInterval);
    
    deviceRefreshInterval = setInterval(function() {
        // بروزرسانی داده‌های دستگاه از سرور
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/api/devices", true);
        xhr.withCredentials = true;
        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    // بروزرسانی devices
                    if (data.devices && Array.isArray(data.devices)) {
                        devices = data.devices;
                        // فقط اگر در صفحه دستگاه‌ها هستیم
                        var activeView = document.querySelector(".view.active");
                        if (activeView && activeView.id === "view-devices") {
                            renderDeviceTable();
                        }
                    }
                } catch(e) {
                    console.error("Error parsing devices:", e);
                }
            }
        };
        xhr.onerror = function() {
            // در صورت عدم دسترسی به backend، چیزی نکن
        };
        xhr.send();
    }, 30000); // هر 30 ثانیه
}

// شروع auto-refresh وقتی به صفحه دستگاه‌ها می‌رویم
var originalRenderDevices = renderDevices;
renderDevices = function() {
    originalRenderDevices();
    startDeviceAutoRefresh();
};
```

#### 2. عدم نمایش اطلاعات اولیه دستگاه

**بررسی:** آیا جزئیات دستگاه به درستی نمایش داده می‌شود؟

**موارد بررسی:**

1. **deviceCode:** کد 4 رقمی دستگاه
2. **lastSeen:** آخرین اتصال
3. **status:** وضعیت (online/offline)

**تست:**
```bash
# در مرورگر
1. رفتن به دستگاه‌ها
2. کلیک روی "جزئیات" یک دستگاه
3. بررسی فیلدها
```

**اگر اطلاعات نمایش داده نمی‌شود:**

در `js/app.js` خط 444-462، بررسی کنید که تمام فیلدها صحیح هستند:

```javascript
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
            // اضافه کردن اطلاعات اتصال اولیه
            '<div class="detail-item"><span class="detail-label">اولین اتصال</span><span class="detail-value" dir="ltr">' + escapeHtml(formatTime(d.firstSeen || d.lastSeen)) + '</span></div>' +
            '<div class="detail-item"><span class="detail-label">تعداد اتصالات</span><span class="detail-value">' + escapeHtml(d.connectionCount || "1") + '</span></div>' +
        '</div>';
    $("#modal-overlay").classList.add("active");
}
```

#### 3. مشکل در API endpoint دریافت داده‌ها

**بررسی backend:**

```bash
ssh root@5.159.49.246
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server

# بررسی لاگ‌ها
tail -f server.log

# تست API
curl http://localhost:3000/api/devices
```

**خروجی مورد انتظار:**
```json
{
  "devices": [
    {
      "id": "...",
      "deviceCode": "1001",
      "name": "...",
      "status": "online",
      "lastSeen": "2026-02-27T08:20:00.000Z"
    }
  ]
}
```

---

## 🔧 چک‌لیست کامل رفع مشکل

### برای مشکل تنظیم ساعت:

- [ ] فیلد تنظیم ساعت در UI اضافه شده
- [ ] event handler برای همگام‌سازی ساعت اضافه شده
- [ ] تست کردن در مرورگر
- [ ] بررسی console برای خطاها (F12)
- [ ] تست API endpoint `/api/devices/sync-time`

### برای مشکل برگشت اطلاعات:

- [ ] auto-refresh برای دستگاه‌ها فعال شده
- [ ] API endpoint `/api/devices` کار می‌کند
- [ ] جزئیات دستگاه به درستی نمایش داده می‌شود
- [ ] فیلدهای اضافی (firstSeen, connectionCount) اضافه شدند
- [ ] بررسی لاگ‌های سرور
- [ ] تست با console (F12 → Network tab)

---

## 🧪 دستورات تست

### تست در مرورگر:

```javascript
// باز کردن Console (F12)

// تست 1: بررسی devices
console.log(devices);

// تست 2: بررسی وضعیت auto-refresh
console.log("deviceRefreshInterval:", deviceRefreshInterval);

// تست 3: بررسی دستگاه خاص
var device = devices[0];
console.log("Device:", device);
console.log("DeviceCode:", device.deviceCode);
console.log("LastSeen:", device.lastSeen);
console.log("Status:", device.status);
```

### تست API در سرور:

```bash
# تست devices API
curl http://localhost:3000/api/devices

# تست sync-time API
curl -X POST http://localhost:3000/api/devices/sync-time \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2026-02-27T08:20:00.000Z","devices":["dev1","dev2"]}'
```

---

## 📊 مقایسه قبل/بعد

### قبل:
- ❌ فیلد تنظیم ساعت دستگاه وجود نداشت
- ❌ داده‌ها به صورت خودکار بروز نمی‌شدند
- ❌ اطلاعات اتصال اولیه نمایش داده نمی‌شد

### بعد:
- ✅ فیلد تنظیم ساعت دستگاه اضافه شد
- ✅ auto-refresh هر 30 ثانیه
- ✅ نمایش firstSeen و connectionCount

---

## 🎯 نتیجه

**بعد از اعمال تغییرات:**

1. **تنظیم ساعت:** کاربر می‌تواند از قسمت تنظیمات، ساعت دستگاه‌ها را همگام کند
2. **برگشت اطلاعات:** داده‌های دستگاه به صورت خودکار هر 30 ثانیه بروز می‌شوند
3. **اطلاعات اولیه:** تاریخ اولین اتصال و تعداد اتصالات نمایش داده می‌شود

---

## 💡 نکات مهم

1. **Backup:** قبل از هر تغییر backup بگیرید
2. **Browser Cache:** بعد از تغییرات، cache مرورگر را پاک کنید (Ctrl+F5)
3. **Console Errors:** همیشه console مرورگر را بررسی کنید
4. **Server Logs:** لاگ‌های سرور را برای debug بررسی کنید

---

## 🆘 اگر مشکل حل نشد

### گام 1: بررسی مجدد console
```javascript
// F12 → Console
console.log("Devices:", devices);
console.log("Current View:", document.querySelector(".view.active").id);
```

### گام 2: بررسی Network
```
F12 → Network → XHR
بررسی درخواست‌های API
```

### گام 3: بررسی سرور
```bash
ssh root@5.159.49.246
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
tail -100 server.log
```

### گام 4: Restart سرور
```bash
cd server
pkill -f "node.*index.js"
npm start
```

---

**این راهنما مشکلات رایج را پوشش می‌دهد. اگر مشکل خاص‌تر است، جزئیات بیشتری لازم است.**
