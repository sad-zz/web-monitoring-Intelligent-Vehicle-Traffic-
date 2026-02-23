# راهنمای عیب‌یابی - Troubleshooting Guide

## 🚨 خطای رایج: Cannot find module

### مشکل

```bash
root@srv:~# node test-rmto.js
Error: Cannot find module '/root/test-rmto.js'
```

### علت
شما در دایرکتوری اشتباه هستید! فایل `test-rmto.js` در دایرکتوری `/root/` نیست، بلکه در دایرکتوری پروژه است.

### راه حل

#### گام 1: پیدا کردن دایرکتوری پروژه

```bash
# روش 1: جستجو با نام فایل اسکریپت
find ~ -name "test-rmto-quick.sh" -type f 2>/dev/null

# روش 2: جستجو با نام دایرکتوری
find ~ -name "web-monitoring-Intelligent-Vehicle-Traffic-" -type d 2>/dev/null

# روش 3: جستجو در مسیرهای رایج
ls -d ~/web-monitoring-Intelligent-Vehicle-Traffic- 2>/dev/null
ls -d ~/projects/web-monitoring-Intelligent-Vehicle-Traffic- 2>/dev/null
ls -d /var/www/web-monitoring-Intelligent-Vehicle-Traffic- 2>/dev/null

# روش 4: اگر با git clone کرده‌اید، معمولاً در home است
cd ~/web-monitoring-Intelligent-Vehicle-Traffic-
```

#### گام 2: رفتن به دایرکتوری پروژه

```bash
# فرض کنید در گام 1 این مسیر را پیدا کردید:
# /home/username/web-monitoring-Intelligent-Vehicle-Traffic-/test-rmto-quick.sh

# دایرکتوری بدون نام فایل:
cd /home/username/web-monitoring-Intelligent-Vehicle-Traffic-

# یا اگر در home directory است:
cd ~/web-monitoring-Intelligent-Vehicle-Traffic-

# بررسی کنید که در دایرکتوری درست هستید
pwd
# خروجی باید شامل: web-monitoring-Intelligent-Vehicle-Traffic-

# لیست فایل‌ها
ls -la
# باید ببینید: server/, test-rmto.html, test-rmto-quick.sh
```

#### گام 3: اجرای اسکریپت تست

```bash
# روش آسان: استفاده از اسکریپت quick
./test-rmto-quick.sh

# یا روش دستی:
cd server
node test-rmto.js
```

---

## 🚨 خطای رایج: .env.example not found

### مشکل

```bash
root@srv:~# cp .env.example .env
cp: cannot stat '.env.example': No such file or directory
```

### علت
- شما در دایرکتوری اشتباه هستید
- فایل `.env.example` در دایرکتوری `server/` است، نه در root

### راه حل

```bash
# گام 1: پیدا کردن و رفتن به دایرکتوری پروژه
# روش 1:
cd ~/web-monitoring-Intelligent-Vehicle-Traffic-

# یا روش 2: پیدا کردن با find
find ~ -name "web-monitoring-Intelligent-Vehicle-Traffic-" -type d 2>/dev/null
# سپس cd به مسیر پیدا شده

# گام 2: به دایرکتوری server بروید
cd server

# گام 3: بررسی کنید که فایل وجود دارد
ls -la .env.example
# باید ببینید: -rw-r--r-- ... .env.example

# گام 4: کپی کردن
cp .env.example .env

# یا استفاده از اسکریپت quick که همه چیز را خودکار انجام می‌دهد:
cd ~/web-monitoring-Intelligent-Vehicle-Traffic-
./test-rmto-quick.sh
```

---

## 🚨 خطای رایج: Permission Denied

### مشکل

```bash
./test-rmto-quick.sh
-bash: ./test-rmto-quick.sh: Permission denied
```

### راه حل

```bash
# اضافه کردن مجوز اجرا
chmod +x test-rmto-quick.sh

# حالا دوباره امتحان کنید
./test-rmto-quick.sh
```

---

## 🚨 خطای رایج: npm command not found

### مشکل

```bash
npm install
-bash: npm: command not found
```

### راه حل

Node.js نصب نیست. باید ابتدا Node.js را نصب کنید:

