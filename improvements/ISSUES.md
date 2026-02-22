# TC Manager – بررسی ایرادات و مشکلات
> **تاریخ بررسی:** ۱۴۰۴/۱۲/۰۴  
> **توجه:** فایل‌های اصلی پروژه دست‌نخورده باقی مانده‌اند. تمام اصلاحات در همین پوشه `improvements/` ذخیره شده‌اند.

---

## خلاصه ایرادات یافت‌شده

| شماره | درجه اهمیت | مشکل | فایل | وضعیت |
|-------|-----------|------|------|--------|
| ۱ | 🔴 بحرانی | محاسبه تردد امروز با زمان اشتباه (UTC vs Local) | `server/index.js` خط ۳۵۶ | اصلاح در `improvements/` |
| ۲ | 🔴 بحرانی | دستگاه‌های HTTP هرگز آفلاین نمی‌شوند | `server/scheduler.js` | اصلاح در `improvements/server/scheduler.js` |
| ۳ | 🟠 مهم | داده‌های تکراری در جدول irawdata انباشته می‌شوند | `server/db.js` | اصلاح در `improvements/server/db.js` |
| ۴ | 🟠 مهم | مدیریت محورها (mehvar) در رابط کاربری وجود ندارد | `js/app.js`, `index.html` | اصلاح در `improvements/` |
| ۵ | 🟡 متوسط | کاربران TCP متصل در رابط کاربری نمایش داده نمی‌شوند | `js/app.js`, `index.html` | مستندسازی شده |
| ۶ | 🟡 متوسط | جدول `users` در `db.js` تعریف نشده | `server/index.js`, `server/db.js` | مستندسازی شده |
| ۷ | 🟢 کم | فایل‌های `patch.js` و `patch2.js` اعمال‌شده‌اند ولی هنوز در ریشه هستند | `/patch.js`, `/patch2.js` | مستندسازی شده |

---

## جزئیات هر ایراد

---

### ایراد ۱ – بحرانی: محاسبه تردد امروز با زمان UTC

**فایل:** `server/index.js`  
**خط تقریبی:** ۳۵۶ (در تابع `/api/stats`)

**مشکل:**  
```javascript
var todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
var todayIraw = db.prepare("SELECT ... FROM irawdata WHERE create_at >= ?")
    .get(todayStart.toISOString()); // ← مشکل: .toISOString() زمان UTC برمی‌گرداند (با Z)
```

فیلد `create_at` در جدول `irawdata` به فرمت زمان محلی (بدون Z) ذخیره می‌شود:  
مثال: `"2026-02-22T10:30:00"` (به وقت تهران)

ولی `.toISOString()` زمان UTC را برمی‌گرداند:  
مثال: `"2026-02-21T20:30:00.000Z"` (UTC=تهران منهای ۳:۳۰)

این باعث می‌شود SQLite مقایسه متنی اشتباه انجام دهد و آمار تردد امروز نادرست نمایش داده شود.

**اصلاح مورد نیاز در `server/index.js`:**  
```javascript
// قبل از آمار، تابع کمکی اضافه کنید (یا از toLocalISOString scheduler استفاده کنید):
function localISODate(d) {
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1).padStart(2, "0");
    var dy = String(d.getDate()).padStart(2, "0");
    return y + "-" + mo + "-" + dy + "T00:00:00";
}

// سپس در /api/stats:
var todayStart = new Date();
var todayStartStr = localISODate(todayStart); // ← به جای todayStart.toISOString()
var todayIraw = db.prepare("SELECT COALESCE(SUM(a+b+c+d+e+x), 0) as c FROM irawdata WHERE create_at >= ?")
    .get(todayStartStr);
```

---

### ایراد ۲ – بحرانی: دستگاه‌های HTTP هرگز آفلاین نمی‌شوند

**فایل:** `server/scheduler.js`

**مشکل:**  
دستگاه‌های TCP زمانی که اتصال قطع می‌شود، وضعیتشان به `offline` تغییر می‌کند (در `socket.on("close")` و `socket.on("error")`). ولی دستگاه‌هایی که از طریق HTTP (پروتکل POST) داده می‌فرستند، حتی اگر روزها داده نفرستند، همچنان `online` باقی می‌مانند. هیچ‌گونه بررسی دوره‌ای برای آفلاین کردن آنها وجود ندارد.

**اثر:** داشبورد نشان می‌دهد دستگاه‌ها آنلاین هستند حتی اگر از کار افتاده باشند.

**اصلاح:** تابع `checkOfflineDevices()` به `scheduler.js` اضافه شده است.  
فایل اصلاح‌شده: **`improvements/server/scheduler.js`**

---

### ایراد ۳ – مهم: داده‌های تکراری در irawdata

**فایل:** `server/db.js`  
**خط تقریبی:** ۱۳۴ (تعریف جدول `irawdata`)

**مشکل:**  
جدول `irawdata` فاقد قید UNIQUE است. دستگاه‌های TCP هنگام اتصال مجدد، داده‌های بازه‌های قبلی را دوباره ارسال می‌کنند (از طریق پروتکل 0197/8821). این باعث می‌شود همان داده چندین بار ذخیره شود و هنگام تجمیع توسط scheduler، تعداد خودروها چند برابر محاسبه شود.

**اصلاح:**  
۱. اضافه کردن `UNIQUE INDEX` روی `(device_code, create_at, stop, lane)` در `db.js`  
۲. تغییر `INSERT INTO irawdata` به `INSERT OR IGNORE INTO irawdata` در `storeIrawdata()`

فایل اصلاح‌شده: **`improvements/server/db.js`**

