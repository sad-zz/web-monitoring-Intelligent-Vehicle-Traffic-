# راهنمای نصب رابط موبایل (Mobile UI)

## مقدمه

این راهنما نحوه نصب **رابط کاربری موبایل** TC Manager را روی سرور اصلی توضیح می‌دهد.

### نکات مهم:
- ✅ سیستم اصلی (پورت 80) **هیچ تغییری نمی‌کند** و همچنان کار می‌کند
- ✅ رابط موبایل روی **پورت 8080** نمایش داده می‌شود
- ✅ داده‌ها از **همان دیتابیس و پورت TCP 2022** استفاده می‌شود
- ✅ ارسال به سامانه RMTO از **سیستم اصلی** انجام می‌شود
- ✅ فقط **یک فایل** نیاز به آپلود دارد

### معماری:

```
┌─────────────┐     پورت 80      ┌──────────────────┐
│  دسکتاپ     │ ──────────────── │  سیستم اصلی      │ ← بدون تغییر
│  مرورگر     │     nginx        │  پورت 3000       │    دیتابیس + TCP:2022 + RMTO
└─────────────┘                  └──────────────────┘
                                          ▲
┌─────────────┐    پورت 8080     ┌────────┴─────────┐
│  موبایل     │ ──────────────── │  سرور موبایل     │ ← جدید: فقط پروکسی
│  مرورگر     │     nginx        │  پورت 3001       │    UI + پروکسی /api/*
└─────────────┘                  └──────────────────┘
```

---

## روش نصب (فقط 2 دستور)

### پیش‌نیاز
- سیستم اصلی TC Manager باید قبلاً روی سرور نصب شده باشد (با `deploy-all.sh`)
- دسترسی SSH به سرور با کاربر root

### مرحله ۱: دانلود فایل

از مخزن GitHub فایل `deploy-mobile.sh` را دانلود کنید:

**روش الف - دانلود مستقیم از GitHub:**
```bash
# روی کامپیوتر خودتان:
wget https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/fix-mobile-layout-issues/deploy-mobile.sh
```

**روش ب - کپی دستی:**
فایل `deploy-mobile.sh` را از مخزن GitHub کپی کنید و در یک فایل متنی ذخیره کنید.

### مرحله ۲: آپلود و اجرا روی سرور

```bash
# آپلود فایل به سرور:
scp deploy-mobile.sh root@5.159.49.246:/tmp/

# اتصال به سرور و اجرا:
ssh root@5.159.49.246 'bash /tmp/deploy-mobile.sh'
```

**یا اگر قبلاً به سرور SSH زده‌اید:**
```bash
# روی سرور:
bash /tmp/deploy-mobile.sh
```

### خروجی مورد انتظار:
```
========================================
  TC Manager – Mobile UI Deployment
  (self-contained – no other files needed)
========================================
[1/7] Creating directories...
[2/7] Copying frontend files from main system...
    Copied from /opt/tc-manager
[3/7] Writing mobile proxy server...
[4/7] Installing npm dependencies...
[5/7] Creating systemd service...
[6/7] Configuring nginx for mobile (port 8080)...
[7/7] Starting mobile service...

========================================
  ✅  Mobile UI running!

  Mobile URL:  http://5.159.49.246:8080
  Direct:      http://127.0.0.1:3001
  API proxy →  http://127.0.0.1:3000

  Same login as main system (admin).
  Main system is NOT affected.
========================================
```

---

## دسترسی

بعد از نصب موفق:

| چه کسی | آدرس | توضیح |
|--------|-------|-------|
| **دسکتاپ** | `http://5.159.49.246` (پورت 80) | سیستم اصلی - بدون تغییر |
| **موبایل** | `http://5.159.49.246:8080` | رابط موبایل - جدید |

هر دو از **همان یوزرنیم و پسورد** استفاده می‌کنند.

---

## مدیریت سرویس

```bash
# وضعیت:
systemctl status tc-manager-mobile

# لاگ‌ها:
journalctl -u tc-manager-mobile -n 50 -f

# ری‌استارت:
systemctl restart tc-manager-mobile

# توقف:
systemctl stop tc-manager-mobile

# حذف کامل:
systemctl stop tc-manager-mobile
systemctl disable tc-manager-mobile
rm -f /etc/systemd/system/tc-manager-mobile.service
rm -f /etc/nginx/sites-enabled/tc-manager-mobile
rm -f /etc/nginx/sites-available/tc-manager-mobile
rm -rf /opt/tc-manager-mobile
systemctl daemon-reload
nginx -t && systemctl reload nginx
```

---

## به‌روزرسانی

اگر فرانت‌اند سیستم اصلی تغییر کرد (مثلاً با `deploy-all.sh` جدید):

```bash
# فقط دوباره deploy-mobile.sh را اجرا کنید:
bash /tmp/deploy-mobile.sh
```

این اسکریپت خودکار فایل‌های جدید را از `/opt/tc-manager` کپی می‌کند.

---

## عیب‌یابی

### خطا: Main TC Manager not found
```
[ERROR] Main TC Manager not found at /opt/tc-manager
```
**راه‌حل:** ابتدا سیستم اصلی را نصب کنید: `bash deploy-all.sh`

### خطا: npm install failed
```
ERROR: npm install failed
```
**راه‌حل:** Node.js نصب نیست. نصب کنید:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
```

### پورت 8080 باز نیست
```bash
# فایروال را چک کنید:
ufw status
ufw allow 8080/tcp
```

### سرویس استارت نمی‌شود
```bash
# لاگ‌ها را ببینید:
journalctl -u tc-manager-mobile -n 50

# تست دستی:
cd /opt/tc-manager-mobile
PORT=3001 MAIN_SERVER=http://127.0.0.1:3000 node server.js
```
