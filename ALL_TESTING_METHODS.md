# همه روش‌های تست RMTO / All RMTO Testing Methods

این راهنما **5 روش مختلف** برای تست و ارسال داده به API سازمان راهداری را توضیح می‌دهد.

**سوال:** اگر test-rmto.html مشکل دارد، چه راه دیگری برای تست وجود دارد؟  
**پاسخ:** 5 روش دیگر! این راهنما همه آنها را توضیح می‌دهد.

---

## 🚀 روش 1: CLI ساده (test-add-method.js) ⭐⭐⭐ توصیه می‌شود!

### بهترین برای: تست سریع Add method

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
node test-add-method.js
```

### مزایا:
- ✅ **خیلی ساده** - فقط 1 دستور
- ✅ **خیلی سریع** - کمتر از 5 ثانیه
- ✅ **بدون نیاز به سرور** - مستقیم اجرا می‌شود
- ✅ **نتیجه واضح** - موفق یا ناموفق

### معایب:
- ❌ فقط یک درخواست - نمی‌توان چند بار تست کرد
- ❌ فقط Add method - نه Add5 یا Add8

### نمونه خروجی موفق:
```
============================================================
Testing RMTO Add Method
============================================================
Test data: {
  "deviceCode": "1001",
  "dateTime": "2024/02/23 14:30",
  "totalCount": 45,
  "avgSpeed": 85
}

✅ Test PASSED
============================================================
Result: {"AddDataResult": "1"}

Success! The Add method is working correctly.
```

### نمونه خروجی خطا:
```
❌ Test FAILED
============================================================
Error: Authentication failed
```

---

## 🔬 روش 2: CLI پیشرفته (test-rmto.js) ⭐⭐⭐

### بهترین برای: تست کامل Add5 method

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
node test-rmto.js
```

### مزایا:
- ✅ **تست کامل** - AddData5 با 5 کلاس
- ✅ **نمایش WSDL** - ساختار سرویس
- ✅ **لاگ دقیق** - جزئیات کامل request/response
- ✅ **بررسی اتصال** - تست SOAP connection

### معایب:
- ❌ **پیچیده‌تر** - خروجی طولانی‌تر
- ❌ **کندتر** - چند ثانیه بیشتر طول می‌کشد

### نمونه خروجی:
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
[OK] AddData5 test completed successfully!

Test Result: {
  "AddData5Result": "1"
}
```

---

## 🌐 روش 3: curl مستقیم (SOAP Request) ⭐⭐

### بهترین برای: تست دستی و دیباگ

### مرحله 1: ساخت XML Request

```bash
cat > /tmp/rmto-add-request.xml << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Add xmlns="http://tempuri.org/">
      <CompanyCode>58</CompanyCode>
      <UserName>NOGSH</UserName>
      <Password>YOUR_PASSWORD_HERE</Password>
      <StationCode>1001</StationCode>
      <DateTime>2024/02/23 14:30</DateTime>
      <Count>45</Count>
      <Speed>85</Speed>
    </Add>
  </soap:Body>
</soap:Envelope>
EOF
```

### مرحله 2: ارسال به RMTO

```bash
curl -X POST http://otf.rmto.ir/Companies/Companies.asmx \
  -H "Content-Type: text/xml; charset=utf-8" \
  -H "SOAPAction: http://tempuri.org/Add" \
  -d @/tmp/rmto-add-request.xml \
  -v
```

### مزایا:
- ✅ **کنترل کامل** - می‌توانید XML را دست‌کاری کنید
- ✅ **بدون نیاز به Node.js** - فقط curl
- ✅ **مناسب Postman** - می‌توان در Postman استفاده کرد
- ✅ **دیباگ راحت** - می‌توانید headers و response را ببینید

### معایب:
- ❌ **نیاز به ساخت XML** - پیچیده برای Add5/Add8
- ❌ **خطاپذیر** - اشتباهات XML رایج است

### برای Add5:

```bash
cat > /tmp/rmto-add5-request.xml << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AddData5 xmlns="http://tempuri.org/">
      <CompanyCode>58</CompanyCode>
      <UserName>NOGSH</UserName>
      <Password>YOUR_PASSWORD_HERE</Password>
      <StationCode>1001</StationCode>
      <DateTime>2024/02/23 14:30</DateTime>
      <C1>10</C1>
      <C2>20</C2>
      <C3>15</C3>
      <C4>5</C4>
      <C5>3</C5>
      <S1>12</S1>
      <S2>18</S2>
      <S3>15</S3>
      <S4>8</S4>
      <S5>0</S5>
      <Violation>2</Violation>
      <Speed>85</Speed>
    </AddData5>
  </soap:Body>
</soap:Envelope>
EOF

curl -X POST http://otf.rmto.ir/Companies/Companies.asmx \
  -H "Content-Type: text/xml; charset=utf-8" \
  -H "SOAPAction: http://tempuri.org/AddData5" \
  -d @/tmp/rmto-add5-request.xml \
  -v
```

---

## 🔌 روش 4: از API سرور ⭐⭐

### بهترین برای: تست با API راحت

### مرحله 1: شروع سرور

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
npm start &
```

### مرحله 2: تست Add با curl

