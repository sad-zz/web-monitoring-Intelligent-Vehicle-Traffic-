#!/bin/bash
# =============================================================
# TC Manager – Mobile UI Deployment  (SELF-CONTAINED)
#
# Works in TWO modes:
#
# ▶ ONLINE (server has internet):
#   scp deploy-mobile.sh root@SERVER_IP:/tmp/
#   ssh root@SERVER_IP 'bash /tmp/deploy-mobile.sh'
#
# ▶ OFFLINE (server has NO internet):
#   1. On YOUR computer (with internet):
#      bash prepare-mobile-offline.sh
#   2. Transfer to server:
#      scp mobile-offline/* root@SERVER_IP:/tmp/
#   3. Run on server:
#      ssh root@SERVER_IP 'bash /tmp/deploy-mobile.sh'
#
# Result:
#   - Mobile UI: http://SERVER_IP:8080
#   - API calls proxied to main server at 127.0.0.1:3000
#   - Same database, same TCP data, same RMTO – nothing duplicated
#   - Main system: UNCHANGED and keeps running
# =============================================================
set -e

APP_DIR="/opt/tc-manager-mobile"
MAIN_DIR="/opt/tc-manager"
MAIN_PORT=3000
MOBILE_PORT=3001
NGINX_PORT=8080

echo "========================================"
echo "  TC Manager – Mobile UI Deployment"
echo "  (self-contained – no other files needed)"
echo "========================================"

# ----------------------------------------------------------
# Pre-check: main system must be deployed
# ----------------------------------------------------------
if [ ! -d "$MAIN_DIR" ]; then
    echo "[ERROR] Main TC Manager not found at $MAIN_DIR"
    echo "        Deploy the main system first with deploy-all.sh"
    exit 1
fi

# ----------------------------------------------------------
# 1. Stop mobile service if already running
# ----------------------------------------------------------
systemctl stop tc-manager-mobile 2>/dev/null || true

# ----------------------------------------------------------
# 2. Create directories
# ----------------------------------------------------------
echo "[1/7] Creating directories..."
mkdir -p "$APP_DIR/public/css" "$APP_DIR/public/js" "$APP_DIR/public/data"

# ----------------------------------------------------------
# 3. Copy frontend files from main installation
# ----------------------------------------------------------
echo "[2/7] Copying frontend files from main system..."
cp -f "$MAIN_DIR/index.html"     "$APP_DIR/public/index.html"
cp -f "$MAIN_DIR/css/style.css"  "$APP_DIR/public/css/style.css"
cp -f "$MAIN_DIR/js/app.js"      "$APP_DIR/public/js/app.js"
[ -f "$MAIN_DIR/data/devices.js" ] && cp -f "$MAIN_DIR/data/devices.js" "$APP_DIR/public/data/devices.js"
echo "    Copied from $MAIN_DIR"

# ----------------------------------------------------------
# 4. Write mobile proxy server (embedded – no external files needed)
# ----------------------------------------------------------
echo "[3/7] Writing mobile proxy server..."

cat > "$APP_DIR/package.json" << 'ENDOFFILE_PACKAGE_JSON'
{
  "name": "tc-manager-mobile",
  "version": "1.0.0",
  "description": "TC Manager - Mobile Web UI proxy (connects to main server API)",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "http-proxy-middleware": "^2.0.7"
  }
}
ENDOFFILE_PACKAGE_JSON

cat > "$APP_DIR/server.js" << 'ENDOFFILE_SERVER_JS'
/**
 * TC Manager - Mobile Web UI Proxy
 *
 * A lightweight server that:
 *  1. Serves the mobile-optimised frontend (index.html, css/, js/)
 *  2. Proxies every /api/* request to the main TC Manager server
 *     so that the mobile UI reads the SAME data (TCP port 2022,
 *     database, RMTO queue) without duplicating anything.
 *
 * Usage:
 *   MAIN_SERVER=http://127.0.0.1:3000 PORT=3001 node server.js
 *
 * Environment variables:
 *   PORT         – port for this mobile server   (default 3001)
 *   MAIN_SERVER  – main TC Manager origin        (default http://127.0.0.1:3000)
 */

var express = require("express");
var path = require("path");
var { createProxyMiddleware } = require("http-proxy-middleware");

var app = express();
var PORT = parseInt(process.env.PORT, 10);
if (isNaN(PORT)) PORT = 3001;
var MAIN_SERVER = process.env.MAIN_SERVER || "http://127.0.0.1:3000";

