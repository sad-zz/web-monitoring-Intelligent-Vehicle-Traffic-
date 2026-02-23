# مراحل بعدی - راهنمای کامل

# NEXT STEPS - Complete Guide

---

## 🎯 مرحله بعد چیه؟ / What's Next?

بعد از دانلود موفق فایل `test-rmto.js`، این مراحل را دنبال کنید:
After successfully downloading `test-rmto.js`, follow these steps:

---

## 📋 مراحل کامل / Complete Steps

### مرحله 1️⃣: رفتن به دایرکتوری server

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
```

بررسی کنید که فایل test-rmto.js دانلود شده:
```bash
ls -lh test-rmto.js
# باید حدود 4KB باشد (نه 14 بایت!)
# Should be about 4KB (not 14 bytes!)
```

---

### مرحله 2️⃣: تنظیم فایل .env

#### گام 2.1: کپی فایل نمونه
```bash
cp .env.example .env
```

#### گام 2.2: ویرایش فایل
```bash
nano .env
```

#### گام 2.3: تنظیمات RMTO
در فایل `.env` این مقادیر را وارد کنید:

```env
# اطلاعات RMTO
RMTO_COMPANY_CODE=58
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=N*(gH5!u3

# یا هر رمز عبور واقعی که از سازمان راهداری دریافت کردید
# Or whatever actual password you received from RMTO
```

**⚠️ مهم:** رمز عبور واقعی خود را وارد کنید!

#### گام 2.4: ذخیره فایل
- کلیدها: `Ctrl+X` سپس `Y` سپس `Enter`

---

### مرحله 3️⃣: نصب وابستگی‌ها (اگر قبلاً نصب نکردید)

```bash
npm install
```

اگر خطا داد، این را امتحان کنید:
```bash
npm install --legacy-peer-deps
```

---

### مرحله 4️⃣: اجرای تست RMTO

```bash
node test-rmto.js
```

---

## ✅ نتایج ممکن / Possible Results

### ✅ نتیجه موفق / Success Result

```
============================================================
RMTO SOAP Service Test
============================================================
WSDL URL: http://otf.rmto.ir/Companies/Companies.asmx?WSDL
Company Code: 58
Username: NOGSH

[1] Creating SOAP client...
[OK] SOAP client created successfully

[2] WSDL Structure:
{
  "CompanySoap": { ... }
}

[3] Testing AddData5 method...
[OK] AddData5 test completed successfully!

Response: {
  "AddData5Result": true
}

============================================================
Test completed successfully! ✓
============================================================
```

**✅ اگر این نتیجه را دیدید، یعنی همه چیز درست کار می‌کند!**
**✅ If you see this result, everything is working correctly!**

➡️ **مرحله بعدی:** بروید به [مرحله 5](#مرحله-5️⃣-راه-اندازی-سرور-اصلی)

---

### ❌ خطای اتصال / Connection Error

```
[RMTO] Failed to create SOAP client: connect ECONNREFUSED
```

**راه حل / Solution:**
1. بررسی اتصال اینترنت سرور
2. بررسی دسترسی به `otf.rmto.ir`:
   ```bash
   ping otf.rmto.ir
   curl -I http://otf.rmto.ir
   ```
3. بررسی فایروال و پورت‌های خروجی (80, 443)

---

### ❌ خطای احراز هویت / Authentication Error

```
[RMTO] SOAP Fault: "Authentication failed"
```

**راه حل / Solution:**
1. بررسی `RMTO_USERNAME` در `.env`
2. بررسی `RMTO_PASSWORD` در `.env`
3. تماس با سازمان راهداری برای تأیید اطلاعات

---

### ❌ خطای کد ایستگاه / StationCode Error

```
[RMTO] SOAP Fault: "StationCode not found"
```

**راه حل / Solution:**
1. کد ایستگاه 4 رقمی را با سازمان راهداری تأیید کنید
2. در تست، کد ایستگاه `"1001"` استفاده می‌شود
3. اگر کد ایستگاه شما متفاوت است، فایل را ویرایش کنید

---

### ❌ خطای فرمت تاریخ / DateTime Format Error

```
[RMTO] SOAP Fault: "Invalid DateTime format"
```

**راه حل / Solution:**
- فرمت صحیح: `YYYY/MM/DD HH:mm`
- مثال: `2024/02/23 14:30`
- **نه:** `2024-02-23` یا `23/02/2024`

---

## مرحله 5️⃣: راه‌اندازی سرور اصلی

اگر تست موفق بود، سرور را راه‌اندازی کنید:

### روش 1: اجرای عادی (Foreground)
```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
npm start
```

### روش 2: اجرای در Background
```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
nohup npm start > server.log 2>&1 &
```

بررسی وضعیت:
```bash
ps aux | grep node
```

---

## مرحله 6️⃣: تست از رابط وب

### باز کردن UI تست
```
http://IP_SERVER:3000/test-rmto.html
```

مثلاً:
- `http://5.159.49.246:3000/test-rmto.html`
- `http://localhost:3000/test-rmto.html`

### استفاده از UI:
1. فرم را با اطلاعات پر کنید
2. دکمه "ارسال داده به RMTO" را بزنید
3. نتیجه و لاگ‌ها را مشاهده کنید

---

## مرحله 7️⃣: پیکربندی Scheduler (ارسال خودکار)

اگر تست موفق بود، scheduler به صورت خودکار فعال می‌شود و:

- **هر 5 دقیقه** داده‌های ترافیک را جمع‌آوری می‌کند
- **هر ساعت** داده‌ها را به RMTO ارسال می‌کند
- **لاگ** همه فعالیت‌ها را ثبت می‌کند

### مشاهده لاگ‌های scheduler:
```bash
# در کنسول سرور
tail -f /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server/server.log

# یا از API
curl http://localhost:3000/api/rmto/logs?limit=50
```

---

## مرحله 8️⃣: مانیتورینگ و بررسی

### API endpoints برای مانیتورینگ:

#### دریافت آخرین لاگ‌ها:
```bash
curl http://localhost:3000/api/rmto/logs?limit=50
```

#### دریافت صف ارسال نشده:
```bash
curl http://localhost:3000/api/rmto/queue?type=5class
```

#### ارسال مجدد داده‌های ناموفق:
```bash
curl -X POST http://localhost:3000/api/rmto/retry
```

#### تست AddData5 از API:
```bash
curl -X POST http://localhost:3000/api/rmto/test-add5 \
  -H "Content-Type: application/json" \
  -d '{
    "deviceCode": "1001",
    "dateTime": "2024/02/23 14:30",
    "class1Count": 10,
    "class2Count": 20,
    "class3Count": 15,
    "class4Count": 5,
    "class5Count": 3,
    "speed1Count": 12,
    "speed2Count": 18,
    "speed3Count": 15,
    "speed4Count": 8,
    "speed5Count": 0,
    "violations": 2,
    "avgSpeed": 85
  }'
```

---

## 📊 Checklist کامل / Complete Checklist

### مراحل ضروری:
- [ ] فایل test-rmto.js دانلود شد (4KB)
- [ ] رفتم به دایرکتوری server
- [ ] فایل .env ساخته شد
- [ ] رمز عبور RMTO وارد شد
- [ ] npm install اجرا شد
- [ ] node test-rmto.js موفق بود

### مراحل بعدی:
- [ ] سرور با npm start راه‌اندازی شد
- [ ] UI تست در http://IP:3000/test-rmto.html باز شد
- [ ] تست از UI موفق بود
- [ ] Scheduler در حال اجرا است
- [ ] لاگ‌ها مانیتور می‌شوند

---

## 🆘 اگر مشکلی داشتید / If You Have Problems

### 1. خطا در دانلود فایل
➡️ ببینید: `DOWNLOAD_ERROR_FIX.md`

### 2. خطا در پیدا کردن پروژه
➡️ ببینید: `START_HERE.md`

### 3. خطا در اتصال RMTO
➡️ ببینید: `TROUBLESHOOTING.md`

### 4. placeholder ها را اشتباه استفاده کردم
➡️ ببینید: `PLACEHOLDER_ERROR.txt`

### 5. نیاز به کپی دستی فایل
➡️ ببینید: `MANUAL_COPY_INSTRUCTIONS.md`

---

## 🎉 تمام شد! / You're Done!

اگر همه مراحل را انجام دادید:

- ✅ تست موفق بود
- ✅ سرور در حال اجرا است
- ✅ Scheduler فعال است
- ✅ داده‌ها به RMTO ارسال می‌شوند

**تبریک! یکپارچه‌سازی RMTO کامل شد! 🚀**
**Congratulations! RMTO integration is complete! 🎊**

---

## 📞 کمک بیشتر / More Help

اگر هنوز سوالی دارید:

1. مستندات فنی کامل: `server/RMTO_GUIDE.md`
2. خلاصه راه‌حل: `RMTO_SOLUTION_SUMMARY.md`
3. راهنمای سریع: `QUICK_FIX.md`

---

**موفق باشید! / Good luck! 🍀**
