# راهنمای استقرار (Deployment Guide)

## پیش‌نیازها

- سرور Ubuntu/Debian با دسترسی root
- اتصال اینترنت (برای نصب Node.js و بسته‌ها)
- پورت‌های 80 (وب) و 2022 (TCP دستگاه‌ها) باز باشد

---

## روش ۱: استقرار کامل (توصیه شده برای نصب اول)

یک اسکریپت واحد که تمام فایل‌ها، سرویس‌ها و تنظیمات را نصب می‌کند:

```bash
# کپی deploy-all.sh به سرور
scp deploy-all.sh root@SERVER_IP:/tmp/

# اجرا روی سرور
ssh root@SERVER_IP
bash /tmp/deploy-all.sh
```

برای پاک کردن دیتابیس قبلی و نصب تازه:
```bash
bash /tmp/deploy-all.sh --fresh
```

پس از اجرا:
- وب: `http://SERVER_IP`
- TCP: پورت `2022`
- ورود: `admin` / `admin123`

---

## روش ۲: استقرار بخش‌بخش (برای بروزرسانی)

اگر سرور قبلاً نصب شده و فقط می‌خواهید کد را بروزرسانی کنید:

### ۲.۱ بروزرسانی فایل‌های سرور (SOAP، scheduler، دیتابیس)

```bash
scp server/deploy-part1-server.sh root@SERVER_IP:/opt/tc-manager/
ssh root@SERVER_IP
cd /opt/tc-manager
bash deploy-part1-server.sh
systemctl restart tc-manager
```

### ۲.۲ بروزرسانی فایل‌های فرانت‌اند

```bash
scp server/deploy-part2-frontend.sh root@SERVER_IP:/opt/tc-manager/
ssh root@SERVER_IP
cd /opt/tc-manager
bash deploy-part2-frontend.sh
```

### ۲.۳ بروزرسانی HTML

```bash
scp server/deploy-part3-html.sh root@SERVER_IP:/opt/tc-manager/
ssh root@SERVER_IP
cd /opt/tc-manager
bash deploy-part3-html.sh
```

### ۲.۴ بروزرسانی CSS و JavaScript

```bash
scp server/deploy-part4-css-js.sh root@SERVER_IP:/opt/tc-manager/
ssh root@SERVER_IP
cd /opt/tc-manager
bash deploy-part4-css-js.sh
systemctl restart tc-manager
```

---

## روش ۳: کپی مستقیم فایل‌ها (سریع‌ترین روش)

اگر نمی‌خواهید از اسکریپت‌های deploy استفاده کنید:

```bash
# کپی فایل‌های سرور
scp server/index.js server/db.js server/rmto-client.js server/scheduler.js \
    root@SERVER_IP:/opt/tc-manager/server/

# کپی فایل‌های فرانت‌اند
scp index.html root@SERVER_IP:/opt/tc-manager/
scp css/style.css root@SERVER_IP:/opt/tc-manager/css/
scp js/app.js root@SERVER_IP:/opt/tc-manager/js/

# ری‌استارت سرویس
ssh root@SERVER_IP "systemctl restart tc-manager"
```

---

## تنظیمات RMTO

فایل `.env` در مسیر `/opt/tc-manager/server/.env`:

```env
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
| ری‌استارت کامل | `systemctl restart tc-manager && systemctl restart nginx` |

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