// ------------------------------------------------------------------
// 1. Proxy all API calls to the main server (preserves cookies/session)
// ------------------------------------------------------------------
app.use(
    "/api",
    createProxyMiddleware({
        target: MAIN_SERVER,
        changeOrigin: true,
        cookieDomainRewrite: "",
        onProxyReq: function (proxyReq, req) {
            // Forward the original cookie header so sessions work
            if (req.headers.cookie) {
                proxyReq.setHeader("Cookie", req.headers.cookie);
            }
        },
        onProxyRes: function (proxyRes) {
            // Allow credentials from the mobile origin
            proxyRes.headers["access-control-allow-credentials"] = "true";
        },
        onError: function (err, req, res) {
            console.error("[Proxy] Error connecting to main server:", err.message);
            res.status(502).json({ error: "Main server unreachable" });
        }
    })
);

// ------------------------------------------------------------------
// 2. Serve mobile frontend static files
// ------------------------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

// Fallback: serve index.html for any non-API, non-file route (SPA)
app.get("*", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ------------------------------------------------------------------
// 3. Start
// ------------------------------------------------------------------
app.listen(PORT, "0.0.0.0", function () {
    console.log("============================================");
    console.log("  TC Manager – Mobile UI");
    console.log("  Listening: http://0.0.0.0:" + PORT);
    console.log("  API proxy: " + MAIN_SERVER + "/api/*");
    console.log("============================================");
});
ENDOFFILE_SERVER_JS

# ----------------------------------------------------------
# 5. Install npm dependencies (offline or online)
# ----------------------------------------------------------
echo "[4/7] Installing npm dependencies..."
cd "$APP_DIR"

# Look for pre-bundled node_modules tarball (for offline servers)
BUNDLE_LOCATIONS=(
    "/tmp/mobile-node-modules.tar.gz"
    "$(dirname "$0")/mobile-node-modules.tar.gz"
    "$APP_DIR/mobile-node-modules.tar.gz"
)

BUNDLE_FOUND=""
for loc in "${BUNDLE_LOCATIONS[@]}"; do
    if [ -f "$loc" ]; then
        BUNDLE_FOUND="$loc"
        break
    fi
done

if [ -n "$BUNDLE_FOUND" ]; then
    # OFFLINE mode: extract pre-bundled node_modules
    echo "    📦 Offline mode: extracting from $BUNDLE_FOUND"
    rm -rf "$APP_DIR/node_modules"
    tar xzf "$BUNDLE_FOUND" -C "$APP_DIR/"
    echo "    ✅ node_modules extracted ($(du -sh "$APP_DIR/node_modules/" | cut -f1))"
elif command -v npm &> /dev/null; then
    # ONLINE mode: npm install (requires internet)
    echo "    🌐 Online mode: running npm install..."
    npm install --production 2>&1 | tail -5 || {
        echo ""
        echo "  [ERROR] npm install failed!"
        echo "  اگر سرور به اینترنت دسترسی ندارد، از حالت آفلاین استفاده کنید:"
        echo "  If the server has no internet, use offline mode:"
        echo ""
        echo "  On your computer (with internet):"
        echo "    bash prepare-mobile-offline.sh"
        echo "    scp mobile-offline/* root@SERVER_IP:/tmp/"
        echo "    ssh root@SERVER_IP 'bash /tmp/deploy-mobile.sh'"
        exit 1
    }
else
    echo ""
    echo "  [ERROR] npm not found and no offline bundle available!"
    echo "  روی کامپیوتر خودتان (که اینترنت دارد) اجرا کنید:"
    echo "    bash prepare-mobile-offline.sh"
    echo "  سپس فایل‌ها را به سرور منتقل کنید:"
    echo "    scp mobile-offline/* root@SERVER_IP:/tmp/"
    echo "    ssh root@SERVER_IP 'bash /tmp/deploy-mobile.sh'"
    exit 1
fi

# ----------------------------------------------------------
# 6. Create systemd service
# ----------------------------------------------------------
echo "[5/7] Creating systemd service..."
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
# 7. Add nginx server block for mobile (port 8080)
# ----------------------------------------------------------
echo "[6/7] Configuring nginx for mobile (port $NGINX_PORT)..."
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
# 8. Open firewall port
# ----------------------------------------------------------
ufw allow $NGINX_PORT/tcp 2>/dev/null || true

# ----------------------------------------------------------
# 9. Start
# ----------------------------------------------------------
echo "[7/7] Starting mobile service..."
systemctl restart tc-manager-mobile
sleep 2

if systemctl is-active --quiet tc-manager-mobile; then
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo ""
    echo "========================================"
    echo "  ✅  Mobile UI running!"
    echo ""
    echo "  Mobile URL:  http://$SERVER_IP:$NGINX_PORT"
    echo "  Direct:      http://127.0.0.1:$MOBILE_PORT"
    echo "  API proxy →  http://127.0.0.1:$MAIN_PORT"
    echo ""
    echo "  Same login as main system (admin)."
    echo "  Main system is NOT affected."
    echo "========================================"
else
    echo "  [ERROR] Check: journalctl -u tc-manager-mobile -n 50"
fi
