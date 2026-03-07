# راهنمای گام‌به‌گام استقرار روی سرور

---

## 🪟 دانلود `deploy-offline.sh` روی Windows و انتقال به سرور

> سرور لینوکسی به GitHub دسترسی ندارد؟ این روش‌ها فقط نیاز به Windows شما دارند.

### روش ۱: مرورگر (ساده‌ترین — بدون هیچ دستوری)
1. این لینک را در **Chrome یا Edge** باز کنید:
   ```
   https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/raw/copilot/review-project-issues/deploy-offline.sh
   ```
2. صفحه متن باز می‌شود → **Ctrl+S** → نام فایل را `deploy-offline.sh` بگذارید → ذخیره

### روش ۲: PowerShell
> ⚠️ **PowerShell** را باز کنید — نه CMD (Command Prompt)
> دکمه Start → تایپ `PowerShell` → Enter

```powershell
cd C:\Users\research\Downloads
Invoke-WebRequest -Uri "https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/raw/copilot/review-project-issues/deploy-offline.sh" -OutFile "deploy-offline.sh"
```

### روش ۳: git clone (اگر git دارید)
```cmd
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic- --branch copilot/review-project-issues --depth 1 tc-src
cd tc-src
REM فایل deploy-offline.sh اینجاست
```

### انتقال به سرور (PowerShell):
```powershell
# مسیر فایل دانلود‌شده را جایگزین کنید:
scp C:\Users\research\Downloads\deploy-offline.sh root@5.159.49.246:/tmp/

# اجرا روی سرور:
ssh root@5.159.49.246 "bash /tmp/deploy-offline.sh"
```

---

## ۱. ساخت فایل .env (اگر وجود ندارد)

فایل `.env` در مسیر `/opt/tc-manager/server/.env` باید وجود داشته باشد.
برای ساخت آن اسکریپت زیر را اجرا کنید — نام کاربری و کلمه عبور RMTO را از شما می‌پرسد:

```bash
cd /opt/tc-manager
wget -q "https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/review-project-issues/create-env.sh" -O create-env.sh
bash create-env.sh
```

**یا اگر ترجیح می‌دهید دستی بسازید:**

```bash
nano /opt/tc-manager/server/.env
```

محتوای `.env` باید این باشد (متغیرهای دقیق):

```env
PORT=3000
HOST=0.0.0.0
TCP_PORT=2022
TZ=Asia/Tehran
ADMIN_USER=admin
ADMIN_PASS=admin123
SESSION_SECRET=یک_رشته_تصادفی_بلند
RMTO_WSDL=http://otf.rmto.ir/Companies/Companies.asmx?WSDL
RMTO_COMPANY_CODE=58
RMTO_USERNAME=نام_کاربری_RAHSAM
RMTO_PASSWORD=کلمه_عبور_RAHSAM
SEND_INTERVAL_MINUTES=5
```

> ⚠️ **نکته مهم**: نام متغیرها دقیقاً باید `RMTO_USERNAME` و `RMTO_PASSWORD` باشند (نه `RMTO_USER` یا `RMTO_PASS`)

> اگر اعتبارنامه‌ها اشتباه باشند، RMTO خطای `Wrong username or password` می‌دهد.

---

## ۲. اجرای deploy-full.sh (همه Fix‌ها یکجا)

```bash
# روی سرور اجرا کنید:
cd /opt/tc-manager
wget -q "https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/review-project-issues/deploy-full.sh" -O deploy-full.sh
bash deploy-full.sh
```

این اسکریپت:
- ✅ همه ۴ فایل سرور را با نسخه صحیح جایگزین می‌کند
- ✅ پشتیبان‌گیری خودکار قبل از جایگزینی
- ✅ بررسی syntax قبل از اعمال
- ✅ منطقه زمانی `Asia/Tehran` را تنظیم می‌کند
- ✅ PM2 را restart می‌کند

---

## ۳. بررسی لاگ بعد از restart

```bash
pm2 logs tc-manager --lines 50
```

**لاگ سالم باید این‌ها را نشان دهد:**
```
[TC Manager] TZ = Asia/Tehran
[TCP] Port 2022 listening
[HTTP] Port 3000 listening
[Scheduler] Starting with cron: */5 * * * *
```

