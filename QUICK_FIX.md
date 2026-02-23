# 🚀 راهنمای سریع برای کاربرانی که خطای "Cannot find module" می‌گیرند

## ❌ مشکلی که شما دارید

```bash
root@srv4702423536:~# cp .env.example .env
cp: cannot stat '.env.example': No such file or directory

root@srv4702423536:~# node test-rmto.js
Error: Cannot find module '/root/test-rmto.js'
```

---

## 🎯 اول: پروژه را پیدا کنید!

### روش 1: جستجو با نام دایرکتوری

```bash
# جستجو در home directory
find ~ -type d -name "*web-monitoring*" 2>/dev/null

# جستجو در /opt (مکان رایج برای پروژه‌ها)
find /opt -type d -name "*web-monitoring*" 2>/dev/null

# جستجو در /var/www
find /var/www -type d -name "*web-monitoring*" 2>/dev/null
```

### روش 2: جستجو با نام فایل مشخص

```bash
# جستجو برای index.html خاص این پروژه
find / -name "index.html" -path "*/web-monitoring-Intelligent-Vehicle-Traffic-/*" 2>/dev/null | head -5

# جستجو برای فایل server
find / -type d -name "server" -path "*/web-monitoring-Intelligent-Vehicle-Traffic-/*" 2>/dev/null
```

### روش 3: بررسی مکان‌های رایج

```bash
# مکان‌های رایج در سرورهای لینوکس
ls -la /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/
ls -la /opt/web-monitoring-Intelligent-Vehicle-Traffic-/
ls -la ~/web-monitoring-Intelligent-Vehicle-Traffic-/
ls -la /var/www/web-monitoring-Intelligent-Vehicle-Traffic-/
```

**مثال خروجی موفق:**
```bash
root@srv:/opt# ls -la /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/
drwxr-xr-x ... server/
-rw-r--r-- ... index.html
drwxr-xr-x ... css/
drwxr-xr-x ... js/
```

**✅ پیدا شد! مسیر شما:** `/opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/`

---

## ✅ راه حل در 3 گام ساده

### گام 1️⃣: رفتن به دایرکتوری پروژه

**استفاده از مسیر واقعی که پیدا کردید:**

```bash
# مثال: اگر پروژه در /opt/tc-manager است
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-

# بررسی که در جای درست هستید
pwd
ls -la

# باید ببینید:
# drwxr-xr-x ... server/
# -rw-r--r-- ... index.html
```

### گام 2️⃣: بررسی اسکریپت quick وجود دارد؟

```bash
# بررسی وجود اسکریپت
ls -la test-rmto-quick.sh
```

**اگر وجود دارد:**
```bash
./test-rmto-quick.sh
# همین! اسکریپت همه کار را انجام می‌دهد
```

**اگر وجود ندارد (نسخه قدیمی):**
به گام 3 بروید ⬇️

### گام 3️⃣: روش دستی (برای نسخه‌های بدون اسکریپت)

```bash
# A. رفتن به دایرکتوری server
cd server

# B. بررسی Node.js نصب است
node --version
# باید نسخه‌ای مثل v20.x.x ببینید

# C. نصب وابستگی‌ها (اگر node_modules ندارید)
npm install

# D. تنظیم .env
ls -la .env

# اگر .env ندارید:
cp .env.example .env
nano .env
# رمز عبور RMTO را در خط RMTO_PASSWORD وارد کنید
# Ctrl+X → Y → Enter برای ذخیره

# E. تست اتصال
# اگر test-rmto.js دارید:
node test-rmto.js

# اگر test-rmto.js ندارید:
# مستقیماً سرور را راه‌اندازی کنید:
npm start
# بروید به: http://YOUR_SERVER_IP:3000/test-rmto.html
```

---

## 🎯 روش جایگزین: Clone مجدد در مسیر مشخص

اگر نمی‌توانید پروژه را پیدا کنید، دوباره clone کنید:

```bash
# گام 1: رفتن به home directory
cd ~

# گام 2: Clone پروژه
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git

# گام 3: رفتن به پروژه
cd web-monitoring-Intelligent-Vehicle-Traffic-

# گام 4: بررسی که در جای درست هستید
pwd
# خروجی: /home/username/web-monitoring-Intelligent-Vehicle-Traffic-

# گام 5: اجرای تست
./test-rmto-quick.sh
```

---

## 🚨 خطاهای رایج

### خطا 1: استفاده از placeholder

```bash
# ❌ اشتباه
cd /path/to/web-monitoring-Intelligent-Vehicle-Traffic-
# خطا: No such file or directory

# توضیح: /path/to/ یک placeholder است!
# شما باید آن را با مسیر واقعی جایگزین کنید
```

### خطا 2: فراموش کردن مسیر

