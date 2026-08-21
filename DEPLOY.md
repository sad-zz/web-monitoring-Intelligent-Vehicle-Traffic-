# راهنمای استقرار با موبایل (Termux) برای سرور بدون اینترنت

این پروژه را می‌توانید با موبایل هم به‌روزرسانی کنید.  
اگر سرور اصلی اینترنت ندارد، **روش پیشنهادی برای آپدیت کد** این است که فقط فایل‌های تغییرکرده را کپی کنید و سرویس را ری‌استارت کنید.

## 1) آماده‌سازی Termux روی موبایل

```bash
pkg update -y
pkg upgrade -y
pkg install -y openssh rsync git
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

# اگر اولین بار است (کلون):
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git
# توجه: نام ریپو عمدا با خط تیره پایانی است

# اگر قبلاً کلون کرده‌اید (آپدیت):
# ⚠️ مهم: git pull باید از داخل پوشه‌ی پروژه اجرا شود، نه از ~/tc-deploy
cd web-monitoring-Intelligent-Vehicle-Traffic-
git pull
# نکته: از "git pull" بدون آرگومان استفاده کنید (نه git pull origin main)
# چون شاخه پیش‌فرض ریپو "main" نیست
# خطای "not a git repository" = داخل پوشه اشتباه هستید؛ دستور بالا را با cd درست کنید
```

```bash
# بعد از clone یا pull، وارد پوشه پروژه شوید:
cd ~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-

# چک سریع وجود فایل‌ها (باید همه‌شان باشند):
ls server/scheduler.js server/index.js server/db.js server/reset-password.js js/app.js index.html
# اگر هر کدام نبود یا curl بعداً دادید و فقط ۱۴ بایت بود (= خطای ۴۰۴ گیت‌هاب)،
# مطمئن شوید VPN روشن است، سپس دوباره git pull بزنید.
```

### مرحله B: VPN را خاموش کنید، سپس انتقال به سرور
بعد از خاموش‌کردن VPN، از داخل پوشه پروژه دستورهای انتقال را بزنید:

```bash
cd ~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-
scp server/scheduler.js server/index.js server/db.js server/reset-password.js root@SERVER_IP:/opt/tc-manager/server/
scp js/app.js root@SERVER_IP:/opt/tc-manager/js/
scp index.html root@SERVER_IP:/opt/tc-manager/
ssh root@SERVER_IP 'systemctl restart tc-manager && systemctl status tc-manager --no-pager -l'
```

اگر خطای `No such file or directory` گرفتید، یعنی داخل پوشه اشتباه هستید؛
اول `pwd` و بعد `ls server js` را چک کنید (مسیر `pwd` باید شامل `web-monitoring-Intelligent-Vehicle-Traffic-` باشد، مثلا `/data/data/com.termux/files/home/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-`) و دوباره `scp` بزنید.
این کار باعث می‌شود لازم نباشد هنگام انتقال به سرور، VPN روشن باشد.

## 3) آپدیت کامل (فقط وقتی سرور پیش‌نیازها را دارد)

### روش ساده (از Termux):

```bash
cd ~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-
git pull
bash server/deploy-full.sh
```

این اسکریپت خودش فایل‌ها را به سرور کپی و اجرا می‌کند (از طریق SSH).
با `--clean` می‌توانید wipe کامل انجام دهید:
```bash
bash server/deploy-full.sh --clean
```

### روش deploy-all.sh (یکپارچه):

```bash
scp deploy-all.sh root@SERVER_IP:/tmp/
ssh root@SERVER_IP 'bash /tmp/deploy-all.sh'
```

⚠️ نکته مهم: `deploy-all.sh` برای نصب Node.js/NPM و وابستگی‌ها ممکن است به اینترنت روی خود سرور نیاز داشته باشد.  
اگر سرور اینترنت ندارد و وابستگی جدید لازم باشد، این روش ممکن است ناموفق شود.

## 4) آپدیت فقط کد (مناسب سرور بدون اینترنت)

این روش برای وقتی است که فقط فایل‌های کد عوض شده‌اند و وابستگی جدید اضافه نشده:

> ⚠️ **مهم:** دستورات `scp` باید از ریشه پروژه اجرا شوند، نه از داخل پوشه `server/`.  
> اگر داخل `server/` باشید و `scp server/db.js ...` بزنید، خطای `server/db.js: No such file or directory` می‌گیرید.  
> قبل از هر `scp`، مطمئن شوید در ریشه پروژه هستید:

