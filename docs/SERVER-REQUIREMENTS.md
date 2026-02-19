# مشخصات سرور مورد نیاز - TC Manager
# Server Requirements for TC Manager

<div dir="rtl">

این سند مشخصات سخت‌افزاری و نرم‌افزاری سرور برای اجرای TC Manager را توضیح می‌دهد.

</div>

---

## 💻 مشخصات سخت‌افزاری | Hardware Requirements

<div dir="rtl">

### برای تست و Development

| مشخصه | حداقل | توصیه می‌شود |
|-------|-------|---------------|
| **CPU** | 1 Core | 2 Cores |
| **RAM** | 512 MB | 1 GB |
| **Storage** | 5 GB | 10 GB SSD |
| **Network** | 100 Mbps | 1 Gbps |
| **تعداد دستگاه** | تا 10 | تا 50 |

### برای Production (کوچک)

| مشخصه | مقدار |
|-------|-------|
| **CPU** | 2 Cores (2.4+ GHz) |
| **RAM** | 2 GB |
| **Storage** | 20 GB SSD |
| **Network** | 1 Gbps |
| **Bandwidth** | حداقل 1 TB/ماه |
| **تعداد دستگاه** | 50-100 |

### برای Production (متوسط)

| مشخصه | مقدار |
|-------|-------|
| **CPU** | 4 Cores (2.8+ GHz) |
| **RAM** | 4 GB |
| **Storage** | 50 GB SSD |
| **Network** | 1 Gbps |
| **Bandwidth** | حداقل 2 TB/ماه |
| **تعداد دستگاه** | 100-300 |

### برای Production (بزرگ)

| مشخصه | مقدار |
|-------|-------|
| **CPU** | 8+ Cores (3+ GHz) |
| **RAM** | 8+ GB |
| **Storage** | 100+ GB SSD |
| **Network** | 10 Gbps |
| **Bandwidth** | نامحدود |
| **تعداد دستگاه** | 300+ |

</div>

---

## 🖥️ سیستم عامل | Operating System

<div dir="rtl">

### پشتیبانی شده (توصیه می‌شود)

#### Linux (توصیه می‌شود)
- ✅ **Ubuntu 20.04 LTS** یا بالاتر ⭐ (توصیه ویژه)
- ✅ **Ubuntu 22.04 LTS** ⭐
- ✅ **Debian 11** یا بالاتر
- ✅ **CentOS 8** / **Rocky Linux 8**
- ✅ **AlmaLinux 8**

#### Windows Server
- ✅ **Windows Server 2019** یا بالاتر
- ✅ **Windows Server 2022**

### چرا Ubuntu 20.04/22.04؟

1. ✅ **رایگان و open source**
2. ✅ **پایدار و امن** (LTS = Long Term Support)
3. ✅ **مستندات زیاد**
4. ✅ **Community بزرگ**
5. ✅ **Update‌های منظم امنیتی**
6. ✅ **سازگاری عالی با Node.js**

</div>

---

## 📦 نرم‌افزارهای مورد نیاز | Required Software

<div dir="rtl">

### الزامی

