#!/bin/bash
# ============================================
# TC Manager Server Setup Script
# Run on Ubuntu/Debian Linux server
# ============================================

set -e

echo "=== TC Manager Server Setup ==="
echo ""

# 1. Update system
echo ">>> Updating system..."
apt-get update -y
apt-get upgrade -y

# 2. Install Node.js 20 LTS
echo ">>> Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# 3. Install build essentials (for better-sqlite3)
echo ">>> Installing build tools..."
apt-get install -y build-essential python3

# 4. Install Nginx
echo ">>> Installing Nginx..."
apt-get install -y nginx

# 5. Setup project directory
APP_DIR="/opt/tc-manager"
echo ">>> Setting up application in $APP_DIR..."
mkdir -p $APP_DIR

# Copy files (run from project root)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cp -r "$PROJECT_DIR"/* $APP_DIR/
cp -r "$PROJECT_DIR"/.gitignore $APP_DIR/ 2>/dev/null || true

# 6. Install Node.js dependencies
echo ">>> Installing Node.js dependencies..."
cd $APP_DIR/server
npm install --production

# 7. Create .env file if not exists
if [ ! -f "$APP_DIR/server/.env" ]; then
    echo ">>> Creating .env from template..."
    cp .env.example .env
    echo ""
    echo "!!! IMPORTANT: Edit $APP_DIR/server/.env with your credentials !!!"
    echo ""
fi

# 8. Setup systemd service
echo ">>> Creating systemd service..."
cat > /etc/systemd/system/tc-manager.service << 'UNIT'
[Unit]
Description=TC Manager - Traffic Monitoring Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/tc-manager/server
ExecStartPre=/bin/bash -c 'fuser -k 3000/tcp 2>/dev/null; fuser -k 2022/tcp 2>/dev/null; sleep 1; true'
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
TimeoutStopSec=10
KillMode=mixed
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable tc-manager

# 9. Setup Nginx reverse proxy
echo ">>> Configuring Nginx..."
cat > /etc/nginx/sites-available/tc-manager << 'NGINX'
server {
    listen 80;
    server_name _;
    client_max_body_size 500M;

    # Frontend files
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/tc-manager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl enable nginx
nginx -t
systemctl restart nginx

# 10. Setup firewall
echo ">>> Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 11. Start application
echo ">>> Starting TC Manager..."
systemctl start tc-manager

echo ""
echo "============================================"
echo "  Setup Complete!"
echo ""
echo "  Dashboard: http://$(hostname -I | awk '{print $1}')"
echo "  API:       http://$(hostname -I | awk '{print $1}')/api/stats"
echo ""
echo "  Next steps:"
echo "  1. Edit /opt/tc-manager/server/.env"
echo "  2. systemctl restart tc-manager"
echo "============================================"
