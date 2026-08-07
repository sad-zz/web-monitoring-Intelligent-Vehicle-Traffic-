#!/bin/bash
# ============================================================
# TC Manager - Fresh Server Install Script
# نصب از صفر روی سرور جدید (Ubuntu/Debian, run as root)
#
# Usage:
#   1) Copy the whole project to the new server, e.g. /root/tc-src
#   2) bash /root/tc-src/deployment-guide/install.sh
#
# Idempotent: safe to re-run. Never deletes an existing data.db.
# ============================================================
set -e

APP_DIR="/opt/tc-manager"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$(dirname "$SCRIPT_DIR")"   # project root (parent of deployment-guide/)

echo "============================================"
echo "  TC Manager - Fresh Install"
echo "  Source:  $SRC_DIR"
echo "  Target:  $APP_DIR"
echo "============================================"

# --- 0) Sanity check: are the runtime files here? ---
for f in index.html js/app.js css/style.css server/index.js server/db.js \
         server/scheduler.js server/rmto-client.js server/package.json; do
    if [ ! -f "$SRC_DIR/$f" ]; then
        echo "ERROR: $SRC_DIR/$f not found."
        echo "Run this script from inside a full copy of the project."
        exit 1
    fi
done

# --- 1) Node.js 20 + build tools ---
if ! command -v node &>/dev/null; then
    echo ">>> Installing Node.js 20..."
    apt-get update -y
    apt-get install -y curl ca-certificates
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "Node: $(node -v) / npm: $(npm -v)"
apt-get install -y build-essential python3 nginx

# --- 2) Copy runtime files (never touches data.db / .env) ---
echo ">>> Copying application files..."
mkdir -p "$APP_DIR"/{css,js,data,server/uploads}
cp "$SRC_DIR/index.html"          "$APP_DIR/"
cp "$SRC_DIR/css/style.css"       "$APP_DIR/css/"
cp "$SRC_DIR/js/app.js"           "$APP_DIR/js/"
cp "$SRC_DIR/data/devices.js"     "$APP_DIR/data/" 2>/dev/null || true
cp "$SRC_DIR/server/index.js" \
   "$SRC_DIR/server/db.js" \
   "$SRC_DIR/server/scheduler.js" \
   "$SRC_DIR/server/rmto-client.js" \
   "$SRC_DIR/server/reset-password.js" \
   "$SRC_DIR/server/package.json" \
   "$APP_DIR/server/"
cp "$SRC_DIR/server/package-lock.json" "$APP_DIR/server/" 2>/dev/null || true

# --- 3) Node dependencies ---
echo ">>> Installing npm dependencies..."
cd "$APP_DIR/server"
if [ -f package-lock.json ]; then
    npm ci --omit=dev || npm install --production
else
    npm install --production
fi

# --- 4) .env from template (only if missing) ---
if [ ! -f "$APP_DIR/server/.env" ]; then
    echo ">>> Creating .env from template..."
    cp "$SCRIPT_DIR/config/env.example" "$APP_DIR/server/.env"
    # Fixed session secret so logins survive restarts
    SECRET=$(head -c 32 /dev/urandom | od -A n -t x1 | tr -d ' \n')
    echo "SESSION_SECRET=$SECRET" >> "$APP_DIR/server/.env"
    echo ""
    echo "!!! IMPORTANT: edit $APP_DIR/server/.env and set RMTO credentials !!!"
    echo ""
fi

# --- 5) systemd service ---
echo ">>> Installing systemd service..."
cp "$SCRIPT_DIR/config/tc-manager.service" /etc/systemd/system/tc-manager.service
systemctl daemon-reload
systemctl enable tc-manager

# --- 6) Nginx reverse proxy ---
echo ">>> Configuring Nginx..."
cp "$SCRIPT_DIR/config/nginx-tc-manager.conf" /etc/nginx/sites-available/tc-manager
ln -sf /etc/nginx/sites-available/tc-manager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

# --- 7) Firewall (2022 = device TCP port, do NOT forget) ---
if command -v ufw &>/dev/null; then
    echo ">>> Configuring firewall..."
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 2022/tcp
    ufw --force enable
fi

# --- 8) Timezone + start ---
timedatectl set-timezone Asia/Tehran 2>/dev/null || true
echo ">>> Starting TC Manager..."
systemctl restart tc-manager
sleep 3
systemctl status tc-manager --no-pager -l | sed -n '1,12p'

IP=$(hostname -I | awk '{print $1}')
echo ""
echo "============================================"
echo "  Install complete!"
echo ""
echo "  Dashboard : http://$IP"
echo "  Login     : admin / admin123  (change it!)"
echo "  Device TCP: $IP:2022"
echo ""
echo "  Next steps:"
echo "  1. nano $APP_DIR/server/.env   (RMTO credentials)"
echo "  2. systemctl restart tc-manager"
echo "  3. journalctl -u tc-manager -f"
echo "============================================"
