# راهنمای استقرار (Deployment Guide)

## پیش‌نیازها

- سرور Ubuntu/Debian با دسترسی root
- سرور نیاز به اینترنت **داخلی** دارد (برای نصب Node.js و بسته‌ها از مخازن apt/npm) — ولی نیازی به دسترسی GitHub ندارد
- یک سیستم محلی (لپ‌تاپ/کامپیوتر) با دسترسی به اینترنت و GitHub
- پورت‌های 80 (وب) و 2022 (TCP دستگاه‌ها) باز باشد

---

## فایل‌های تغییر یافته در این نسخه

فایل‌هایی که تغییر کرده‌اند و باید به سرور منتقل شوند:

| فایل | توضیح |
|------|-------|
| `deploy-all.sh` | اسکریپت نصب کامل (شامل تمام کدها — **فقط این یک فایل کافیست**) |
| `server/deploy-part1-server.sh` | بروزرسانی فایل‌های سرور (db.js, index.js, rmto-client.js, scheduler.js) |
| `server/deploy-part2-frontend.sh` | بروزرسانی داده‌های نمونه فرانت‌اند |
| `server/deploy-part3-html.sh` | بروزرسانی index.html |
| `server/deploy-part4-css-js.sh` | بروزرسانی style.css و app.js |
| `DEPLOY.md` | همین راهنما (فقط مستندات — نیازی به انتقال به سرور ندارد) |

> **ساده‌ترین روش:** فقط `deploy-all.sh` را به سرور منتقل و اجرا کنید — تمام فایل‌های بالا داخل آن تعبیه شده‌اند.

---

## روش سریع: دانلود، انتقال و اجرا (۳ دستور)

### ۱. دانلود از GitHub به کامپیوتر خودتان

روی **سیستم محلی** (لپ‌تاپ/کامپیوتر خودتان) اجرا کنید:

```bash
# اگر قبلاً clone نکردید:
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git
cd web-monitoring-Intelligent-Vehicle-Traffic-

# اگر قبلاً clone کردید — دریافت آخرین تغییرات:
cd web-monitoring-Intelligent-Vehicle-Traffic-
git pull
```

### ۲. انتقال به سرور

```bash
# SERVER_IP را با آدرس IP سرور جایگزین کنید:
scp deploy-all.sh root@SERVER_IP:/tmp/
```

### ۳. اجرا روی سرور

```bash
ssh root@SERVER_IP "bash /tmp/deploy-all.sh"
```

**تمام!** 🎉 سرور بروزرسانی شد.

> **برای ویندوز:** از WinSCP یا FileZilla استفاده کنید. فایل `deploy-all.sh` را از پوشه پروژه به مسیر `/tmp/` روی سرور کپی کنید، سپس با PuTTY یا ترمینال SSH دستور `bash /tmp/deploy-all.sh` را اجرا کنید.

---

## بروزرسانی جزئی (فقط بخش‌های تغییر یافته)

اگر سرور قبلاً نصب شده و نمی‌خواهید کل سیستم را مجدد نصب کنید، می‌توانید فقط بخش‌های مورد نیاز را بروزرسانی کنید:

### فقط فایل‌های سرور (SOAP، scheduler، دیتابیس)
```bash
# روی سیستم محلی:
scp server/deploy-part1-server.sh root@SERVER_IP:/opt/tc-manager/

# روی سرور:
ssh root@SERVER_IP "cd /opt/tc-manager && bash deploy-part1-server.sh && systemctl restart tc-manager"
```

### فقط HTML
```bash
# روی سیستم محلی:
scp server/deploy-part3-html.sh root@SERVER_IP:/opt/tc-manager/

# روی سرور:
ssh root@SERVER_IP "cd /opt/tc-manager && bash deploy-part3-html.sh"
```

### فقط CSS و JavaScript
```bash
# روی سیستم محلی:
scp server/deploy-part4-css-js.sh root@SERVER_IP:/opt/tc-manager/

# روی سرور:
ssh root@SERVER_IP "cd /opt/tc-manager && bash deploy-part4-css-js.sh && systemctl restart tc-manager"
```

### همه بخش‌ها — یکجا
```bash
# روی سیستم محلی:
scp server/deploy-part1-server.sh server/deploy-part2-frontend.sh \
    server/deploy-part3-html.sh server/deploy-part4-css-js.sh \
    root@SERVER_IP:/opt/tc-manager/

# روی سرور:
ssh root@SERVER_IP "cd /opt/tc-manager && bash deploy-part1-server.sh && bash deploy-part2-frontend.sh && bash deploy-part3-html.sh && bash deploy-part4-css-js.sh && systemctl restart tc-manager"
```

---

## گام صفر: دانلود فایل‌ها از GitHub به سیستم محلی

> **چون سرور دسترسی به GitHub ندارد، ابتدا فایل‌ها را روی سیستم خودتان (لپ‌تاپ/کامپیوتر) دانلود کنید.**

