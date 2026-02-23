# کپی دستی فایل‌ها / Manual File Copy

## 🚨 مشکل / Problem
فایل GET_NEW_FILES.sh خطای 404 می‌دهد.
GET_NEW_FILES.sh gives 404 error.

## ✅ راه‌حل ساده / Simple Solution

این دستورات را **یکی یکی** کپی و اجرا کنید:
Copy and run these commands **one by one**:

---

## 🚀 دستورات / Commands

### گام 0: رفتن به پروژه
```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-
```

### گام 1: دانلود test-rmto.js (تست Add5)
```bash
cd server
curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/test-rmto.js
cd ..
```

### گام 2: دانلود test-add-method.js (تست Add)
```bash
cd server
curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/test-add-method.js
cd ..
```

### گام 3: دانلود rmto-client.js (کد بهبود یافته)
```bash
cd server
curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/rmto-client.js
cd ..
```

### گام 4: دانلود test-rmto.html (رابط وب)
```bash
curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/test-rmto.html
```

---

## ✅ بررسی دانلود موفق / Check Download Success

```bash
ls -lh server/test-*.js server/rmto-client.js test-rmto.html
```

**انتظار / Expected:**
- test-rmto.js → حدود 4KB
- test-add-method.js → حدود 2KB  
- rmto-client.js → حدود 6KB
- test-rmto.html → حدود 8KB

---

## 🧪 اجرای تست / Run Test

```bash
cd server
node test-add-method.js
```

**نتیجه موفق / Success Result:**
```
✅ Test PASSED
Result: {"AddDataResult": "1"}
```

**نتیجه خطا / Error Result:**
```
❌ Test FAILED
Error: Authentication failed
```
→ بررسی .env (Check .env file)

---

## 📋 یک خط کامل / One Complete Line

اگر می‌خواهید همه را یکجا اجرا کنید:
If you want to run everything at once:

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic- && cd server && curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/test-rmto.js && curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/test-add-method.js && curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/rmto-client.js && cd .. && curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/test-rmto.html && ls -lh server/test-*.js
```

---

## 🎯 فایل‌های دانلود شده / Downloaded Files

1. **server/test-rmto.js** - تست AddData5 (5 کلاس)
2. **server/test-add-method.js** 🆕 - تست AddData (ساده)
3. **server/rmto-client.js** - کد RMTO بهبود یافته
4. **test-rmto.html** - رابط وب برای تست

---

## 🔍 عیب‌یابی / Troubleshooting

### خطا: 404 Not Found
```bash
# بررسی اتصال اینترنت
curl -I https://raw.githubusercontent.com

# یا استفاده از wget
wget https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/test-rmto.js
```

### خطا: Cannot find module
```bash
# نصب وابستگی‌ها
cd server
npm install
```

### خطا: Authentication failed
```bash
# بررسی .env
cd server
cat .env
# باید شامل:
# RMTO_USERNAME=NOGSH
# RMTO_PASSWORD=...
```

---

## 🎉 تمام!

حالا می‌توانید تست کنید:
Now you can test:

```bash
cd server
node test-add-method.js
```

یا از رابط وب:
Or use web interface:

```bash
npm start
# Then open: http://SERVER_IP:3000/test-rmto.html
```
