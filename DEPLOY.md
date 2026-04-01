# راهنمای انتقال و آپلود روی سرور (مرحله‌به‌مرحله)

این راهنما برای همین مخزن نوشته شده و بر اساس اسکریپت‌های موجود (`deploy-all.sh` و `server/deploy-part*.sh`) است.

---

## 1) پیش‌نیازها

- سیستم شما باید `ssh` و `scp` داشته باشد.
- دسترسی `root` به سرور داشته باشید.
- IP سرور را بدانید (در مثال‌ها: `SERVER_IP`).
- اگر سرور اصلی اینترنت ندارد، یک دستگاه واسط (مثلاً Termux) که موقتاً با VPN آنلاین می‌شود در دسترس داشته باشید.

---

## 2) سناریوی شما: انتقال دو مرحله‌ای با Termux (ریپو → Termux → سرور)

این بخش دقیقاً برای حالتی است که گفتید:
- مرحله اول با VPN: فایل‌ها را از سیستم/ریپو به Termux منتقل می‌کنید.
- مرحله دوم بدون VPN: از Termux به سرور اصلی آپلود و دیپلوی می‌کنید.

### فاز A) زمانی که VPN روشن است (انتقال به Termux)

#### A-0) (روش مستقیم) اگر می‌خواهید از خود GitHub روی Termux بگیرید
```bash
pkg install -y git openssh
mkdir -p ~/tc-deploy
cd ~/tc-deploy
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git
cd ~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-
git pull
```
> اگر این روش را انجام دادید، دیگر نیازی به `scp` از سیستم اصلی به Termux ندارید و می‌توانید مستقیم به فاز B بروید.

#### A-1) روی Termux یک پوشه ثابت بسازید
```bash
mkdir -p ~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-
```

#### A-2) روی سیستم اصلی مسیر پروژه را در متغیر قرار دهید
```bash
REPO_PATH="/path/to/web-monitoring-Intelligent-Vehicle-Traffic-"
```
> خط فاصله انتهای نام (`...Traffic-`) بخشی از نام همین ریپازیتوری است.

#### A-3) روی Termux نام کاربری دقیق را پیدا کنید
```bash
whoami
```
> خروجی معمولاً شکلی مثل `u0_a123` دارد. همان را به‌جای `TERMUX_USER` قرار دهید.

#### A-4) از سیستم اصلی، فایل دیپلوی را به Termux بفرستید
> IP و پورت SSH Termux را با مقدار واقعی خودتان جایگزین کنید.
```bash
scp "$REPO_PATH/deploy-all.sh" TERMUX_USER@TERMUX_IP:~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-/
```

#### A-5) (اختیاری) برای آپدیت سریع، اسکریپت‌های part را هم بفرستید
```bash
scp "$REPO_PATH/server/deploy-part1-server.sh" TERMUX_USER@TERMUX_IP:~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-/
scp "$REPO_PATH/server/deploy-part2-frontend.sh" TERMUX_USER@TERMUX_IP:~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-/
scp "$REPO_PATH/server/deploy-part4-css-js.sh" TERMUX_USER@TERMUX_IP:~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-/
```

#### A-6) روی خود Termux چک کنید فایل‌ها رسیده باشند
```bash
cd ~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-
pwd
ls -lh
```

### فاز B) VPN را خاموش کنید و از Termux به سرور اصلی بفرستید

#### B-1) در Termux داخل همان مسیر بروید
```bash
cd ~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-
```

#### B-2) انتقال اسکریپت اصلی به سرور
```bash
scp deploy-all.sh root@SERVER_IP:/tmp/
```

#### B-3) اجرای دیپلوی روی سرور
```bash
ssh root@SERVER_IP "bash /tmp/deploy-all.sh"
```

#### B-4) بررسی سرویس پس از دیپلوی
```bash
ssh root@SERVER_IP "systemctl status tc-manager --no-pager"
ssh root@SERVER_IP "journalctl -u tc-manager -n 100 --no-pager"
ssh root@SERVER_IP "nginx -t"
```

