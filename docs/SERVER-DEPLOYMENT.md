# راهنمای نصب روی سرور اختصاصی - TC Manager
# VPS/Dedicated Server Deployment Guide

<div dir="rtl">

این راهنما قدم به قدم نحوه نصب TC Manager روی سرور VPS یا Dedicated را توضیح می‌دهد.

</div>

---

## 📋 پیش‌نیازها | Prerequisites

<div dir="rtl">

قبل از شروع، مطمئن شوید:

- ✅ سرور VPS/Dedicated با مشخصات مناسب ([راهنمای مشخصات](SERVER-REQUIREMENTS.md))
- ✅ دسترسی SSH به سرور
- ✅ دسترسی root یا sudo
- ✅ اطلاعات RMTO (username, password)
- ✅ دامنه یا IP ثابت (برای HTTPS)

</div>

---

## 🚀 روش 1: نصب خودکار (توصیه می‌شود)

<div dir="rtl">

### گام 1: اتصال به سرور

</div>

```bash
# اتصال با SSH
ssh root@YOUR_SERVER_IP

# یا با کاربر معمولی
ssh username@YOUR_SERVER_IP
```

<div dir="rtl">

### گام 2: دانلود و اجرای اسکریپت نصب

</div>

```bash
# دانلود اسکریپت نصب
wget https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/convert-tc-manager-to-cloud/server-install.sh

# قابل اجرا کردن
chmod +x server-install.sh

# اجرا با sudo
sudo ./server-install.sh
```

<div dir="rtl">

**⚠️ نکته مهم:** این دستورات را یک‌به‌یک اجرا کنید (با Enter بین هر خط). همه را در یک خط قرار ندهید.

اسکریپت به طور خودکار:
1. ✅ Node.js نصب می‌کند
2. ✅ PM2 نصب می‌کند
3. ✅ TC Manager را دانلود می‌کند
4. ✅ Dependencies نصب می‌کند
5. ✅ تنظیمات اولیه انجام می‌دهد
6. ✅ Application را start می‌کند

**تمام!** Application در حال اجراست.

دسترسی: `http://YOUR_SERVER_IP:3000`

</div>

---

## 🔧 روش 2: نصب دستی (قدم به قدم)

<div dir="rtl">

### مرحله 1: به‌روزرسانی سیستم

</div>

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/Rocky/Alma
sudo yum update -y
```

<div dir="rtl">

### مرحله 2: نصب Node.js

**Ubuntu/Debian:**

</div>

```bash
# نصب Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# بررسی نصب
node --version  # باید v18.x نمایش دهد
npm --version   # باید 9.x نمایش دهد
```

<div dir="rtl">

**CentOS/Rocky/Alma:**

</div>

```bash
# نصب Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# بررسی
node --version
npm --version
```

<div dir="rtl">

### مرحله 3: نصب PM2 (Process Manager)

</div>

```bash
# نصب PM2 globally
sudo npm install -g pm2

# بررسی
pm2 --version
```

<div dir="rtl">

### مرحله 4: نصب Git

</div>

```bash
# Ubuntu/Debian
sudo apt install -y git

# CentOS/Rocky/Alma
sudo yum install -y git

# بررسی
git --version
```

<div dir="rtl">

### مرحله 5: دانلود TC Manager

</div>

```bash
# رفتن به home directory
cd /home

# کلون کردن repository
sudo git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git tc-manager

# تغییر ownership
sudo chown -R $USER:$USER tc-manager

# رفتن به پوشه
cd tc-manager/server
```

<div dir="rtl">

### مرحله 6: نصب Dependencies

</div>

```bash
# نصب package‌ها
npm install --production

# بررسی موفقیت
ls node_modules  # باید پر از پوشه‌ها باشد
```

<div dir="rtl">

### مرحله 7: تنظیم Environment Variables

</div>

```bash
# کپی کردن فایل نمونه
cp .env.example .env

# ویرایش با nano
nano .env

# یا با vim
vim .env
```

<div dir="rtl">

**محتوای مهم `.env`:**

</div>

```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Admin
ADMIN_USER=admin
ADMIN_PASS=YOUR_SECURE_PASSWORD

# RMTO
RMTO_COMPANY_CODE=58
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=YOUR_RMTO_PASSWORD

# Security (اختیاری اما توصیه می‌شود)
DEVICE_API_KEY=YOUR_RANDOM_KEY
SESSION_SECRET=YOUR_RANDOM_SECRET
```

<div dir="rtl">

**نکته:** برای generate کردن کلیدهای امن:

</div>

```bash
# روش 1: با openssl
openssl rand -hex 32

