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
# پیشنهاد: کل پروژه را همان‌جا بگیرید تا مسیرها درست بماند
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git
# توجه: نام ریپو عمدا با خط تیره پایانی است
cd web-monitoring-Intelligent-Vehicle-Traffic-
# چک سریع وجود فایل‌ها
ls server/scheduler.js server/index.js server/db.js js/app.js index.html
```

### مرحله B: VPN را خاموش کنید، سپس انتقال به سرور
بعد از خاموش‌کردن VPN، از داخل پوشه پروژه دستورهای انتقال را بزنید:

```bash
cd ~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-
scp server/scheduler.js server/index.js server/db.js root@SERVER_IP:/opt/tc-manager/server/
scp js/app.js root@SERVER_IP:/opt/tc-manager/js/
scp index.html root@SERVER_IP:/opt/tc-manager/
ssh root@SERVER_IP 'systemctl restart tc-manager && systemctl status tc-manager --no-pager -l'
```

اگر خطای `No such file or directory` گرفتید، یعنی داخل پوشه اشتباه هستید؛
اول `pwd` و بعد `ls server js` را چک کنید (مسیر `pwd` باید شامل `web-monitoring-Intelligent-Vehicle-Traffic-` باشد، مثلا `/data/data/com.termux/files/home/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-`) و دوباره `scp` بزنید.
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
- قبل از `scp` این دستور را بزنید تا مطمئن شوید مسیرها درست هستند:

```bash
pwd
ls server/scheduler.js server/index.js server/db.js js/app.js index.html
```

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

## 9) آپدیت تک‌تک فایل‌های تغییرکرده از Termux (پیشرفته)

این روش وقتی استفاده می‌شود که می‌خواهید دقیقاً فایل‌های تغییرکرده را از کلون Termux به سرور منتقل کنید.

### مشکل رایج: `fatal: couldn't find remote ref main`

اگر کلون Termux فقط شاخه فیچر را دارد (shallow clone) و `origin/main` موجود نیست،  
دستور `git fetch origin main` شکست می‌خورد. راه‌حل زیر را استفاده کنید:

```bash
# =========================
# 0) تنظیم متغیرها
# =========================
export REPO="$HOME/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-"
export SERVER_IP="5.159.49.246"
export SERVER_USER="root"

cd "$REPO" || exit 1
```

```bash
# =========================
# 1) ساختن لیست فایل‌های runtime
# =========================

# روش A: اگر origin/main موجود باشد
git fetch origin main:refs/remotes/origin/main 2>/dev/null && \
  git diff --name-only origin/main...HEAD \
    | grep -Ev '^(DEPLOY|DEPLOY-MOBILE|ANALYSIS|README|mobile/|prepare-mobile-offline\.sh|deploy-mobile\.sh|server/deploy-part|deploy-all\.sh|\.github/)' \
    > /tmp/tc_changed_runtime.txt

# روش B: اگر origin/main موجود نباشد (shallow clone فقط شاخه فیچر دارد)
# از git log برای لیست‌کردن فایل‌های تغییرکرده در تمام commitها استفاده کنید:
if [ ! -s /tmp/tc_changed_runtime.txt ]; then
  git log --name-only --pretty=format: HEAD \
    | grep -v '^$' \
    | sort -u \
    | grep -Ev '^(DEPLOY|DEPLOY-MOBILE|ANALYSIS|README|mobile/|prepare-mobile-offline\.sh|deploy-mobile\.sh|server/deploy-part|deploy-all\.sh|\.github/)' \
    > /tmp/tc_changed_runtime.txt
fi

echo "=== CHANGED RUNTIME FILES ==="
cat /tmp/tc_changed_runtime.txt
```

> **نکته:** اگر خروجی لیست خیلی طولانی بود (اولین commit همه فایل‌ها را اضافه کرده)،  
> می‌توانید فایل را دستی بنویسید (روش C زیر).

```bash
# روش C: نوشتن دستی فایل‌هایی که در این برنچ تغییر کرده‌اند
# (همیشه کار می‌کند، حتی بدون git history)
# نکته: از printf استفاده می‌شود تا در copy/paste از GitHub خراب نشود
printf 'index.html\njs/app.js\nserver/index.js\nserver/db.js\n' > /tmp/tc_changed_runtime.txt

echo "=== RUNTIME FILES TO DEPLOY ==="
cat /tmp/tc_changed_runtime.txt
```

```bash
# =========================
# 2) آپلود تک‌تک فایل‌ها به سرور
# =========================
ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p /tmp/tc-update"

while IFS= read -r f; do
  [ -z "$f" ] && continue
  echo "UPLOAD => $f"
  ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p /tmp/tc-update/$(dirname "$f")"
  scp "$REPO/$f" ${SERVER_USER}@${SERVER_IP}:/tmp/tc-update/"$f"
done < /tmp/tc_changed_runtime.txt
```

```bash
# =========================
# 3) بکاپ + اعمال + ری‌استارت روی سرور
# =========================
ssh ${SERVER_USER}@${SERVER_IP} '
set -e
APP_DIR="/opt/tc-manager"
UPD_DIR="/tmp/tc-update"
TS=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$APP_DIR/backup-$TS"

mkdir -p "$BACKUP_DIR"
cd "$UPD_DIR"
find . -type f | sed "s|^\./||" > /tmp/tc_apply_list.txt

while IFS= read -r f; do
  [ -z "$f" ] && continue
  mkdir -p "$BACKUP_DIR/$(dirname "$f")" "$APP_DIR/$(dirname "$f")"
  [ -f "$APP_DIR/$f" ] && cp -f "$APP_DIR/$f" "$BACKUP_DIR/$f" || true
  install -m 644 "$UPD_DIR/$f" "$APP_DIR/$f"
  echo "APPLIED => $f"
done < /tmp/tc_apply_list.txt

systemctl restart tc-manager || pm2 restart tc-manager

echo "=== VERIFY (rmto keys) ==="
grep -n "setting-rmto-live-source-ip" $APP_DIR/index.html || true
grep -n "rmto_live_source_ip" $APP_DIR/js/app.js || true
grep -n "rmto_live_source_ip" $APP_DIR/server/index.js || true
grep -n "rmto_live_source_ip" $APP_DIR/server/db.js || true

echo "=== SERVICE STATUS ==="
systemctl status tc-manager --no-pager -l | sed -n "1,40p" || pm2 status
'
```

```bash
# =========================
# 4) لاگ نهایی
# =========================
ssh ${SERVER_USER}@${SERVER_IP} '
journalctl -u tc-manager -n 120 --no-pager || pm2 logs tc-manager --lines 120
'
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
