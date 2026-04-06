#!/bin/bash
# ============================================
# TC Manager - Full Clean Deployment
# Runs deploy-part1..4 in order
# ============================================
set -e

echo ""
echo "============================================"
echo "  TC Manager - Full Clean Deploy"
echo "============================================"
echo ""

# Optional: clean wipe (pass --clean flag)
if [ "$1" = "--clean" ]; then
    echo ">>> CLEAN MODE: Wiping /opt/tc-manager..."
    systemctl stop tc-manager 2>/dev/null || true
    # Kill any stale node processes on our ports
    fuser -k 3000/tcp 2>/dev/null || true
    fuser -k 2022/tcp 2>/dev/null || true
    sleep 2
    # Backup database before wipe
    if [ -f /opt/tc-manager/server/data.db ]; then
        BACKUP_NAME="/root/data.db.backup.$(date +%Y%m%d_%H%M%S)"
        cp /opt/tc-manager/server/data.db "$BACKUP_NAME"
        echo ">>> Database backed up to $BACKUP_NAME"
    fi
    # Backup .env before wipe
    if [ -f /opt/tc-manager/server/.env ]; then
        cp /opt/tc-manager/server/.env /tmp/.env.backup
        echo ">>> .env backed up to /tmp/.env.backup"
    fi
    # Wipe everything except node_modules (takes too long to reinstall)
    cd /opt/tc-manager
    find . -maxdepth 1 ! -name '.' ! -name 'server' -exec rm -rf {} + 2>/dev/null || true
    cd /opt/tc-manager/server
    find . -maxdepth 1 ! -name '.' ! -name 'node_modules' ! -name 'data.db' ! -name '.env' -exec rm -rf {} + 2>/dev/null || true
    mkdir -p /opt/tc-manager/{css,js,data,server}
    # Restore .env
    if [ -f /tmp/.env.backup ]; then
        cp /tmp/.env.backup /opt/tc-manager/server/.env
        echo ">>> .env restored"
    fi
    echo ">>> Clean wipe done (kept node_modules, data.db, .env)"
    echo ""
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ">>> Step 1/4: Server files..."
bash "$SCRIPT_DIR/deploy-part1-server.sh"
echo ""

echo ">>> Step 2/4: Frontend data..."
bash "$SCRIPT_DIR/deploy-part2-frontend.sh"
echo ""

echo ">>> Step 3/4: HTML..."
bash "$SCRIPT_DIR/deploy-part3-html.sh"
echo ""

echo ">>> Step 4/4: CSS + JS..."
bash "$SCRIPT_DIR/deploy-part4-css-js.sh"
echo ""

# Verify services
echo ">>> Verifying services..."
echo ""

if systemctl is-active --quiet tc-manager; then
    echo "✓ tc-manager is RUNNING"
else
    echo "✗ tc-manager is NOT running!"
    echo "  Check: journalctl -u tc-manager -n 30 --no-pager"
fi

if systemctl is-active --quiet nginx; then
    echo "✓ nginx is RUNNING"
else
    echo "✗ nginx is NOT running!"
    echo "  Check: journalctl -u nginx -n 10 --no-pager"
fi

echo ""
echo "============================================"
echo "  Deploy Complete!"
echo "  Dashboard: http://5.159.49.246"
echo "============================================"