#### Ubuntu/Debian:
```bash
# نصب Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# بررسی نصب
node --version
npm --version
```

#### CentOS/RHEL:
```bash
# نصب Node.js 20.x
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# بررسی نصب
node --version
npm --version
```

#### یا استفاده از nvm:
```bash
# نصب nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# فعال کردن nvm (یا logout و login کنید)
source ~/.bashrc

# نصب Node.js
nvm install 20
nvm use 20

# بررسی
node --version
npm --version
```

---

## 🚨 خطای رایج: Cannot connect to RMTO

### مشکل

```
[RMTO] Failed to create SOAP client: connect ECONNREFUSED
```

### راه حل

#### 1. بررسی اتصال اینترنت
```bash
ping 8.8.8.8
```

#### 2. بررسی دسترسی به RMTO
```bash
curl -I http://otf.rmto.ir/Companies/Companies.asmx?WSDL
```

اگر خطای timeout یا connection refused دادید:
- فایروال را بررسی کنید
- اتصال به اینترنت را بررسی کنید
- با تیم شبکه تماس بگیرید

#### 3. بررسی DNS
```bash
nslookup otf.rmto.ir
```

---

## 🚨 خطای رایج: Authentication Failed

### مشکل

```
[RMTO] SOAP Fault: "Authentication failed"
```

### راه حل

#### 1. بررسی فایل .env

```bash
cd server
cat .env | grep RMTO
```

مطمئن شوید که:
- `RMTO_USERNAME` درست است
- `RMTO_PASSWORD` درست است
- فضای خالی اضافی ندارد

#### 2. ویرایش مجدد

```bash
nano .env
```

فرمت صحیح:
```env
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=your_password_here
```

**نه اینطور:**
```env
RMTO_USERNAME = NOGSH    # ❌ فضای خالی اضافی
RMTO_PASSWORD= pass      # ❌
```

---

## 🚨 خطای رایج: Module not found (soap, dotenv, etc.)

### مشکل

```
Error: Cannot find module 'soap'
Error: Cannot find module 'dotenv'
```

### راه حل

وابستگی‌ها نصب نشده‌اند:

```bash
# رفتن به دایرکتوری server
cd /path/to/web-monitoring-Intelligent-Vehicle-Traffic-/server

# نصب وابستگی‌ها
npm install

# اگر خطا داد، پاک کردن و نصب مجدد
rm -rf node_modules package-lock.json
npm install
```

---

## 📋 Checklist برای تست موفق

قبل از اجرای تست، این موارد را بررسی کنید:

- [ ] در دایرکتوری پروژه هستید (نه `/root/`)
- [ ] فایل `server/.env` وجود دارد و رمز عبور صحیح است
- [ ] Node.js نصب است (`node --version`)
- [ ] وابستگی‌ها نصب شده‌اند (`ls server/node_modules`)
- [ ] اتصال اینترنت برقرار است
- [ ] دسترسی به `otf.rmto.ir` وجود دارد

---

## 🆘 اگر هنوز مشکل دارید

### دریافت کمک

1. **لاگ کامل خطا را ذخیره کنید:**
```bash
cd /path/to/web-monitoring-Intelligent-Vehicle-Traffic-
./test-rmto-quick.sh > error_log.txt 2>&1
cat error_log.txt
```

2. **اطلاعات محیط را جمع‌آوری کنید:**
```bash
echo "=== System Info ===" > system_info.txt
uname -a >> system_info.txt
echo "=== Node Version ===" >> system_info.txt
node --version >> system_info.txt
npm --version >> system_info.txt
echo "=== Current Directory ===" >> system_info.txt
pwd >> system_info.txt
echo "=== Files ===" >> system_info.txt
ls -la >> system_info.txt
cat system_info.txt
```

3. **این اطلاعات را با تیم فنی به اشتراک بگذارید**

---

## 📞 منابع کمک

- راهنمای کامل: `server/RMTO_GUIDE.md`
- خلاصه راه‌حل: `RMTO_SOLUTION_SUMMARY.md`
- مستندات پروژه: `README.md`
- راهنمای AI: `CLAUDE.md`