```bash
cd ~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-
scp server/scheduler.js server/index.js server/db.js server/reset-password.js root@SERVER_IP:/opt/tc-manager/server/
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
cd ~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-
rsync -avz server/scheduler.js server/index.js server/db.js server/reset-password.js root@SERVER_IP:/opt/tc-manager/server/
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
printf 'index.html\njs/app.js\nserver/index.js\nserver/db.js\nserver/reset-password.js\n' > /tmp/tc_changed_runtime.txt

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

## 9.0) اورژانس: `bad-setting` / پورت اشغال / پروسس یتیم

علائم:
- `systemctl status` می‌گوید `Loaded: bad-setting` یا `Unbalanced quoting`
- لاگ: `Port 3000/2022 already in use` و `restart counter` چند هزارتایی
- `ss -lntp` هنوز یک `node /opt/tc-ma` روی 3000 و 2022 نشان می‌دهد حتی وقتی سرویس dead است

علت رایج:
1. فایل `/etc/systemd/system/tc-manager.service` خراب شده (کوتیشن ناقص، `2&gt;` به‌جای `2>`، یا تایپوی `fuset`)
2. یک پروسس قدیمی Node خارج از systemd پورت‌ها را نگه داشته
3. گاهی همزمان PM2 و systemd هر دو سرویس را بالا می‌آورند

**همین الان روی سرور (به‌صورت root) این بلوک را کامل کپی/اجرا کنید:**

```bash
set -e

# 1) توقف کامل تلاش‌های systemd + PM2
systemctl stop tc-manager 2>/dev/null || true
systemctl reset-failed tc-manager 2>/dev/null || true
pm2 stop tc-manager 2>/dev/null || true
pm2 delete tc-manager 2>/dev/null || true

# 2) کشتن همه listenerهای 3000/2022 و پروسس‌های index.js این اپ
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 2022/tcp 2>/dev/null || true
pkill -f '/opt/tc-manager/server/index.js' 2>/dev/null || true
pkill -f 'node /opt/tc-manager' 2>/dev/null || true
sleep 2

# 3) مطمئن شوید پورت آزاد است (باید خالی باشد)
ss -lntp | grep -E ':3000|:2022' || echo "ports free OK"

# 4) بازنویسی unit سالم (بدون bash -c و بدون کوتیشن تو در تو)
cat > /etc/systemd/system/tc-manager.service << 'UNIT'
[Unit]
Description=TC Manager (Noavaran Jonoob Shargh)
After=network.target
StartLimitIntervalSec=300
StartLimitBurst=20

[Service]
Type=simple
User=root
WorkingDirectory=/opt/tc-manager/server
ExecStartPre=-/usr/bin/fuser -k 3000/tcp
ExecStartPre=-/usr/bin/fuser -k 2022/tcp
ExecStartPre=/bin/sleep 2
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
TimeoutStopSec=15
KillMode=mixed
KillSignal=SIGTERM
Environment=NODE_ENV=production
Environment=TZ=Asia/Tehran

[Install]
WantedBy=multi-user.target
UNIT

# 5) اعتبارسنجی unit و استارت
systemd-analyze verify /etc/systemd/system/tc-manager.service || true
systemctl daemon-reload
systemctl enable tc-manager
systemctl reset-failed tc-manager
systemctl start tc-manager
sleep 3

# 6) بررسی
systemctl status tc-manager --no-pager -l | sed -n '1,45p'
ss -lntp | grep -E ':3000|:2022' || true
journalctl -u tc-manager -n 40 --no-pager
```

اگر بعد از این هنوز `bad-setting` بود:

```bash
cat -A /etc/systemd/system/tc-manager.service
# نباید &gt; یا کوتیشن تکی ناقص ببینید
```

هشدار دیسک/دیتابیس:
- اگر `data.db` چند گیگابایت شد (مثلاً ~6GB)، سرویس سنگین و ناپایدار می‌شود.
- فعلاً برای بالا آوردن سرویس لازم نیست پاکش کنید؛ بعد از پایدار شدن، VACUUM/آرشیو جداگانه انجام دهید.

## 9.1) رفع ریست مداوم / صفر بودن «مدت روشن بودن سرور»

اگر پنل مدام از دسترس خارج می‌شود، uptime نزدیک صفر است، یا قبل از ذخیره تنظیمات دوباره لاگین می‌خواهد — اول بخش **9.0** را اجرا کنید، بعد در صورت نیاز:

```bash
ssh root@SERVER_IP '
set -e
# 1) واحد systemd پایدار (Restart=always)
cat > /etc/systemd/system/tc-manager.service << "UNIT"
[Unit]
Description=TC Manager (Noavaran Jonoob Shargh)
After=network.target
StartLimitIntervalSec=300
StartLimitBurst=20

