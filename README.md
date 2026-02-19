# TC Manager - Traffic Counter Management System
# سیستم مدیریت شمارنده‌های ترافیک

<div dir="rtl">

## نوآوران جنوب شرق (Noavaran Jonoob Shargh)

سیستم جامع مدیریت شمارنده‌های ترافیک با قابلیت ارسال داده به RMTO (راهسام)

</div>

---

---

## 🚀 Quick Deploy | دیپلوی سریع

### Deploy to Railway (5 minutes | 5 دقیقه)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/web-monitoring-intelligent-vehicle-traffic)

**یا:**

1. Fork کنید این repo را
2. به [Railway.app](https://railway.app) بروید
3. New Project → Deploy from GitHub
4. این repo را انتخاب کنید
5. PostgreSQL اضافه کنید
6. Variables را تنظیم کنید

📖 [راهنمای کامل Railway](RAILWAY-QUICKSTART.md) | [راهنمای تست](docs/RAILWAY-TEST-GUIDE.md)

---

### Deploy to VPS/Dedicated Server (10 minutes | 10 دقیقه)

<div dir="rtl">

**نصب خودکار:**

</div>

```bash
# SSH to your server
ssh root@YOUR_SERVER_IP

# Download and run installer
wget https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/convert-tc-manager-to-cloud/server-install.sh
chmod +x server-install.sh
sudo ./server-install.sh
```

<div dir="rtl">

**مشخصات سرور مورد نیاز:**
- CPU: 2 Cores | RAM: 2 GB | Storage: 20 GB SSD
- قیمت: ~$12/ماه یا 200k تومان/ماه

</div>

📖 [راهنمای سریع سرور](SERVER-QUICKSTART.md) | [مشخصات کامل](docs/SERVER-REQUIREMENTS.md) | [راهنمای جامع](docs/SERVER-DEPLOYMENT.md)

---

## 🚀 Features | امکانات

<div dir="rtl">

### ✅ عملکرد اصلی
- 📊 **مدیریت دستگاه‌ها**: مدیریت 100+ دستگاه شمارنده ترافیک
- 📡 **دریافت داده**: دریافت خودکار داده از دستگاه‌ها (24/7)
- 🔄 **ارسال به RMTO**: ارسال خودکار داده به سامانه راهسام (OTF)
- 📈 **گزارش‌گیری**: گزارشات آماری کامل
- 🔐 **احراز هویت**: سیستم لاگین امن
- 💾 **پشتیبان‌گیری**: بکاپ و بازیابی کامل

### ✅ پشتیبانی از پلتفرم‌ها
- 🐧 **Linux**: Ubuntu, Debian, CentOS, etc.
- 🪟 **Windows 10**: نصب آسان با PowerShell
- ☁️ **Cloud**: Railway, Fly.io, Render, Heroku
- 🐳 **Docker**: Docker & Docker Compose

### ✅ پایگاه داده
- 📁 **SQLite**: پیش‌فرض برای نصب لوکال
- 🐘 **PostgreSQL**: برای دیپلوی ابری
- 🔄 **Auto-detection**: تشخیص خودکار نوع دیتابیس

### ✅ امنیت
- 🔑 API Key authentication برای دستگاه‌ها
- ⏱️ Rate limiting
- 🛡️ Input validation & sanitization
- 🔒 CORS configuration

</div>

---

## 📦 Quick Start | شروع سریع

### Option 1: Docker (Recommended | توصیه می‌شود)

```bash
# Clone repository
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git
cd web-monitoring-Intelligent-Vehicle-Traffic-

# Run with Docker Compose (SQLite)
docker-compose up -d

# OR: Run with PostgreSQL
docker-compose -f docker-compose.prod.yml up -d

# Open browser: http://localhost:3000
# Login: admin / admin123
```

### Option 2: Windows 10

1. دانلود و نصب [Node.js LTS](https://nodejs.org)
2. اجرای PowerShell به عنوان Administrator
3. اجرای دستور:

```powershell
cd windows
.\install-windows.ps1
```

4. دو کلیک روی میانبر "TC Manager" روی دسکتاپ

### Option 3: Linux (Ubuntu/Debian)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and install
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git
cd web-monitoring-Intelligent-Vehicle-Traffic-/server
npm install

# Configure
cp .env.example .env
nano .env  # Edit RMTO credentials

# Run
npm start

# Open browser: http://localhost:3000
```

---

## ☁️ Cloud Deployment | دیپلوی ابری

<div dir="rtl">

### Railway.app (توصیه می‌شود)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-)

**یا دستی:**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add

# Deploy
railway up
```

مستندات کامل: [docs/DEPLOY-CLOUD.md](docs/DEPLOY-CLOUD.md)

### Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Launch app
flyctl launch

# Add PostgreSQL
flyctl postgres create

# Deploy
flyctl deploy
```

### Render.com

1. Fork this repository
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New +" → "Blueprint"
4. Connect your forked repository
5. Click "Apply"

</div>

---

## 🔧 Configuration | پیکربندی

<div dir="rtl">

فایل `.env` را ویرایش کنید:

```bash
# نوع دیتابیس
DATABASE_TYPE=sqlite          # یا postgresql

# PostgreSQL (برای cloud)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# احراز هویت
ADMIN_USER=admin
ADMIN_PASS=admin123

# API Key دستگاه‌ها (اختیاری، برای امنیت بیشتر)
DEVICE_API_KEY=your-secret-key-here

# تنظیمات RMTO
RMTO_COMPANY_CODE=58
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=your-password
RMTO_WSDL=http://otf.rmto.ir/Companies/Companies.asmx?WSDL

# فاصله ارسال (دقیقه)
SEND_INTERVAL_MINUTES=15
```

</div>

---

## 📡 API Documentation | مستندات API

### Device Data Reception (دریافت داده از دستگاه‌ها)

```http
POST /api/data
Headers:
  Content-Type: application/json
  X-API-Key: your-api-key  (optional)

Body:
{
  "device_code": "1234",
  "timestamp": "2026-02-18T10:00:00Z",
  "vehicle_class": 2,
  "speed": 85,
  "direction": 1,
  "lane": 2
}

Response:
{
  "success": true,
  "received": 1
}
```

### Batch Data (دریافت گروهی)

```http
POST /api/data
Body:
{
  "device_code": "1234",
  "records": [
    { "timestamp": "...", "vehicle_class": 2, "speed": 85 },
    { "timestamp": "...", "vehicle_class": 1, "speed": 60 }
  ]
}
```

### ICCORE Format (فرمت دستگاه‌های ICCORE)

```http
POST /api/irawdata
Body:
{
  "device_id": "1234",
  "create_at": "2026-02-18T10:00:00",
  "stop": "2026-02-18T10:15:00",
  "lane": 1,
  "a": 10, "b": 50, "c": 20, "d": 5, "e": 3, "x": 2,
  "sa": 500, "sb": 4000, "sc": 1600, "sd": 400, "se": 240, "sx": 160
}
```

مستندات کامل: [docs/API.md](docs/API.md)

---

## 💾 Backup & Restore | پشتیبان‌گیری و بازیابی

<div dir="rtl">

### دانلود بکاپ

```http
GET /api/backup/download
```

دانلود فایل `.db` (SQLite) یا `.sql` (PostgreSQL)

### بازیابی از بکاپ

1. **از طریق وب اینترفیس:**
   - بروید به تنظیمات → بکاپ
   - فایل `.sql.gz`, `.sql`, یا `.db` را آپلود کنید
   - کلیک روی "Import"

2. **از طریق API:**

```http
POST /api/backup/import-sql-gz
Content-Type: multipart/form-data
Body: backup file

Response:
{
  "success": true,
  "importId": "1708249999000",
  "message": "Import started..."
}
```

3. **پیگیری پیشرفت:**

```http
GET /api/backup/import-progress/{importId}

Response:
{
  "status": "importing",
  "message": "Imported: 1500 of 5000",
  "imported": 1500,
  "total": 5000,
  "progress": 30
}
```

مستندات کامل: [docs/BACKUP-RESTORE.md](docs/BACKUP-RESTORE.md)

</div>

---

## 🔍 Project Structure | ساختار پروژه

```
web-monitoring-Intelligent-Vehicle-Traffic-/
├── server/                  # Backend application
│   ├── index.js            # Main server
│   ├── db.js               # Database (auto-detect SQLite/PostgreSQL)
│   ├── db-postgres.js      # PostgreSQL adapter
│   ├── backup-handler.js   # Backup/restore logic
│   ├── device-api.js       # Device API security
│   ├── rmto-client.js      # RMTO SOAP client
│   ├── scheduler.js        # Data aggregation & sending
│   └── package.json        # Dependencies
├── css/                     # Frontend styles
├── js/                      # Frontend JavaScript
├── data/                    # Sample data
├── windows/                 # Windows installation scripts
│   ├── install-windows.ps1
│   ├── start-windows.bat
│   └── install-as-service.ps1
├── docs/                    # Documentation
│   ├── DEPLOY-CLOUD.md
│   ├── DEPLOY-WINDOWS.md
│   ├── BACKUP-RESTORE.md
│   └── API.md
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose (SQLite)
├── docker-compose.prod.yml # Docker Compose (PostgreSQL)
├── railway.json            # Railway.app config
├── fly.toml                # Fly.io config
├── render.yaml             # Render.com config
└── README.md               # This file
```

---

## 🛡️ Security | امنیت

<div dir="rtl">

### توصیه‌های امنیتی:

1. **تغییر رمز عبور پیش‌فرض**: حتماً رمز admin را تغییر دهید
2. **API Key**: برای دریافت داده از دستگاه‌ها حتماً API key تنظیم کنید:
   ```bash
   DEVICE_API_KEY=$(openssl rand -hex 32)
   ```
3. **HTTPS**: در production حتماً از HTTPS استفاده کنید
4. **Firewall**: فقط پورت‌های لازم را باز کنید
5. **Database**: از رمز قوی برای PostgreSQL استفاده کنید
6. **Rate Limiting**: فعال است به صورت پیش‌فرض (100 req/min)

</div>

---

## 📊 Monitoring | مانیتورینگ

<div dir="rtl">

### Health Check

```http
GET /health

Response:
{
  "status": "ok",
  "timestamp": "2026-02-18T10:00:00Z",
  "database": "postgresql",
  "uptime": 86400,
  "memory": {...}
}
```

### Metrics

```http
GET /metrics

Response:
{
  "devices_total": 125,
  "devices_online": 118,
  "rmto_queue_unsent": 5,
  "uptime_seconds": 86400
}
```

</div>

---

## 🐛 Troubleshooting | رفع مشکل

<div dir="rtl">

### دستگاه‌ها آنلاین نمی‌شوند

- بررسی کنید که API endpoint صحیح است
- بررسی کنید که API key (اگر فعال است) صحیح است
- لاگ‌های سرور را بررسی کنید

### ارسال به RMTO کار نمی‌کند

- بررسی کنید اطلاعات RMTO در `.env` صحیح است
- لاگ‌های RMTO را بررسی کنید: `GET /api/rmto/logs`
- تست دستی: `POST /api/rmto/send-now`

### خطای دیتابیس

- SQLite: بررسی کنید `server/data.db` وجود دارد
- PostgreSQL: بررسی کنید `DATABASE_URL` صحیح است
- بررسی permissions دایرکتوری `server/`

### Import بکاپ کار نمی‌کند

- فایل `.sql.gz` باید compressed باشد (gzip)
- فایل باید حاوی دستورات SQL معتبر باشد
- برای فایل‌های بزرگ صبور باشید (ممکن است دقایقی طول بکشد)

</div>

---

## 📖 Documentation | مستندات کامل

<div dir="rtl">

- [راهنمای دیپلوی ابری](docs/DEPLOY-CLOUD.md) - Railway, Fly.io, Render
- [راهنمای نصب ویندوز](docs/DEPLOY-WINDOWS.md) - Windows 10
- [راهنمای بکاپ و بازیابی](docs/BACKUP-RESTORE.md) - Backup/Restore
- [مستندات API](docs/API.md) - Complete API reference

</div>

---

## 🤝 Contributing | مشارکت

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 License | مجوز

This project is proprietary software owned by **نوآوران جنوب شرق (Noavaran Jonoob Shargh)**.

All rights reserved.

---

## 📞 Support | پشتیبانی

<div dir="rtl">

**نوآوران جنوب شرق (Noavaran Jonoob Shargh)**

- 🌐 Website: [Coming Soon]
- 📧 Email: support@noavaran-js.com
- 📱 Phone: [Coming Soon]

</div>

---

<div align="center" dir="rtl">

**ساخته شده با ❤️ توسط نوآوران جنوب شرق**

**Built with ❤️ by Noavaran Jonoob Shargh**

</div>
