#!/bin/bash
# ============================================
# TC Manager - Full Deployment
# Can run from Termux (copies to server via SSH)
# or directly on the server.
# Usage:
#   bash server/deploy-full.sh            # from Termux
#   bash server/deploy-full.sh --clean    # from Termux, clean wipe
#   bash server/deploy-full.sh --local    # on server directly
# ============================================
set -e

SERVER_IP="${SERVER_IP:-5.159.49.246}"
SERVER_USER="${SERVER_USER:-root}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "============================================"
echo "  TC Manager - Full Deploy"
echo "============================================"
echo ""

# -----------------------------------------------
# Detect if we're on the server or on Termux
# -----------------------------------------------
ON_SERVER=false
if [ "$1" = "--local" ]; then
    ON_SERVER=true
    shift
elif [ -d "/opt/tc-manager" ] && command -v systemctl &>/dev/null; then
    ON_SERVER=true
fi

if [ "$ON_SERVER" = false ]; then
    # ===========================================
    # TERMUX MODE: scp scripts to server, run via SSH
    # ===========================================
    echo ">>> Termux mode: deploying to $SERVER_USER@$SERVER_IP"
    echo ""

    # Verify deploy scripts exist locally
    for f in deploy-part1-server.sh deploy-part2-frontend.sh deploy-part3-html.sh deploy-part4-css-js.sh; do
        if [ ! -f "$SCRIPT_DIR/$f" ]; then
            echo "ERROR: $SCRIPT_DIR/$f not found!"
            echo "Make sure you're running from the git repo root:"
            echo "  cd ~/tc-deploy/web-monitoring-Intelligent-Vehicle-Traffic-"
            echo "  bash server/deploy-full.sh"
            exit 1
        fi
    done

    CLEAN_FLAG=""
    if [ "$1" = "--clean" ]; then
        CLEAN_FLAG="--clean"
    fi

    echo "[1/5] Copying deploy scripts to server..."
    scp "$SCRIPT_DIR/deploy-part1-server.sh" \
        "$SCRIPT_DIR/deploy-part2-frontend.sh" \
        "$SCRIPT_DIR/deploy-part3-html.sh" \
        "$SCRIPT_DIR/deploy-part4-css-js.sh" \
        "$SERVER_USER@$SERVER_IP:/tmp/"
    echo ""

    echo "[2/5] Running server deploy (part1)..."
    ssh "$SERVER_USER@$SERVER_IP" "bash /tmp/deploy-part1-server.sh"
    echo ""

    echo "[3/5] Running frontend data deploy (part2)..."
    ssh "$SERVER_USER@$SERVER_IP" "bash /tmp/deploy-part2-frontend.sh"
    echo ""

    echo "[4/5] Running HTML deploy (part3)..."
    ssh "$SERVER_USER@$SERVER_IP" "bash /tmp/deploy-part3-html.sh"
    echo ""

    echo "[5/5] Running CSS+JS deploy (part4)..."
    ssh "$SERVER_USER@$SERVER_IP" "bash /tmp/deploy-part4-css-js.sh"
    echo ""

    # Verify
    echo ">>> Verifying services..."
    ssh "$SERVER_USER@$SERVER_IP" '
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
        fi
    '

    echo ""
    echo "============================================"
    echo "  Deploy Complete!"
    echo "  Dashboard: http://$SERVER_IP"
    echo "============================================"
    exit 0
fi

# ===========================================
# SERVER MODE: run scripts directly
# ===========================================
echo ">>> Server mode: running locally"
echo ""

# Optional: clean wipe (pass --clean flag)
if [ "$1" = "--clean" ]; then
    echo ">>> CLEAN MODE: Wiping /opt/tc-manager..."
    systemctl stop tc-manager 2>/dev/null || true
    fuser -k 3000/tcp 2>/dev/null || true
    fuser -k 2022/tcp 2>/dev/null || true
    sleep 2
    if [ -f /opt/tc-manager/server/data.db ]; then
        BACKUP_NAME="/root/data.db.backup.$(date +%Y%m%d_%H%M%S)"
        cp /opt/tc-manager/server/data.db "$BACKUP_NAME"
        echo ">>> Database backed up to $BACKUP_NAME"
    fi
    if [ -f /opt/tc-manager/server/.env ]; then
        cp /opt/tc-manager/server/.env /tmp/.env.backup
        echo ">>> .env backed up to /tmp/.env.backup"
    fi
    cd /opt/tc-manager
    find . -maxdepth 1 ! -name '.' ! -name 'server' -exec rm -rf {} + 2>/dev/null || true
    cd /opt/tc-manager/server
    find . -maxdepth 1 ! -name '.' ! -name 'node_modules' ! -name 'data.db' ! -name '.env' -exec rm -rf {} + 2>/dev/null || true
    mkdir -p /opt/tc-manager/{css,js,data,server}
    if [ -f /tmp/.env.backup ]; then
        cp /tmp/.env.backup /opt/tc-manager/server/.env
        echo ">>> .env restored"
    fi
    echo ">>> Clean wipe done (kept node_modules, data.db, .env)"
    echo ""
fi

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
echo "  Dashboard: http://$SERVER_IP"
echo "============================================"
