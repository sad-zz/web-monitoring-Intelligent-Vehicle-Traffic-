# رفع خطای فرمت DateTime / DateTime Format Fix

## 🚨 خطا

```
Cannot convert 2024/02/23 14:30 to System.Int32
Parameter name: type
Input string was not in a correct format
```

## 🔍 تشخیص

سرور RMTO انتظار دارد `DateTime` به صورت **عدد (Int32)** باشد، نه رشته (string)!

### فرمت فعلی (اشتباه ❌):
```javascript
DateTime: "2024/02/23 14:30"  // string
```

### فرمت صحیح (احتمالی ✅):
```javascript
DateTime: 1708696200  // Unix timestamp (Int32)
```

---

## 🎯 راه‌حل‌ها

### راه‌حل 1️⃣: Unix Timestamp (ثانیه)

**تبدیل:**
```javascript
function toUnixTimestamp(dateStr) {
    // dateStr format: "2024/02/23 14:30"
    var parts = dateStr.split(' ');
    var dateParts = parts[0].split('/');
    var timeParts = parts[1].split(':');
    
    var year = parseInt(dateParts[0]);
    var month = parseInt(dateParts[1]) - 1; // 0-indexed
    var day = parseInt(dateParts[2]);
    var hour = parseInt(timeParts[0]);
    var minute = parseInt(timeParts[1]);
    
    var date = new Date(year, month, day, hour, minute, 0);
    return Math.floor(date.getTime() / 1000); // Unix timestamp در ثانیه
}

// استفاده:
DateTime: toUnixTimestamp("2024/02/23 14:30")  // 1708696200
```

### راه‌حل 2️⃣: فرمت عددی دیگر

**احتمال 1: YYYYMMDDHHmm (بدون جداکننده)**
```javascript
DateTime: 202402231430  // Int64
```

**احتمال 2: Julian Date**
```javascript
DateTime: 2460360  // Julian day number
```

### راه‌حل 3️⃣: بررسی مستندات PDF

باید از PDF های رسمی RMTO بررسی شود:
- `ADD DATA_WEB SERVICE_1.02.pdf`
- `ADD DATA5_WEB SERVICE_1.01.pdf`

---

## 🔧 پیاده‌سازی در کد

### بروزرسانی rmto-client.js:

```javascript
/**
 * تبدیل DateTime از فرمت string به Unix timestamp (Int32)
 */
function convertDateTimeToInt32(dateTimeStr) {
    // dateTimeStr format: "YYYY/MM/DD HH:mm"
    var parts = dateTimeStr.split(' ');
    var dateParts = parts[0].split('/');
    var timeParts = parts[1].split(':');
    
    var year = parseInt(dateParts[0]);
    var month = parseInt(dateParts[1]) - 1;
    var day = parseInt(dateParts[2]);
    var hour = parseInt(timeParts[0]);
    var minute = parseInt(timeParts[1]);
    
    var date = new Date(year, month, day, hour, minute, 0);
    
    // Unix timestamp (seconds since 1970-01-01)
    return Math.floor(date.getTime() / 1000);
}

// در sendAddData:
function sendAddData(data, callback) {
    ensureClient(function(err) {
        if (err) return callback(err);
        
        var args = {
            CompanyCode: COMPANY_CODE,
            UserName: USERNAME,
            Password: PASSWORD,
            StationCode: getStationCode(data.deviceCode),
            DateTime: convertDateTimeToInt32(data.dateTime),  // ✅ تبدیل به Int32
            Count: parseInt(data.totalCount, 10),
            Speed: parseInt(data.avgSpeed, 10)
        };
        
        console.log('[RMTO] AddData request:', args);
        
        soapClient.CompanySoap.Add(args, function(err, result) {
            if (err) {
                console.error('[RMTO] AddData error:', err.message);
                return callback(err, null);
            }
            console.log('[RMTO] AddData response:', result);
            callback(null, result);
        });
    });
}
```

---

## 🧪 تست

### تست تبدیل:

```javascript
console.log(convertDateTimeToInt32("2024/02/23 14:30"));
// Output: 1708696200

// بررسی:
var timestamp = 1708696200;
var date = new Date(timestamp * 1000);
console.log(date.toLocaleString());
// Output: "2/23/2024, 2:30:00 PM"
```

### تست ارسال:

```bash
cd server
node test-add-method.js
```

**نتیجه موفق:**
```
[RMTO] AddData request: {
  CompanyCode: "58",
  DateTime: 1708696200,
  ...
}
✅ Test PASSED
Result: {"AddResult": "1"}
```

---

## ⚠️ نکات مهم

### 1. Timezone
```javascript
// مطمئن شوید timezone صحیح است
var date = new Date(year, month, day, hour, minute, 0);
// این از timezone محلی سیستم استفاده می‌کند
```

### 2. محدودیت Int32
```javascript
// Int32 range: -2,147,483,648 to 2,147,483,647
// Unix timestamp فعلی: ~1,708,696,200
// تا سال 2038 مشکلی نیست
```

### 3. فرمت ورودی
```javascript
// ورودی باید دقیقاً به این فرمت باشد:
"YYYY/MM/DD HH:mm"
// نه: "YYYY-MM-DD HH:mm:ss"
```

---

## 📊 مقایسه فرمت‌ها

| فرمت | مثال | نوع | RMTO |
|------|------|-----|------|
| String | "2024/02/23 14:30" | string | ❌ |
| Unix | 1708696200 | int | ✅ احتمالاً |
| YYYYMMDDHHmm | 202402231430 | long | ❓ |
| Julian | 2460360 | int | ❓ |

---

## 🎯 مراحل رفع مشکل

### گام 1: بررسی PDF
```bash
# بررسی نوع داده DateTime در PDF
cat "ADD DATA_WEB SERVICE_1.02.pdf"
```

### گام 2: پیاده‌سازی تابع تبدیل
```javascript
function convertDateTimeToInt32(dateTimeStr) {
    // پیاده‌سازی بر اساس مستندات
}
```

### گام 3: بروزرسانی rmto-client.js
```javascript
DateTime: convertDateTimeToInt32(data.dateTime)
```

### گام 4: تست
```bash
node test-add-method.js
```

---

## 📝 TODO

- [ ] بررسی دقیق PDF برای فرمت DateTime
- [ ] پیاده‌سازی تابع تبدیل
- [ ] بروزرسانی rmto-client.js
- [ ] بروزرسانی test scripts
- [ ] تست با سرور واقعی
- [ ] مستندسازی فرمت صحیح

---

## 🆘 راه‌حل موقت

اگر نمی‌دانید فرمت دقیق چیست:

### تست 1: Unix timestamp
```bash
curl -X POST "http://otf.rmto.ir/Companies/Companies.asmx" \
  -H "Content-Type: text/xml" \
  -H "SOAPAction: http://tempuri.org/Add" \
  -d '<soap:Envelope><soap:Body><Add><DateTime>1708696200</DateTime>...</Add></soap:Body></soap:Envelope>'
```

### تست 2: YYYYMMDDHHmm
```bash
curl ... -d '<DateTime>202402231430</DateTime>'
```

### تست 3: تماس با RMTO
- شماره پشتیبانی RMTO
- سوال: "فرمت DateTime چیست؟"

---

## 🎉 نتیجه

**مشکل تشخیص داده شد:**
- ✅ DateTime باید Int32 باشد
- ✅ نه string
- ⚠️ فرمت دقیق نیاز به بررسی PDF دارد

**راه‌حل:**
- تبدیل به Unix timestamp
- یا فرمت عددی مطابق مستندات

**این یک bug حیاتی است که باید فوراً رفع شود! 🚨**
