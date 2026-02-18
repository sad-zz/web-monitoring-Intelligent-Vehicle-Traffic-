# راهنمای تست روی Railway.app - قدم به قدم
# Railway.app Testing Guide - Step by Step

<div dir="rtl">

## 📋 پیش‌نیازها

قبل از شروع، مطمئن شوید این‌ها رو دارید:

- [ ] حساب کاربری GitHub
- [ ] حساب کاربری Railway.app (رایگان)
- [ ] این repository رو fork کرده باشید (اختیاری)

</div>

---

## 🚀 روش 1: Deploy با GitHub (توصیه می‌شود)

<div dir="rtl">

### گام 1: ایجاد حساب Railway

1. بروید به https://railway.app
2. کلیک روی **"Start a New Project"** یا **"Login"**
3. با GitHub خود وارد شوید
4. دسترسی‌های لازم را بدهید

### گام 2: ایجاد پروژه جدید

1. در داشبورد Railway، کلیک روی **"+ New Project"**
2. انتخاب کنید: **"Deploy from GitHub repo"**
3. اگر اولین باره، Railway از شما می‌خواد دسترسی به GitHub بدید
4. کلیک روی **"Configure GitHub App"**

### گام 3: انتخاب Repository

1. لیست repository‌های شما نمایش داده می‌شه
2. این repository رو پیدا کنید: `web-monitoring-Intelligent-Vehicle-Traffic-`
3. کلیک روی اون
4. Railway به طور خودکار `railway.json` و `railway.toml` رو تشخیص می‌ده

### گام 4: اضافه کردن PostgreSQL Database

1. در پروژه Railway، کلیک روی **"+ New"**
2. انتخاب کنید: **"Database"** → **"Add PostgreSQL"**
3. Railway یک PostgreSQL database می‌سازه
4. بعد از چند ثانیه، database آماده می‌شه
5. Railway به طور خودکار `DATABASE_URL` رو به app شما اضافه می‌کنه

### گام 5: تنظیم Environment Variables

در تب **"Variables"** این متغیرها رو اضافه کنید:

```
NODE_ENV=production
ADMIN_USER=admin
ADMIN_PASS=YOUR_SECURE_PASSWORD
RMTO_COMPANY_CODE=58
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=YOUR_RMTO_PASSWORD
DEVICE_API_KEY=GENERATE_A_RANDOM_KEY
SESSION_SECRET=GENERATE_A_RANDOM_SECRET
```

**نکته:** برای generate کردن کلیدهای امن:
- از این سایت استفاده کنید: https://randomkeygen.com/
- یا از این دستور: `openssl rand -hex 32` (در ترمینال)

### گام 6: Deploy

1. Railway به طور خودکار شروع به build و deploy می‌کنه
2. پیشرفت رو در تب **"Deployments"** ببینید
3. منتظر بمانید تا وضعیت به **"Success"** تبدیل شه (2-3 دقیقه)

### گام 7: دسترسی به Application

1. در تب **"Settings"**، بروید به بخش **"Networking"**
2. کلیک روی **"Generate Domain"**
3. Railway یک domain رایگان به شما می‌ده (مثل: `tc-manager-production.up.railway.app`)
4. کلیک روی لینک برای باز کردن app

### گام 8: تست Application

1. صفحه login باید باز شه
2. با اطلاعات admin که تنظیم کردید وارد شوید
3. بررسی کنید dashboard کار می‌کنه
4. بروید به **تنظیمات** → **Health Check**
5. یا مستقیماً به `/health` بروید
6. باید پاسخ JSON با `"status": "ok"` ببینید

</div>

---

## 🚀 روش 2: Deploy با Railway CLI

<div dir="rtl">

### گام 1: نصب Railway CLI

</div>

```bash
# macOS/Linux
curl -fsSL https://railway.app/install.sh | sh

# Windows (PowerShell)
iwr https://railway.app/install.ps1 -useb | iex

# یا با npm
npm install -g @railway/cli
```

<div dir="rtl">

### گام 2: Login

</div>

```bash
railway login
```

<div dir="rtl">

این دستور مرورگر رو باز می‌کنه. با GitHub خود وارد شوید.

### گام 3: Initialize پروژه

</div>

```bash
# رفتن به پوشه پروژه
cd /path/to/web-monitoring-Intelligent-Vehicle-Traffic-

# Initialize Railway project
railway init

# نام پروژه رو وارد کنید (مثلاً: tc-manager)
```

<div dir="rtl">

### گام 4: اضافه کردن PostgreSQL

</div>

```bash
railway add
# انتخاب کنید: PostgreSQL
```

<div dir="rtl">

### گام 5: تنظیم Environment Variables

</div>

```bash
railway variables set ADMIN_USER=admin
railway variables set ADMIN_PASS=your-secure-password
railway variables set RMTO_COMPANY_CODE=58
railway variables set RMTO_USERNAME=NOGSH
railway variables set RMTO_PASSWORD=your-rmto-password
railway variables set NODE_ENV=production

# Generate و set کردن API key
railway variables set DEVICE_API_KEY=$(openssl rand -hex 32)
railway variables set SESSION_SECRET=$(openssl rand -hex 32)
```

<div dir="rtl">

### گام 6: Deploy

</div>

```bash
railway up
```

<div dir="rtl">

این دستور کد رو آپلود و deploy می‌کنه.

