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

```bash
# اگر با git clone کرده‌اید:
cd ~/web-monitoring-Intelligent-Vehicle-Traffic-

# یا اگر نمی‌دانید کجاست، جستجو کنید:
find ~ -name "web-monitoring-Intelligent-Vehicle-Traffic-" -type d 2>/dev/null
# یا
find /var/www -name "web-monitoring-Intelligent-Vehicle-Traffic-" -type d 2>/dev/null
# یا
find /home -name "web-monitoring-Intelligent-Vehicle-Traffic-" -type d 2>/dev/null

# مسیری که پیدا می‌کند را کپی کنید و cd کنید
cd /مسیر/پیدا/شده/web-monitoring-Intelligent-Vehicle-Traffic-
```

### گام 2️⃣: بررسی که در دایرکتوری درست هستید

```bash
# این دستور را بزنید
pwd

# خروجی باید چیزی شبیه به این باشد:
# /home/user/web-monitoring-Intelligent-Vehicle-Traffic-
# یا
# /var/www/web-monitoring-Intelligent-Vehicle-Traffic-

# حالا لیست فایل‌ها را ببینید
ls -la

# باید این‌ها را ببینید:
# drwxr-xr-x ... server/
# -rwxr-xr-x ... test-rmto-quick.sh
# -rw-r--r-- ... test-rmto.html
# -rw-r--r-- ... README.md
```

### گام 3️⃣: اجرای اسکریپت تست

```bash
# حالا این دستور را بزنید (در همان دایرکتوری پروژه)
./test-rmto-quick.sh

# اسکریپت سؤال می‌کند: Do you want to create .env file now? (y/n)
# جواب دهید: y

# اگر درخواست رمز عبور کرد، رمز عبور RMTO را وارد کنید
```

اسکریپت باقی کارها را خودکار انجام می‌دهد!

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
