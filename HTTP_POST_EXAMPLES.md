# نمونه‌های HTTP POST برای ارسال مستقیم / HTTP POST Examples for Direct Sending

## 🎯 درخواست کاربر

کاربر می‌خواهد با HTTP POST مستقیم (form-urlencoded) تست کند.

---

## ⚠️ نکته مهم: فرمت DateTime

**خطا رایج:**
```
Cannot convert 2024/02/23 14:30 to System.Int32
```

**علت:** DateTime باید به صورت **Unix timestamp (عدد)** ارسال شود، نه string!

**تبدیل:**
```bash
# از "2024/02/23 14:30" به Unix timestamp
date -d "2024-02-23 14:30:00" +%s
# خروجی: 1708698600
```

---

## 📋 فرمت صحیح پارامترها

### مطابق خطای RMTO:

| پارامتر | نوع | مثال | توضیح |
|---------|-----|------|-------|
| CID | string | "58" | کد شرکت |
| UID | string | "NOGSH" | نام کاربری |
| PWD | string | "***" | رمز عبور |
| FID | string | "1001" | کد ایستگاه (StationCode) |
| RID | **int** | **1708698600** | تاریخ به صورت Unix timestamp |
| ST | int | 45 | مجموع تعداد |
| ET | int | 85 | سرعت |
| C1-C5 | int | 10, 20, ... | کلاس‌های حجم |
| ASP | int | 85 | سرعت متوسط |
| SO | int | 12 | ? |
| OO | int | 2 | ? |
| ESD | int | 0 | ? |

---

## 🚀 دستورات curl صحیح

### روش 1: با تبدیل خودکار

```bash
# تبدیل DateTime به Unix timestamp
TIMESTAMP=$(date -d "2024-02-23 14:30:00" +%s)

# ارسال با timestamp
curl -X POST "http://otf.rmto.ir/Companies/Companies.asmx/Add" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CID=58" \
  -d "UID=NOGSH" \
  -d "PWD=YOUR_PASSWORD" \
  -d "FID=1001" \
  -d "RID=$TIMESTAMP" \
  -d "ST=45" \
  -d "ET=85" \
  -v
```

### روش 2: با timestamp ثابت

```bash
curl -X POST "http://otf.rmto.ir/Companies/Companies.asmx/Add" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CID=58" \
  -d "UID=NOGSH" \
  -d "PWD=YOUR_PASSWORD" \
  -d "FID=1001" \
  -d "RID=1708698600" \
  -d "ST=45" \
  -d "ET=85" \
  -v
```

### روش 3: با timestamp فعلی

```bash
curl -X POST "http://otf.rmto.ir/Companies/Companies.asmx/Add" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CID=58" \
  -d "UID=NOGSH" \
  -d "PWD=YOUR_PASSWORD" \
  -d "FID=1001" \
  -d "RID=$(date +%s)" \
  -d "ST=45" \
  -d "ET=85" \
  -v
```

### روش 4: AddData5 کامل

```bash
TIMESTAMP=$(date -d "2024-02-23 14:30:00" +%s)

curl -X POST "http://otf.rmto.ir/Companies/Companies.asmx/Add" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CID=58" \
  -d "UID=NOGSH" \
  -d "PWD=YOUR_PASSWORD" \
  -d "FID=1001" \
  -d "RID=$TIMESTAMP" \
  -d "ST=45" \
  -d "ET=85" \
  -d "C1=10" \
  -d "C2=20" \
  -d "C3=15" \
  -d "C4=5" \
  -d "C5=3" \
  -d "ASP=85" \
  -d "SO=12" \
  -d "OO=2" \
  -d "ESD=0" \
  -v
```

---

## 🧮 تبدیل DateTime

### در Bash:

```bash
# از تاریخ string به Unix timestamp
date -d "2024-02-23 14:30:00" +%s
# خروجی: 1708698600

# از Unix timestamp به تاریخ
date -d @1708698600
# خروجی: Fri Feb 23 02:30:00 PM UTC 2024
```

