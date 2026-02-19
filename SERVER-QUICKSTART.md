# 🚀 راهنمای سریع آپلود روی سرور
# Quick Server Upload Guide

<div dir="rtl">

## در 10 دقیقه روی سرور اختصاصی deploy کنید!

### پیش‌نیاز: یک سرور VPS

**مشخصات حداقل:**
- CPU: 2 Cores
- RAM: 2 GB
- Storage: 20 GB SSD
- OS: Ubuntu 20.04/22.04 LTS

**قیمت تقریبی:**
- ایران: 150-200 هزار تومان/ماه
- خارج: $10-15/ماه

### گام 1: خرید/اجاره سرور

**توصیه‌های داخلی:**
- آبرآروان: https://abrarvan.com
- ایران سرور: https://iranserver.com
- پارس پک: https://parspack.com

**توصیه‌های خارجی:**
- DigitalOcean: https://digitalocean.com
- Linode: https://linode.com
- Hetzner: https://hetzner.com

### گام 2: اتصال به سرور

```bash
ssh root@YOUR_SERVER_IP
```

### گام 3: نصب خودکار (توصیه می‌شود)

```bash
# دانلود اسکریپت نصب
wget https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/main/server-install.sh

# اجرا
chmod +x server-install.sh
sudo ./server-install.sh
```

اسکریپت به طور خودکار همه چیز را نصب می‌کند:
- ✅ Node.js
- ✅ PM2
- ✅ TC Manager
- ✅ Dependencies
- ✅ تنظیمات اولیه

### گام 4: دسترسی

باز کنید:
```
http://YOUR_SERVER_IP:3000
```

ورود با:
```
Username: admin
Password: [همان که در نصب وارد کردید]
```

### گام 5: تنظیم HTTPS (اختیاری اما توصیه می‌شود)

**نیاز:** یک دامنه (مثلاً tc-manager.example.com)

```bash
# نصب Nginx
sudo apt install nginx

# نصب Certbot
sudo apt install certbot python3-certbot-nginx

# دریافت SSL
sudo certbot --nginx -d YOUR_DOMAIN
```

حالا دسترسی با HTTPS:
```
https://YOUR_DOMAIN
```

## ✅ تمام!

Application شما الان:
- ✅ 24/7 در حال اجراست
- ✅ از اینترنت قابل دسترسی است
- ✅ با HTTPS امن است (اگر تنظیم کردید)
- ✅ Auto-restart دارد (با PM2)

## 📚 راهنماهای کامل

**برای جزئیات بیشتر:**

1. [مشخصات سرور مورد نیاز](docs/SERVER-REQUIREMENTS.md)
   - انتخاب سرور مناسب
   - محاسبه منابع
   - توصیه‌های VPS

2. [راهنمای کامل نصب](docs/SERVER-DEPLOYMENT.md)
   - نصب دستی گام‌به‌گام
   - تنظیم Nginx
   - SSL/HTTPS
   - Firewall و امنیت
   - Backup و Monitoring

3. [راهنمای Backup](docs/BACKUP-RESTORE.md)
   - Backup خودکار
   - Restore از بکاپ

## 🆘 مشکل دارید؟

**Application start نمی‌شود:**
```bash
pm2 logs tc-manager
```

**پورت 3000 باز نیست:**
```bash
sudo ufw allow 3000/tcp
```

**نیاز به کمک:**
- راهنمای کامل: `docs/SERVER-DEPLOYMENT.md`
- GitHub Issues: https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/issues

## 💡 نکات

**امنیت:**
- رمز admin را تغییر دهید
- Firewall فعال کنید
- HTTPS تنظیم کنید
- Backup منظم بگیرید

**Performance:**
- برای بیش از 100 دستگاه: upgrade سرور
- PostgreSQL برای scale بهتر
- CDN برای سرعت بیشتر

**نگهداری:**
- بررسی روزانه logs: `pm2 logs`
- بررسی weekly resources: `htop`
- Backup روزانه خودکار
- Update منظم

---

**موفق باشید!** 🎉

</div>