**دستور migration برای پایگاه‌داده‌های موجود (در سرور اجرا شود):**
```bash
sqlite3 /opt/tc-manager/server/data.db <<'SQL'
-- حذف ردیف‌های تکراری (نگه‌داشتن اولین ردیف)
DELETE FROM irawdata WHERE id NOT IN (
    SELECT MIN(id) FROM irawdata GROUP BY device_code, create_at, stop, lane
);
-- اضافه کردن قید منحصربه‌فرد
CREATE UNIQUE INDEX IF NOT EXISTS idx_irawdata_unique 
    ON irawdata(device_code, create_at, stop, lane);
SQL
```

---

### ایراد ۴ – مهم: مدیریت محورها (Mehvar/Routes) در رابط کاربری

**فایل‌ها:** `js/app.js`, `index.html`

**مشکل:**  
سرور دارای API کامل برای مدیریت محورها است (`GET/POST/DELETE /api/mehvar`) ولی در رابط کاربری هیچ بخشی برای مشاهده، اضافه یا حذف محورها وجود ندارد. کاربر نمی‌تواند محورها را از طریق داشبورد مدیریت کند.

**اصلاح مورد نیاز:**  
- اضافه کردن یک دکمه ناوبری «محورها» در `index.html`  
- اضافه کردن بخش HTML برای نمایش و مدیریت محورها  
- اضافه کردن تابع `loadMehvar()` در `app.js`  

این اصلاح در **`improvements/index.html`** و **`improvements/js/app.js`** پیاده‌سازی شده است.

---

### ایراد ۵ – متوسط: نمایش دستگاه‌های TCP متصل

**فایل:** `js/app.js`, `index.html`

**مشکل:**  
سرور endpoint زیر را دارد:
```
GET /api/tcp/connected → لیست دستگاه‌های TCP متصل و زمان اتصال
POST /api/tcp/sync-time → سینک کردن ساعت یک دستگاه
POST /api/tcp/poll → درخواست داده از یک دستگاه
```
ولی رابط کاربری هیچ پنلی برای نمایش این اطلاعات ندارد. اپراتور نمی‌تواند ببیند کدام دستگاه‌های TCP اکنون متصل هستند.

**اصلاح پیشنهادی:** اضافه کردن یک پنل «اتصالات TCP فعال» در داشبورد.

---

### ایراد ۶ – متوسط: تعریف جدول users در خارج از db.js

**فایل:** `server/index.js` تابع `initAdmin()`

**مشکل:**  
جدول `users` در `initAdmin()` داخل `index.js` ایجاد می‌شود نه در `db.js`. این از نظر معماری نادرست است چون `db.js` باید تمام schema پایگاه‌داده را مدیریت کند.

**اصلاح پیشنهادی:** انتقال دستور `CREATE TABLE IF NOT EXISTS users` از `initAdmin()` به `db.js`.

---

### ایراد ۷ – کم: فایل‌های patch.js و patch2.js

**فایل‌ها:** `/patch.js`, `/patch2.js`

**مشکل:**  
این فایل‌ها اصلاحاتی بودند که قرار بود یک‌بار روی سرور اجرا شوند. هم‌اکنون تمام اصلاحات آنها در `server/index.js` اعمال شده‌اند (تأیید شده از روی کد موجود). ولی این فایل‌ها همچنان در ریشه مخزن هستند و ممکن است باعث سردرگمی شوند (اگر کسی آنها را دوباره اجرا کند).

**اصلاح:** این فایل‌ها می‌توانند به پوشه `archive/` منتقل شوند یا با نام `patch.js.applied` تغییر نام داده شوند.

---

## نحوه اعمال اصلاحات

### اصلاح ایراد ۱ (تردد امروز)
در فایل `server/index.js`، در تابع مسیر `/api/stats` (حدود خط ۳۵۶):  
مقدار `todayStart.toISOString()` را با کد زیر جایگزین کنید:
```javascript
var y = todayStart.getFullYear();
var mo = String(todayStart.getMonth() + 1).padStart(2, "0");
var dy = String(todayStart.getDate()).padStart(2, "0");
var todayStartStr = y + "-" + mo + "-" + dy + "T00:00:00";
// سپس: .get(todayStartStr) به جای .get(todayStart.toISOString())
```

### اصلاح ایراد ۲ (آفلاین شدن دستگاه‌ها)
فایل `improvements/server/scheduler.js` را جایگزین `server/scheduler.js` کنید:
```bash
cp /opt/tc-manager/improvements/server/scheduler.js /opt/tc-manager/server/scheduler.js
pm2 restart tc-manager
```

### اصلاح ایراد ۳ (داده‌های تکراری)  
۱. دستور migration (بالا) را روی سرور اجرا کنید  
۲. فایل `improvements/server/db.js` را جایگزین `server/db.js` کنید  
۳. در `server/index.js`، تابع `storeIrawdata()` را اصلاح کنید (INSERT OR IGNORE)

### اصلاح ایراد ۴ (UI محورها)
فایل‌های `improvements/index.html` و `improvements/js/app.js` را جایگزین نسخه‌های اصلی کنید.

---

## وضعیت پچ‌های قبلی

| پچ | وضعیت | توضیح |
|----|--------|-------|
| `patch.js` Fix0: `\r\n` terminator | ✅ اعمال‌شده | خط ۸۴۲ index.js |
| `patch.js` Fix1: startDataRequests | ✅ اعمال‌شده | خط ۱۳۰ پوشه‌بندی |
| `patch.js` Fix2: immediate poll | ✅ اعمال‌شده | تابع startPeriodicPoll |
| `patch.js` Fix3a/3b: toLocalISOString | ✅ اعمال‌شده | scheduler.js خط ۱۵ |
| `patch2.js` Fix A-I | ✅ اعمال‌شده | deviceClockDrift, largeDrift, etc |