```bash
curl -X POST http://localhost:3000/api/rmto/test-add \
  -H "Content-Type: application/json" \
  -d '{
    "deviceCode": "1001",
    "dateTime": "2024/02/23 14:30",
    "totalCount": 45,
    "avgSpeed": 85
  }'
```

### مرحله 3: تست Add5 با curl

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

### مزایا:
- ✅ **API ساده** - JSON به جای XML
- ✅ **راحت‌تر** - نسبت به curl مستقیم
- ✅ **لاگ در سرور** - می‌توانید لاگ‌ها را ببینید
- ✅ **مناسب Postman** - می‌توان collection ساخت

### معایب:
- ❌ **نیاز به سرور running** - باید npm start بزنید
- ❌ **پورت باید باز باشد** - 3000 باید در دسترس باشد

### با Postman:

**Request:**
- Method: POST
- URL: `http://localhost:3000/api/rmto/test-add`
- Headers: `Content-Type: application/json`
- Body: (JSON از بالا)

---

## ⏰ روش 5: Scheduler خودکار ⭐

### بهترین برای: ارسال واقعی و مداوم

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
npm start
```

### Scheduler چه کار می‌کند:
- ⏰ **هر ساعت** خودکار اجرا می‌شود
- 📊 **داده واقعی** از دیتابیس می‌خواند
- 📡 **خودکار ارسال** به RMTO می‌کند
- 📝 **لاگ می‌گیرد** - در فایل لاگ ذخیره می‌شود

### مزایا:
- ✅ **خودکار** - نیازی به دخالت دستی نیست
- ✅ **مداوم** - هر ساعت اجرا می‌شود
- ✅ **داده واقعی** - از دیتابیس می‌خواند
- ✅ **مناسب production** - برای استقرار واقعی

### معایب:
- ❌ **نمی‌توان تست سریع کرد** - باید منتظر بمانید
- ❌ **نیاز به داده واقعی** - دیتابیس باید پر باشد

### مشاهده لاگ‌ها:

```bash
# لاگ‌های RMTO
tail -f /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server/logs/rmto-*.log

# یا از API
curl http://localhost:3000/api/rmto/logs?limit=50
```

### تنظیمات Scheduler:

در `server/scheduler.js`:
```javascript
// هر ساعت اجرا می‌شود
cron.schedule('0 * * * *', function() {
  // ارسال داده به RMTO
});
```

---

## 📊 مقایسه همه روش‌ها / Full Comparison

| روش | سادگی | سرعت | کنترل | نیاز سرور | نیاز XML | توصیه |
|-----|--------|------|-------|-----------|----------|-------|
| **test-add-method.js** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ❌ خیر | ❌ خیر | ✅ بهترین! |
| **test-rmto.js** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ❌ خیر | ❌ خیر | ✅ عالی |
| **curl مستقیم** | ⭐ | ⭐⭐ | ⭐⭐⭐ | ❌ خیر | ✅ بله | ⚠️ پیشرفته |
| **API سرور** | ⭐⭐ | ⭐⭐ | ⭐⭐ | ✅ بله | ❌ خیر | ✅ خوب |
| **Scheduler** | ⭐⭐⭐ | ⭐ | ⭐ | ✅ بله | ❌ خیر | ⚠️ واقعی |

---

## 🎯 توصیه نهایی / Final Recommendation

### برای تست سریع الان: ⭐⭐⭐

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
node test-add-method.js
```

**چرا این بهترین است:**
- ✅ خیلی ساده - فقط 1 دستور
- ✅ خیلی سریع - < 5 ثانیه
- ✅ نتیجه واضح - موفق یا ناموفق
- ✅ بدون پیچیدگی

### برای تست کامل:

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
node test-rmto.js
```

### برای استقرار واقعی:

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
npm start
```

---

## 🆘 راه‌حل خطاها / Error Solutions

### خطا: Cannot find module

```bash
# نصب وابستگی‌ها
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
npm install
```

### خطا: Authentication failed

```bash
# بررسی .env
cat .env

# اطمینان از صحت:
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=YOUR_ACTUAL_PASSWORD
RMTO_COMPANY_CODE=58
```

### خطا: Connection refused

- بررسی اتصال اینترنت
- بررسی فایروال
- ping به otf.rmto.ir

### خطا: Invalid DateTime format

- فرمت باید: `YYYY/MM/DD HH:mm`
- مثال صحیح: `2024/02/23 14:30`
- مثال غلط: `2024-02-23 14:30:00`

---

## 📝 خلاصه / Summary

**سوال:** test-rmto.html مشکل دارد، چه کنیم؟

**پاسخ:** 5 روش دیگر وجود دارد!

1. ✅ **test-add-method.js** - بهترین و ساده‌ترین
2. ✅ **test-rmto.js** - کامل‌تر و پیشرفته‌تر
3. ⚠️ **curl** - برای پیشرفته‌ها
4. ✅ **API** - برای integration
5. ⚠️ **Scheduler** - برای production

**توصیه:** از روش 1 شروع کنید! ✨

---

## 🎉 نتیجه / Result

- ✅ test-rmto.html **اختیاری** است
- ✅ **CLI بهتر** و سریع‌تر است
- ✅ **5 روش** مختلف برای انتخاب
- ✅ **هر نیازی** پوشش داده شده

**دیگر نیازی به test-rmto.html نیست! 🚀**
