#!/bin/bash
# =============================================================
# TC Manager – آماده‌سازی بسته آفلاین موبایل
# Prepare Mobile UI Offline Bundle
#
# این اسکریپت را روی کامپیوتر خودتان (که اینترنت دارد) اجرا کنید.
# Run this script on YOUR computer (which has internet access).
#
# نتیجه: یک پوشه mobile-offline/ ساخته می‌شود که شامل:
#   1. deploy-mobile.sh  (اسکریپت نصب)
#   2. mobile-node-modules.tar.gz  (کتابخانه‌های Node.js)
#
# سپس هر دو فایل را به سرور منتقل کنید.
#
# Usage:
#   bash prepare-mobile-offline.sh
#   scp mobile-offline/* root@5.159.49.246:/tmp/
#   ssh root@5.159.49.246 'bash /tmp/deploy-mobile.sh'
# =============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/mobile-offline"

echo "========================================"
echo "  آماده‌سازی بسته آفلاین موبایل"
echo "  Preparing Mobile Offline Bundle"
echo "========================================"

# ----------------------------------------------------------
# 1. Check prerequisites
# ----------------------------------------------------------
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Install it first:"
    echo "  https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm not found. Install Node.js first."
    exit 1
fi

echo "[1/4] Checking Node.js... $(node -v)"

# ----------------------------------------------------------
# 2. Install dependencies in mobile/
# ----------------------------------------------------------
echo "[2/4] Installing npm dependencies..."
cd "$SCRIPT_DIR/mobile"
rm -rf node_modules package-lock.json
npm install --production 2>&1 | tail -5
echo "    ✅ Dependencies installed ($(du -sh node_modules/ | cut -f1))"

# ----------------------------------------------------------
# 3. Create tarball of node_modules
# ----------------------------------------------------------
echo "[3/4] Creating node_modules tarball..."
tar czf "$SCRIPT_DIR/mobile-node-modules.tar.gz" node_modules/
echo "    ✅ mobile-node-modules.tar.gz ($(du -sh "$SCRIPT_DIR/mobile-node-modules.tar.gz" | cut -f1))"

# ----------------------------------------------------------
# 4. Create output directory with both files
# ----------------------------------------------------------
echo "[4/4] Creating mobile-offline/ directory..."
mkdir -p "$OUTPUT_DIR"
cp -f "$SCRIPT_DIR/deploy-mobile.sh" "$OUTPUT_DIR/"
mv -f "$SCRIPT_DIR/mobile-node-modules.tar.gz" "$OUTPUT_DIR/"

# Clean up
rm -rf "$SCRIPT_DIR/mobile/node_modules" "$SCRIPT_DIR/mobile/package-lock.json"

echo ""
echo "========================================"
echo "  ✅  بسته آفلاین آماده است!"
echo "  ✅  Offline bundle ready!"
echo ""
echo "  پوشه: mobile-offline/"
echo "  فایل‌ها:"
echo "    - deploy-mobile.sh             (اسکریپت نصب)"
echo "    - mobile-node-modules.tar.gz   (کتابخانه‌ها)"
echo ""
echo "  حالا هر دو فایل را به سرور منتقل کنید:"
echo ""
echo "  scp mobile-offline/* root@5.159.49.246:/tmp/"
echo "  ssh root@5.159.49.246 'bash /tmp/deploy-mobile.sh'"
echo "========================================"
