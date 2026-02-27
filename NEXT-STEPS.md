# راهنمای گام‌به‌گام استقرار روی سرور

## ۱. قبل از اجرا — اعتبارنامه RMTO را اصلاح کنید

در فایل `/opt/tc-manager/.env` روی سرور، مقادیر زیر را با اطلاعات صحیح RAHSAM پر کنید:

```env
RMTO_URL=http://XXXX.XXXX.XX/XXX/service.asmx
RMTO_USER=your_username_here
RMTO_PASS=your_password_here
RMTO_FID=your_fid_here
```

> اگر این اعتبارنامه‌ها اشتباه باشند، RMTO خطای `Wrong username or password` می‌دهد.

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

## خلاصه وضعیت Fix‌ها (Fix1 تا Fix38)

| Fix | موضوع | وضعیت |
|-----|-------|--------|
| Fix10 | فرمت 0012 → `yyMMddHHmmss` | ✅ |
| Fix22 | ارسال 0197 بعد از 8012 ACK | ✅ |
| Fix23 | drain کامل buffer دستگاه با 8821 | ✅ |
| Fix30 | منطقه زمانی `Asia/Tehran` | ✅ |
| Fix31 | اصلاح timestamp در handler 8821 | ✅ |
| Fix35 | UPSERT: داده واقعی جایگزین صفر می‌شود | ✅ |
| Fix36 | توقف drain وقتی interval آینده است | ✅ |
| Fix37 | دکمه «جزییات» + auto-refresh در RMTO | ✅ |
| Fix38 | تشخیص خطای auth RMTO + جلوگیری از retry بی‌نهایت | ✅ |
