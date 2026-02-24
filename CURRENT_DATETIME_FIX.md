# ✅ رفع تاریخ: استفاده از زمان واقعی سرور

## مشکل / Problem

**قبل:**
```javascript
dateTime: '2024/02/23 14:30'  // تاریخ hard-coded قدیمی
```

**مشکل:** تاریخ‌های نمونه 2024 بودند اما باید 2026 (زمان فعلی) باشند!

---

## ✅ راه‌حل / Solution

### تابع جدید در rmto-client.js:

```javascript
/**
 * دریافت تاریخ و زمان فعلی سرور به فرمت RMTO
 * @returns {string} DateTime در فرمت "YYYY/MM/DD HH:mm"
 */
function getCurrentDateTime() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    var hour = String(now.getHours()).padStart(2, '0');
    var minute = String(now.getMinutes()).padStart(2, '0');
    
    return year + '/' + month + '/' + day + ' ' + hour + ':' + minute;
}
```

**مثال خروجی:**
```
2026/02/24 08:50
```

---

## 📝 تغییرات

### 1. server/rmto-client.js

**تابع جدید:**
- `getCurrentDateTime()` - دریافت تاریخ فعلی به فرمت RMTO

**Export:**
```javascript
module.exports = {
    ...
    getCurrentDateTime: getCurrentDateTime
};
```

### 2. server/test-add-method.js

**قبل:**
```javascript
dateTime: '2024/02/23 14:30'  // ❌ hard-coded
```

**بعد:**
```javascript
var currentDateTime = rmto.getCurrentDateTime();
dateTime: currentDateTime  // ✅ تاریخ واقعی سرور
```

**خروجی:**
```
Current Server DateTime: 2026/02/24 08:50
Test data: {
  "deviceCode": "1001",
  "dateTime": "2026/02/24 08:50",  ✅ سال 2026
  "totalCount": 45,
  "avgSpeed": 85
}
```

### 3. server/test-rmto.js

همین تغییر برای test-rmto.js

---

## 🧪 تست

```bash
cd server
node test-add-method.js
```

**خروجی موفق:**
```
============================================================
Testing RMTO Add Method
============================================================

Current Server DateTime: 2026/02/24 08:50
Test data: {
  "deviceCode": "1001",
  "dateTime": "2026/02/24 08:50",  ✅
  "totalCount": 45,
  "avgSpeed": 85
}

[RMTO] AddData request: {
  "DateTime": "2026/02/24 08:50"  ✅
  ...
}
```

---

## 🎯 استفاده / Usage

### در کد خود:

```javascript
var rmto = require('./rmto-client.js');

// دریافت تاریخ فعلی
var currentDateTime = rmto.getCurrentDateTime();
console.log(currentDateTime);  // "2026/02/24 08:50"

// استفاده در ارسال
rmto.sendAddData({
    deviceCode: "1001",
    dateTime: currentDateTime,  // تاریخ واقعی
    totalCount: 45,
    avgSpeed: 85
}, callback);
```

### دستور CLI:

```bash
# نمایش تاریخ فعلی
node -p "require('./rmto-client.js').getCurrentDateTime()"
# خروجی: 2026/02/24 08:50
```

---

## 📊 مقایسه قبل/بعد

| مورد | قبل | بعد |
|------|-----|-----|
| نوع | Hard-coded | Dynamic |
| سال | 2024 ❌ | 2026 ✅ |
| زمان | ثابت | فعلی سرور |
| مثال | 2024/02/23 14:30 | 2026/02/24 08:50 |

---

## 💡 مزایا / Benefits

1. ✅ **همیشه به‌روز** - تاریخ از سرور گرفته می‌شود
2. ✅ **بدون hard-code** - نیازی به تغییر دستی نیست
3. ✅ **فرمت صحیح** - دقیقاً مطابق RMTO (YYYY/MM/DD HH:mm)
4. ✅ **استفاده آسان** - یک تابع ساده

---

## 🚀 نکات / Notes

### زمان محلی vs UTC

تابع فعلی از **زمان محلی سرور** استفاده می‌کند.

اگر نیاز به UTC دارید:
```javascript
function getCurrentDateTimeUTC() {
    var now = new Date();
    var year = now.getUTCFullYear();
    var month = String(now.getUTCMonth() + 1).padStart(2, '0');
    var day = String(now.getUTCDate()).padStart(2, '0');
    var hour = String(now.getUTCHours()).padStart(2, '0');
    var minute = String(now.getUTCMinutes()).padStart(2, '0');
    
    return year + '/' + month + '/' + day + ' ' + hour + ':' + minute;
}
```

### تنظیم TimeZone سرور

```bash
# بررسی timezone فعلی
timedatectl

# تنظیم timezone ایران
sudo timedatectl set-timezone Asia/Tehran

# تنظیم زمان دستی (اختیاری)
sudo timedatectl set-time '2026-02-24 08:50:00'
```

---

## ✅ چک‌لیست

- [x] تابع getCurrentDateTime() اضافه شد
- [x] Export شد در rmto-client.js
- [x] test-add-method.js بروز شد
- [x] test-rmto.js بروز شد
- [x] تست شد (خروجی 2026)
- [x] مستندات اضافه شد

**تاریخ حالا همیشه به‌روز است! ✅**

---

## 📁 فایل‌های تغییر یافته

- `server/rmto-client.js` - تابع getCurrentDateTime()
- `server/test-add-method.js` - استفاده از تاریخ فعلی
- `server/test-rmto.js` - استفاده از تاریخ فعلی
- `CURRENT_DATETIME_FIX.md` - این راهنما

**همه چیز با زمان واقعی سرور (2026) همگام است! 🎉**