### گام 7: باز کردن Application

</div>

```bash
railway open
```

<div dir="rtl">

این دستور app رو در مرورگر باز می‌کنه.

### گام 8: مشاهده Logs

</div>

```bash
railway logs
```

---

## ✅ Checklist تست

<div dir="rtl">

بعد از deploy، این موارد رو تست کنید:

### تست‌های اساسی

- [ ] صفحه اصلی (login) باز می‌شه
- [ ] Login با admin کار می‌کنه
- [ ] Dashboard نمایش داده می‌شه
- [ ] Health check پاسخ می‌ده: `https://your-app.railway.app/health`
- [ ] Metrics endpoint کار می‌کنه: `https://your-app.railway.app/metrics`

### تست Database

- [ ] دستگاه‌ها لیست می‌شن (حتی اگر خالی باشه)
- [ ] می‌تونید دستگاه جدید اضافه کنید
- [ ] داده‌ها ذخیره می‌شن
- [ ] بعد از restart، داده‌ها حفظ می‌شن

### تست Device API

</div>

```bash
# تست ارسال داده از دستگاه
curl -X POST https://your-app.railway.app/api/data \
  -H "Content-Type: application/json" \
  -d '{
    "device_code": "1234",
    "vehicle_class": 2,
    "speed": 85
  }'

# باید پاسخ {"success": true, "received": 1} برگرده
```

<div dir="rtl">

### تست Backup

- [ ] می‌تونید بکاپ دانلود کنید
- [ ] می‌تونید فایل بکاپ آپلود کنید

</div>

---

## 🐛 رفع مشکلات متداول

<div dir="rtl">

### خطا: Build Failed

**علت:** Dependencies نصب نشده

**راه حل:**
1. بروید به تب **Deployments**
2. روی deploy شکست خورده کلیک کنید
3. لاگ‌ها رو بخونید
4. معمولاً مشکل از `package.json` یا `node_modules` هست

### خطا: Application Crashed

**علت:** Environment variables ناقص هستن

**راه حل:**
1. بروید به **Variables**
2. مطمئن شوید حداقل این‌ها رو دارید:
   - `DATABASE_URL` (خودکار با PostgreSQL)
   - `ADMIN_USER`
   - `ADMIN_PASS`
3. اگر متغیری کم بود، اضافه کنید و **Restart** کنید

### خطا: Database Connection Failed

**علت:** PostgreSQL هنوز آماده نیست

**راه حل:**
1. منتظر بمونید 1-2 دقیقه
2. بروید به **Deployments** → **Restart**

### خطا: Health Check Failing

**علت:** Application start نشده یا خیلی کند شروع شده

**راه حل:**
1. در `railway.json` timeout رو زیاد کنید:
   ```json
   "healthcheck": {
     "path": "/health",
     "timeout": 200,
     "interval": 60
   }
   ```
2. Push و deploy مجدد

### دستگاه‌ها متصل نمی‌شن

**علت:** CORS یا API key

**راه حل:**
1. اگر از API key استفاده می‌کنید، مطمئن شوید دستگاه‌ها header `X-API-Key` رو می‌فرستن
2. Domain Railway رو به دستگاه‌ها بدید (نه localhost)

</div>

---

## 📊 مانیتورینگ در Railway

<div dir="rtl">

### مشاهده Logs

1. تب **"Deployments"**
2. روی آخرین deployment کلیک کنید
3. تب **"Logs"**
4. لاگ‌های real-time رو ببینید

### مشاهده Metrics

1. تب **"Metrics"**
2. CPU usage، Memory، Network traffic
3. می‌تونید timeframe رو تغییر بدید

### دریافت Alerts

1. **Settings** → **Alerts**
2. می‌تونید alert برای crash، high memory، etc. تنظیم کنید

</div>

---

## 💰 هزینه‌ها

<div dir="rtl">

**Free Tier Railway:**
- $5 credit رایگان هر ماه
- برای test و development کافیه
- معمولاً یک app کوچک 2-3 دلار در ماه مصرف می‌کنه

**نکته:** اگر برای production استفاده می‌کنید، حتماً credit card اضافه کنید تا service قطع نشه.

</div>

---

## 🎯 Next Steps

<div dir="rtl">

بعد از deploy موفق:

1. **Custom Domain:** اگر دامنه خودتون رو دارید، می‌تونید وصل کنید
2. **Monitoring:** با ابزارهایی مثل Sentry، LogRocket ادغام کنید
3. **Backups:** بکاپ منظم از database بگیرید
4. **Scale Up:** اگر ترافیک زیاد شد، می‌تونید replicas اضافه کنید

</div>

---

## 📞 کمک بیشتر

<div dir="rtl">

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **GitHub Issues:** مشکلات رو در repository گزارش کنید

</div>

---

## ✅ موفقیت!

<div dir="rtl">

اگر همه چیز کار کرد، الان TC Manager شما روی Railway در حال اجراست! 🎉

می‌تونید:
- از هر جای دنیا بهش دسترسی داشته باشید
- دستگاه‌هاتون رو بهش وصل کنید
- داده‌ها رو 24/7 جمع‌آوری کنید
- به RMTO ارسال کنید

</div>

---

**تاریخ:** ۱۴۰۴/۱۱/۲۹
**نسخه:** ۱.۰.۰
**وضعیت:** ✅ آماده برای تست
