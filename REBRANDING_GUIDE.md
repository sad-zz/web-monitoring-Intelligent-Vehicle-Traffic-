# راهنمای تغییر نام‌گذاری / Rebranding Guide

## 🎯 هدف / Objective

تغییر نام‌گذاری از "RMTO / رهسام" به "سامانه تردد شماری" یا "نوآوران جنوب شرق"

---

## ✅ تغییرات اعمال شده / Changes Applied

### 1. رابط کاربری (UI Files)

#### test-traffic-system.html (جدید)
نسخه بهبود یافته test-rmto.html با:
- ✅ عنوان: "تست ارسال داده به سامانه تردد شماری"
- ✅ نام شرکت: "نوآوران جنوب شرق - سیستم مدیریت ترافیک هوشمند"
- ✅ نمایش خروجی واقعی SOAP request/response
- ✅ نمایش خطاها به صورت بصری
- ✅ لاگ‌گذاری زمان واقعی
- ✅ UI زیبا و حرفه‌ای

#### ویژگی‌های خروجی:
```javascript
// نمایش درخواست SOAP
📤 داده‌های ارسالی: {...}

// نمایش پاسخ SOAP  
📥 پاسخ دریافت شده: {...}

// نمایش XML کامل
📄 درخواست SOAP ارسال شده: <xml>...</xml>
📄 پاسخ SOAP دریافت شده: <xml>...</xml>

// نمایش خطا
❌ خطا در ارسال!
⚠️ جزئیات خطا: {...}
```

### 2. API Endpoints (سازگار با نام‌های قبلی)

**نام‌های جدید (پیشنهادی):**
```
/api/traffic-system/test-add5
/api/traffic-system/test-add
/api/traffic-system/logs
/api/traffic-system/queue
```

**نام‌های قدیمی (همچنان کار می‌کنند):**
```
/api/rmto/test-add5
/api/rmto/test-add
/api/rmto/logs
/api/rmto/queue
```

### 3. نام‌گذاری در کد

**قبل:**
```javascript
console.log("[RMTO] Sending data...");
var rmtoClient = require('./rmto-client');
```

**بعد (پیشنهاد):**
```javascript
console.log("[Traffic System] Sending data...");
var trafficClient = require('./rmto-client'); // فایل همان است
```

**نکته:** نام فایل‌ها تغییر نکرده (سازگاری با کد موجود) اما label ها تغییر کرده‌اند

---

## 🎨 نمایش خروجی واقعی / Real Output Display

### مثال خروجی موفق:

```
═══════════════════════════════════════
🚀 شروع ارسال داده به سامانه تردد شماری
═══════════════════════════════════════

📤 داده‌های ارسالی:
{
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
}

📥 پاسخ دریافت شد از سرور
وضعیت HTTP: 200 OK

✅ ارسال موفق!

📊 پاسخ سرور:
{
  "success": true,
  "result": {
    "AddData5Result": "1"
  }
}

✅ نتیجه: {"AddData5Result":"1"}

📄 درخواست SOAP ارسال شده:
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AddData5 xmlns="http://tempuri.org/">
      <CompanyCode>58</CompanyCode>
      <UserName>NOGSH</UserName>
      <Password>***</Password>
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

📄 پاسخ SOAP دریافت شده:
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope>
  <soap:Body>
    <AddData5Response>
      <AddData5Result>1</AddData5Result>
    </AddData5Response>
  </soap:Body>
</soap:Envelope>

═══════════════════════════════════════
⏹️ پایان عملیات ارسال
═══════════════════════════════════════
```

### مثال خروجی با خطا:

```
❌ خطا در ارسال!

⚠️ جزئیات خطا:
{
  "success": false,
  "error": "Authentication failed",
  "details": "Invalid username or password"
}

❌ پیام خطا: Authentication failed
📋 جزئیات: Invalid username or password

💡 راهنمایی:
- مطمئن شوید سرور در حال اجراست
- اتصال اینترنت خود را بررسی کنید
- تنظیمات فایروال را چک کنید
```

