# 🚀 خلاصه تغییرات برای رفع مشکل ارسال به RMTO

## ❓ مشکل اولیه

کاربر گزارش داد که هنگام ارسال داده به API سازمان راهداری در آدرس:
```
http://otf.rmto.ir/Companies/Companies.asmx?op=Add5
```
خطا دریافت می‌کند.

---

## ✅ راه‌حل‌های اضافه شده

### 1. 🧪 ابزار تست خط فرمان (Command Line Test)

**فایل:** `server/test-rmto.js`

این اسکریپت به شما کمک می‌کند تا مشکل دقیق را تشخیص دهید:

```bash
cd server
node test-rmto.js
```

**خروجی این اسکریپت:**
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
  "CompanySoap": {
    "AddData": {...},
    "AddData5": {...},
    "AddData8": {...}
  }
}

[3] Testing AddData5 method...
Request XML: <soap:Envelope>...</soap:Envelope>

[OK] AddData5 test completed successfully!
```

اگر خطا وجود داشته باشد، جزئیات کامل خطا نمایش داده می‌شود.

---

### 2. 🖥️ رابط وب تعاملی (Web UI)

**فایل:** `test-rmto.html`

یک صفحه وب فارسی کامل برای تست ارسال داده:

**نحوه استفاده:**
1. سرور را اجرا کنید:
   ```bash
   cd server
   npm start
   ```

2. مرورگر را باز کنید:
   ```
   http://localhost:3000/test-rmto.html
   ```

3. فرم را پر کنید (مقادیر پیش‌فرض از قبل وارد شده)

4. دکمه "ارسال داده به RMTO" را بزنید

**امکانات:**
- ✅ فرم فارسی با توضیحات کامل
- ✅ تاریخ و زمان فعلی به صورت خودکار
- ✅ نمایش نتیجه ارسال (موفق/ناموفق)
- ✅ مشاهده آخرین لاگ‌های ارسال
- ✅ جزئیات کامل request/response

---

### 3. 📊 API های جدید

چهار endpoint جدید برای مدیریت و تست:

#### ۱. تست AddData5
```http
POST /api/rmto/test-add5
Content-Type: application/json

{
  "deviceCode": "1001",
  "dateTime": "2024/02/22 14:30",
  "class1Count": 10,
  "class2Count": 20,
  ...
}
```

#### ۲. دریافت لاگ‌ها
```http
GET /api/rmto/logs?limit=50
```

#### ۳. دریافت صف ارسال نشده
```http
GET /api/rmto/queue?type=5class
```

#### ۴. ارسال مجدد داده‌های ناموفق
```http
POST /api/rmto/retry
```

---

### 4. 📝 مستندات کامل

**فایل:** `server/RMTO_GUIDE.md`

راهنمای جامع شامل:
- ✅ توضیح کامل پارامترهای AddData5
- ✅ فرمت صحیح DateTime
- ✅ عیب‌یابی خطاهای رایج
- ✅ نحوه تنظیم اطلاعات احراز هویت
- ✅ مثال‌های کاربردی

---

### 5. 🔍 بهبود لاگینگ

**فایل:** `server/rmto-client.js`

لاگ‌های بهتر برای تشخیص مشکل:

```javascript
[RMTO] Initializing SOAP client...
[RMTO] WSDL URL: http://otf.rmto.ir/...
[RMTO] Company Code: 58
[RMTO] Username: NOGSH

[RMTO] AddData5 request: {
  "CompanyCode": "58",
  "UserName": "NOGSH",
  "StationCode": "1001",
  "DateTime": "2024/02/22 14:30",
  ...
}

