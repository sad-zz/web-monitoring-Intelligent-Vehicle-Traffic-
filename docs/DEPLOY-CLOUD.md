# Cloud Deployment Guide | راهنمای دیپلوی ابری

<div dir="rtl">

این راهنما نحوه دیپلوی TC Manager روی پلتفرم‌های مختلف ابری را توضیح می‌دهد.

</div>

---

## Railway.app (Recommended | توصیه می‌شود)

<div dir="rtl">

### مزایا:
- ✅ نصب بسیار ساده (یک کلیک)
- ✅ PostgreSQL رایگان 500MB
- ✅ SSL/HTTPS خودکار
- ✅ پشتیبانی از environment variables
- ✅ لاگ‌ها و metrics

### روش 1: Deploy با یک کلیک

</div>

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-)

<div dir="rtl">

1. روی دکمه بالا کلیک کنید
2. با حساب GitHub خود وارد شوید
3. نام پروژه را وارد کنید
4. روی "Deploy" کلیک کنید
5. منتظر بمانید تا deploy کامل شود (2-3 دقیقه)
6. روی "View App" کلیک کنید

### روش 2: Deploy دستی با CLI

</div>

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Initialize project
railway init

# 4. Add PostgreSQL database
railway add

# When prompted, select: PostgreSQL

# 5. Set environment variables
railway variables set ADMIN_USER=admin
railway variables set ADMIN_PASS=your-secure-password
railway variables set RMTO_COMPANY_CODE=58
railway variables set RMTO_USERNAME=NOGSH
railway variables set RMTO_PASSWORD=your-rmto-password
railway variables set DEVICE_API_KEY=$(openssl rand -hex 32)

# 6. Deploy
railway up

# 7. Get your app URL
railway domain
```

<div dir="rtl">

### تنظیمات پیشرفته

1. بروید به [Railway Dashboard](https://railway.app/dashboard)
2. پروژه خود را انتخاب کنید
3. Settings → Variables:
   - `DATABASE_URL`: خودکار توسط PostgreSQL plugin تنظیم می‌شود
   - `NODE_ENV`: production
   - `PORT`: خودکار (Railway تنظیم می‌کند)

4. Settings → Networking:
   - Domain را enable کنید
   - Custom domain اختیاری

5. Settings → Deploy:
   - Auto-deploy از Git را فعال کنید

### مانیتورینگ

- **Logs**: Railway Dashboard → Deployments → View Logs
- **Metrics**: Railway Dashboard → Metrics
- **Health**: `https://your-app.railway.app/health`

### بکاپ دیتابیس

</div>

```bash
# Connect to Railway database
railway connect PostgreSQL

# Create backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Compress
gzip backup-*.sql
```

---

## Fly.io

<div dir="rtl">

### مزایا:
- ✅ Edge deployment (نزدیک به کاربر)
- ✅ مقیاس‌پذیری خودکار
- ✅ پشتیبانی از Docker
- ✅ PostgreSQL مدیریت شده

### نصب flyctl

</div>

```bash
# Linux/macOS
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

<div dir="rtl">

### Deploy

</div>

```bash
# 1. Login
flyctl auth login

# 2. Launch app (در دایرکتوری پروژه)
flyctl launch

# Fly.io will detect Dockerfile and fly.toml automatically
# When prompted:
#   - App name: tc-manager (or your choice)
#   - Region: Choose closest to your location
#   - PostgreSQL: Yes
#   - Deploy now: Yes

# 3. Set secrets (environment variables)
flyctl secrets set ADMIN_USER=admin
flyctl secrets set ADMIN_PASS=your-secure-password
flyctl secrets set RMTO_COMPANY_CODE=58
flyctl secrets set RMTO_USERNAME=NOGSH
flyctl secrets set RMTO_PASSWORD=your-rmto-password
flyctl secrets set DEVICE_API_KEY=$(openssl rand -hex 32)

# 4. Get database connection string
flyctl postgres attach

# 5. Deploy
flyctl deploy

# 6. Open app
flyctl open
```

<div dir="rtl">

### مدیریت

</div>

```bash
# View logs
flyctl logs

# Check status
flyctl status

# Scale up
flyctl scale count 2

# SSH into container
flyctl ssh console

# Restart app
flyctl apps restart tc-manager
```

<div dir="rtl">

### بکاپ دیتابیس

</div>

```bash
# List databases
flyctl postgres list

# Connect to database
flyctl postgres connect -a <postgres-app-name>