```bash
# ❌ اشتباه - فرض نکنید پروژه در مسیر فعلی است
./test-rmto-quick.sh
# خطا: No such file or directory

# ✅ صحیح - ابتدا به دایرکتوری پروژه بروید
cd ~/web-monitoring-Intelligent-Vehicle-Traffic-
./test-rmto-quick.sh
```

---

## 📋 Checklist برای اجرای موفق

- [ ] با `find` مسیر واقعی پروژه را پیدا کردم
- [ ] با `cd` به دایرکتوری پروژه رفتم (نه placeholder!)
- [ ] با `pwd` مطمئن شدم در جای درست هستم
- [ ] با `ls -la` فایل `test-rmto-quick.sh` را دیدم
- [ ] اسکریپت را اجرا کردم: `./test-rmto-quick.sh`

---

## 🆘 هنوز مشکل دارید؟

### اگر پروژه را پیدا نکردید:

```bash
# این دستور تمام دایرکتوری‌هایی که نام آن‌ها شامل "monitoring" است را پیدا می‌کند
find ~ -type d -iname "*monitoring*" 2>/dev/null

# یا جستجوی گسترده‌تر
find / -type d -iname "*web-monitoring*" 2>/dev/null | head -10
```

### اگر Git ندارید:

```bash
# نصب Git
apt-get update && apt-get install -y git     # Ubuntu/Debian
yum install -y git                           # CentOS/RHEL
```

---

## 📞 کمک بیشتر

اگر هنوز مشکل دارید، این فایل‌ها را بخوانید:
- `TROUBLESHOOTING.md` - راهنمای کامل عیب‌یابی
- `RMTO_SOLUTION_SUMMARY.md` - خلاصه راه‌حل

**موفق باشید! 🎉**

---

## 🎯 چرا این مشکل پیش آمد؟

شما در دایرکتوری `/root/` (خانه) بودید:
```bash
root@srv:~#        # این ~ یعنی /root/
```

اما فایل‌های پروژه در دایرکتوری دیگری هستند:
```
/home/user/web-monitoring-Intelligent-Vehicle-Traffic-/
                                                      ↑
                                    دایرکتوری پروژه
```

---

## 📋 نکات مهم

### ✅ این‌ها را بکنید:
```bash
# ✅ ابتدا به دایرکتوری پروژه بروید
cd /path/to/web-monitoring-Intelligent-Vehicle-Traffic-

# ✅ سپس اسکریپت را اجرا کنید
./test-rmto-quick.sh
```

### ❌ این‌ها را نکنید:
```bash
# ❌ مستقیم از home directory
~$ ./test-rmto-quick.sh
-bash: ./test-rmto-quick.sh: No such file or directory

# ❌ مستقیم از /root/
root@srv:~# node test-rmto.js
Error: Cannot find module '/root/test-rmto.js'
```

---

## 🆘 هنوز مشکل دارید؟

### گزینه 1: پیدا کردن دایرکتوری پروژه

```bash
# این دستور را اجرا کنید (ممکن است چند دقیقه طول بکشد)
find / -name "test-rmto-quick.sh" 2>/dev/null

# مسیر فایل را پیدا می‌کند، مثلاً:
# /home/user/projects/web-monitoring-Intelligent-Vehicle-Traffic-/test-rmto-quick.sh

# حالا به دایرکتوری آن بروید (بدون نام فایل):
cd /home/user/projects/web-monitoring-Intelligent-Vehicle-Traffic-
```

### گزینه 2: دانلود مجدد پروژه

```bash
# رفتن به یک دایرکتوری مشخص
cd ~

# دانلود پروژه
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git

# رفتن به دایرکتوری پروژه
cd web-monitoring-Intelligent-Vehicle-Traffic-

# اجرای اسکریپت
./test-rmto-quick.sh
```

### گزینه 3: روش دستی کامل

```bash
# 1. رفتن به دایرکتوری پروژه
cd /path/to/web-monitoring-Intelligent-Vehicle-Traffic-

# 2. رفتن به server
cd server

# 3. ساخت .env
cp .env.example .env

# 4. ویرایش .env
nano .env
# در خط RMTO_PASSWORD رمز عبور خود را بنویسید
# ذخیره: Ctrl+X → Y → Enter

# 5. نصب وابستگی‌ها
npm install

# 6. اجرای تست
node test-rmto.js
```

---

## 📞 کمک بیشتر

اگر هنوز مشکل دارید، این فایل‌ها را بخوانید:
- `TROUBLESHOOTING.md` - راهنمای کامل عیب‌یابی
- `RMTO_SOLUTION_SUMMARY.md` - خلاصه راه‌حل
- `server/RMTO_GUIDE.md` - مستندات فنی

یا این دستور را اجرا کنید و خروجی را ارسال کنید:
```bash
cd /path/to/web-monitoring-Intelligent-Vehicle-Traffic-
./test-rmto-quick.sh > error_log.txt 2>&1
cat error_log.txt
```

---

**موفق باشید! 🎉**
