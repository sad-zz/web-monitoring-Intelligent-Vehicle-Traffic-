# 📥 راهنمای کپی دستی فایل test-rmto.js

## مشکل / Problem

فایل `test-rmto.js` روی سرور شما وجود ندارد.
The `test-rmto.js` file doesn't exist on your server.

---

## 🎯 روش 1: دانلود مستقیم با curl یا wget (آسان‌ترین!)

### با curl:

```bash
# رفتن به دایرکتوری server
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server

# دانلود فایل
curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/main/server/test-rmto.js

# بررسی فایل دانلود شد
ls -lh test-rmto.js

# اجرای تست
node test-rmto.js
```

### با wget:

```bash
# رفتن به دایرکتوری server
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server

# دانلود فایل
wget https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/main/server/test-rmto.js

# بررسی فایل دانلود شد
ls -lh test-rmto.js

# اجرای تست
node test-rmto.js
```

---

## 🎯 روش 2: کپی-پیست دستی محتوای فایل

اگر curl و wget کار نکردند، محتوای فایل را به صورت دستی کپی کنید:

### گام 1: ساخت فایل خالی

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
nano test-rmto.js
```

### گام 2: کپی کردن محتوا

در ویرایشگر nano، این محتوا را کپی-پیست کنید:

```javascript
/**
 * RMTO SOAP Test Utility
 * Tests connection and API calls to RMTO service
 * 
 * Usage: node test-rmto.js
 */

require("dotenv").config();
var soap = require("soap");

var WSDL_URL = process.env.RMTO_WSDL || "http://otf.rmto.ir/Companies/Companies.asmx?WSDL";
var COMPANY_CODE = process.env.RMTO_COMPANY_CODE || "58";
var USERNAME = process.env.RMTO_USERNAME || "";
var PASSWORD = process.env.RMTO_PASSWORD || "";

console.log("=".repeat(60));
console.log("RMTO SOAP Service Test");
console.log("=".repeat(60));
console.log("WSDL URL:", WSDL_URL);
console.log("Company Code:", COMPANY_CODE);
console.log("Username:", USERNAME);
console.log("Password:", PASSWORD ? "***" : "(empty)");
console.log("");

