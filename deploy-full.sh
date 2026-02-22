#!/usr/bin/env bash
# =======================================================================
# deploy-full.sh — جایگزینی کامل server/index.js با نسخه تمیز از repo
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
echo "  TC Manager — جایگزینی کامل server/index.js"
echo "========================================================"

# 1. پشتیبان‌گیری
echo ""
echo "📦  [1/4] پشتیبان‌گیری از فایل فعلی..."
cp server/index.js "server/index.js.bak-${TS}"
echo "      → server/index.js.bak-${TS}"

# 2. دانلود نسخه صحیح
echo ""
echo "⬇️   [2/4] دانلود server/index.js از repo..."
wget -q -O server/index.js.new "${REPO_RAW}/server/index.js"
echo "      → دانلود شد ($(wc -c < server/index.js.new) بایت)"

# 3. بررسی syntax (از /tmp استفاده می‌کنیم تا extension .new مشکل ESM ایجاد نکند)
echo ""
echo "🔍  [3/4] بررسی syntax..."
cp server/index.js.new /tmp/tc-syntax-check.js
if node --check /tmp/tc-syntax-check.js; then
    echo "      ✅ syntax درست است"
    mv server/index.js.new server/index.js
else
    echo "      ❌ خطای syntax! فایل جایگزین نشد."
    rm -f server/index.js.new /tmp/tc-syntax-check.js
    exit 1
fi
rm -f /tmp/tc-syntax-check.js

# 4. راه‌اندازی مجدد
echo ""
echo "🔄  [4/4] راه‌اندازی مجدد سرور..."
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
echo "  ✅ کامل شد — server/index.js جایگزین شد"
echo ""
echo "  برای مشاهده لاگ:"
echo "    pm2 logs tc-manager --lines 50"
echo ""
echo "  برای بررسی فرمت دستور 0012 (باید 12 رقم باشد):"
echo "    node verify-timesync.js"
echo "========================================================"