# روش 2: با Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

<div dir="rtl">

### مرحله 8: تست اولیه

</div>

```bash
# تست اجرا (temporary)
node index.js

# باید خروجی مشابه این ببینید:
# ============================================
#   TC Manager Server (Noavaran Jonoob Shargh)
#   http://0.0.0.0:3000
#   Default login: admin / admin123
# ============================================

# برای خروج: Ctrl+C
```

<div dir="rtl">

### مرحله 9: راه‌اندازی با PM2

</div>

```bash
# Start با PM2
pm2 start index.js --name tc-manager

# بررسی وضعیت
pm2 list

# مشاهده logs
pm2 logs tc-manager

# راه‌اندازی خودکار با startup سیستم
pm2 startup
# دستوری که PM2 نمایش می‌دهد را اجرا کنید

# ذخیره لیست process‌ها
pm2 save
```

<div dir="rtl">

**دستورات مفید PM2:**

</div>

```bash
# مشاهده وضعیت
pm2 status
pm2 list

# مشاهده logs
pm2 logs tc-manager
pm2 logs tc-manager --lines 100

# restart
pm2 restart tc-manager

# stop
pm2 stop tc-manager

# حذف
pm2 delete tc-manager

# مانیتورینگ
pm2 monit
```

---

## 🌐 مرحله 10: تنظیم Nginx (Reverse Proxy)

<div dir="rtl">

### چرا Nginx؟

- ✅ **HTTPS/SSL**: برای امنیت
- ✅ **Performance**: بهینه‌سازی static files
- ✅ **Load Balancing**: اگر چند سرور داشتید
- ✅ **Security**: محافظت بیشتر

### نصب Nginx

</div>

```bash
# Ubuntu/Debian
sudo apt install -y nginx

# CentOS/Rocky/Alma
sudo yum install -y nginx

# شروع Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# بررسی
sudo systemctl status nginx
```

<div dir="rtl">

### پیکربندی Nginx

</div>

```bash
# ایجاد فایل config
sudo nano /etc/nginx/sites-available/tc-manager

# یا در CentOS
sudo nano /etc/nginx/conf.d/tc-manager.conf
```

<div dir="rtl">

**محتوای فایل config:**

</div>

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Redirect HTTP to HTTPS (بعد از نصب SSL)
    # return 301 https://$server_name$request_uri;

    # Location
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }

    # Static files (if needed)
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Max upload size (for backup files)
    client_max_body_size 500M;
}
```

<div dir="rtl">

### فعال‌سازی Config

**Ubuntu/Debian:**

</div>

```bash
# ایجاد symlink
sudo ln -s /etc/nginx/sites-available/tc-manager /etc/nginx/sites-enabled/

# حذف default config
sudo rm /etc/nginx/sites-enabled/default

# تست config
sudo nginx -t

# restart Nginx
sudo systemctl restart nginx
```

<div dir="rtl">

**CentOS:**

</div>

```bash
# تست config
sudo nginx -t

# restart
sudo systemctl restart nginx
```

<div dir="rtl">

### بررسی

حالا باید بتونید با آدرس زیر دسترسی داشته باشید:

</div>

```
http://YOUR_SERVER_IP
یا
http://YOUR_DOMAIN
```

---

## 🔒 مرحله 11: نصب SSL/HTTPS (Let's Encrypt)

<div dir="rtl">

### نصب Certbot

</div>

```bash
# Ubuntu/Debian
sudo apt install -y certbot python3-certbot-nginx

# CentOS/Rocky/Alma
sudo yum install -y certbot python3-certbot-nginx
```

<div dir="rtl">

### دریافت SSL Certificate

</div>

```bash
# اجرای certbot
sudo certbot --nginx -d YOUR_DOMAIN

# یا برای چند subdomain
sudo certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN
```

<div dir="rtl">

Certbot به طور خودکار:
1. SSL certificate دریافت می‌کند
2. Nginx config را به‌روز می‌کند
3. HTTP به HTTPS redirect می‌کند

### تمدید خودکار

Let's Encrypt certificates هر 90 روز expire می‌شوند.

</div>

```bash
# تست تمدید
sudo certbot renew --dry-run

# اگر موفق بود، تمدید خودکار فعال است
# Ubuntu به طور خودکار یک cronjob اضافه می‌کند
```

<div dir="rtl">

### بررسی HTTPS

</div>

```
https://YOUR_DOMAIN
```

<div dir="rtl">

باید:
- ✅ قفل سبز در مرورگر ببینید
- ✅ Certificate معتبر باشد
- ✅ HTTP به HTTPS redirect شود

</div>

---

## 🔥 مرحله 12: تنظیم Firewall

<div dir="rtl">

### UFW (Ubuntu/Debian)

</div>

```bash
# نصب UFW
sudo apt install -y ufw

