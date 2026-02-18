# Quick Start Guide | راهنمای شروع سریع
# TC Manager - Traffic Counter Management System

<div dir="rtl">

## 🚀 سریع‌ترین راه برای شروع

این راهنما کوتاه‌ترین مسیر برای راه‌اندازی TC Manager را نشان می‌دهد.

</div>

---

## Option 1: Docker (Recommended | توصیه می‌شود)

<div dir="rtl">

**پیش‌نیاز:** Docker Desktop نصب باشد

### گام 1: دانلود

</div>

```bash
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git
cd web-monitoring-Intelligent-Vehicle-Traffic-
```

<div dir="rtl">

### گام 2: اجرا

</div>

```bash
docker-compose up -d
```

<div dir="rtl">

### گام 3: دسترسی

</div>

```
http://localhost:3000
Username: admin
Password: admin123
```

<div dir="rtl">

**تمام!** 🎉

</div>

---

## Option 2: Railway.app (Cloud - 1 Click)

<div dir="rtl">

### گام 1: کلیک روی دکمه

</div>

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-)

<div dir="rtl">

### گام 2: لاگین با GitHub

### گام 3: Deploy!

**منتظر 2-3 دقیقه بمانید، تمام!** 🎉

</div>

---

## Option 3: Windows 10

<div dir="rtl">

**پیش‌نیاز:** Node.js از https://nodejs.org

### گام 1: دانلود پروژه

از GitHub → Code → Download ZIP

### گام 2: Extract

به `C:\TC-Manager`

### گام 3: نصب

</div>

```powershell
# Run as Administrator
cd C:\TC-Manager\windows
.\install-windows.ps1
```

<div dir="rtl">

### گام 4: اجرا

دو کلیک روی میانبر "TC Manager" روی Desktop

**یا:**

</div>

```cmd
cd C:\TC-Manager
windows\start-windows.bat
```

<div dir="rtl">

### گام 5: دسترسی

</div>

```
http://localhost:3000
Username: admin
Password: admin123
```

<div dir="rtl">

**تمام!** 🎉

</div>

---

## Option 4: Linux (Manual)

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git
cd web-monitoring-Intelligent-Vehicle-Traffic-/server

# Install dependencies
npm install

# Configure (optional)
cp .env.example .env
nano .env  # Edit RMTO credentials

# Run
npm start

# Access
# http://localhost:3000
# admin / admin123
```

---

## 🔧 تنظیمات اولیه

<div dir="rtl">

### تغییر رمز عبور admin

1. لاگین کنید
2. رفتن به **تنظیمات** → **تغییر رمز عبور**
3. رمز جدید را وارد کنید

### تنظیم RMTO

فایل `.env` را ویرایش کنید:

</div>

```env
RMTO_COMPANY_CODE=58
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=your-actual-password
```

<div dir="rtl">

### فعال‌سازی API Key (اختیاری، برای امنیت)

</div>

```env
DEVICE_API_KEY=your-secret-key
```

<div dir="rtl">

**Generate کردن API Key:**

</div>

```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

---

## 📱 ارسال داده از دستگاه

<div dir="rtl">

### فرمت ساده

</div>

```http
POST http://your-server.com/api/data
Content-Type: application/json
X-API-Key: your-api-key (optional)

{
  "device_code": "1234",
  "vehicle_class": 2,
  "speed": 85
}
```

<div dir="rtl">

### فرمت ICCORE

</div>

```http
POST http://your-server.com/api/irawdata
Content-Type: application/json

{
  "device_id": "1234",
  "create_at": "2026-02-18T10:00:00",
  "stop": "2026-02-18T10:15:00",
  "a": 10, "b": 50, "c": 20, "d": 5, "e": 3
}
```

---

## 💾 Import بکاپ

<div dir="rtl">

### از طریق وب

1. لاگین کنید
2. **تنظیمات** → **پشتیبان‌گیری**
3. تب **بازیابی از بکاپ**
4. آپلود فایل `.sql.gz` یا `.db`
5. کلیک روی **Import**

### از طریق API

</div>

```bash
curl -X POST http://localhost:3000/api/backup/import-sql-gz \
  -F "backup=@backup.sql.gz"
```

---

## ❓ مشکل دارید؟

<div dir="rtl">

### سرور start نمی‌شود

</div>

```bash
# Check Node.js version
node --version  # Should be 18+

# Check logs
tail -f server/*.log
```

<div dir="rtl">

### دستگاه‌ها آنلاین نمی‌شوند

1. بررسی کنید server در حال اجراست
2. بررسی کنید firewall port 3000 را بلاک نکرده
3. بررسی کنید دستگاه به URL صحیح متصل است

### نمی‌توانم لاگین کنم

رمز پیش‌فرض:

</div>

```
Username: admin
Password: admin123
```

<div dir="rtl">

اگر تغییر داده‌اید و فراموش کرده‌اید:

</div>

```bash
# Delete database and restart (WARNING: loses all data)
rm server/data.db
npm start
```

---

## 📚 مستندات کامل

<div dir="rtl">

- [راهنمای Cloud Deployment](docs/DEPLOY-CLOUD.md)
- [راهنمای Windows](docs/DEPLOY-WINDOWS.md)
- [راهنمای Backup/Restore](docs/BACKUP-RESTORE.md)
- [API Documentation](docs/API.md)
- [Database Migration](docs/DATABASE-MIGRATION.md)

</div>

---

## 🆘 پشتیبانی

<div dir="rtl">

**نوآوران جنوب شرق**

📧 Email: support@noavaran-js.com

🐛 Issues: https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/issues

</div>

---

## ✅ Checklist اولین راه‌اندازی

<div dir="rtl">

- [ ] سرور start شد
- [ ] با admin لاگین کردید
- [ ] رمز admin را تغییر دادید
- [ ] اطلاعات RMTO را تنظیم کردید
- [ ] یک device تست را register کردید
- [ ] داده تست را ارسال کردید
- [ ] داده را در dashboard دیدید
- [ ] بکاپ گرفتید

**همه چیز کار کرد؟ عالی! 🎉**

</div>