# Create backup
pg_dump > backup-$(date +%Y%m%d).sql
```

---

## Render.com

<div dir="rtl">

### مزایا:
- ✅ رایگان برای شروع
- ✅ PostgreSQL رایگان
- ✅ SSL/HTTPS خودکار
- ✅ Deploy از GitHub

### روش 1: Deploy با Blueprint (یک کلیک)

1. Fork کردن repository
2. بروید به [Render Dashboard](https://dashboard.render.com/)
3. کلیک روی "New +" → "Blueprint"
4. Repository خود را متصل کنید
5. فایل `render.yaml` را انتخاب کنید
6. کلیک روی "Apply"

### روش 2: Deploy دستی

1. بروید به [Render Dashboard](https://dashboard.render.com/)

2. **ایجاد PostgreSQL Database:**
   - کلیک روی "New +" → "PostgreSQL"
   - نام: `tc-manager-db`
   - Plan: Free
   - کلیک روی "Create Database"
   - Connection string را یادداشت کنید

3. **ایجاد Web Service:**
   - کلیک روی "New +" → "Web Service"
   - Repository خود را متصل کنید
   - Settings:
     - Name: `tc-manager`
     - Environment: Docker
     - Plan: Free
     - Health Check Path: `/health`
   
4. **تنظیم Environment Variables:**
   - `NODE_ENV`: `production`
   - `DATABASE_TYPE`: `postgresql`
   - `DATABASE_URL`: (از قسمت database کپی کنید)
   - `ADMIN_USER`: `admin`
   - `ADMIN_PASS`: رمز امن خود
   - `RMTO_COMPANY_CODE`: `58`
   - `RMTO_USERNAME`: `NOGSH`
   - `RMTO_PASSWORD`: رمز RMTO
   - `DEVICE_API_KEY`: (Generate با `openssl rand -hex 32`)

5. کلیک روی "Create Web Service"

### مانیتورینگ

- **Logs**: Render Dashboard → Service → Logs
- **Metrics**: Render Dashboard → Service → Metrics
- **Shell Access**: Render Dashboard → Service → Shell

### بکاپ

</div>

```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# Create backup
render postgres backup create tc-manager-db

# Download backup
render postgres backup download <backup-id>
```

---

## Heroku

<div dir="rtl">

### نصب

</div>

```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create app
heroku create tc-manager

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set ADMIN_USER=admin
heroku config:set ADMIN_PASS=your-secure-password
heroku config:set RMTO_COMPANY_CODE=58
heroku config:set RMTO_USERNAME=NOGSH
heroku config:set RMTO_PASSWORD=your-rmto-password
heroku config:set DEVICE_API_KEY=$(openssl rand -hex 32)

# Deploy
git push heroku main

# Open app
heroku open
```

---

## Digital Ocean App Platform

<div dir="rtl">

1. بروید به [Digital Ocean Dashboard](https://cloud.digitalocean.com/)
2. کلیک روی "Create" → "Apps"
3. Repository خود را متصل کنید
4. Settings:
   - Build Command: `cd server && npm install`
   - Run Command: `node server/index.js`
   - HTTP Port: `3000`
5. Add Database: PostgreSQL
6. تنظیم Environment Variables
7. کلیک روی "Create Resources"

</div>

---

## AWS Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init

# Create environment with RDS
eb create tc-manager-env --database

# Set environment variables
eb setenv ADMIN_USER=admin ADMIN_PASS=password ...

# Deploy
eb deploy

# Open
eb open
```

---

## Google Cloud Run

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash

# Login
gcloud auth login

# Build container
gcloud builds submit --tag gcr.io/PROJECT_ID/tc-manager

# Deploy
gcloud run deploy tc-manager \
  --image gcr.io/PROJECT_ID/tc-manager \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## Troubleshooting | رفع مشکل

<div dir="rtl">

### خطا: Build Failed

- بررسی کنید `Dockerfile` و `package.json` صحیح است
- لاگ‌های build را بررسی کنید
- مطمئن شوید که Node.js 18+ استفاده می‌شود

### خطا: Database Connection

- بررسی کنید `DATABASE_URL` صحیح است
- مطمئن شوید database در همان region است
- بررسی کنید SSL configuration صحیح است

### خطا: Health Check Failed

- بررسی کنید `/health` endpoint کار می‌کند
- timeout را افزایش دهید (در تنظیمات platform)
- لاگ‌های application را بررسی کنید

### Performance Issues

- Scale up: تعداد instances را افزایش دهید
- Add cache: Redis یا Memcached اضافه کنید
- Optimize queries: indexes اضافه کنید

</div>

---

## Best Practices | بهترین روش‌ها

<div dir="rtl">

1. **Environment Variables**: همیشه از environment variables استفاده کنید
2. **Database Backups**: حتماً backup روزانه تنظیم کنید
3. **Monitoring**: از monitoring tools استفاده کنید
4. **Logging**: لاگ‌ها را مرکزی ذخیره کنید
5. **SSL**: همیشه HTTPS فعال کنید
6. **Secrets**: از secret management استفاده کنید
7. **Health Checks**: health check endpoint تنظیم کنید
8. **Auto-scaling**: بر اساس load تنظیم کنید

</div>

---

<div dir="rtl">

## پشتیبانی

اگر مشکلی داشتید:
1. لاگ‌های application را بررسی کنید
2. لاگ‌های platform را بررسی کنید
3. `/health` endpoint را تست کنید
4. با تیم پشتیبانی تماس بگیرید

</div>