[Service]
Type=simple
User=root
WorkingDirectory=/opt/tc-manager/server
ExecStartPre=-/usr/bin/fuser -k 3000/tcp
ExecStartPre=-/usr/bin/fuser -k 2022/tcp
ExecStartPre=/bin/sleep 2
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
TimeoutStopSec=15
KillMode=mixed
KillSignal=SIGTERM
Environment=NODE_ENV=production
Environment=TZ=Asia/Tehran

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable tc-manager
systemctl restart tc-manager
sleep 3
systemctl status tc-manager --no-pager -l | sed -n "1,40p"
echo "--- recent logs ---"
journalctl -u tc-manager -n 80 --no-pager
'
```

نکات مهم این نسخه:
- نشست ورود در SQLite ذخیره می‌شود و بعد از ریستارت از بین نمی‌رود
- `SESSION_SECRET` پایدار است (فایل `server/.session-secret` یا مقدار داخل `.env`)
- اگر هم systemd و هم PM2 همزمان سرویس را اجرا کنند، روی پورت با هم تداخل می‌کنند؛ فقط یکی را نگه دارید
- خط `ExecStartPre` دیگر `bash -c '...'` ندارد تا خطای `Unbalanced quoting` تکرار نشود

آپلود فایل‌های ضروری این فیکس از Termux:

```bash
cd ~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-
scp server/index.js server/db.js server/scheduler.js server/rmto-client.js root@SERVER_IP:/opt/tc-manager/server/
scp js/app.js root@SERVER_IP:/opt/tc-manager/js/
scp index.html root@SERVER_IP:/opt/tc-manager/
ssh root@SERVER_IP 'systemctl daemon-reload && systemctl restart tc-manager && systemctl status tc-manager --no-pager -l'
```

---

## 10) بازنشانی رمز عبور از طریق SSH

اگر نمی‌توانید از طریق UI وارد شوید (رمز فراموش شده یا تغییر کرده)، می‌توانید با اسکریپت زیر رمز را ریست کنید:

```bash
# اتصال به سرور
ssh root@5.159.49.246

# بازنشانی رمز به admin123 (پیش‌فرض)
cd /opt/tc-manager
node server/reset-password.js

# یا تنظیم رمز دلخواه
node server/reset-password.js "RmzJadid1234"

# مثال: ست کردن رمز 321123 برای کاربر admin
node server/reset-password.js "321123" "admin"
```

بعد از ریست، با رمز جدید وارد پنل شوید.

> **نکته:** اگر `reset-password.js` روی سرور وجود ندارد (فایل قبلاً آپلود نشده)،
> ابتدا آن را از Termux آپلود کنید:
> ```bash
> # از داخل پوشه پروژه در Termux:
> scp server/reset-password.js root@5.159.49.246:/opt/tc-manager/server/
> ssh root@5.159.49.246 'cd /opt/tc-manager && node server/reset-password.js "321123" "admin"'
> ```

> **نکته:** اگر می‌خواهید مستقیماً در پایگاه داده آپدیت کنید (بدون فایل جانبی):
> ```bash
> cd /opt/tc-manager
> node -e "
> const bcrypt=require('bcryptjs'),db=require('better-sqlite3')('./server/data.db');
> db.prepare('UPDATE users SET password_hash=? WHERE username=?').run(bcrypt.hashSync('admin123',10),'admin');
> console.log('done');
> "
> ```

---

## چک‌لیست کوتاه برای موبایل

1. ورود به Termux  
2. (در صورت نیاز) دانلود فایل‌ها با VPN روشن داخل `~/tc-deploy`  
3. خاموش‌کردن VPN  
4. تست `ssh root@SERVER_IP`  
5. اجرای `scp` برای فایل‌های تغییرکرده  
6. `systemctl restart tc-manager`  
7. بررسی `systemctl status` و `journalctl`
