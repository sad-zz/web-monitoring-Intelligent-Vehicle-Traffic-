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

# 3. بررسی syntax
echo ""
echo "🔍  [3/4] بررسی syntax..."
if node --check server/index.js.new; then
    echo "      ✅ syntax درست است"
    mv server/index.js.new server/index.js
else
    echo "      ❌ خطای syntax! فایل جایگزین نشد."
    rm -f server/index.js.new
    exit 1
fi

# 4. راه‌اندازی مجدد
echo ""
echo "🔄  [4/4] راه‌اندازی مجدد سرور..."
# آزاد کردن پورت 2022 اگر هنوز در اشغال باشد
PORT_PID=$(fuser 2022/tcp 2>/dev/null || true)
if [ -n "$PORT_PID" ]; then
    echo "      ⚡ پورت 2022 توسط PID $PORT_PID اشغال است — در حال آزادسازی..."
    fuser -k 2022/tcp 2>/dev/null || true
    sleep 2
fi
pm2 restart tc-manager
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