**علائم مشکل:**
- ❌ `Port 2022 already in use` → پورت آزاد نشده، اجرا کنید: `bash kill-crash-loop.sh`
- ❌ `deviceClockDrift is not defined` → deploy-full.sh را مجدداً اجرا کنید
- ❌ `Wrong username or password` → اعتبارنامه RMTO در `.env` اشتباه است

---

## ۴. بررسی عملکرد دستگاه

وقتی دستگاه RATCX1 وصل می‌شود، لاگ باید این توالی را نشان دهد:

```
[TCP] New connection from X.X.X.X
[TCP] RATCX1 handshake: device=XXXXXXXX time=2026.02.27-XX:XX:XX.X
[TCP] Device XXXXXXXX clock drift: X minutes
[TCP] > XXXXXXXX TIME_SYNC: 0012YYMMDDHHMMSS   ← فرمت 12 رقمی
[TCP] *** TIME SYNC ACK RECEIVED ***
[TCP] > XXXXXXXX IMMEDIATE_POLL: 0197YYMMDDHHMM  ← 10 رقمی، ساعت ایران
[TCP] *** RATCX1 INTERVAL DATA RECEIVED ***
[DB] INSERT irawdata: device=XXXXXXXX ...
```

---

## ۵. بررسی UI سایت

1. به `http://5.159.49.246/` بروید
2. وارد شوید (admin / admin123 یا کلمه عبوری که تغییر داده‌اید)
3. بخش **«دریافت اطلاعات»** → باید رکوردهای جدید با timestamp ایران نمایش دهد
4. بخش **«ارسال سامانه»** → جدول RMTO هر ۳۰ ثانیه auto-refresh می‌شود
   - اگر بنر قرمز «خطای احراز هویت RMTO» نشان داد → اعتبارنامه `.env` را اصلاح کنید

---

## ۶. اگر crash loop هنوز ادامه دارد

```bash
cd /opt/tc-manager
wget -q "https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/review-project-issues/kill-crash-loop.sh" -O kill-crash-loop.sh
bash kill-crash-loop.sh
```

---

## خلاصه وضعیت Fix‌ها (Fix1 تا Fix43)

### 📡 ارتباط با دستگاه RATCX1

| Fix | موضوع | نتیجه |
|-----|-------|--------|
| Fix10 | فرمت `0012` اشتباه بود → `YYYY.MM.DD-HH:MM:SS` → اصلاح به `yyMMddHHmmss` (12 رقم) | ساعت دستگاه تنظیم می‌شود ✅ |
| Fix19 | `0197` با زمان اشتباه ارسال می‌شد | داده‌های دستگاه دریافت می‌شود ✅ |
| Fix21 | دستگاه با RTC خراب (year=2000) داده نمی‌فرستاد | backlog از buffer دستگاه خوانده می‌شود ✅ |
| Fix22 | بعد از `8012 ACK` سرور `0197` نمی‌فرستاد | جریان داده برقرار است ✅ |
| Fix23 | فقط یک `8821` در هر اتصال دریافت می‌شد | کل buffer دستگاه drain می‌شود ✅ |
| Fix25 | `0197` از زمان سرور نه DB استفاده می‌کرد | ادامه از آخرین رکورد ذخیره‌شده ✅ |
| Fix36 | interval‌های آینده (زمان جلو) ذخیره می‌شدند | توقف درخواست interval ناقص ✅ |

### 🗄️ ذخیره داده (irawdata)

| Fix | موضوع | نتیجه |
|-----|-------|--------|
| Fix3 | داده‌های تکراری ذخیره می‌شدند | `UNIQUE INDEX` + `INSERT OR IGNORE` ✅ |
| Fix24 | interval‌های صفر تردد حذف می‌شدند | همه interval‌ها ذخیره می‌شوند ✅ |
| Fix31 | timestamp اشتباه در `8821` handler | timestamp واقعی دستگاه استفاده می‌شود ✅ |
| Fix34 | رکوردهای قدیمی UTC بعد از Fix30 مشکل داشتند | رکوردهای > 4 ساعت پشت رد می‌شوند ✅ |
| Fix35 | `INSERT OR IGNORE` داده واقعی را رد می‌کرد | `UPSERT`: داده‌ی بهتر (بیشتر) جایگزین می‌شود ✅ |

