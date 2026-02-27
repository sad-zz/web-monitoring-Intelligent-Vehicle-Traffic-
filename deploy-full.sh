#!/usr/bin/env bash
# =======================================================================
# deploy-full.sh — جایگزینی کامل server/index.js و server/scheduler.js
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
echo "  TC Manager — جایگزینی کامل server/index.js + scheduler.js"
echo "========================================================"

replace_file() {
    local LOCAL="$1"
    local URL="$2"
    local TMPFILE="/tmp/tc-check-${TS}-$(basename ${LOCAL}).js"

    echo ""
    echo "📦  پشتیبان‌گیری از ${LOCAL}..."
    cp "${LOCAL}" "${LOCAL}.bak-${TS}"
    echo "      → ${LOCAL}.bak-${TS}"

    echo "⬇️   دانلود ${LOCAL} از repo..."
    wget -q -O "${LOCAL}.new" "${URL}"
    echo "      → دانلود شد ($(wc -c < "${LOCAL}.new") بایت)"

    echo "🔍  بررسی syntax..."
    cp "${LOCAL}.new" "${TMPFILE}"
    if node --check "${TMPFILE}"; then
        echo "      ✅ syntax درست است"
        mv "${LOCAL}.new" "${LOCAL}"
    else
        echo "      ❌ خطای syntax! فایل جایگزین نشد."
        rm -f "${LOCAL}.new" "${TMPFILE}"
        exit 1
    fi
    rm -f "${TMPFILE}"
}

replace_file "server/index.js"     "${REPO_RAW}/server/index.js"
replace_file "server/scheduler.js" "${REPO_RAW}/server/scheduler.js"

# راه‌اندازی مجدد
echo ""
echo "🔄  راه‌اندازی مجدد سرور..."
# توقف کامل PM2 اول
pm2 stop tc-manager 2>/dev/null || true
sleep 1
# آزاد کردن پورت‌های 2022 و 3000 اگر هنوز در اشغال باشند
for PORT in 2022 3000; do
    if fuser ${PORT}/tcp >/dev/null 2>&1; then
        echo "      ⚡ پورت ${PORT} اشغال است — در حال آزادسازی..."
        fuser -k ${PORT}/tcp 2>/dev/null || true
    fi
done
sleep 2
pm2 start tc-manager
echo ""
pm2 list

echo ""
echo "========================================================"
echo "  ✅ کامل شد — server/index.js و server/scheduler.js جایگزین شدند"
echo ""
echo "  برای مشاهده لاگ:"
echo "    pm2 logs tc-manager --lines 50"
echo ""
echo "  برای بررسی فرمت دستور 0012 (باید 12 رقم باشد):"
echo "    node verify-timesync.js"
echo "========================================================"
