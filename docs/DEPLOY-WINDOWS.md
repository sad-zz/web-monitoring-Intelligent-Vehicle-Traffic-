# Windows 10 Deployment Guide | راهنمای نصب ویندوز 10

<div dir="rtl">

این راهنما نحوه نصب و اجرای TC Manager روی Windows 10 را گام به گام توضیح می‌دهد.

</div>

---

## پیش‌نیازها (Prerequisites)

<div dir="rtl">

### 1. Node.js (الزامی)

**دانلود و نصب:**
1. بروید به https://nodejs.org
2. نسخه LTS (18.x یا بالاتر) را دانلود کنید
3. فایل نصبی را اجرا کنید
4. در حین نصب، گزینه "Add to PATH" را تیک بزنید
5. کامپیوتر را restart کنید

**بررسی نصب:**
</div>

```cmd
node --version
npm --version
```

<div dir="rtl">

باید نسخه Node.js (مثلاً v18.19.0) و npm را نمایش دهد.

### 2. Git (اختیاری)

اگر می‌خواهید از Git استفاده کنید:
1. بروید به https://git-scm.com/download/win
2. Git for Windows را دانلود و نصب کنید

</div>

---

## روش 1: نصب سریع با PowerShell (Recommended)

<div dir="rtl">

### مرحله 1: دانلود پروژه

**با Git:**
</div>

```cmd
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git
cd web-monitoring-Intelligent-Vehicle-Traffic-
```

<div dir="rtl">

**بدون Git:**
1. بروید به https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-
2. کلیک روی "Code" → "Download ZIP"
3. فایل ZIP را استخراج کنید
4. پوشه استخراج شده را به `C:\TC-Manager` منتقل کنید

### مرحله 2: اجرای اسکریپت نصب

1. روی دکمه Start کلیک راست کنید
2. "Windows PowerShell (Admin)" را انتخاب کنید
3. دستورات زیر را وارد کنید:

</div>

```powershell
# رفتن به پوشه پروژه
cd C:\TC-Manager

# اجرای اسکریپت نصب
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\windows\install-windows.ps1
```

<div dir="rtl">

### مرحله 3: تنظیمات

فایل `server\.env` را با Notepad باز کنید:

</div>

```cmd
notepad server\.env
```

<div dir="rtl">

اطلاعات زیر را وارد کنید:

</div>

```env
# RMTO Settings
RMTO_COMPANY_CODE=58
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=رمز عبور واقعی خود را اینجا وارد کنید

# Admin Password (change this!)
ADMIN_PASS=رمز عبور قوی خود را وارد کنید
```

<div dir="rtl">

فایل را ذخیره کنید (Ctrl+S) و ببندید.

### مرحله 4: اجرا

دو کلیک روی میانبر "TC Manager" روی دسکتاپ یا در Start Menu

**یا از Command Prompt:**

</div>

```cmd
cd C:\TC-Manager
windows\start-windows.bat
```

<div dir="rtl">

### مرحله 5: دسترسی به وب اینترفیس

1. مرورگر خود را باز کنید
2. بروید به: http://localhost:3000
3. وارد شوید با:
   - نام کاربری: `admin`
   - رمز عبور: (همان که در .env تنظیم کردید)

</div>

---

## روش 2: نصب دستی

<div dir="rtl">

### مرحله 1: دانلود

همانند روش 1

### مرحله 2: نصب Dependencies

</div>

```cmd
cd C:\TC-Manager\server
npm install
```

<div dir="rtl">

### مرحله 3: تنظیمات

</div>

```cmd
copy .env.example .env
notepad .env
```

<div dir="rtl">

اطلاعات را وارد کنید و ذخیره کنید.

### مرحله 4: اجرا

</div>

```cmd
node index.js
```

---

## نصب به عنوان Windows Service (24/7)

<div dir="rtl">

برای اجرای مداوم TC Manager (حتی بعد از restart):

### مرحله 1: نصب node-windows

از PowerShell (Admin):

</div>

```powershell
cd C:\TC-Manager
.\windows\install-as-service.ps1
```

<div dir="rtl">

### مرحله 2: مدیریت سرویس

**بازکردن Services Manager:**
1. کلید Windows + R
2. تایپ کنید: `services.msc`
3. Enter

**پیدا کردن سرویس:**
- نام: "TC Manager"
- Status: Running
- Startup Type: Automatic

**عملیات:**
- Start: شروع سرویس
- Stop: توقف سرویس
- Restart: راه‌اندازی مجدد

### مرحله 3: لاگ‌ها

لاگ‌های سرویس در این مسیر ذخیره می‌شوند:

</div>

```
C:\TC-Manager\daemon\
```

<div dir="rtl">

### حذف سرویس

اگر خواستید سرویس را حذف کنید:

</div>

```powershell
# Create uninstall-service.ps1
$uninstallScript = @"
var Service = require('node-windows').Service;
var svc = new Service({
    name: 'TC Manager',
    script: require('path').join(__dirname, 'server', 'index.js')
});
svc.on('uninstall', function() {
    console.log('Service uninstalled');
});
svc.uninstall();
"@

$uninstallScript | Out-File -FilePath uninstall-service.js -Encoding UTF8
node uninstall-service.js
```

---

## تنظیمات پیشرفته

<div dir="rtl">

### تغییر پورت

فایل `.env` را باز کنید:

</div>

```env
PORT=8080
```

<div dir="rtl">

### فعال‌سازی API Key

برای امنیت بیشتر:

</div>

```env
DEVICE_API_KEY=your-secure-key-here
```

<div dir="rtl">

یا generate کنید:

</div>

