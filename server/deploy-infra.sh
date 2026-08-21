#!/bin/bash
# ============================================
# TC Manager - Full Deploy Script
# Copy-paste this ENTIRE script on your server
# ============================================
set -e

APP="/opt/tc-manager"
echo "=== Creating TC Manager at $APP ==="
mkdir -p $APP/{css,js,data,server}

# ---------- server/package.json ----------
cat > $APP/server/package.json << 'JSONEOF'
{
  "name": "tc-manager-server",
  "version": "1.0.0",
  "description": "TC Manager - Sistan Akbari",
  "main": "index.js",
  "scripts": { "start": "node index.js" },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "better-sqlite3": "^9.4.3",
    "soap": "^1.0.0",
    "node-cron": "^3.0.3",
    "dotenv": "^16.4.1"
  }
}
JSONEOF

# ---------- server/.env ----------
cat > $APP/server/.env << 'ENVEOF'
PORT=3000
HOST=0.0.0.0
RMTO_WSDL=http://otf.rmto.ir/Companies/Companies.asmx?WSDL
RMTO_ENDPOINT=http://otf.rmto.ir/Companies/Companies.asmx
RMTO_COMPANY_CODE=58
RMTO_USERNAME=NOGSH
RMTO_PASSWORD=N*(gH5!u3
SEND_INTERVAL_MINUTES=15
ENVEOF

echo ">>> Files created. Now running setup..."

# ---------- Install Node.js ----------
if ! command -v node &> /dev/null; then
    echo ">>> Installing Node.js 20..."
    apt-get update -y
    apt-get install -y curl
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs build-essential python3
fi
echo "Node: $(node -v)"

# ---------- Install Nginx ----------
apt-get install -y nginx

# ---------- Install npm deps ----------
cd $APP/server
npm install --production

# ---------- systemd service ----------
cat > /etc/systemd/system/tc-manager.service << 'SVCEOF'
[Unit]
Description=TC Manager Server
After=network.target
StartLimitIntervalSec=300
StartLimitBurst=20

[Service]
Type=simple
User=root
WorkingDirectory=/opt/tc-manager/server
ExecStartPre=-/usr/bin/fuser -k 3000/tcp
ExecStartPre=-/usr/bin/fuser -k 2022/tcp
ExecStartPre=/bin/sleep 2
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
TimeoutStopSec=15
KillMode=mixed
KillSignal=SIGTERM
Environment=NODE_ENV=production
Environment=TZ=Asia/Tehran

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable tc-manager

# ---------- Nginx ----------
cat > /etc/nginx/sites-available/tc-manager << 'NGXEOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 500M;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGXEOF

ln -sf /etc/nginx/sites-available/tc-manager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl enable nginx
nginx -t && systemctl restart nginx

# ---------- Firewall ----------
ufw allow 22/tcp
ufw allow 80/tcp
ufw --force enable

echo ""
echo "=== Infrastructure ready! ==="
echo "=== Now you need to upload the code files ==="
echo "=== Run: systemctl start tc-manager ==="
echo ""