### 🕐 منطقه زمانی

| Fix | موضوع | نتیجه |
|-----|-------|--------|
| Fix30 | سرور UTC → `0012` با ساعت UTC ارسال می‌شد (۳.۵ ساعت اشتباه) | `TZ=Asia/Tehran` → همه عملیات به وقت ایران ✅ |
| Fix39a | `ST/ET` در SOAP با فرمت اشتباه ارسال می‌شد → XML parse error | `toSoapDateTime()` → `YYYY-MM-DDTHH:mm:ss` ✅ |
| Fix43a | `SRVDT` از RMTO تاریخ `0000-12-31` نشان می‌داد | تبدیل صحیح + `null` برای تاریخ‌های invalid ✅ |

### 📤 ارسال به سامانه RMTO

| Fix | موضوع | نتیجه |
|-----|-------|--------|
| Fix29 | pipeline اشتباه — aggregate 15 دقیقه‌ای | per-interval `Add5` با پارامترهای صحیح WSDL ✅ |
| Fix38 | خطای auth بی‌نهایت retry می‌کرد | تشخیص + `rmto_id=-2` (permanent fail) ✅ |
| Fix39b | رکوردهای `rid=0` (device_code خالی) بی‌نهایت retry | `device_code > 0` فیلتر ✅ |
| Fix39c | `CFL=100` بدون پیام خطا ذخیره می‌شد | پیام خطای معنادار ذخیره می‌شود ✅ |
| Fix43b/c | ستون خطا در جدول RMTO نشان نمی‌داد | خطای واقعی مستقیم در جدول نمایش ✅ |

### 🖥️ پایداری سرور

| Fix | موضوع | نتیجه |
|-----|-------|--------|
| Fix13 | هر خطای uncaught سرور را crash می‌کرد | `uncaughtException` handler ✅ |
| Fix14 | EADDRINUSE بی‌نهایت retry | max 10 retry سپس `exit(1)` ✅ |
| Fix33 | SIGTERM پورت‌ها را آزاد نمی‌کرد → crash loop | graceful shutdown با `close()+destroy()` ✅ |
| Fix40 | سوکت‌های TCP فعال بعد از SIGTERM باز می‌ماندند | `_activeTcpSockets.forEach(destroy)` ✅ |
| Fix41a | session بعد از PM2 restart از بین می‌رفت → 401 در settings | SQLite session store ✅ |

### 🎨 رابط کاربری

| Fix | موضوع | نتیجه |
|-----|-------|--------|
| Fix4 | مدیریت محورها (Mehvar) نبود | view کامل با CRUD ✅ |
| Fix5 | دستگاه‌های TCP در داشبورد نمایش نمی‌دادند | پانل دستگاه‌های متصل ✅ |
| Fix37 | دکمه «جزییات» RMTO خطا می‌داد | modal با پاسخ کامل + auto-refresh ✅ |
| Fix41c-f | ذخیره تنظیمات RMTO فیدبک نمی‌داد | inline status + دکمه «تست اتصال» ✅ |
| Fix42 | `deploy-full.sh` فایل‌های frontend را جایگزین نمی‌کرد | `js/app.js` + `index.html` هم جایگزین می‌شوند ✅ |

---

## وضعیت فعلی سیستم (بعد از همه Fix‌ها)

✅ **دستگاه RATCX1**: وصل → ساعت تنظیم → داده دریافت → DB ذخیره  
✅ **ارسال RMTO**: هر ۵ دقیقه interval‌های جدید ارسال می‌شوند  
✅ **UI**: نمایش صحیح داده، جزییات RMTO، auto-refresh  
✅ **پایداری**: crash loop رفع شده، session پایدار  

### ⚠️ اگر RMTO هنوز `Wrong username or password` می‌دهد:
```bash
nano /opt/tc-manager/server/.env
# RMTO_USERNAME و RMTO_PASSWORD را اصلاح کنید
pm2 restart tc-manager --update-env
```
سپس در UI تنظیمات → «تست اتصال» را بزنید.
