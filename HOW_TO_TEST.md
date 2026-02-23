# 🧪 چطور تست کنم؟ / How Do I Test?

**سوال:** الان چطور تستش کنم؟  
**Question:** Now how do I test it?

**پاسخ:** 3 روش ساده!  
**Answer:** 3 simple methods!

---

## 🚀 روش 1: سریع (فقط 1 دستور!)

اگر می‌خواهید **فوراً** تست کنید:

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server && curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/test-rmto.js && npm install && cp .env.example .env && nano .env && node test-rmto.js
```

**نکته:** در nano:
1. رمز عبور RMTO را وارد کنید: `RMTO_PASSWORD=N*(gH5!u3`
2. ذخیره: `Ctrl+X` → `Y` → `Enter`

---

## 📋 روش 2: گام به گام (استاندارد)

اگر می‌خواهید **مطمئن** پیش بروید:

### گام 1: رفتن به پوشه server

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
```

**بررسی:** باید در مسیر `...server` باشید
```bash
pwd
# خروجی: /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
```

### گام 2: دانلود فایل test-rmto.js

```bash
curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/test-rmto.js
```

**بررسی:** فایل باید حدود 4KB باشد (نه 14 بایت!)
```bash
ls -lh test-rmto.js
# خروجی باید: -rw-r--r-- 1 root root 4.0K ... test-rmto.js
```

⚠️ **اگر فقط 14 بایت بود:** خطای 404 است! به `DOWNLOAD_ERROR_FIX.md` مراجعه کنید.

### گام 3: نصب وابستگی‌ها

```bash
npm install
```

**اگر خطا گرفت:**
```bash
npm install --legacy-peer-deps
```

**بررسی:** باید پوشه `node_modules` ساخته شود
```bash
ls -d node_modules
```

### گام 4: تنظیم فایل .env

#### الف) کپی فایل نمونه
```bash
cp .env.example .env
```

#### ب) ویرایش فایل
```bash
nano .env
```

#### ج) تنظیمات مورد نیاز
در فایل .env این‌ها را تنظیم کنید:

```env
RMTO_COMPANY_CODE=58
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=N*(gH5!u3
```

⚠️ **توجه:** رمز عبور واقعی خود را وارد کنید!

#### د) ذخیره و خروج
- `Ctrl+X` → خروج
- `Y` → تأیید ذخیره
- `Enter` → تأیید نام فایل

**بررسی:**
```bash
cat .env | grep RMTO_PASSWORD
# باید رمز عبور را نشان دهد
```

### گام 5: اجرای تست

```bash
node test-rmto.js
```

**منتظر نتیجه بمانید...** (5-10 ثانیه)

---

## 🖥️ روش 3: تست از UI (بصری)

اگر می‌خواهید از **رابط وب** تست کنید:

### گام 1: راه‌اندازی سرور

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
npm start
```

**خروجی موفق:**
```
Server running on port 3000
```

### گام 2: باز کردن مرورگر

در مرورگر این آدرس را باز کنید:
```
http://5.159.49.246:3000/test-rmto.html
```

**یا اگر روی سرور محلی هستید:**
```
http://localhost:3000/test-rmto.html
```

### گام 3: پر کردن فرم

فرمی را خواهید دید با این فیلدها:
- کد ایستگاه: `1001` (پیش‌فرض)
- تاریخ/زمان: خودکار پر می‌شود
- تعداد خودروها: مقادیر نمونه

### گام 4: ارسال

دکمه **"ارسال داده به RMTO"** را بزنید.

### گام 5: مشاهده نتیجه

- ✅ **موفق:** پیام سبز رنگ نشان داده می‌شود
- ❌ **خطا:** پیام قرمز رنگ با جزئیات

---

## ✅ نتیجه موفق / Success Result

اگر همه چیز درست باشد، این خروجی را خواهید دید:

```
============================================================
RMTO SOAP Service Test
============================================================
WSDL URL: http://otf.rmto.ir/Companies/Companies.asmx?WSDL
Company Code: 58
Username: NOGSH

[1] Creating SOAP client...
[RMTO] Initializing SOAP client...
[RMTO] WSDL URL: http://otf.rmto.ir/Companies/Companies.asmx?WSDL
[RMTO] Company Code: 58
[RMTO] Username: NOGSH
[OK] SOAP client created successfully

[2] WSDL Structure:
{
  "CompanySoap": {
    "AddData": { ... },
    "AddData5": { ... },
    "AddData8": { ... }
  }
}

[3] Testing AddData5 method...
[RMTO] AddData5 request: {
  "CompanyCode": "58",
  "UserName": "NOGSH",
  "Password": "***",
  "StationCode": "1001",
  "DateTime": "2026/02/23 10:30",
  ...
}

[OK] AddData5 test completed successfully!

Test Result:
{
  "AddDataResult": "1"  ← این یعنی موفقیت! ✅
}

============================================================
Test completed!
============================================================
```

### 🎉 تبریک!

اگر `"AddDataResult": "1"` دیدید، **تست موفق بوده است!**

---

## ❌ نتایج خطا / Error Results

### 1️⃣ خطای اتصال (Connection Error)

```
[RMTO] Failed to create SOAP client
[RMTO] Error: connect ECONNREFUSED
[RMTO] Error: getaddrinfo ENOTFOUND otf.rmto.ir
```

**علت:**
- مشکل اتصال اینترنت
- فایروال مسدود کرده
- DNS کار نمی‌کند

**راه حل:**
```bash
# بررسی اتصال
ping otf.rmto.ir

# بررسی DNS
nslookup otf.rmto.ir

# تست با curl
curl -I http://otf.rmto.ir
```

### 2️⃣ خطای احراز هویت (Authentication Error)

```
[RMTO] AddData5 error: SOAP Fault
[RMTO] faultcode: soap:Server
[RMTO] faultstring: "Authentication failed"
```

**علت:**
- نام کاربری اشتباه
- رمز عبور اشتباه

**راه حل:**
```bash
# بررسی .env
cat .env | grep RMTO

# ویرایش دوباره
nano .env
```

### 3️⃣ خطای کد ایستگاه (StationCode Error)

```
[RMTO] SOAP Fault: "StationCode not found"
[RMTO] SOAP Fault: "Invalid StationCode"
```

**علت:**
- کد ایستگاه در سیستم RMTO ثبت نشده
- کد ایستگاه غیرفعال است

**راه حل:**
- با سازمان راهداری تماس بگیرید
- کد ایستگاه صحیح را دریافت کنید
- کد را فعال کنند

### 4️⃣ خطای فرمت تاریخ (DateTime Format Error)

```
[RMTO] SOAP Fault: "Invalid DateTime format"
```

**علت:**
- فرمت تاریخ اشتباه است

**فرمت صحیح:**
```
YYYY/MM/DD HH:mm

مثال‌های صحیح:
✅ 2026/02/23 10:30
✅ 2026/01/15 08:00
✅ 2025/12/31 23:59

مثال‌های غلط:
❌ 2026-02-23 10:30  (خط تیره نه، / بزن)
❌ 23/02/2026 10:30  (ترتیب اشتباه)
❌ 2026/2/23 10:30   (باید 02 باشد نه 2)
```

### 5️⃣ خطای Module Not Found

```
Error: Cannot find module 'soap'
Error: Cannot find module 'express'
```

**علت:**
- npm install اجرا نشده
- node_modules پاک شده

**راه حل:**
```bash
npm install
# یا
npm install --legacy-peer-deps
```

---

## 📋 Checklist تست / Test Checklist

### برای روش CLI:

- [ ] رفتم به پوشه server
- [ ] فایل test-rmto.js دانلود شد (4KB)
- [ ] npm install موفق بود
- [ ] .env ساخته شد
- [ ] رمز عبور در .env وارد شد
- [ ] node test-rmto.js اجرا شد
- [ ] نتیجه `"AddDataResult": "1"` بود ✅

### برای روش UI:

- [ ] سرور با npm start راه‌اندازی شد
- [ ] صفحه test-rmto.html باز شد
- [ ] فرم با مقادیر پر شد
- [ ] دکمه ارسال زده شد
- [ ] پیام موفقیت نمایش داده شد ✅
- [ ] لاگ‌ها در قسمت پایین نمایش داده شد

---

## 🆘 کمک بیشتر / Need More Help?

اگر هنوز مشکل دارید، این فایل‌ها را بخوانید:

1. **TROUBLESHOOTING.md** - عیب‌یابی کامل
2. **NEXT_STEPS.md** - مراحل بعدی چیست؟
3. **server/RMTO_GUIDE.md** - مستندات فنی
4. **QUICK_FIX.md** - رفع سریع مشکلات
5. **DOWNLOAD_ERROR_FIX.md** - مشکل دانلود

---

## 🎯 خلاصه سریع / Quick Summary

### ✅ اگر تست موفق بود:

**مرحله بعد:** `NEXT_STEPS.md` را بخوانید

```bash
# راه‌اندازی سرور اصلی
npm start

# یا در background:
nohup npm start > server.log 2>&1 &
```

### ❌ اگر خطا گرفتید:

**عیب‌یابی:** `TROUBLESHOOTING.md` را بخوانید

```bash
# مشاهده راهنمای عیب‌یابی
cat TROUBLESHOOTING.md | less
```

---

## 💡 نکات مهم / Important Notes

1. ⚠️ **رمز عبور را به کسی ندهید**
2. ⚠️ **فایل .env را commit نکنید**
3. ✅ **قبل از تست، .env را بررسی کنید**
4. ✅ **اندازه فایل test-rmto.js باید 4KB باشد**
5. ✅ **اگر 404 گرفتید، از branch صحیح دانلود کنید**

---

## 🎊 موفق باشید! / Good Luck!

**سوالی دارید؟** همه مستندات را در `DOCUMENTATION_INDEX.md` ببینید.

**تست موفق بود؟** `NEXT_STEPS.md` را بخوانید و ادامه دهید!

**🚀 موفق باشید!**
