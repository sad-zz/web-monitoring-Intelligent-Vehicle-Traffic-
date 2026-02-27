#!/usr/bin/env bash
# =======================================================================
# kill-crash-loop.sh — قطع فوری حلقه EADDRINUSE و راه‌اندازی مجدد سالم
# =======================================================================
# وقتی pm2 logs نشان می‌دهد "Port 2022/3000 already in use" بی‌پایان
# این اسکریپت را اجرا کنید:
#
#   cd /opt/tc-manager
#   wget -q "https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/review-project-issues/kill-crash-loop.sh" -O kill-crash-loop.sh
#   bash kill-crash-loop.sh
# =======================================================================
set -e

echo "========================================================"
echo "  TC Manager — قطع حلقه crash و راه‌اندازی مجدد"
echo "========================================================"

# Step 1: stop PM2 process immediately (prevents new restarts)
echo ""
echo "⏹️  [1/4] متوقف کردن PM2..."
pm2 stop tc-manager 2>/dev/null || true
sleep 3

# Step 2: kill anything still holding port 2022 or 3000
echo "⚡  [2/4] آزادسازی پورت‌ها 2022 و 3000..."
for PORT in 2022 3000; do
    if fuser ${PORT}/tcp >/dev/null 2>&1; then
        echo "      → پورت ${PORT} هنوز در اشغال است — آزاد می‌شود..."
        fuser -k ${PORT}/tcp 2>/dev/null || true
    else
        echo "      → پورت ${PORT} آزاد است ✓"
    fi
done
sleep 2

# Step 3: verify ports are free
echo "🔍  [3/4] بررسی پورت‌ها..."
for PORT in 2022 3000; do
    if fuser ${PORT}/tcp >/dev/null 2>&1; then
        echo "      ❌ پورت ${PORT} هنوز اشغال است — دستی بررسی کنید:"
        echo "         ss -tlnp | grep ${PORT}"
    else
        echo "      ✅ پورت ${PORT} آزاد"
    fi
done

# Step 4: restart cleanly
echo "🔄  [4/4] راه‌اندازی مجدد..."
if [ -f ecosystem.config.js ]; then
    pm2 start ecosystem.config.js 2>/dev/null || pm2 restart tc-manager --update-env
else
    pm2 restart tc-manager --update-env 2>/dev/null || pm2 start server/index.js --name tc-manager
fi
sleep 3
pm2 list

echo ""
echo "========================================================"
echo "  برای مشاهده لاگ (Ctrl+C برای خروج):"
echo "    pm2 logs tc-manager --lines 30"
echo ""
echo "  اگر مشکل ادامه داشت، deploy-full.sh را اجرا کنید:"
echo "    bash deploy-full.sh"
echo "========================================================"