1. **Node.js**
   - نسخه: 18.x LTS یا بالاتر
   - نصب: از [nodejs.org](https://nodejs.org) یا repository رسمی

2. **npm**
   - نسخه: 9.x یا بالاتر
   - معمولاً با Node.js نصب می‌شود

3. **Git** (اختیاری اما توصیه می‌شود)
   - برای کلون کردن repository

### توصیه می‌شود

1. **PM2** - Process Manager
   - برای اجرای 24/7 و restart خودکار
   - `npm install -g pm2`

2. **Nginx** یا **Apache** - Web Server
   - برای reverse proxy
   - SSL/HTTPS termination
   - Load balancing (اگر نیاز باشد)

3. **Certbot** - SSL Certificate
   - برای HTTPS رایگان (Let's Encrypt)

4. **UFW** یا **firewalld** - Firewall
   - برای امنیت شبکه

5. **fail2ban** - Intrusion Prevention
   - محافظت در برابر brute force

</div>

---

## 🌐 شبکه و پورت‌ها | Network & Ports

<div dir="rtl">

### پورت‌های مورد نیاز

| پورت | پروتکل | استفاده | دسترسی |
|------|---------|----------|---------|
| **22** | TCP | SSH | فقط IP مدیر |
| **80** | TCP | HTTP | همه (redirect به HTTPS) |
| **443** | TCP | HTTPS | همه |
| **3000** | TCP | Node.js (داخلی) | localhost فقط |

### پیکربندی Firewall

```bash
# اجازه SSH
ufw allow 22/tcp

# اجازه HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# پورت 3000 فقط از localhost
# (Nginx به عنوان reverse proxy استفاده می‌کنیم)

# فعال‌سازی firewall
ufw enable
```

</div>

---

## 💾 دیتابیس | Database

<div dir="rtl">

### گزینه 1: SQLite (پیش‌فرض)

**مناسب برای:**
- تا 100 دستگاه
- یک سرور
- ساده‌ترین راه

**نیاز:**
- فضای disk: 500 MB - 5 GB (بسته به داده)
- حافظه: بخشی از RAM اصلی
- فایل: `server/data.db`

### گزینه 2: PostgreSQL

**مناسب برای:**
- بیش از 100 دستگاه
- چندین سرور (clustering)
- تراکنش‌های زیاد

**مشخصات اضافی:**
- CPU: +1 Core
- RAM: +1 GB
- Storage: +10 GB

**نصب:**
```bash
sudo apt install postgresql postgresql-contrib
```

</div>

---

## 📊 تخمین مصرف منابع | Resource Estimation

<div dir="rtl">

### محاسبه RAM مورد نیاز

**فرمول تقریبی:**
```
RAM مورد نیاز = RAM پایه + (تعداد دستگاه × 2 MB)
```

**مثال:**
- 50 دستگاه: 1 GB + (50 × 2 MB) = 1.1 GB → **2 GB توصیه می‌شود**
- 100 دستگاه: 1 GB + (100 × 2 MB) = 1.2 GB → **2 GB توصیه می‌شود**
- 300 دستگاه: 1 GB + (300 × 2 MB) = 1.6 GB → **4 GB توصیه می‌شود**

### محاسبه Storage مورد نیاز

**فرمول تقریبی:**
```
Storage روزانه = تعداد دستگاه × داده هر دستگاه × 24 ساعت
```

**فرض:**
- هر دستگاه هر 15 دقیقه 1 رکورد ارسال می‌کند
- هر رکورد حدود 200 byte حافظه می‌گیرد

**محاسبه:**
```
رکوردهای روزانه = دستگاه × (24 × 60 / 15) = دستگاه × 96
حجم روزانه = رکوردهای روزانه × 200 byte
```

**مثال:**
- 50 دستگاه: 50 × 96 × 200 = ~0.9 MB/روز → **320 MB/سال**
- 100 دستگاه: 100 × 96 × 200 = ~1.8 MB/روز → **650 MB/سال**
- 300 دستگاه: 300 × 96 × 200 = ~5.5 MB/روز → **2 GB/سال**

**توصیه:** 
- برای safe بودن، 3-5 برابر محاسبه بالا در نظر بگیرید
- حداقل 20 GB SSD برای سیستم + database

### محاسبه Bandwidth

**فرمول:**
```
Bandwidth ماهانه = تعداد دستگاه × داده ارسالی روزانه × 30
```

**مثال:**
- 100 دستگاه با 100 KB/دستگاه/روز: 100 × 100 KB × 30 = ~300 MB/ماه
- با احتساب overhead و RMTO: × 3 = **~1 GB/ماه**

**توصیه:**
- حداقل 1 TB/ماه bandwidth برای اطمینان

</div>

---

## 🏢 ارائه‌دهندگان VPS توصیه شده | Recommended VPS Providers

<div dir="rtl">

### داخلی (ایران)

| ارائه‌دهنده | قیمت تقریبی | مشخصات پایه | لینک |
|-------------|-------------|-------------|------|
| **آبرآروان** | از 150k تومان/ماه | 2 Core, 2GB RAM, 40GB SSD | abrarvan.com |
| **ایران سرور** | از 200k تومان/ماه | 2 Core, 2GB RAM, 30GB SSD | iranserver.com |
| **پارس پک** | از 180k تومان/ماه | 2 Core, 2GB RAM, 40GB SSD | parspack.com |
| **آسیاتک** | از 150k تومان/ماه | 2 Core, 2GB RAM, 40GB SSD | asiatech.ir |

### خارجی (بین‌الملل)

| ارائه‌دهنده | قیمت تقریبی | مشخصات پایه | ویژگی |
|-------------|-------------|-------------|--------|
| **DigitalOcean** | از $12/ماه | 2 Core, 2GB RAM, 50GB SSD | ساده، مستندات عالی |
| **Linode** | از $12/ماه | 2 Core, 4GB RAM, 80GB SSD | Performance خوب |
| **Vultr** | از $12/ماه | 2 Core, 4GB RAM, 80GB SSD | لوکیشن‌های زیاد |
| **Hetzner** | از €4.5/ماه | 2 Core, 4GB RAM, 40GB SSD | قیمت عالی، آلمان |

### توصیه بر اساس موقعیت

**اگر دستگاه‌ها در ایران هستند:**
- ✅ VPS ایرانی (latency کمتر، سرعت بیشتر)
- ✅ IP ایرانی (بدون فیلترینگ)

**اگر دستگاه‌ها بین‌المللی هستند:**
- ✅ VPS خارجی (uptime بهتر)
- ✅ CDN برای سرعت بیشتر

</div>

---

## ⚙️ پیکربندی توصیه شده | Recommended Configuration

<div dir="rtl">

### برای شروع (Budget)

**مشخصات:**
- CPU: 2 Cores
- RAM: 2 GB
- Storage: 40 GB SSD
- قیمت: ~$12/ماه یا 200k تومان/ماه

**مناسب برای:**
- تا 50 دستگاه
- Test و pilot
- بودجه محدود

### برای Production (توصیه)

**مشخصات:**
- CPU: 4 Cores
- RAM: 4 GB
- Storage: 80 GB SSD
- قیمت: ~$25/ماه یا 400k تومان/ماه

**مناسب برای:**
- 100-300 دستگاه
- Production واقعی
- Reliable و fast

### برای Enterprise

**مشخصات:**
- CPU: 8+ Cores
- RAM: 8+ GB
- Storage: 160+ GB SSD
- Backup: Secondary server
- قیمت: ~$80/ماه یا 1.5M تومان/ماه

**مناسب برای:**
- 300+ دستگاه
- High availability
- Mission critical

</div>

---

## 🔒 ملاحظات امنیتی | Security Considerations

<div dir="rtl">

### الزامی

1. ✅ **SSH Key Authentication**
   - غیرفعال کردن password login
   - استفاده از SSH keys

2. ✅ **Firewall**
   - فقط پورت‌های لازم باز باشند
   - محدود کردن SSH به IP مشخص

3. ✅ **SSL/HTTPS**
   - حتماً از HTTPS استفاده کنید
   - Let's Encrypt رایگان است

4. ✅ **Auto Updates**
   - security updates خودکار
   - `unattended-upgrades` در Ubuntu

5. ✅ **Backup منظم**
   - روزانه backup از database
   - ذخیره backup در location جداگانه

### توصیه می‌شود

1. ⭐ **fail2ban** - محافظت از brute force
2. ⭐ **Monitoring** - نظارت بر سرور (Netdata, Grafana)
3. ⭐ **Log Management** - مدیریت لاگ‌ها
4. ⭐ **Intrusion Detection** - شناسایی نفوذ (AIDE)

</div>

---

## 📈 مانیتورینگ و نگهداری | Monitoring & Maintenance

<div dir="rtl">

### ابزارهای Monitoring

1. **PM2 Monitoring**
   ```bash
   pm2 list
   pm2 monit
   pm2 logs
   ```

2. **Netdata** (رایگان، توصیه می‌شود)
   - نظارت real-time
   - نصب آسان
   - Web interface

3. **htop** / **glances**
   - مانیتور command-line
   - بررسی CPU, RAM, Network

### وظایف نگهداری

**روزانه:**
- بررسی لاگ‌ها
- بررسی disk space
- بررسی uptime

**هفتگی:**
- بررسی backup‌ها
- بررسی security updates
- بررسی performance

**ماهانه:**
- تمیز کردن لاگ‌های قدیمی
- بررسی database size
- optimization و cleanup

</div>

---

## ✅ Checklist انتخاب سرور | Server Selection Checklist

<div dir="rtl">

قبل از خرید/اجاره سرور، این موارد را بررسی کنید:

- [ ] CPU کافی است؟ (حداقل 2 cores)
- [ ] RAM کافی است؟ (حداقل 2 GB)
- [ ] Storage SSD است؟ (نه HDD)
- [ ] Bandwidth کافی است؟ (حداقل 1 TB/ماه)
- [ ] لوکیشن مناسب است؟ (نزدیک به دستگاه‌ها)
- [ ] پشتیبانی خوب دارد؟
- [ ] قیمت منطقی است؟
- [ ] امکان upgrade دارد؟
- [ ] Backup رایگان/ارزان دارد؟
- [ ] Snapshot/Backup سیستم دارد؟

</div>

---

## 🆘 سوالات متداول | FAQ

<div dir="rtl">

### سوال: SQLite یا PostgreSQL؟

**پاسخ:** 
- تا 100 دستگاه: SQLite (ساده‌تر)
- بیش از 100 دستگاه: PostgreSQL (قدرتمندتر)

### سوال: Ubuntu یا CentOS؟

**پاسخ:** Ubuntu 20.04/22.04 LTS (راحت‌تر و مستندات بیشتر)

### سوال: چقدر حافظه نیاز دارم؟

**پاسخ:** 
- پایه: 1 GB
- هر 50 دستگاه: +1 GB
- Safe: 2x محاسبه بالا

### سوال: VPS ایرانی یا خارجی؟

**پاسخ:**
- دستگاه‌ها در ایران: VPS ایرانی
- دستگاه‌ها بین‌المللی: VPS خارجی
- مهم: latency پایین

### سوال: چطور scale up کنم؟

**پاسخ:**
1. شروع با VPS کوچک
2. Monitor کردن resources
3. Upgrade وقتی نیاز شد (CPU, RAM)
4. یا اضافه کردن سرور دوم (Load Balancer)

</div>

---

## 📞 کمک بیشتر

<div dir="rtl">

برای راهنمای نصب و deploy:
- 📖 [راهنمای نصب روی سرور](SERVER-DEPLOYMENT.md)
- 📖 [راهنمای Cloud](DEPLOY-CLOUD.md)
- 📖 [راهنمای Docker](../README.md#docker)

</div>

---

**تاریخ:** ۱۴۰۴/۱۱/۳۰  
**نسخه:** ۱.۰.۰  
**وضعیت:** ✅ آماده استفاده
