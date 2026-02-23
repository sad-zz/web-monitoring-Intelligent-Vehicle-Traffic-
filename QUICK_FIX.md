# 🚀 راهنمای سریع برای کاربرانی که خطای "Cannot find module" می‌گیرند

## ❌ مشکلی که شما دارید

```bash
root@srv4702423536:~# cp .env.example .env
cp: cannot stat '.env.example': No such file or directory

root@srv4702423536:~# node test-rmto.js
Error: Cannot find module '/root/test-rmto.js'
```

## ✅ راه حل در 3 گام ساده

### گام 1️⃣: پیدا کردن دایرکتوری پروژه

**⚠️ مهم: مسیر واقعی پروژه را پیدا کنید، نه placeholder!**

```bash
# دستور 1: جستجوی پروژه در home directory شما
find ~ -name "test-rmto-quick.sh" -type f 2>/dev/null

# دستور 2: اگر نتیجه نداد، جستجو در کل سیستم (ممکن است طولانی باشد)
find / -name "test-rmto-quick.sh" -type f 2>/dev/null | head -1

# دستور 3: یا اگر یادتان هست پروژه را در کجا clone کردید:
ls -d ~/web-monitoring-Intelligent-Vehicle-Traffic- 2>/dev/null
ls -d ~/projects/web-monitoring-Intelligent-Vehicle-Traffic- 2>/dev/null
ls -d /var/www/web-monitoring-Intelligent-Vehicle-Traffic- 2>/dev/null
```

**خروجی مثال:**
```
/home/username/web-monitoring-Intelligent-Vehicle-Traffic-/test-rmto-quick.sh
```

**مسیر دایرکتوری بدون نام فایل:**
```
/home/username/web-monitoring-Intelligent-Vehicle-Traffic-
```

### گام 2️⃣: رفتن به دایرکتوری پروژه

**استفاده از مسیر واقعی که در گام 1 پیدا کردید:**

```bash
# ❌ اشتباه - این placeholder است، کار نمی‌کند!
cd /path/to/web-monitoring-Intelligent-Vehicle-Traffic-

# ✅ صحیح - از مسیر واقعی استفاده کنید
# مثال: اگر در گام 1 این را پیدا کردید:
# /home/username/web-monitoring-Intelligent-Vehicle-Traffic-/test-rmto-quick.sh
# پس این دستور را بزنید:

cd /home/username/web-monitoring-Intelligent-Vehicle-Traffic-

# یا اگر در home directory خودتان است:
cd ~/web-monitoring-Intelligent-Vehicle-Traffic-
```

**بررسی که در دایرکتوری درست هستید:**

```bash
# این دستور را بزنید
pwd

# خروجی باید مسیر کامل پروژه باشد، مثلاً:
# /home/username/web-monitoring-Intelligent-Vehicle-Traffic-

# لیست فایل‌ها
ls -la

# باید این‌ها را ببینید:
# drwxr-xr-x ... server/
# -rwxr-xr-x ... test-rmto-quick.sh
# -rw-r--r-- ... test-rmto.html
```

### گام 3️⃣: اجرای اسکریپت تست

```bash
# حالا که در دایرکتوری درست هستید:
./test-rmto-quick.sh

# اسکریپت سؤال می‌کند: Do you want to create .env file now? (y/n)
# جواب دهید: y

# اگر درخواست رمز عبور کرد، رمز عبور RMTO را وارد کنید
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