---

## 3) بررسی اولیه در سیستم خودتان

اگر `REPO_PATH` را در مراحل قبل تنظیم کرده‌اید:

```bash
cd "$REPO_PATH"
```

بررسی صحت سینتکس (قبل از آپلود):

```bash
bash -n deploy-all.sh
bash -n server/deploy-part1-server.sh
bash -n server/deploy-part2-frontend.sh
bash -n server/deploy-part4-css-js.sh
node --check js/app.js
node --check server/index.js
node --check server/scheduler.js
node --check server/rmto-client.js
node --check server/db.js
```

---

## 4) روش اصلی و ساده (دیپلوی کامل)

### مرحله 4-1) ارسال اسکریپت به سرور

```bash
scp "$REPO_PATH/deploy-all.sh" root@SERVER_IP:/tmp/
```

### مرحله 4-2) اجرای اسکریپت روی سرور

```bash
ssh root@SERVER_IP "bash /tmp/deploy-all.sh"
```

> این اسکریپت به‌صورت خودکار:
> - فایل‌ها را در `/opt/tc-manager` می‌ریزد
> - `npm install --production` را اجرا می‌کند
> - سرویس `tc-manager` (systemd) را می‌سازد/به‌روزرسانی می‌کند
> - nginx را تنظیم می‌کند
> - سرویس را بالا می‌آورد

### مرحله 4-3) بررسی وضعیت بعد از آپلود

```bash
ssh root@SERVER_IP "systemctl status tc-manager --no-pager"
ssh root@SERVER_IP "journalctl -u tc-manager -n 100 --no-pager"
ssh root@SERVER_IP "nginx -t"
```

---

## 5) روش ریست کامل (وقتی دیتابیس جدید می‌خواهید)

اگر بخواهید دیتابیس قبلی حذف شود:

```bash
ssh root@SERVER_IP "bash /tmp/deploy-all.sh --fresh"
```

> گزینه `--fresh` دیتابیس قبلی (`data.db`) را پاک می‌کند.

---

## 6) آپدیت سریع فقط کد (بدون دیپلوی کامل)

اگر فقط فایل‌های برنامه عوض شده‌اند، می‌توانید از اسکریپت‌های بخش‌بندی‌شده استفاده کنید:

### فقط بک‌اند
```bash
scp "$REPO_PATH/server/deploy-part1-server.sh" root@SERVER_IP:/tmp/
ssh root@SERVER_IP "bash /tmp/deploy-part1-server.sh && systemctl restart tc-manager"
```

### فقط فرانت‌اند
```bash
scp "$REPO_PATH/server/deploy-part2-frontend.sh" root@SERVER_IP:/tmp/
ssh root@SERVER_IP "bash /tmp/deploy-part2-frontend.sh && systemctl restart tc-manager"
```

### فقط CSS/JS
```bash
scp "$REPO_PATH/server/deploy-part4-css-js.sh" root@SERVER_IP:/tmp/
ssh root@SERVER_IP "bash /tmp/deploy-part4-css-js.sh && systemctl restart tc-manager"
```

---

## 7) چک نهایی بعد از هر آپلود

```bash
ssh root@SERVER_IP "systemctl is-active tc-manager"
ssh root@SERVER_IP "journalctl -u tc-manager -n 50 --no-pager"
ssh root@SERVER_IP "ss -lntp | grep -E ':80|:3000|:2022' || true"
```

- پورت `80` برای وب (nginx)
- پورت `3000` برای Node.js
- پورت `2022` برای دریافت TCP دستگاه‌ها

---

## 8) عیب‌یابی سریع

- اگر سرویس بالا نیامد:
  ```bash
  ssh root@SERVER_IP "journalctl -u tc-manager -n 200 --no-pager"
  ```
- اگر nginx مشکل داشت:
  ```bash
  ssh root@SERVER_IP "nginx -t && systemctl reload nginx"
  ```
- اگر فقط کد عوض شده و deploy کامل طولانی است، از روش «آپدیت سریع فقط کد» استفاده کنید.