// در صورت خطا:
[RMTO] AddData5 error: ...
[RMTO] Error code: ECONNREFUSED
[RMTO] SOAP Fault: {...}
[RMTO] HTTP Status: 500
[RMTO] Request XML: <soap:Envelope>...</soap:Envelope>
```

---

## 🛠️ نحوه استفاده برای رفع مشکل

### گام ۱: تنظیم اطلاعات احراز هویت

```bash
cd server
cp .env.example .env
nano .env
```

در فایل `.env`:
```env
RMTO_COMPANY_CODE=58
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=your_actual_password_here
```

### گام ۲: تست با اسکریپت

```bash
node test-rmto.js
```

**اگر موفق بود:**
```
[OK] AddData5 test completed successfully!
```

**اگر خطا داشت:**
- خطای اتصال → بررسی اینترنت و دسترسی به `otf.rmto.ir`
- خطای احراز هویت → بررسی username/password
- خطای فرمت → بررسی DateTime format
- خطای StationCode → کد ایستگاه را با RMTO تأیید کنید

### گام ۳: تست با رابط وب

```bash
npm start
```

سپس به `http://localhost:3000/test-rmto.html` بروید و تست کنید.

### گام ۴: مشاهده لاگ‌ها

**در کنسول سرور:**
```bash
npm start
# لاگ‌ها اینجا نمایش داده می‌شوند
```

**از API:**
```bash
curl http://localhost:3000/api/rmto/logs
```

---

## 🐛 عیب‌یابی خطاهای رایج

### خطا ۱: Connection failed / ECONNREFUSED
```
[RMTO] Failed to create SOAP client: connect ECONNREFUSED
```

**علت:** سرور RMTO در دسترس نیست

**راه حل:**
```bash
# تست اتصال
curl http://otf.rmto.ir/Companies/Companies.asmx?WSDL

# بررسی DNS
ping otf.rmto.ir

# بررسی فایروال
```

### خطا ۲: Authentication failed / 401
```
[RMTO] SOAP Fault: faultstring: "Authentication failed"
```

**علت:** نام کاربری یا رمز عبور اشتباه

**راه حل:**
1. بررسی `RMTO_USERNAME` در `.env`
2. بررسی `RMTO_PASSWORD` در `.env`
3. تماس با سازمان راهداری برای تأیید اعتبار

### خطا ۳: Invalid DateTime format
```
[RMTO] SOAP Fault: faultstring: "Invalid DateTime format"
```

**علت:** فرمت تاریخ اشتباه است

**فرمت صحیح:** `YYYY/MM/DD HH:mm`

**مثال‌های صحیح:**
- ✅ `2024/02/22 14:30`
- ✅ `2024/12/31 23:59`
- ✅ `2024/01/01 00:00`

**مثال‌های غلط:**
- ❌ `2024-02-22 14:30` (خط تیره)
- ❌ `22/02/2024 14:30` (ترتیب)
- ❌ `2024/2/22 14:30` (تک رقمی)

### خطا ۴: StationCode not found
```
[RMTO] SOAP Fault: faultstring: "StationCode not found"
```

**علت:** کد ایستگاه در سیستم RMTO ثبت نشده

**راه حل:**
1. تماس با سازمان راهداری
2. تأیید کد ایستگاه
3. ثبت کد ایستگاه در سیستم RMTO

---

## 📁 فایل‌های اضافه شده

| فایل | توضیح |
|------|-------|
| `server/test-rmto.js` | اسکریپت تست خط فرمان |
| `test-rmto.html` | رابط وب تست |
| `server/RMTO_GUIDE.md` | مستندات کامل |
| `server/rmto-client.js` | بهبود یافته با لاگ بهتر |
| `server/index.js` | API های جدید |

---

## 📞 در صورت نیاز به کمک

1. ✅ اسکریپت `test-rmto.js` را اجرا کنید
2. ✅ خروجی کامل (با خطا) را کپی کنید
3. ✅ فایل `.env` را بررسی کنید (بدون نمایش رمز عبور)
4. ✅ لاگ‌های سرور را بررسی کنید
5. ✅ با تیم فنی تماس بگیرید و اطلاعات بالا را ارسال کنید

---

## ⚠️ نکات امنیتی

- 🔒 هرگز `USERNAME` و `PASSWORD` را در کد قرار ندهید
- 🔒 همیشه از فایل `.env` استفاده کنید
- 🔒 فایل `.env` را به git commit نکنید
- 🔒 از `.gitignore` برای مخفی کردن `.env` استفاده کنید

---

**موفق باشید! 🎉**
