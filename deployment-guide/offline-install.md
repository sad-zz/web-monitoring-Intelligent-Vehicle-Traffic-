# نصب TC Manager روی سرور بدون اینترنت

وقتی سرور مقصد به اینترنت دسترسی ندارد، دو چیز را نمی‌توان روی خود سرور دانلود کرد: **Node.js** و **پکیج‌های npm** (`node_modules`). راه‌حل: هر دو را روی یک **سیستم آنلاین** آماده کنید و با `scp` منتقل کنید.

> ⚠️ سیستم آنلاین باید هم‌معماری سرور باشد (معمولاً `x64` / `linux-x64`) چون `better-sqlite3` ماژول native کامپایل‌شده دارد. بهترین حالت: یک ماشین مجازی یا سرور موقت با **همان نسخه توزیع لینوکس** سرور مقصد.

---

## مرحله ۱ — آماده‌سازی روی سیستم آنلاین

```bash
# 1) دریافت سورس
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git
cd web-monitoring-Intelligent-Vehicle-Traffic-

# 2) دانلود Node.js 20 (باینری مستقل، بدون نیاز به apt روی سرور)
curl -fLO https://nodejs.org/dist/v20.18.1/node-v20.18.1-linux-x64.tar.xz

# 3) ساخت node_modules با همان Node 20
#    (اگر روی این سیستم node ندارید، اول همان tar.xz را همین‌جا باز و به PATH اضافه کنید)
cd server
npm install --production
cd ..

# 4) بسته‌بندی همه‌چیز
tar -cJf tc-bundle.tar.xz \
    index.html css js data \
    server/index.js server/db.js server/scheduler.js server/rmto-client.js \
    server/reset-password.js server/package.json server/package-lock.json \
    server/node_modules \
    deployment-guide
```

اگر Nginx هم لازم است و روی سرور نصب نیست، فایل‌های `.deb` آن را هم دانلود کنید:

```bash
mkdir debs && cd debs
apt-get download nginx nginx-common nginx-core libnginx-mod-* 2>/dev/null || apt-get download nginx nginx-common
cd ..
```

> Nginx اختیاری است — می‌توانید بدون آن مستقیم با پورت 3000 کار کنید: `http://SERVER_IP:3000`

## مرحله ۲ — انتقال به سرور

```bash
scp node-v20.18.1-linux-x64.tar.xz tc-bundle.tar.xz root@SERVER_IP:/root/
scp -r debs root@SERVER_IP:/root/ 2>/dev/null || true
```

## مرحله ۳ — نصب روی سرور (آفلاین)

```bash
ssh root@SERVER_IP

# 1) نصب Node به‌صورت باینری
tar -xJf /root/node-v20.18.1-linux-x64.tar.xz -C /usr/local --strip-components=1
node -v   # v20.18.1

# 2) باز کردن برنامه
mkdir -p /opt/tc-manager
tar -xJf /root/tc-bundle.tar.xz -C /opt/tc-manager
mkdir -p /opt/tc-manager/server/uploads

# 3) فایل .env
cp /opt/tc-manager/deployment-guide/config/env.example /opt/tc-manager/server/.env
nano /opt/tc-manager/server/.env    # رمزهای RMTO

# 4) سرویس systemd
cp /opt/tc-manager/deployment-guide/config/tc-manager.service /etc/systemd/system/
# ⚠️ چون Node در /usr/local است، مسیر اجرا را اصلاح کنید:
sed -i 's|/usr/bin/node|/usr/local/bin/node|' /etc/systemd/system/tc-manager.service
systemctl daemon-reload
systemctl enable tc-manager
systemctl start tc-manager
systemctl status tc-manager --no-pager

# 5) (اختیاری) Nginx از فایل‌های deb
dpkg -i /root/debs/*.deb || true
cp /opt/tc-manager/deployment-guide/config/nginx-tc-manager.conf /etc/nginx/sites-available/tc-manager
ln -sf /etc/nginx/sites-available/tc-manager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# 6) فایروال (اگر ufw موجود است)
ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 2022/tcp
ufw allow 3000/tcp   # فقط اگر بدون Nginx کار می‌کنید
ufw --force enable

# 7) منطقه زمانی
timedatectl set-timezone Asia/Tehran
```

## عیب‌یابی مخصوص نصب آفلاین

| مشکل | راه‌حل |
|---|---|
| `Error: Cannot find module 'better-sqlite3'` یا خطای `invalid ELF header` | `node_modules` روی سیستمی با معماری/glibc متفاوت ساخته شده — روی سیستمی هم‌نسخه با سرور دوباره `npm install` بزنید |
| `node: not found` در سرویس | مسیر `ExecStart` در unit فایل را چک کنید (`which node`) |
| نسخه glibc قدیمی (`GLIBC_2.28 not found`) | از باینری Node هم‌خانواده با توزیع سرور استفاده کنید (برای توزیع‌های خیلی قدیمی، نسخه unofficial-builds گزینه است) |

> ارسال به RMTO (`otf.rmto.ir`) نیاز به دسترسی شبکه‌ای به آن آدرس دارد. اگر سرور کلاً بدون شبکه خارجی است، داده‌ها در صف `rmto_queue` می‌مانند (`sent=0`) و به‌محض برقراری دسترسی قابل ارسال‌اند.