# قوانین پایه
sudo ufw default deny incoming
sudo ufw default allow outgoing

# اجازه SSH (مهم! قبل از enable کردن)
sudo ufw allow 22/tcp

# یا محدود به IP خاص (امن‌تر)
sudo ufw allow from YOUR_IP_ADDRESS to any port 22

# اجازه HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# فعال‌سازی
sudo ufw enable

# بررسی
sudo ufw status verbose
```

<div dir="rtl">

### firewalld (CentOS/Rocky/Alma)

</div>

```bash
# شروع firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld

# اجازه‌ها
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# reload
sudo firewall-cmd --reload

# بررسی
sudo firewall-cmd --list-all
```

---

## 🛡️ مرحله 13: امنیت اضافی

<div dir="rtl">

### نصب fail2ban

**محافظت در برابر brute force attacks**

</div>

```bash
# نصب
sudo apt install -y fail2ban  # Ubuntu/Debian
sudo yum install -y fail2ban  # CentOS

# شروع
sudo systemctl start fail2ban
sudo systemctl enable fail2ban

# بررسی
sudo fail2ban-client status
```

<div dir="rtl">

### غیرفعال کردن Root Login

</div>

```bash
# ویرایش SSH config
sudo nano /etc/ssh/sshd_config

# تغییر این خطوط:
PermitRootLogin no
PasswordAuthentication no  # فقط اگر SSH key دارید

# restart SSH
sudo systemctl restart sshd
```

<div dir="rtl">

### تنظیم Auto Updates

</div>

```bash
# Ubuntu/Debian
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# CentOS
sudo yum install -y yum-cron
sudo systemctl enable --now yum-cron
```

---

## 💾 مرحله 14: تنظیم Backup خودکار

<div dir="rtl">

### ایجاد اسکریپت Backup

</div>

```bash
# ایجاد پوشه backups
mkdir -p /home/tc-manager-backups

# ایجاد اسکریپت
nano /home/backup-tc-manager.sh
```

<div dir="rtl">

**محتوای اسکریپت:**

</div>

```bash
#!/bin/bash

# تنظیمات
BACKUP_DIR="/home/tc-manager-backups"
APP_DIR="/home/tc-manager"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="tc-manager-backup-$DATE.tar.gz"

# ایجاد backup
cd $APP_DIR
tar -czf $BACKUP_DIR/$BACKUP_FILE \
    server/data.db \
    server/.env \
    --exclude='node_modules' \
    --exclude='uploads'

# حذف backups قدیمی‌تر از 30 روز
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

<div dir="rtl">

### تنظیم Cronjob برای Backup روزانه

</div>

```bash
# قابل اجرا کردن
chmod +x /home/backup-tc-manager.sh

# ویرایش crontab
crontab -e

# اضافه کردن این خط (backup روزانه ساعت 2 صبح)
0 2 * * * /home/backup-tc-manager.sh >> /var/log/tc-backup.log 2>&1
```

<div dir="rtl">

### تست Backup

</div>

```bash
# اجرای دستی
/home/backup-tc-manager.sh

# بررسی
ls -lh /home/tc-manager-backups/
```

---

## 📊 مرحله 15: نصب Monitoring (اختیاری اما توصیه می‌شود)

<div dir="rtl">

### نصب Netdata

**Monitoring real-time رایگان و قدرتمند**

</div>

```bash
# نصب با یک دستور
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# دسترسی
# http://YOUR_SERVER_IP:19999
```

<div dir="rtl">

**امن‌سازی Netdata:**

</div>

```bash
# محدود کردن به localhost فقط
sudo nano /etc/netdata/netdata.conf

# تغییر این خط:
[web]
    bind to = 127.0.0.1

# restart
sudo systemctl restart netdata
```

<div dir="rtl">

سپس از طریق Nginx reverse proxy دسترسی داشته باشید.

</div>

---

## ✅ مرحله 16: بررسی نهایی

<div dir="rtl">

### Checklist تست

- [ ] Application در حال اجراست: `pm2 list`
- [ ] HTTP کار می‌کند: `http://YOUR_IP`
- [ ] HTTPS کار می‌کند: `https://YOUR_DOMAIN`
- [ ] Login کار می‌کند: admin / password
- [ ] Health check: `/health`
- [ ] Device API: `POST /api/data`
- [ ] Firewall فعال است: `sudo ufw status`
- [ ] SSL معتبر است (قفل سبز)
- [ ] Backup تنظیم شده: `crontab -l`
- [ ] PM2 startup فعال است: `pm2 list`

