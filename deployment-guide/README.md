# راهنمای استقرار از صفر — TC Manager (نوآوران جنوب شرق)

این پوشه یک **راهنمای کامل و مستقل** برای نصب سامانه مدیریت ترددشمار (TC Manager) روی یک **سرور جدید از صفر** است. تمام فایل‌های لازم برای نصب داخل همین پوشه قرار دارد و هیچ‌چیزی از سیستم فعلی را تغییر نمی‌دهد.

> اگر عجله دارید: بخش «نصب سریع (خودکار)» را ببینید — یک اسکریپت همه‌کار.

---

## فهرست مطالب

1. [معرفی سیستم و معماری](#۱-معرفی-سیستم-و-معماری)
2. [پیش‌نیازها](#۲-پیش‌نیازها)
3. [فایل‌های لازم برای استقرار](#۳-فایل‌های-لازم-برای-استقرار)
4. [نصب سریع (خودکار)](#۴-نصب-سریع-خودکار)
5. [نصب دستی گام‌به‌گام](#۵-نصب-دستی-گام‌به‌گام)
6. [پیکربندی (env و تنظیمات)](#۶-پیکربندی)
7. [انتقال داده از سرور قبلی](#۷-انتقال-داده-از-سرور-قبلی)
8. [بررسی سلامت بعد از نصب](#۸-بررسی-سلامت-بعد-از-نصب)
9. [عیب‌یابی](#۹-عیب‌یابی)
10. [نصب روی سرور بدون اینترنت](#۱۰-نصب-روی-سرور-بدون-اینترنت)

---

## ۱) معرفی سیستم و معماری

سامانه TC Manager داده ترددشمارهای جاده‌ای (دستگاه‌های RATCX1 و دستگاه‌های HTTP) را دریافت، در پایگاه‌داده SQLite ذخیره، تجمیع و به سامانه RMTO (راهسام / otf.rmto.ir) ارسال می‌کند و یک داشبورد وب فارسی (RTL) برای مدیریت دارد.

```
دستگاه‌های RATCX1 (TCP:2022) ──→ server/index.js ──→ SQLite (data.db)
دستگاه‌های HTTP (POST /api)  ──→ server/index.js ──→ SQLite (data.db)
                                                        ↓
                                               server/scheduler.js (تجمیع دوره‌ای)
                                                        ↓
                                               server/rmto-client.js (SOAP)
                                                        ↓
                                               otf.rmto.ir (RMTO / راهسام)
```

| مؤلفه | فناوری |
|---|---|
| بک‌اند | Node.js 20 + Express |
| پایگاه‌داده | SQLite (better-sqlite3، حالت WAL) |
| زمان‌بند | node-cron |
| فرانت‌اند | HTML/CSS/JS خالص (بدون فریم‌ورک) — از خود Node سرو می‌شود |
| وب‌سرور جلویی | Nginx (reverse proxy روی پورت 80) |
| مدیریت سرویس | systemd (سرویس `tc-manager`) |
| منطقه زمانی | Asia/Tehran (در کد تنظیم می‌شود) |

### پورت‌ها

| پورت | پروتکل | کاربرد |
|---|---|---|
| 80 | HTTP | داشبورد وب (از طریق Nginx) |
| 3000 | HTTP | برنامه Node (داخلی، پشت Nginx) |
| **2022** | TCP | **اتصال دستگاه‌های ترددشمار RATCX1 — حتماً باید در فایروال باز باشد** |
| 22 | SSH | مدیریت سرور |

---

## ۲) پیش‌نیازها

- سرور لینوکس **Ubuntu 20.04/22.04/24.04 یا Debian 11/12** با دسترسی root
- حداقل ۱ گیگ RAM و ۱۰ گیگ دیسک (دیتابیس با گذشت زمان رشد می‌کند)
- دسترسی اینترنت روی سرور برای نصب اولیه (برای سرور بدون اینترنت بخش ۱۰ را ببینید)
- IP ثابت (دستگاه‌های ترددشمار باید به `IP:2022` وصل شوند)
- اطلاعات حساب RMTO: کد شرکت، نام کاربری و رمز عبور (از راهسام دریافت می‌شود)

---

## ۳) فایل‌های لازم برای استقرار

فایل‌های **زمان اجرا (runtime)** که باید روی سرور کپی شوند — همه در ریشه مخزن موجودند:

```
index.html                     ← داشبورد (شامل صفحه لاگین)
css/style.css                  ← استایل‌ها
js/app.js                      ← منطق فرانت‌اند
data/devices.js                ← داده نمونه (فرانت‌اند)
server/index.js                ← سرور اصلی (REST API + پروتکل TCP دستگاه‌ها)
server/db.js                   ← اسکیمای پایگاه‌داده SQLite
server/scheduler.js            ← تجمیع دوره‌ای و ارسال به RMTO
server/rmto-client.js          ← کلاینت SOAP سامانه RMTO
server/reset-password.js       ← ابزار بازنشانی رمز مدیر
server/package.json            ← وابستگی‌های Node
server/package-lock.json       ← قفل نسخه وابستگی‌ها
```

فایل‌های همین پوشه (`deployment-guide/`):

```
README.md                      ← همین راهنما
install.sh                     ← اسکریپت نصب خودکار روی سرور جدید
offline-install.md             ← راهنمای نصب روی سرور بدون اینترنت
checklist.md                   ← چک‌لیست خلاصه نصب
config/env.example             ← الگوی فایل .env (بدون رمز واقعی)
config/tc-manager.service      ← فایل سرویس systemd
config/nginx-tc-manager.conf   ← پیکربندی Nginx
```

> فایل‌هایی مثل `deploy-all.sh`، `patch.js`، فایل‌های PDF و آرشیوها برای اجرا لازم نیستند — مستندات و ابزار توسعه‌اند.

> **نکته وابستگی‌ها:** با اینکه ارسال به RMTO از نوع SOAP است، کلاینت آن با ماژول `http` خود Node پیاده شده و به پکیج `soap` نیازی نیست. وابستگی‌ها همان است که در `server/package.json` آمده: express, cors, better-sqlite3, node-cron, dotenv, express-session, multer, bcryptjs.

---

## ۴) نصب سریع (خودکار)

روی سیستم خودتان (یا موبایل با Termux) مخزن را بگیرید و به سرور جدید منتقل کنید:

```bash
# 1) دریافت سورس
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git
cd web-monitoring-Intelligent-Vehicle-Traffic-

# 2) انتقال کل پروژه به سرور جدید
rsync -avz --exclude '.git' --exclude 'node_modules' ./ root@NEW_SERVER_IP:/root/tc-src/
# (اگر rsync ندارید: scp -r ./ root@NEW_SERVER_IP:/root/tc-src/)

# 3) اجرای نصب روی سرور
ssh root@NEW_SERVER_IP 'bash /root/tc-src/deployment-guide/install.sh'
```

اسکریپت `install.sh` به‌ترتیب: Node.js 20 و ابزار build و Nginx را نصب می‌کند، فایل‌های runtime را به `/opt/tc-manager` کپی می‌کند، `npm install` می‌زند، فایل `.env` را از الگو می‌سازد، سرویس systemd و Nginx و فایروال (شامل پورت 2022) را تنظیم و سرویس را اجرا می‌کند.

بعد از پایان:

```bash
# رمزهای RMTO را وارد کنید:
nano /opt/tc-manager/server/.env
systemctl restart tc-manager
```

سپس داشبورد: `http://NEW_SERVER_IP` — ورود اولیه: کاربر `admin` رمز `admin123` (**بلافاصله از منوی تنظیمات عوض کنید**).

---

## ۵) نصب دستی گام‌به‌گام

اگر می‌خواهید بدون اسکریپت و با کنترل کامل نصب کنید:

### گام ۱ — نصب پیش‌نیازها

```bash
apt-get update -y
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
# ابزار کامپایل برای better-sqlite3 (ماژول native)
apt-get install -y build-essential python3
# وب‌سرور
apt-get install -y nginx
node -v   # باید v20.x باشد
```

### گام ۲ — کپی فایل‌های برنامه

```bash
mkdir -p /opt/tc-manager/{css,js,data,server}
cd /root/tc-src   # جایی که سورس را منتقل کرده‌اید

cp index.html /opt/tc-manager/
cp css/style.css /opt/tc-manager/css/
cp js/app.js /opt/tc-manager/js/
cp data/devices.js /opt/tc-manager/data/
cp server/index.js server/db.js server/scheduler.js server/rmto-client.js \
   server/reset-password.js server/package.json server/package-lock.json \
   /opt/tc-manager/server/
```

### گام ۳ — نصب وابستگی‌های Node

```bash
cd /opt/tc-manager/server
npm install --production
```

> اگر خطای کامپایل `better-sqlite3` گرفتید، مطمئن شوید `build-essential` و `python3` نصب‌اند.

### گام ۴ — ساخت فایل .env

```bash
cp /root/tc-src/deployment-guide/config/env.example /opt/tc-manager/server/.env
nano /opt/tc-manager/server/.env   # رمز و کد شرکت RMTO را وارد کنید
```

### گام ۵ — سرویس systemd

```bash
cp /root/tc-src/deployment-guide/config/tc-manager.service /etc/systemd/system/tc-manager.service
systemctl daemon-reload
systemctl enable tc-manager
```

### گام ۶ — Nginx

```bash
cp /root/tc-src/deployment-guide/config/nginx-tc-manager.conf /etc/nginx/sites-available/tc-manager
ln -sf /etc/nginx/sites-available/tc-manager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx && systemctl enable nginx
```

### گام ۷ — فایروال

```bash
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # داشبورد
ufw allow 443/tcp    # HTTPS (در صورت استفاده)
ufw allow 2022/tcp   # ⚠️ دستگاه‌های ترددشمار — فراموش نشود!
ufw --force enable
```

### گام ۸ — اجرا

```bash
systemctl start tc-manager
systemctl status tc-manager --no-pager
```

پایگاه‌داده (`server/data.db`) و کاربر پیش‌فرض `admin` با رمز `admin123` در اولین اجرا **به‌صورت خودکار** ساخته می‌شوند.

---

## ۶) پیکربندی

### فایل `.env` (`/opt/tc-manager/server/.env`)

| کلید | پیش‌فرض | توضیح |
|---|---|---|
| `PORT` | 3000 | پورت HTTP برنامه Node |
| `HOST` | 0.0.0.0 | آدرس bind |
| `RMTO_WSDL` | `http://otf.rmto.ir/Companies/Companies.asmx?WSDL` | آدرس WSDL سامانه RMTO |
| `RMTO_ENDPOINT` | `http://otf.rmto.ir/Companies/Companies.asmx` | آدرس سرویس SOAP |
| `RMTO_COMPANY_CODE` | 58 | کد شرکت در راهسام |
| `RMTO_USERNAME` | — | نام کاربری RMTO |
| `RMTO_PASSWORD` | — | رمز عبور RMTO |
| `SEND_INTERVAL_MINUTES` | 15 | بازه ارسال به RMTO (دقیقه) |
| `ADMIN_USER` | admin | نام کاربر مدیر (فقط برای ساخت اولیه) |
| `ADMIN_PASS` | admin123 | رمز اولیه مدیر (فقط برای ساخت اولیه) |
| `SESSION_SECRET` | تصادفی | کلید نشست — مقدار ثابت بگذارید تا با هر ری‌استارت نشست‌ها باطل نشوند |

> **مهم:** تنظیمات RMTO که از داشبورد (منوی تنظیمات) ذخیره شوند در جدول `settings` پایگاه‌داده قرار می‌گیرند و **بر مقادیر `.env` اولویت دارند**.

### تنظیمات داخل داشبورد

بعد از ورود، از منوی «تنظیمات»: نام سیستم، پورت‌ها، بازه رفرش، سقف سرعت، مهلت آفلاین‌شدن دستگاه، مشخصات RMTO و هشدارها قابل تغییرند. اطلاعات بات پیام‌رسان بله (`bale_bot_token` و `bale_chat_id`) نیز برای اعلان‌ها از همین‌جا تنظیم می‌شود.

### تعریف محورها و دستگاه‌ها

- از منوی «محورها» کد محور (RID راهسام)، نام و وضعیت ارسال را ثبت کنید.
- دستگاه‌های RATCX1 هنگام اولین اتصال TCP **به‌صورت خودکار ثبت** می‌شوند؛ سپس از منوی «دستگاه‌ها» محور هرکدام را مشخص کنید.
- روی خود دستگاه‌ها باید IP سرور جدید و پورت `2022` تنظیم شود.

---

## ۷) انتقال داده از سرور قبلی

تمام داده‌ها (دستگاه‌ها، داده خام تردد، صف RMTO، تنظیمات، کاربران) در **یک فایل** است: `server/data.db`.

```bash
# 1) روی سرور قبلی — توقف سرویس برای یکپارچگی فایل
ssh root@OLD_SERVER_IP 'systemctl stop tc-manager'

# 2) کپی دیتابیس (فایل‌های wal/shm هم اگر بودند)
scp root@OLD_SERVER_IP:/opt/tc-manager/server/data.db /tmp/
scp root@OLD_SERVER_IP:'/opt/tc-manager/server/data.db-wal' /tmp/ 2>/dev/null || true
scp root@OLD_SERVER_IP:'/opt/tc-manager/server/data.db-shm' /tmp/ 2>/dev/null || true
ssh root@OLD_SERVER_IP 'systemctl start tc-manager'

# 3) قرار دادن روی سرور جدید
scp /tmp/data.db* root@NEW_SERVER_IP:/opt/tc-manager/server/
ssh root@NEW_SERVER_IP 'systemctl restart tc-manager'
```

راه جایگزین: از داشبورد سرور قبلی «دانلود بکاپ» بگیرید (`GET /api/backup/download`) و در داشبورد سرور جدید بازیابی کنید (`POST /api/backup/restore`).

> اگر انتقال داده لازم نیست، هیچ‌کاری نکنید — دیتابیس خالی خودکار ساخته می‌شود.

---

## ۸) بررسی سلامت بعد از نصب

```bash
# سرویس بالا است؟
systemctl is-active tc-manager

# لاگ زنده
journalctl -u tc-manager -f

# پورت‌ها گوش می‌دهند؟ (3000 و 2022)
ss -tlnp | grep -E ':3000|:2022'

# پاسخ API
curl -s http://127.0.0.1:3000/api/auth/check

# تست دریافت داده ۵ کلاسه (شبیه‌سازی دستگاه HTTP)
curl -X POST http://127.0.0.1:3000/api/irawdata \
  -H "Content-Type: application/json" \
  -d '{"device_id":"1001","create_at":"2026-01-01T10:30:00","stop":"2026-01-01T10:35:00","lane":1,"a":5,"b":20,"c":8,"d":2,"e":3,"x":1,"sa":300,"sb":1800,"sc":800,"sd":200,"se":300,"sx":50}'

# بررسی دیتابیس
apt-get install -y sqlite3
sqlite3 /opt/tc-manager/server/data.db "SELECT device_code, last_seen, status FROM devices;"
sqlite3 /opt/tc-manager/server/data.db "SELECT COUNT(*) FROM irawdata;"
sqlite3 /opt/tc-manager/server/data.db "SELECT * FROM rmto_queue WHERE sent=0 LIMIT 5;"
```

پیشوندهای لاگ: `[TCP]` رویدادهای دستگاه، `[TCP] >>>` فرمان ارسالی به دستگاه، `[Scheduler]` تجمیع، `[RMTO]` ارسال به راهسام.

---

## ۹) عیب‌یابی

| مشکل | علت محتمل | راه‌حل |
|---|---|---|
| سرویس بالا نمی‌آید | خطای `npm install` یا `.env` ناقص | `journalctl -u tc-manager -n 100` را بخوانید |
| خطای کامپایل better-sqlite3 | نبود ابزار build | `apt-get install -y build-essential python3` سپس `npm rebuild better-sqlite3` |
| `EADDRINUSE` روی 3000/2022 | پروسه قبلی زنده است | `fuser -k 3000/tcp; fuser -k 2022/tcp` سپس ری‌استارت (unit فایل خودش این‌کار را در ExecStartPre می‌کند) |
| دستگاه‌ها وصل نمی‌شوند | پورت 2022 بسته است | `ufw allow 2022/tcp` و فایروال دیتاسنتر را چک کنید |
| داشبورد باز نمی‌شود | Nginx یا سرویس پایین است | `nginx -t`، `systemctl status nginx tc-manager` |
| ارسال به RMTO ناموفق | رمز اشتباه یا فیلترشدن otf.rmto.ir | تنظیمات RMTO در داشبورد را چک کنید؛ `curl -I http://otf.rmto.ir` از خود سرور |
| ساعت داده‌ها جابه‌جاست | منطقه زمانی سیستم | کد خودش `TZ=Asia/Tehran` می‌گذارد؛ `timedatectl set-timezone Asia/Tehran` هم بزنید |
| رمز ورود فراموش شده | — | `cd /opt/tc-manager && node server/reset-password.js "رمز_جدید" "admin"` |

کدهای خطای سخت‌افزاری دستگاه (فیلد error_byte پیام 8821) در `docs/error-codes.md` مخزن مستند شده است.

### بازگشت اضطراری (Rollback)

قبل از هر تغییر روی سرور:

```bash
cp /opt/tc-manager/server/index.js /opt/tc-manager/server/index.js.bak
# در صورت مشکل:
cp /opt/tc-manager/server/index.js.bak /opt/tc-manager/server/index.js && systemctl restart tc-manager
```

---

## ۱۰) نصب روی سرور بدون اینترنت

اگر سرور مقصد اینترنت ندارد (نصب Node و npm ممکن نیست)، راهنمای جداگانه [`offline-install.md`](offline-install.md) را دنبال کنید — خلاصه: روی یک سیستم آنلاین با همان معماری/توزیع، Node و `node_modules` را آماده و با `scp` منتقل می‌کنید.

---

## پیوست: مستندات مرتبط در مخزن

| فایل | محتوا |
|---|---|
| `ANALYSIS.md` | تحلیل کامل سرور: جداول DB، پروتکل TCP، لیست APIها، توابع کلیدی |
| `CLAUDE.md` | معماری پروژه، پروتکل RATCX1، فرمت SOAP راهسام |
| `DEPLOY.md` | به‌روزرسانی سیستمِ در حال کار از طریق موبایل (Termux) |
| `docs/error-codes.md` | جدول کدهای خطای سخت‌افزاری دستگاه RATCX1 |
| `ADD DATA5_WEB SERVICE_1.01.pdf` | مستند رسمی وب‌سرویس Add5 راهسام |
