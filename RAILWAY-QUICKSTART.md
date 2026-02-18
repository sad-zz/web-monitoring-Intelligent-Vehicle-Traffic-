# 🚀 شروع سریع با Railway.app

<div dir="rtl">

## در 5 دقیقه deploy کنید!

### گام 1: وارد Railway شوید
https://railway.app

### گام 2: پروژه جدید بسازید
```
+ New Project → Deploy from GitHub repo
```

### گام 3: این repository را انتخاب کنید
```
web-monitoring-Intelligent-Vehicle-Traffic-
```

### گام 4: PostgreSQL اضافه کنید
```
+ New → Database → PostgreSQL
```

### گام 5: تنظیمات را وارد کنید

رفته به **Variables** و این‌ها را اضافه کنید:

```env
NODE_ENV=production
ADMIN_USER=admin
ADMIN_PASS=رمز-امن-خودتان
RMTO_COMPANY_CODE=58
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=رمز-RMTO
```

### گام 6: منتظر deploy بمانید
2-3 دقیقه صبر کنید تا build شود.

### گام 7: دامنه بسازید
```
Settings → Networking → Generate Domain
```

### گام 8: تست کنید!

باز کنید:
```
https://your-app.up.railway.app
```

لاگین کنید با:
```
Username: admin
Password: [همان که تنظیم کردید]
```

## ✅ تست خودکار

اسکریپت تست را اجرا کنید:

```bash
./test-railway-deploy.sh
```

و URL اپلیکیشن را وارد کنید.

## 📚 راهنمای کامل

برای جزئیات بیشتر:
- [راهنمای کامل Railway](docs/RAILWAY-TEST-GUIDE.md)
- [راهنمای Cloud Deploy](docs/DEPLOY-CLOUD.md)

## 🆘 مشکل دارید؟

1. لاگ‌ها را بررسی کنید: **Deployments → View Logs**
2. Variables را چک کنید: **Variables**
3. Health check را تست کنید: `/health`
4. با ما تماس بگیرید: GitHub Issues

## 💡 نکات

- **رایگان:** Railway هر ماه $5 credit رایگان می‌ده
- **Database:** حتماً PostgreSQL اضافه کنید
- **Domain:** می‌تونید custom domain وصل کنید
- **Scale:** می‌تونید resources رو افزایش بدید

---

**موفق باشید! 🎉**

</div>
