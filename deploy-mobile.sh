#!/bin/bash
# =============================================================
# TC Manager – Mobile UI Deployment
# Deploys the mobile-optimised web interface on a SEPARATE port
# while proxying all API calls to the main TC Manager server.
#
# The main system (tc-manager on port 3000) is NOT touched.
#
# Usage:
#   bash deploy-mobile.sh
#
# Result:
#   - Mobile UI available on port 8080 (via nginx) or port 3001 direct
#   - API calls proxied to main server at 127.0.0.1:3000
#   - Same database, same TCP data, same RMTO – nothing duplicated
# =============================================================
set -e

APP_DIR="/opt/tc-manager-mobile"
MAIN_PORT=3000
MOBILE_PORT=3001
NGINX_PORT=8080

echo "========================================"
echo "  TC Manager – Mobile UI Deployment"
echo "========================================"

# ----------------------------------------------------------
# 1. Create directories
# ----------------------------------------------------------
echo "[1/6] Creating directories..."
mkdir -p "$APP_DIR/public/css" "$APP_DIR/public/js" "$APP_DIR/public/data"

# ----------------------------------------------------------
# 2. Copy frontend files from main installation
# ----------------------------------------------------------
echo "[2/6] Copying frontend files..."
MAIN_DIR="/opt/tc-manager"

if [ -d "$MAIN_DIR" ]; then
    # Copy from the deployed main installation
    cp -f "$MAIN_DIR/index.html"     "$APP_DIR/public/index.html"
    cp -f "$MAIN_DIR/css/style.css"  "$APP_DIR/public/css/style.css"
    cp -f "$MAIN_DIR/js/app.js"      "$APP_DIR/public/js/app.js"
    [ -f "$MAIN_DIR/data/devices.js" ] && cp -f "$MAIN_DIR/data/devices.js" "$APP_DIR/public/data/devices.js"
    echo "    Copied from $MAIN_DIR"
else
    # Fallback: copy from repo source (first-time deploy before main)
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    cp -f "$SCRIPT_DIR/index.html"     "$APP_DIR/public/index.html"
    cp -f "$SCRIPT_DIR/css/style.css"  "$APP_DIR/public/css/style.css"
    cp -f "$SCRIPT_DIR/js/app.js"      "$APP_DIR/public/js/app.js"
    [ -f "$SCRIPT_DIR/data/devices.js" ] && cp -f "$SCRIPT_DIR/data/devices.js" "$APP_DIR/public/data/devices.js"
    echo "    Copied from repo source ($SCRIPT_DIR)"
fi

# ----------------------------------------------------------
# 3. Copy mobile server files
# ----------------------------------------------------------
echo "[3/6] Installing mobile server..."
cp -f "$(cd "$(dirname "$0")" && pwd)/mobile/server.js"    "$APP_DIR/server.js"
cp -f "$(cd "$(dirname "$0")" && pwd)/mobile/package.json"  "$APP_DIR/package.json"

cd "$APP_DIR"
npm install --production 2>&1 | tail -5 || { echo "ERROR: npm install failed"; exit 1; }

# ----------------------------------------------------------
# 4. Create .env
# ----------------------------------------------------------
cat > "$APP_DIR/.env" << EOF
PORT=$MOBILE_PORT
MAIN_SERVER=http://127.0.0.1:$MAIN_PORT
EOF

# ----------------------------------------------------------
# 5. Create systemd service
# ----------------------------------------------------------
echo "[4/6] Creating systemd service..."
cat > /etc/systemd/system/tc-manager-mobile.service << ENDSVC
[Unit]
Description=TC Manager – Mobile UI (port $MOBILE_PORT)
After=network.target tc-manager.service
Wants=tc-manager.service

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=$MOBILE_PORT
Environment=MAIN_SERVER=http://127.0.0.1:$MAIN_PORT

[Install]
WantedBy=multi-user.target
ENDSVC

systemctl daemon-reload
systemctl enable tc-manager-mobile

# ----------------------------------------------------------
# 6. Add nginx server block for mobile (port 8080)
# ----------------------------------------------------------
echo "[5/6] Configuring nginx for mobile (port $NGINX_PORT)..."
cat > /etc/nginx/sites-available/tc-manager-mobile << ENDNGINX
# TC Manager – Mobile UI
server {
    listen $NGINX_PORT;
    listen [::]:$NGINX_PORT;
    server_name _;
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:$MOBILE_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
ENDNGINX

ln -sf /etc/nginx/sites-available/tc-manager-mobile /etc/nginx/sites-enabled/tc-manager-mobile
nginx -t && systemctl reload nginx

# ----------------------------------------------------------
# 7. Open firewall port
# ----------------------------------------------------------
ufw allow $NGINX_PORT/tcp 2>/dev/null || true

# ----------------------------------------------------------
# 8. Start
# ----------------------------------------------------------
echo "[6/6] Starting mobile service..."
systemctl restart tc-manager-mobile
sleep 2

if systemctl is-active --quiet tc-manager-mobile; then
    echo ""
    echo "========================================"
    echo "  OK! Mobile UI running"
    echo "  URL:  http://<SERVER_IP>:$NGINX_PORT"
    echo "  Direct: http://127.0.0.1:$MOBILE_PORT"
    echo "  API proxy → http://127.0.0.1:$MAIN_PORT"
    echo ""
    echo "  Same login as main system."
    echo "  Main system is NOT affected."
    echo "========================================"
else
    echo "  [ERROR] Check: journalctl -u tc-manager-mobile -n 50"
fi
