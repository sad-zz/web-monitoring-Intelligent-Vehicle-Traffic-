# 🚀 شروع کنید اینجا / START HERE

## شما کجا هستید؟ / Where Are You?

اگر این فایل را می‌بینید، پروژه را پیدا کرده‌اید! 🎉
If you're reading this, you found the project! 🎉

---

## ⚠️ فایل test-rmto.js ندارید؟ / Missing test-rmto.js?

**اگر فایل `test-rmto.js` روی سرور شما نیست:**
**If `test-rmto.js` file doesn't exist on your server:**

👉 **بخوانید: `MANUAL_COPY_INSTRUCTIONS.md`**
👉 **Read: `MANUAL_COPY_INSTRUCTIONS.md`**

```bash
# دانلود سریع فایل / Quick download:
cd server
curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/main/server/test-rmto.js
```

---

## ✅ گام 1: مطمئن شوید در دایرکتوری درست هستید

```bash
# بررسی کنید در کجا هستید
pwd

# باید یکی از این‌ها را ببینید:
# /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-
# /home/user/web-monitoring-Intelligent-Vehicle-Traffic-
# /var/www/web-monitoring-Intelligent-Vehicle-Traffic-

# بررسی که فایل‌های پروژه وجود دارند
ls -la

# باید ببینید:
# server/
# index.html
# css/
# js/
```

---

## 📋 گام 2: انتخاب روش تست

### روش A: با اسکریپت Quick (اگر وجود دارد)

```bash
# بررسی اسکریپت وجود دارد یا نه
ls -la test-rmto-quick.sh

# اگر وجود دارد:
./test-rmto-quick.sh
```

### روش B: دستی (اگر اسکریپت وجود ندارد)

**این روش همیشه کار می‌کند!**

```bash
# گام 1: رفتن به server
cd server

# گام 2: بررسی Node.js نصب است
node --version
npm --version

# اگر نصب نیست:
# curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
# sudo apt-get install -y nodejs

# گام 3: نصب وابستگی‌ها (اگر هنوز نصب نشده)
npm install

# گام 4: تنظیم .env
ls -la .env

# اگر .env ندارید:
cp .env.example .env
nano .env

# در nano:
# - رمز عبور RMTO را در خط RMTO_PASSWORD وارد کنید
# - Ctrl+X → Y → Enter برای ذخیره

# گام 5: تست
node test-rmto.js
```

---

## 🔍 اگر test-rmto.js هم وجود ندارد

پروژه شما نسخه قدیمی است. می‌توانید:

### گزینه 1: دریافت فایل test-rmto.js

```bash
# در دایرکتوری server/
curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/main/server/test-rmto.js

# سپس تست کنید
node test-rmto.js
```

### گزینه 2: استفاده از rmto-client.js مستقیماً

```bash
# در دایرکتوری server/
node
```

سپس در Node REPL:

```javascript
require('dotenv').config();
const rmto = require('./rmto-client');

rmto.initClient(function(err) {
  if (err) {
    console.error('خطا:', err.message);
    process.exit(1);
  }
  
  console.log('✅ اتصال موفق!');
  
  // تست با داده نمونه
  rmto.sendAddData5({
    deviceCode: '1001',
    dateTime: '2024/02/23 10:00',
    class1Count: 10,
    class2Count: 20,
    class3Count: 15,
    class4Count: 5,
    class5Count: 3,
    speed1Count: 12,
    speed2Count: 18,
    speed3Count: 15,
    speed4Count: 8,
    speed5Count: 0,
    violations: 2,
    avgSpeed: 85
  }, function(err, result) {
    if (err) {
      console.error('❌ خطا:', err.message);
    } else {
      console.log('✅ موفق:', result);
    }
    process.exit(0);
  });
});
```

---

## 🌐 راه‌اندازی سرور (برای تست از مرورگر)

```bash
# در دایرکتوری server/
npm start

# سرور روی پورت 3000 اجرا می‌شود
# بروید به: http://SERVER_IP:3000/test-rmto.html
```

---

## 🆘 خطاهای رایج

### خطا: Cannot find module 'soap'

```bash
cd server
npm install
```

### خطا: .env.example not found

```bash
# شما در دایرکتوری اشتباه هستید
# به server برگردید:
cd server
ls -la .env.example
```

### خطا: ECONNREFUSED

مشکل شبکه - بررسی کنید:
```bash
curl http://otf.rmto.ir/Companies/Companies.asmx?WSDL
```

### خطا: Authentication failed

رمز عبور در `.env` اشتباه است:
```bash
nano server/.env
# رمز عبور را اصلاح کنید
```

---

## 📚 مستندات بیشتر / More Documentation

اگر هنوز مشکل دارید:

1. **`MANUAL_COPY_INSTRUCTIONS.md`** ← کپی دستی فایل test-rmto.js
2. **`QUICK_FIX.md`** ← راه حل سریع
3. **`TROUBLESHOOTING.md`** ← عیب‌یابی کامل
4. **`server/RMTO_GUIDE.md`** ← راهنمای فنی RMTO
5. **`PLACEHOLDER_ERROR.txt`** ← درباره placeholder ها

---

## 💡 نکات سریع

```bash
# یافتن مسیر فعلی
pwd

# لیست فایل‌ها
ls -la

# رفتن به server
cd server

# برگشت به دایرکتوری قبل
cd ..

# مشاهده محتوای فایل
cat .env

# ویرایش فایل
nano .env
```

---

## ✨ خلاصه دستورات برای کپی-پیست

```bash
# تست سریع RMTO (اگر همه چیز نصب است)
cd server
node test-rmto.js

# نصب از صفر
cd server
npm install
cp .env.example .env
nano .env  # رمز عبور را وارد کنید
node test-rmto.js

# راه‌اندازی سرور
cd server
npm start
# بروید به: http://YOUR_IP:3000/test-rmto.html
```

---

**موفق باشید! 🚀**