// Step 1: Create SOAP client
console.log("[1] Creating SOAP client...");
soap.createClient(WSDL_URL, { 
    wsdl_options: {
        timeout: 30000,
        rejectUnauthorized: false
    }
}, function (err, client) {
    if (err) {
        console.error("[ERROR] Failed to create SOAP client:");
        console.error("  Message:", err.message);
        console.error("  Code:", err.code);
        console.error("  Stack:", err.stack);
        process.exit(1);
    }

    console.log("[OK] SOAP client created successfully");
    console.log("");

    // Step 2: Inspect WSDL structure
    console.log("[2] WSDL Structure:");
    var description = client.describe();
    console.log(JSON.stringify(description, null, 2));
    console.log("");

    // Step 3: Test Add5 method
    console.log("[3] Testing AddData5 method...");
    
    // Sample test data
    var testData = {
        CompanyCode: COMPANY_CODE,
        UserName: USERNAME,
        Password: PASSWORD,
        StationCode: "1001", // Test device code
        DateTime: "2024/02/22 12:00", // Format: YYYY/MM/DD HH:mm
        C1: 10, // Class 1 count
        C2: 20, // Class 2 count
        C3: 15, // Class 3 count
        C4: 5,  // Class 4 count
        C5: 3,  // Class 5 count
        S1: 12, // Speed range 1
        S2: 18, // Speed range 2
        S3: 15, // Speed range 3
        S4: 8,  // Speed range 4
        S5: 0,  // Speed range 5
        Violation: 2, // Violations count
        Speed: 85 // Average speed
    };

    console.log("Test parameters:");
    console.log(JSON.stringify(testData, null, 2));
    console.log("");

    // Check if method exists
    if (!client.AddData5) {
        console.error("[ERROR] AddData5 method not found in WSDL");
        console.log("Available methods:", Object.keys(client));
        process.exit(1);
    }

    // Make the call
    client.AddData5(testData, function (err, result, rawResponse, soapHeader, rawRequest) {
        console.log("");
        console.log("=".repeat(60));
        console.log("SOAP Request (Raw XML):");
        console.log("=".repeat(60));
        console.log(rawRequest);
        console.log("");

        if (err) {
            console.log("=".repeat(60));
            console.log("ERROR Response:");
            console.log("=".repeat(60));
            console.error("Message:", err.message);
            console.error("Code:", err.code);
            
            if (err.response) {
                console.error("HTTP Status:", err.response.statusCode);
                console.error("Response Body:", err.response.body);
            }
            
            if (err.root && err.root.Envelope) {
                console.log("SOAP Fault:", JSON.stringify(err.root.Envelope.Body.Fault, null, 2));
            }
            
            console.log("");
            console.log("Full error object:");
            console.log(JSON.stringify(err, null, 2));
            process.exit(1);
        }

        console.log("=".repeat(60));
        console.log("SUCCESS Response:");
        console.log("=".repeat(60));
        console.log("Result:", JSON.stringify(result, null, 2));
        console.log("");
        console.log("Raw Response:");
        console.log(rawResponse);
        console.log("");
        console.log("[OK] AddData5 test completed successfully!");
        process.exit(0);
    });
});
```

### گام 3: ذخیره فایل

در nano:
- `Ctrl+X` برای خروج
- `Y` برای تأیید ذخیره
- `Enter` برای تأیید نام فایل

### گام 4: بررسی و اجرا

```bash
# بررسی فایل ساخته شد
ls -lh test-rmto.js

# اجرای تست
node test-rmto.js
```

---

## 🎯 روش 3: استفاده از SCP یا SFTP

اگر فایل را روی کامپیوتر خود دارید:

### با SCP:

```bash
# از کامپیوتر خود:
scp test-rmto.js root@5.159.49.246:/opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server/

# سپس روی سرور:
ssh root@5.159.49.246
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
node test-rmto.js
```

### با SFTP:

```bash
# از کامپیوتر خود:
sftp root@5.159.49.246
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server/
put test-rmto.js
quit

# سپس روی سرور:
ssh root@5.159.49.246
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
node test-rmto.js
```

---

## 🎯 روش 4: Clone مجدد فقط این فایل

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server

# دانلود تنها این فایل از GitHub
git fetch origin
git checkout origin/main -- server/test-rmto.js

# یا:
git pull origin main

# بررسی
ls -lh test-rmto.js
node test-rmto.js
```

---

## ✅ بعد از کپی فایل

### 1. مطمئن شوید وابستگی‌ها نصب هستند:

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
npm install
```

### 2. مطمئن شوید .env تنظیم شده:

```bash
# بررسی .env وجود دارد
ls -la .env

# اگر ندارید:
cp .env.example .env
nano .env

# رمز عبور RMTO را در خط RMTO_PASSWORD وارد کنید
```

### 3. اجرای تست:

```bash
node test-rmto.js
```

---

## 🆘 خطاهای رایج

### خطا: Cannot find module 'soap'

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
npm install
```

### خطا: Cannot find module 'dotenv'

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
npm install
```

### خطا: .env not found

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
cp .env.example .env
nano .env
```

### خطا: Connection refused

مشکل شبکه - بررسی کنید:
```bash
curl -I http://otf.rmto.ir/Companies/Companies.asmx?WSDL
```

---

## 📋 خلاصه دستورات (کپی-پیست کامل)

```bash
# روش آسان - دانلود با curl
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/main/server/test-rmto.js
npm install
node test-rmto.js

# اگر .env ندارید:
cp .env.example .env
nano .env  # رمز عبور را وارد کنید
node test-rmto.js
```

---

**موفق باشید! 🚀**
