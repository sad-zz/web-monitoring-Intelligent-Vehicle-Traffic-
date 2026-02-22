#!/bin/bash
# ============================================================
# اجرا روی سرور (بدون نیاز به git pull):
#
#   curl -fsSL https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/review-project-issues/deploy-patch-2026-02-22.sh | bash
#
# یا با wget:
#   wget -qO- https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/review-project-issues/deploy-patch-2026-02-22.sh | bash
# ============================================================
set -e
cd /opt/tc-manager

echo "=== TC Manager Patch 2026-02-22 ==="
echo "در حال دانلود اسکریپت پچ..."

# دانلود deploy-patch-2026-02-22.js مستقیماً از GitHub
wget -q -O /tmp/deploy-patch-2026-02-22.js \
  "https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/review-project-issues/deploy-patch-2026-02-22.js"

echo "در حال اجرای پچ..."
node /tmp/deploy-patch-2026-02-22.js

echo ""
echo "=== Restarting PM2 ==="
pm2 restart tc-manager
pm2 status
echo ""
echo "=== پچ با موفقیت اعمال شد ==="
