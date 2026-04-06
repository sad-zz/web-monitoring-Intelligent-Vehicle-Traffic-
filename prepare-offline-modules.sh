#!/bin/bash
# ============================================
# Prepare node_modules tarball for offline server deployment
# Run this on a machine WITH internet (laptop or Termux with VPN)
#
# Usage:
#   bash prepare-offline-modules.sh          # full node_modules
#   bash prepare-offline-modules.sh --missing # only missing packages
# ============================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="/tmp/tc-offline-build"

echo "=== Building node_modules tarball for offline deployment ==="

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"

# Copy package.json from repo
cp "$SCRIPT_DIR/server/package.json" "$WORK_DIR/"

cd "$WORK_DIR"

if [ "$1" = "--missing" ]; then
    echo ">>> Installing only commonly missing packages..."
    npm install --production express-session@1.17.3 multer@1.4.5-lts.1 bcryptjs@2.4.3 2>&1 | tail -10
else
    echo ">>> Running npm install --production (full)..."
    echo "    NOTE: Requires build-essential and python3 for better-sqlite3"
    npm install --production 2>&1 | tail -10
fi

if [ ! -d "node_modules" ]; then
    echo "ERROR: npm install failed - check errors above"
    exit 1
fi

# Create tarball
echo ">>> Creating node_modules.tar.gz..."
tar czf "$SCRIPT_DIR/node_modules.tar.gz" node_modules/

SIZE=$(du -h "$SCRIPT_DIR/node_modules.tar.gz" | cut -f1)
echo ""
echo "=== Done! ==="
echo "File: $SCRIPT_DIR/node_modules.tar.gz ($SIZE)"
echo ""
echo "=== Next steps (Termux relay) ==="
echo ""
echo "--- Phase 1: VPN ON (download from GitHub) ---"
echo "  cd ~/tc-deploy"
echo "  git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git"
echo "  # OR: cd web-monitoring-Intelligent-Vehicle-Traffic- && git pull"
echo "  cd web-monitoring-Intelligent-Vehicle-Traffic-"
echo "  bash prepare-offline-modules.sh --missing"
echo ""
echo "--- Phase 2: VPN OFF (upload to server) ---"
echo "  scp node_modules.tar.gz root@5.159.49.246:/tmp/"
echo "  scp server/deploy-part1-server.sh root@5.159.49.246:/tmp/"
echo "  ssh root@5.159.49.246 'bash /tmp/deploy-part1-server.sh'"
echo ""

# Cleanup
rm -rf "$WORK_DIR"