### دستورات مفید بررسی

</div>

```bash
# بررسی وضعیت services
sudo systemctl status nginx
pm2 status

# بررسی logs
pm2 logs tc-manager
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# بررسی resources
htop
df -h
free -h

# بررسی ports
sudo netstat -tulpn | grep LISTEN
# یا
sudo ss -tulpn | grep LISTEN

# بررسی uptime
uptime
pm2 status
```

---

## 🐛 رفع مشکلات | Troubleshooting

<div dir="rtl">

### خطا 404 هنگام دانلود اسکریپت

**علامت:**
```
ERROR 404: Not Found
```

**علت:**
- آدرس اشتباه یا branch غلط
- فایل در branch اصلی (main) وجود ندارد

**راه‌حل:**
از آدرس صحیح با branch صحیح استفاده کنید:

</div>

```bash
# ✅ درست
wget https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/convert-tc-manager-to-cloud/server-install.sh

# ❌ اشتباه
wget https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/main/server-install.sh
```

<div dir="rtl">

**نکته:** دستورات را جداگانه اجرا کنید، نه همه در یک خط.

### Application start نمی‌شود

**بررسی:**

</div>

```bash
# لاگ‌های PM2
pm2 logs tc-manager --lines 100

# اجرای مستقیم برای دیدن خطا
cd /home/tc-manager/server
node index.js
```

<div dir="rtl">

**علت‌های احتمالی:**
- Dependencies نصب نشده: `npm install`
- `.env` وجود ندارد: `cp .env.example .env`
- پورت 3000 اشغال است: `sudo lsof -i :3000`

### Nginx خطا می‌دهد

</div>

```bash
# تست config
sudo nginx -t

# مشاهده خطاها
sudo tail -f /var/log/nginx/error.log

# restart
sudo systemctl restart nginx
```

<div dir="rtl">

### SSL کار نمی‌کند

</div>

```bash
# بررسی certificate
sudo certbot certificates

# تمدید دستی
sudo certbot renew

# مشاهده لاگ
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

<div dir="rtl">

### Database خطا می‌دهد

</div>

```bash
# بررسی فایل database
ls -lh /home/tc-manager/server/data.db

# permissions
sudo chown $USER:$USER /home/tc-manager/server/data.db

# بررسی فضای disk
df -h
```

<div dir="rtl">

### Performance کند است

</div>

```bash
# بررسی resources
htop
free -h
df -h

# بررسی PM2
pm2 monit

# نیاز به upgrade سرور؟
```

---

## 🔄 بروزرسانی Application

<div dir="rtl">

### نحوه Update

</div>

```bash
# رفتن به پوشه
cd /home/tc-manager

# Pull آخرین تغییرات
git pull origin main

# نصب dependencies جدید (اگر هست)
cd server
npm install

# restart application
pm2 restart tc-manager

# بررسی
pm2 logs tc-manager
```

<div dir="rtl">

### Update با Downtime کم

</div>

```bash
# 1. Backup
/home/backup-tc-manager.sh

# 2. Pull
cd /home/tc-manager
git pull

# 3. Install
cd server
npm install

# 4. Test (در terminal دیگر)
node index.js
# Ctrl+C بعد از اطمینان

# 5. Restart
pm2 restart tc-manager

# کل فرآیند: < 1 دقیقه downtime
```

---

## 📚 منابع اضافی

<div dir="rtl">

- [مشخصات سرور مورد نیاز](SERVER-REQUIREMENTS.md)
- [راهنمای Backup و Restore](BACKUP-RESTORE.md)
- [راهنمای API](API.md)
- [مستندات PM2](https://pm2.keymetrics.io/docs/)
- [مستندات Nginx](https://nginx.org/en/docs/)
- [مستندات Let's Encrypt](https://letsencrypt.org/docs/)

</div>

---

## 🎉 تمام!

<div dir="rtl">

الان TC Manager شما روی سرور اختصاصی در حال اجراست!

می‌تونید:
- ✅ از هر جا دسترسی داشته باشید
- ✅ با HTTPS امن کار کنید
- ✅ دستگاه‌هاتون رو وصل کنید
- ✅ 24/7 داده جمع‌آوری کنید
- ✅ به RMTO ارسال کنید

**موفق باشید!** 🚀

</div>

---

**تاریخ:** ۱۴۰۴/۱۱/۳۰  
**نسخه:** ۱.۰.۰  
**وضعیت:** ✅ تست شده و آماده
