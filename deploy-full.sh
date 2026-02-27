#!/usr/bin/env bash
# =======================================================================
# deploy-full.sh — جایگزینی کامل server/index.js و scheduler.js و db.js و rmto-client.js
# =======================================================================
# استفاده روی سرور:
#   cd /opt/tc-manager
#   wget -q "https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/review-project-issues/deploy-full.sh" -O deploy-full.sh
#   bash deploy-full.sh
# =======================================================================
set -e

REPO_RAW="https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/review-project-issues"
TS=$(date +%Y%m%d_%H%M%S)

echo "========================================================"
echo "  TC Manager — جایگزینی کامل فایل‌های سرور"
echo "========================================================"

replace_file() {
    local LOCAL="$1"
    local URL="$2"
    # Use /tmp with .js extension so node --check works on Node.js v20+
    local TMPFILE="/tmp/tc-syntax-$(basename ${LOCAL%.*})-${TS}.js"

    echo ""
    echo "📦  پشتیبان‌گیری از ${LOCAL}..."
    cp "${LOCAL}" "${LOCAL}.bak-${TS}"
    echo "      → ${LOCAL}.bak-${TS}"

    echo "⬇️   دانلود ${LOCAL} از repo..."
    # Try with SSL verification first, fall back to --no-check-certificate
    if ! wget -q -O "${LOCAL}.new" "${URL}" 2>/dev/null; then
        echo "      (SSL مشکل دارد، تلاش بدون بررسی SSL...)"
        wget -q --no-check-certificate -O "${LOCAL}.new" "${URL}"
    fi
    local SZ
    SZ=$(wc -c < "${LOCAL}.new")
    echo "      → دانلود شد (${SZ} بایت)"
    if [ "${SZ}" -lt 100 ]; then
        echo "      ❌ فایل دانلود‌شده خیلی کوچک است (${SZ} بایت) — احتمالاً خطای دانلود."
        cat "${LOCAL}.new"
        rm -f "${LOCAL}.new"
        exit 1
    fi

    echo "🔍  بررسی syntax..."
    cp "${LOCAL}.new" "${TMPFILE}"
    if node --check "${TMPFILE}" 2>&1; then
        echo "      ✅ syntax درست است"
        mv "${LOCAL}.new" "${LOCAL}"
    else
        echo "      ❌ خطای syntax! فایل جایگزین نشد. بک‌آپ را برگردانید:"
        echo "         cp ${LOCAL}.bak-${TS} ${LOCAL}"
        rm -f "${LOCAL}.new" "${TMPFILE}"
        exit 1
    fi
    rm -f "${TMPFILE}"
}

replace_file "server/index.js"       "${REPO_RAW}/server/index.js"
replace_file "server/scheduler.js"   "${REPO_RAW}/server/scheduler.js"
replace_file "server/db.js"          "${REPO_RAW}/server/db.js"
replace_file "server/rmto-client.js" "${REPO_RAW}/server/rmto-client.js"

# دانلود ecosystem.config.js برای PM2 (تنظیم TZ=Asia/Tehran)
echo ""
echo "⬇️   دانلود ecosystem.config.js (TZ=Asia/Tehran)..."
if ! wget -q -O ecosystem.config.js "${REPO_RAW}/ecosystem.config.js" 2>/dev/null; then
    wget -q --no-check-certificate -O ecosystem.config.js "${REPO_RAW}/ecosystem.config.js"
fi
echo "      → ecosystem.config.js دانلود شد"

# راه‌اندازی مجدد
echo ""
echo "🔄  راه‌اندازی مجدد سرور..."
# آزاد کردن پورت‌های 2022 و 3000 اگر هنوز در اشغال باشند
for PORT in 2022 3000; do
    if fuser ${PORT}/tcp >/dev/null 2>&1; then
        echo "      ⚡ پورت ${PORT} اشغال است — در حال آزادسازی..."
        fuser -k ${PORT}/tcp 2>/dev/null || true
    fi
done
sleep 1
# restart with --update-env to pick up TZ=Asia/Tehran from ecosystem.config.js
pm2 restart tc-manager --update-env 2>/dev/null || pm2 start ecosystem.config.js
echo ""
pm2 list

echo ""
echo "========================================================"
echo "  ✅ همه ۴ فایل سرور جایگزین شدند + ecosystem.config.js"
echo "  ✅ منطقه زمانی: Asia/Tehran (UTC+3:30)"
echo ""
echo "  برای مشاهده لاگ:"
echo "    pm2 logs tc-manager --lines 50"
echo ""
echo "  بررسی موفقیت: ساعت دستگاه باید ایران (+3:30) باشد"
echo "========================================================"