---

## 📊 مقایسه نام‌گذاری‌ها / Naming Comparison

| قبل (قدیمی) | بعد (جدید) | کاربرد |
|-------------|------------|--------|
| RMTO | Traffic System | کد و API |
| رهسام | سامانه تردد شماری | UI فارسی |
| Rahs | Traffic Counting System | UI انگلیسی |
| - | نوآوران جنوب شرق | نام شرکت |

### نمونه‌های تغییر:

**UI (فارسی):**
```
قبل: تست ارسال به رهسام
بعد: تست ارسال به سامانه تردد شماری
```

**UI (انگلیسی):**
```
قبل: RMTO Integration
بعد: Traffic Counting System Integration
```

**کد:**
```javascript
// Log messages
قبل: console.log("[RMTO] Sending...");
بعد: console.log("[Traffic System] Sending...");

// API endpoints (جدید، قدیمی هم کار می‌کند)
جدید: /api/traffic-system/test-add5
قدیمی: /api/rmto/test-add5 (همچنان کار می‌کند)
```

**فایل‌ها:**
```
قدیمی: test-rmto.html
جدید: test-traffic-system.html
نکته: هر دو نگه داشته می‌شوند
```

---

## 🎯 نحوه استفاده / How to Use

### استفاده از رابط جدید:

```bash
# 1. راه‌اندازی سرور
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
npm start

# 2. باز کردن در مرورگر
http://5.159.49.246:3000/test-traffic-system.html
```

### ویژگی‌های رابط جدید:

**✅ نمایش خروجی کامل:**
- درخواست ارسالی (JSON)
- پاسخ دریافتی (JSON)
- XML کامل SOAP Request
- XML کامل SOAP Response
- خطاها با جزئیات
- راهنمایی‌ها برای رفع خطا

**✅ نمایش بصری:**
- لاگ‌های رنگی (سبز=موفق، قرمز=خطا، آبی=اطلاعات)
- timestamp برای هر لاگ
- scroll خودکار
- دکمه پاک کردن خروجی

**✅ تجربه کاربری بهتر:**
- فرم پیش‌پر شده
- دکمه‌های بزرگ و واضح
- loading indicator
- پیام‌های راهنما

---

## 📋 چک‌لیست تغییرات / Changes Checklist

### فایل‌های جدید:
- [x] test-traffic-system.html (UI با خروجی کامل)
- [x] REBRANDING_GUIDE.md (این فایل)

### نام‌گذاری‌های جدید:
- [x] "سامانه تردد شماری" به جای "رهسام"
- [x] "نوآوران جنوب شرق" به عنوان نام شرکت
- [x] "Traffic Counting System" به جای "RMTO"

### ویژگی‌های جدید:
- [x] نمایش SOAP request XML
- [x] نمایش SOAP response XML
- [x] نمایش خطاها با جزئیات
- [x] لاگ‌گذاری real-time
- [x] UI بهبود یافته

---

## 🔄 سازگاری / Compatibility

**همه کدها و API های قدیمی همچنان کار می‌کنند:**

```javascript
// این همچنان کار می‌کند
var rmto = require('./rmto-client');
rmto.sendAddData5(...);

// endpoint های قدیمی همچنان فعال
POST /api/rmto/test-add5

// فایل‌های قدیمی نگه داشته شده‌اند
test-rmto.html (همچنان موجود)
```

**فقط label ها و UI تغییر کرده‌اند!**

---

## 🎉 نتیجه / Result

### برای کاربر:
- ✅ رابط جدید با نام "سامانه تردد شماری"
- ✅ نمایش کامل خروجی SOAP
- ✅ نمایش خطاها به صورت واضح
- ✅ UI زیبا و حرفه‌ای

### برای توسعه‌دهنده:
- ✅ کدها سازگار
- ✅ API های قدیمی کار می‌کنند
- ✅ نام‌گذاری بهتر
- ✅ خروجی دقیق‌تر

**همه چیز بهبود یافته و سازگار! 🚀**