```powershell
# Generate random API key
$bytes = New-Object byte[] 32
[Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
$apiKey = [Convert]::ToBase64String($bytes)
Write-Host "Generated API Key: $apiKey"
```

<div dir="rtl">

### بازکردن Firewall

اگر می‌خواهید از شبکه دیگری دسترسی داشته باشید:

</div>

```powershell
# As Administrator
New-NetFirewallRule -DisplayName "TC Manager" `
  -Direction Inbound `
  -Port 3000 `
  -Protocol TCP `
  -Action Allow
```

---

## بکاپ و بازیابی

<div dir="rtl">

### بکاپ دستی

</div>

```cmd
# Copy database file
copy server\data.db backups\data-backup-%date:~-4,4%%date:~-7,2%%date:~-10,2%.db
```

<div dir="rtl">

### بکاپ خودکار (Task Scheduler)

1. باز کنید: Task Scheduler
2. Create Basic Task
3. Name: "TC Manager Backup"
4. Trigger: Daily at 2:00 AM
5. Action: Start a program
6. Program: `C:\TC-Manager\windows\backup.bat`

**ایجاد backup.bat:**

</div>

```batch
@echo off
set BACKUP_DIR=C:\TC-Manager\backups
set DATE=%date:~-4,4%%date:~-7,2%%date:~-10,2%
mkdir %BACKUP_DIR%
copy C:\TC-Manager\server\data.db %BACKUP_DIR%\data-backup-%DATE%.db
```

<div dir="rtl">

### بازیابی از بکاپ

1. توقف TC Manager
2. کپی فایل بکاپ به `server\data.db`
3. راه‌اندازی مجدد

</div>

```cmd
# Stop TC Manager
taskkill /F /IM node.exe

# Restore backup
copy backups\data-backup-20260218.db server\data.db /Y

# Start TC Manager
windows\start-windows.bat
```

---

## Troubleshooting | رفع مشکل

<div dir="rtl">

### خطا: "node is not recognized"

**علت:** Node.js در PATH نیست

**راه حل:**
1. Node.js را دوباره نصب کنید
2. گزینه "Add to PATH" را تیک بزنید
3. کامپیوتر را restart کنید

### خطا: "Cannot find module"

**علت:** Dependencies نصب نشده

**راه حل:**

</div>

```cmd
cd C:\TC-Manager\server
npm install
```

<div dir="rtl">

### خطا: "Port 3000 already in use"

**علت:** برنامه دیگری از پورت 3000 استفاده می‌کند

**راه حل 1:** پورت را تغییر دهید در `.env`:

</div>

```env
PORT=3001
```

<div dir="rtl">

**راه حل 2:** برنامه دیگر را ببندید:

</div>

```cmd
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID with actual number)
taskkill /F /PID <PID>
```

<div dir="rtl">

### خطا: "EACCES: permission denied"

**علت:** دسترسی برای نوشتن در پوشه نیست

**راه حل:**
1. روی پوشه `C:\TC-Manager` کلیک راست
2. Properties → Security → Edit
3. Full Control برای Users اضافه کنید

### TC Manager start نمی‌شود

**بررسی لاگ‌ها:**

</div>

```cmd
type server\error.log
```

<div dir="rtl">

**بررسی اتصال دیتابیس:**

</div>

```cmd
# Check if data.db exists
dir server\data.db

# If not, TC Manager will create it on first run
```

<div dir="rtl">

### دستگاه‌ها آنلاین نمی‌شوند

**بررسی Firewall:**
- Windows Defender Firewall را باز کنید
- Inbound Rules → TC Manager را فعال کنید

**بررسی شبکه:**
- IP address کامپیوتر خود را پیدا کنید:

</div>

```cmd
ipconfig
```

<div dir="rtl">

- در دستگاه‌ها، آدرس `http://YOUR_IP:3000/api/data` را تنظیم کنید

</div>

---

## Update | به‌روزرسانی

<div dir="rtl">

### با Git

</div>

```cmd
cd C:\TC-Manager
git pull
cd server
npm install
```

<div dir="rtl">

### بدون Git

1. دانلود نسخه جدید از GitHub
2. کپی کردن فایل‌های جدید (بدون پوشه `server/node_modules` و `server/data.db`)
3. اجرای `npm install` در `server/`

</div>

---

## Uninstall | حذف

<div dir="rtl">

### حذف برنامه

1. اگر به عنوان service نصب کرده‌اید، ابتدا service را حذف کنید
2. پوشه `C:\TC-Manager` را حذف کنید
3. میانبرها را حذف کنید

### حذف کامل

</div>

```cmd
# Remove service (if installed)
sc delete "TC Manager"

# Remove files
rmdir /S /Q C:\TC-Manager

# Remove shortcuts
del "%USERPROFILE%\Desktop\TC Manager.lnk"
del "%ProgramData%\Microsoft\Windows\Start Menu\Programs\TC Manager.lnk"
```

---

## Best Practices | بهترین روش‌ها

<div dir="rtl">

1. **Backup منظم**: هر روز backup بگیرید
2. **Update منظم**: نسخه جدید را نصب کنید
3. **Monitor logs**: لاگ‌ها را بررسی کنید
4. **Strong passwords**: رمز قوی استفاده کنید
5. **Firewall**: فقط پورت‌های لازم را باز کنید
6. **Antivirus**: TC Manager را از لیست Antivirus خارج کنید

</div>

---

## پشتیبانی

<div dir="rtl">

اگر مشکلی داشتید:
1. این راهنما را دوباره مطالعه کنید
2. لاگ‌ها را بررسی کنید
3. با تیم پشتیبانی تماس بگیرید

**نوآوران جنوب شرق**
- Email: support@noavaran-js.com

</div>
