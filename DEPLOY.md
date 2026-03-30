# راهنمای استقرار با موبایل (Termux) برای سرور بدون اینترنت

این پروژه را می‌توانید با موبایل هم به‌روزرسانی کنید.  
اگر سرور اصلی اینترنت ندارد، **روش پیشنهادی برای آپدیت کد** این است که فقط فایل‌های تغییرکرده را کپی کنید و سرویس را ری‌استارت کنید.

## 1) آماده‌سازی Termux روی موبایل

```bash
pkg update -y
pkg upgrade -y
pkg install -y openssh rsync
```

> اگر `scp` یا `ssh` از قبل در Termux دارید، همین کافی است.

## 2) تست اتصال SSH

```bash
ssh root@SERVER_IP
```

اگر اولین بار وصل می‌شوید، `yes` بزنید و پسورد را وارد کنید.

## 2.1) سناریوی VPN (دانلود با VPN، انتقال بدون VPN)

اگر روی موبایل برای دانلود نیاز به VPN دارید ولی برای ارتباط با سرور باید VPN خاموش باشد، این ترتیب را انجام دهید:

### مرحله A: با VPN روشن فقط دانلود/دریافت فایل
فایل‌های لازم را داخل حافظه Termux ذخیره کنید (مثلاً مسیر Home):

```bash
mkdir -p ~/tc-deploy
cd ~/tc-deploy
# اینجا فایل‌ها را دانلود یا کپی کنید
```

### مرحله B: VPN را خاموش کنید، سپس انتقال به سرور
بعد از خاموش‌کردن VPN، از همان فایل‌های ذخیره‌شده در Termux به سرور کپی کنید:

```bash
cd ~/tc-deploy
scp server/scheduler.js server/index.js server/db.js root@SERVER_IP:/opt/tc-manager/server/
scp js/app.js root@SERVER_IP:/opt/tc-manager/js/
scp index.html root@SERVER_IP:/opt/tc-manager/
ssh root@SERVER_IP 'systemctl restart tc-manager && systemctl status tc-manager --no-pager -l'
```

این کار باعث می‌شود لازم نباشد هنگام انتقال به سرور، VPN روشن باشد.

## 3) آپدیت کامل (فقط وقتی سرور پیش‌نیازها را دارد)

دستور کامل:

```bash
scp deploy-all.sh root@SERVER_IP:/tmp/
ssh root@SERVER_IP 'bash /tmp/deploy-all.sh'
```

⚠️ نکته مهم: `deploy-all.sh` برای نصب Node.js/NPM و وابستگی‌ها ممکن است به اینترنت روی خود سرور نیاز داشته باشد.  
اگر سرور اینترنت ندارد و وابستگی جدید لازم باشد، این روش ممکن است ناموفق شود.

## 4) آپدیت فقط کد (مناسب سرور بدون اینترنت)

این روش برای وقتی است که فقط فایل‌های کد عوض شده‌اند و وابستگی جدید اضافه نشده:

```bash
scp server/scheduler.js server/index.js server/db.js root@SERVER_IP:/opt/tc-manager/server/
scp js/app.js root@SERVER_IP:/opt/tc-manager/js/
scp index.html root@SERVER_IP:/opt/tc-manager/
ssh root@SERVER_IP 'systemctl restart tc-manager && systemctl status tc-manager --no-pager -l'
```

### نکته مسیر فایل‌ها
- چون مقصد یک پوشه است (`/opt/tc-manager/`)، بهتر است مسیرها را دقیق بزنید یا از داخل ریشه پروژه دستور را اجرا کنید.
- اگر خواستید ساختار پوشه‌ها ۱۰۰٪ حفظ شود، از `rsync` استفاده کنید:

```bash
rsync -avz server/scheduler.js server/index.js server/db.js root@SERVER_IP:/opt/tc-manager/server/
rsync -avz js/app.js root@SERVER_IP:/opt/tc-manager/js/
rsync -avz index.html root@SERVER_IP:/opt/tc-manager/
ssh root@SERVER_IP 'systemctl restart tc-manager'
```

## 5) بررسی سلامت بعد از استقرار

```bash
ssh root@SERVER_IP 'systemctl is-active tc-manager && journalctl -u tc-manager -n 100 --no-pager'
```

اگر خروجی `active` بود یعنی سرویس بالا است.

## 6) سناریوی اضطراری (Rollback سریع)

قبل از کپی فایل جدید:

```bash
ssh root@SERVER_IP 'cp /opt/tc-manager/server/index.js /opt/tc-manager/server/index.js.bak'
```

در صورت مشکل:

```bash
ssh root@SERVER_IP 'cp /opt/tc-manager/server/index.js.bak /opt/tc-manager/server/index.js && systemctl restart tc-manager'
```

---

## چک‌لیست کوتاه برای موبایل

1. ورود به Termux  
2. (در صورت نیاز) دانلود فایل‌ها با VPN روشن داخل `~/tc-deploy`  
3. خاموش‌کردن VPN  
4. تست `ssh root@SERVER_IP`  
5. اجرای `scp` برای فایل‌های تغییرکرده  
6. `systemctl restart tc-manager`  
7. بررسی `systemctl status` و `journalctl`