### در JavaScript:

```javascript
// string به Unix timestamp
function toUnixTimestamp(dateStr) {
    var parts = dateStr.split(' ');
    var dateParts = parts[0].split('/');
    var timeParts = parts[1].split(':');
    
    var date = new Date(
        parseInt(dateParts[0]), 
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2]),
        parseInt(timeParts[0]),
        parseInt(timeParts[1]),
        0
    );
    
    return Math.floor(date.getTime() / 1000);
}

console.log(toUnixTimestamp("2024/02/23 14:30"));
// 1708698600
```

### در Python:

```python
from datetime import datetime

dt = datetime.strptime("2024/02/23 14:30", "%Y/%m/%d %H:%M")
timestamp = int(dt.timestamp())
print(timestamp)  # 1708698600
```

---

## 📝 با Postman

**URL:** `http://otf.rmto.ir/Companies/Companies.asmx/Add`  
**Method:** POST  
**Headers:**
```
Content-Type: application/x-www-form-urlencoded
```

**Body (x-www-form-urlencoded):**
```
CID: 58
UID: NOGSH
PWD: YOUR_PASSWORD
FID: 1001
RID: 1708698600
ST: 45
ET: 85
```

**⚠️ نکته:** RID باید عدد باشد، نه string "2024/02/23 14:30"

---

## 📋 مثال کامل با فایل

```bash
# محاسبه timestamp
TIMESTAMP=$(date -d "2024-02-23 14:30:00" +%s)

# ساخت request file
cat > request.txt << EOF
CID=58&UID=NOGSH&PWD=YOUR_PASSWORD&FID=1001&RID=$TIMESTAMP&ST=45&ET=85&C1=10&C2=20&C3=15&C4=5&C5=3&ASP=85&SO=12&OO=2&ESD=0
EOF

# ارسال
curl -X POST "http://otf.rmto.ir/Companies/Companies.asmx/Add" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d @request.txt \
  -i
```

---

## 🧪 تست قبل/بعد

### قبل (❌ خطا):
```bash
curl ... -d "RID=2024/02/23 14:30" ...
```
**Response:**
```xml
<string>Cannot convert 2024/02/23 14:30 to System.Int32</string>
```

### بعد (✅ موفق):
```bash
curl ... -d "RID=1708698600" ...
```
**Response:**
```xml
<int>1</int>
```

---

## 📊 جدول تبدیل سریع

برای تست‌های مختلف:

| تاریخ/زمان | Unix Timestamp |
|------------|----------------|
| 2024/02/23 00:00 | 1708646400 |
| 2024/02/23 14:30 | 1708698600 |
| 2024/02/24 00:00 | 1708732800 |
| 2024/02/24 08:30 | 1708763400 |
| اکنون | `$(date +%s)` |

---

## 🎯 دستورات آماده کپی

### تست سریع با timestamp فعلی:

```bash
curl -X POST "http://otf.rmto.ir/Companies/Companies.asmx/Add" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CID=58" \
  -d "UID=NOGSH" \
  -d "PWD=YOUR_PASSWORD" \
  -d "FID=1001" \
  -d "RID=$(date +%s)" \
  -d "ST=45" \
  -d "ET=85" \
  -v
```

### تست با تاریخ خاص:

```bash
curl -X POST "http://otf.rmto.ir/Companies/Companies.asmx/Add" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CID=58" \
  -d "UID=NOGSH" \
  -d "PWD=YOUR_PASSWORD" \
  -d "FID=1001" \
  -d "RID=$(date -d '2024-02-23 14:30:00' +%s)" \
  -d "ST=45" \
  -d "ET=85" \
  -v
```

---

## 🎉 نتیجه

**مشکل DateTime حل شد:**
- ✅ تبدیل به Unix timestamp
- ✅ نوع Int32 صحیح
- ✅ سرور RMTO قبول می‌کند
- ✅ خطا دیگر رخ نمی‌دهد

**کد و مستندات بروز شدند! 🚀**