### الف) دانلود با ZIP (ساده‌ترین روش — بدون نیاز به Git)

1. در مرورگر باز کنید:
   ```
   https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/archive/refs/heads/main.zip
   ```
2. فایل ZIP را دانلود و از حالت فشرده خارج کنید
3. وارد پوشه استخراج شده شوید:
   ```bash
   cd web-monitoring-Intelligent-Vehicle-Traffic--main
   ```

### ب) دانلود با Git (برای بروزرسانی‌های بعدی آسان‌تر)

```bash
# روی سیستم محلی خودتان اجرا کنید (نه سرور):
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git
cd web-monitoring-Intelligent-Vehicle-Traffic-
```

> بعد از این مرحله، تمام فایل‌های پروژه روی سیستم محلی شما هستند.

---

## نصب اول (سرور جدید): ساده‌ترین روش با یک فایل

> **`deploy-all.sh` همه چیز را داخل خودش دارد** — کد سرور، فرانت‌اند، تنظیمات، نصب Node.js و Nginx. فقط کافیست این یک فایل را به سرور منتقل کنید.

### گام ۱: انتقال فایل از سیستم محلی به سرور

```bash
# روی سیستم محلی خودتان اجرا کنید:
# (SERVER_IP را با آدرس IP سرور جایگزین کنید)

scp deploy-all.sh root@SERVER_IP:/tmp/
```

> **نکته:** اگر SCP ندارید (مثلاً در ویندوز)، می‌توانید از WinSCP یا FileZilla استفاده کنید.
> فایل `deploy-all.sh` را از پوشه پروژه به مسیر `/tmp/` روی سرور کپی کنید.

### گام ۲: اتصال به سرور و اجرا

```bash
# SSH به سرور:
ssh root@SERVER_IP

# اجرای اسکریپت نصب:
bash /tmp/deploy-all.sh
```

### گام ۳: تأیید نصب

پس از اجرای موفق:
- **وب:** `http://SERVER_IP` (در مرورگر باز کنید)
- **TCP:** پورت `2022` (برای دریافت داده از دستگاه‌ها)
- **ورود:** نام کاربری `admin` / رمز `admin123`

---

## بروزرسانی کد (سرور قبلاً نصب شده)

وقتی کد تغییر کرده و می‌خواهید سرور را بروزرسانی کنید:

### روش الف: بروزرسانی کامل (مطمئن‌ترین)

```bash
# ۱. روی سیستم محلی - دانلود آخرین نسخه:
cd web-monitoring-Intelligent-Vehicle-Traffic-
git pull origin main

# ۲. روی سیستم محلی - ارسال به سرور:
scp deploy-all.sh root@SERVER_IP:/tmp/

# ۳. روی سرور - اجرا:
ssh root@SERVER_IP "bash /tmp/deploy-all.sh"
```

> **نکته:** دیتابیس و تنظیمات `.env` حفظ می‌شود. برای نصب تازه از صفر:
> ```bash
> ssh root@SERVER_IP "bash /tmp/deploy-all.sh --fresh"
> ```

### روش ب: بروزرسانی بخش‌بخش (فقط فایل‌های تغییر یافته)

هر قسمت یک اسکریپت جداگانه دارد. فقط قسمت‌هایی که تغییر کرده را ارسال کنید:

#### ب.۱) فایل‌های سرور (SOAP، scheduler، دیتابیس)
```bash
# روی سیستم محلی:
scp server/deploy-part1-server.sh root@SERVER_IP:/opt/tc-manager/

# روی سرور:
ssh root@SERVER_IP "cd /opt/tc-manager && bash deploy-part1-server.sh && systemctl restart tc-manager"
```

#### ب.۲) فایل‌های داده فرانت‌اند
```bash
# روی سیستم محلی:
scp server/deploy-part2-frontend.sh root@SERVER_IP:/opt/tc-manager/

# روی سرور:
ssh root@SERVER_IP "cd /opt/tc-manager && bash deploy-part2-frontend.sh"
```

#### ب.۳) HTML
```bash
# روی سیستم محلی:
scp server/deploy-part3-html.sh root@SERVER_IP:/opt/tc-manager/

# روی سرور:
ssh root@SERVER_IP "cd /opt/tc-manager && bash deploy-part3-html.sh"
```

#### ب.۴) CSS و JavaScript
```bash
# روی سیستم محلی:
scp server/deploy-part4-css-js.sh root@SERVER_IP:/opt/tc-manager/

# روی سرور:
ssh root@SERVER_IP "cd /opt/tc-manager && bash deploy-part4-css-js.sh && systemctl restart tc-manager"
```

### روش ج: کپی مستقیم فایل‌ها (سریع‌ترین)

بدون اسکریپت deploy — فایل‌ها را مستقیم SCP کنید:

```bash
# روی سیستم محلی — فایل‌های سرور:
scp server/index.js server/db.js server/rmto-client.js server/scheduler.js server/package.json \
    root@SERVER_IP:/opt/tc-manager/server/

# روی سیستم محلی — فایل‌های فرانت‌اند:
scp index.html root@SERVER_IP:/opt/tc-manager/
scp css/style.css root@SERVER_IP:/opt/tc-manager/css/
scp js/app.js root@SERVER_IP:/opt/tc-manager/js/

# روی سرور — نصب وابستگی‌ها (در صورت تغییر package.json):
ssh root@SERVER_IP "cd /opt/tc-manager/server && npm install --production"

# روی سرور — ری‌استارت سرویس:
ssh root@SERVER_IP "systemctl restart tc-manager"
```

---

## انتقال بدون SCP (با USB یا روش‌های دیگر)

اگر SCP از سیستم محلی به سرور ممکن نیست:

### با فلش USB
1. فایل `deploy-all.sh` را روی فلش USB کپی کنید
2. فلش را به سرور وصل کنید
3. روی سرور:
   ```bash
   # پیدا کردن فلش (معمولاً /dev/sdb1):
   lsblk

   # مانت کردن:
   mkdir -p /mnt/usb
   mount /dev/sdb1 /mnt/usb

   # کپی و اجرا:
   cp /mnt/usb/deploy-all.sh /tmp/
   bash /tmp/deploy-all.sh

   # آنمانت:
   umount /mnt/usb
   ```

### با کپی-پیست در ترمینال
اگر فقط SSH دارید و SCP کار نمی‌کند:
1. محتوای `deploy-all.sh` را در ادیتور متنی باز کنید
2. SSH به سرور بزنید
3. روی سرور:
   ```bash
   cat > /tmp/deploy-all.sh << 'PASTE_END'
   ```
4. تمام محتوای فایل را Paste کنید
5. در خط آخر بنویسید:
   ```
   PASTE_END
   ```
6. اجرا:
   ```bash
   bash /tmp/deploy-all.sh
   ```

---

## تنظیمات RMTO

فایل `.env` در مسیر `/opt/tc-manager/server/.env`:

```env
PORT=3000
HOST=0.0.0.0
TCP_PORT=2022
RMTO_WSDL=http://otf.rmto.ir/Companies/Companies.asmx?WSDL
RMTO_COMPANY_CODE=58
RMTO_USERNAME=نام_کاربری
RMTO_PASSWORD=رمز_عبور
SEND_INTERVAL_MINUTES=15
```

یا از طریق داشبورد: **تنظیمات** ← **تنظیمات RMTO**

---

## بررسی وضعیت

```bash
# وضعیت سرویس
systemctl status tc-manager

# لاگ‌های اخیر
journalctl -u tc-manager -n 50 --no-pager

# لاگ‌های لحظه‌ای
journalctl -u tc-manager -f

# تست اتصال
curl http://localhost:3000/api/stats
```

---

## عیب‌یابی

| مشکل | راه‌حل |
|------|--------|
| سرویس بالا نمی‌آید | `journalctl -u tc-manager -n 50` |
| خطای RMTO | بررسی WSDL و اطلاعات ورود در تنظیمات |
| پورت 2022 پاسخ نمی‌دهد | `ufw allow 2022/tcp` |
| خطای better-sqlite3 | `cd /opt/tc-manager/server && npm rebuild better-sqlite3` |
| خطای npm install | `apt-get install -y build-essential python3` سپس `npm install` |
| ری‌استارت کامل | `systemctl restart tc-manager && systemctl restart nginx` |
| بررسی پورت‌ها | `ss -tlnp` سپس فیلتر پورت‌های 3000, 2022, 80 |
| فضای دیسک | `df -h /opt/tc-manager` |

---

## ساختار فایل‌ها روی سرور

```
/opt/tc-manager/
├── index.html              ← صفحه اصلی داشبورد
├── css/style.css           ← استایل
├── js/app.js               ← لاجیک فرانت‌اند
├── data/devices.js         ← داده نمونه
└── server/
    ├── .env                ← تنظیمات (RMTO, پورت‌ها)
    ├── index.js            ← سرور Express اصلی
    ├── db.js               ← مدیریت دیتابیس SQLite
    ├── rmto-client.js      ← کلاینت SOAP برای RMTO
    ├── scheduler.js        ← زمان‌بند ارسال ۱۵ دقیقه‌ای
    ├── package.json        ← وابستگی‌ها
    └── data.db             ← دیتابیس (ایجاد خودکار)
```

---

## خلاصه سریع

```
GitHub ──(دانلود)──> سیستم محلی ──(SCP)──> سرور ──(bash)──> نصب
```

| کار | دستور |
|-----|-------|
| دانلود از GitHub | `git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git` |
| ارسال به سرور | `scp deploy-all.sh root@SERVER_IP:/tmp/` |
| نصب روی سرور | `ssh root@SERVER_IP "bash /tmp/deploy-all.sh"` |
| بروزرسانی | `git pull` سپس `scp` و `bash` مجدد |
