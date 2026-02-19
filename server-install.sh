#!/bin/bash
# TC Manager - Automated Server Installation Script
# اسکریپت نصب خودکار TC Manager روی سرور

set -e  # Exit on error

# رنگ‌ها برای output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# توابع کمکی
print_header() {
    echo -e "${PURPLE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${CYAN}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ خطا: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# بررسی root/sudo
check_root() {
    if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
        print_error "این اسکریپت نیاز به دسترسی sudo دارد"
        echo "لطفاً با sudo اجرا کنید: sudo $0"
        exit 1
    fi
}

# شناسایی سیستم عامل
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    elif [ -f /etc/redhat-release ]; then
        OS="centos"
    else
        OS=$(uname -s)
    fi
    
    case "$OS" in
        ubuntu|debian)
            PKG_MANAGER="apt"
            ;;
        centos|rhel|rocky|almalinux)
            PKG_MANAGER="yum"
            ;;
        *)
            print_warning "سیستم عامل شناسایی نشد: $OS"
            PKG_MANAGER="apt"
            ;;
    esac
}

# نصب Node.js
install_nodejs() {
    print_step "نصب Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_info "Node.js از قبل نصب است: $NODE_VERSION"
        
        # بررسی نسخه
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -lt 18 ]; then
            print_warning "نسخه Node.js قدیمی است. در حال به‌روزرسانی..."
        else
            print_success "نسخه Node.js مناسب است"
            return 0
        fi
    fi
    
    if [ "$PKG_MANAGER" = "apt" ]; then
        # Ubuntu/Debian
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        # CentOS/Rocky/Alma
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    fi
    
    if command -v node &> /dev/null; then
        print_success "Node.js نصب شد: $(node --version)"
    else
        print_error "نصب Node.js شکست خورد"
        exit 1
    fi
}

# نصب PM2
install_pm2() {
    print_step "نصب PM2..."
    
    if command -v pm2 &> /dev/null; then
        print_info "PM2 از قبل نصب است: $(pm2 --version)"
        return 0
    fi
    
    sudo npm install -g pm2
    
    if command -v pm2 &> /dev/null; then
        print_success "PM2 نصب شد: $(pm2 --version)"
    else
        print_error "نصب PM2 شکست خورد"
        exit 1
    fi
}

# نصب Git
install_git() {
    print_step "نصب Git..."
    
    if command -v git &> /dev/null; then
        print_info "Git از قبل نصب است: $(git --version)"
        return 0
    fi
    
    if [ "$PKG_MANAGER" = "apt" ]; then
        sudo apt-get install -y git
    else
        sudo yum install -y git
    fi
    
    if command -v git &> /dev/null; then
        print_success "Git نصب شد"
    else
        print_error "نصب Git شکست خورد"
        exit 1
    fi
}

# دانلود TC Manager
download_app() {
    print_step "دانلود TC Manager..."
    
    INSTALL_DIR="/home/tc-manager"
    
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "پوشه $INSTALL_DIR از قبل وجود دارد"
        read -p "آیا می‌خواهید حذف و دوباره دانلود شود؟ (y/n): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo rm -rf "$INSTALL_DIR"
        else
            print_info "از نصخه موجود استفاده می‌شود"
            cd "$INSTALL_DIR"
            return 0
        fi
    fi
    
    cd /home
    sudo git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git tc-manager
    sudo chown -R $USER:$USER tc-manager
    cd tc-manager
    
    print_success "TC Manager دانلود شد"
}

# نصب Dependencies
install_dependencies() {
    print_step "نصب Dependencies..."
    
    cd /home/tc-manager/server
    
    npm install --production
    
    if [ $? -eq 0 ]; then
        print_success "Dependencies نصب شدند"
    else
        print_error "نصب Dependencies شکست خورد"
        exit 1
    fi
}

# تنظیم Environment Variables
setup_env() {
    print_step "تنظیم Environment Variables..."
    
    cd /home/tc-manager/server
    
    if [ -f .env ]; then
        print_warning "فایل .env از قبل وجود دارد"
        read -p "آیا می‌خواهید بازنویسی شود؟ (y/n): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "از .env موجود استفاده می‌شود"
            return 0
        fi
    fi
    
    cp .env.example .env
    
    echo ""
    print_info "لطفاً اطلاعات زیر را وارد کنید:"
    echo ""
    
    # Admin Password
    read -p "رمز عبور Admin (پیش‌فرض: admin123): " ADMIN_PASS
    ADMIN_PASS=${ADMIN_PASS:-admin123}
    
    # RMTO Username
    read -p "RMTO Username (پیش‌فرض: NOGSH): " RMTO_USER
    RMTO_USER=${RMTO_USER:-NOGSH}
    
    # RMTO Password
    read -p "RMTO Password: " RMTO_PASS
    if [ -z "$RMTO_PASS" ]; then
        print_warning "RMTO Password خالی است. بعداً باید تنظیم شود."
        RMTO_PASS="CHANGE_ME"
    fi
    
    # Generate random keys
    API_KEY=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
    SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
    
    # به‌روزرسانی .env
    sed -i "s/NODE_ENV=development/NODE_ENV=production/" .env
    sed -i "s/ADMIN_PASS=admin123/ADMIN_PASS=$ADMIN_PASS/" .env
    sed -i "s/RMTO_USERNAME=NOGSH/RMTO_USERNAME=$RMTO_USER/" .env
    sed -i "s/RMTO_PASSWORD=CHANGE_ME_HERE/RMTO_PASSWORD=$RMTO_PASS/" .env
    sed -i "s/DEVICE_API_KEY=/DEVICE_API_KEY=$API_KEY/" .env
    sed -i "s/# SESSION_SECRET=/SESSION_SECRET=$SESSION_SECRET/" .env
    
    print_success "فایل .env تنظیم شد"
}

# راه‌اندازی Application با PM2
start_app() {
    print_step "راه‌اندازی Application..."
    
    cd /home/tc-manager/server
    
    # حذف process قبلی (اگر وجود دارد)
    pm2 delete tc-manager 2>/dev/null || true
    
    # Start با PM2
    pm2 start index.js --name tc-manager
    
    # تنظیم startup
    pm2 startup systemd -u $USER --hp /home/$USER 2>/dev/null || true
    pm2 save
    
    if pm2 list | grep -q "tc-manager"; then
        print_success "Application راه‌اندازی شد"
    else
        print_error "راه‌اندازی Application شکست خورد"
        exit 1
    fi
}

# نصب Nginx (اختیاری)
install_nginx() {
    print_step "نصب Nginx..."
    
    read -p "آیا می‌خواهید Nginx نصب شود؟ (توصیه می‌شود) (y/n): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Nginx نصب نشد"
        return 0
    fi
    
    if command -v nginx &> /dev/null; then
        print_info "Nginx از قبل نصب است"
        return 0
    fi
    
    if [ "$PKG_MANAGER" = "apt" ]; then
        sudo apt-get install -y nginx
    else
        sudo yum install -y nginx
    fi
    
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    print_success "Nginx نصب و راه‌اندازی شد"
    
    # پیشنهاد پیکربندی
    print_info ""
    print_info "برای پیکربندی Nginx به عنوان reverse proxy:"
    print_info "sudo nano /etc/nginx/sites-available/tc-manager"
    print_info ""
    print_info "یا از راهنمای کامل استفاده کنید:"
    print_info "docs/SERVER-DEPLOYMENT.md"
}

# تنظیم Firewall
setup_firewall() {
    print_step "تنظیم Firewall..."
    
    read -p "آیا می‌خواهید Firewall تنظیم شود؟ (y/n): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Firewall تنظیم نشد"
        return 0
    fi
    
    if command -v ufw &> /dev/null; then
        # UFW (Ubuntu/Debian)
        print_info "تنظیم UFW..."
        sudo ufw --force enable
        sudo ufw allow 22/tcp
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        print_success "UFW تنظیم شد"
    elif command -v firewall-cmd &> /dev/null; then
        # firewalld (CentOS/Rocky/Alma)
        print_info "تنظیم firewalld..."
        sudo systemctl start firewalld
        sudo systemctl enable firewalld
        sudo firewall-cmd --permanent --add-service=ssh
        sudo firewall-cmd --permanent --add-service=http
        sudo firewall-cmd --permanent --add-service=https
        sudo firewall-cmd --reload
        print_success "firewalld تنظیم شد"
    else
        print_warning "Firewall شناسایی نشد"
    fi
}

# نمایش اطلاعات نهایی
show_info() {
    print_header "نصب با موفقیت انجام شد!"
    
    # گرفتن IP سرور
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "IP_NOT_FOUND")
    
    echo ""
    echo -e "${GREEN}✓ TC Manager در حال اجراست!${NC}"
    echo ""
    echo -e "${CYAN}دسترسی به Application:${NC}"
    echo -e "  • HTTP:  http://$SERVER_IP:3000"
    echo -e "  • Local: http://localhost:3000"
    echo ""
    
    if command -v nginx &> /dev/null; then
        echo -e "${CYAN}دسترسی از طریق Nginx (بعد از پیکربندی):${NC}"
        echo -e "  • HTTP:  http://$SERVER_IP"
        echo -e "  • HTTPS: https://YOUR_DOMAIN"
        echo ""
    fi
    
    echo -e "${CYAN}اطلاعات ورود:${NC}"
    echo -e "  • نام کاربری: admin"
    echo -e "  • رمز عبور: (همانی که وارد کردید)"
    echo ""
    
    echo -e "${CYAN}دستورات مفید:${NC}"
    echo -e "  • مشاهده وضعیت:  pm2 list"
    echo -e "  • مشاهده logs:    pm2 logs tc-manager"
    echo -e "  • Restart:         pm2 restart tc-manager"
    echo -e "  • Stop:            pm2 stop tc-manager"
    echo -e "  • Monitoring:      pm2 monit"
    echo ""
    
    echo -e "${CYAN}فایل‌های مهم:${NC}"
    echo -e "  • Application:     /home/tc-manager"
    echo -e "  • Config:          /home/tc-manager/server/.env"
    echo -e "  • Database:        /home/tc-manager/server/data.db"
    echo -e "  • Logs:            pm2 logs tc-manager"
    echo ""
    
    echo -e "${YELLOW}مراحل بعدی:${NC}"
    echo -e "  1. ✓ Application نصب و راه‌اندازی شد"
    
    if command -v nginx &> /dev/null; then
        echo -e "  2. ⚠ Nginx را به عنوان reverse proxy پیکربندی کنید"
        echo -e "     راهنما: docs/SERVER-DEPLOYMENT.md"
    else
        echo -e "  2. ⚠ Nginx نصب کنید (اختیاری اما توصیه می‌شود)"
    fi
    
    echo -e "  3. ⚠ SSL/HTTPS تنظیم کنید (Let's Encrypt)"
    echo -e "     دستور: sudo certbot --nginx"
    echo -e "  4. ⚠ Backup خودکار تنظیم کنید"
    echo -e "     راهنما: docs/BACKUP-RESTORE.md"
    echo ""
    
    echo -e "${GREEN}راهنماهای کامل:${NC}"
    echo -e "  • Deployment:  docs/SERVER-DEPLOYMENT.md"
    echo -e "  • Requirements: docs/SERVER-REQUIREMENTS.md"
    echo -e "  • API:         docs/API.md"
    echo ""
    
    print_header "موفق باشید!"
}

# اجرای اصلی
main() {
    print_header "TC Manager - نصب خودکار"
    
    print_info "این اسکریپت TC Manager را به طور خودکار نصب می‌کند"
    print_info "زمان تقریبی: 5-10 دقیقه"
    echo ""
    
    read -p "آیا می‌خواهید ادامه دهید؟ (y/n): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "نصب لغو شد"
        exit 0
    fi
    
    echo ""
    
    # بررسی‌های اولیه
    check_root
    detect_os
    
    print_info "سیستم عامل شناسایی شده: $OS"
    print_info "Package Manager: $PKG_MANAGER"
    echo ""
    
    # به‌روزرسانی سیستم
    print_step "به‌روزرسانی سیستم..."
    if [ "$PKG_MANAGER" = "apt" ]; then
        sudo apt-get update -qq
        sudo apt-get upgrade -y -qq
    else
        sudo yum update -y -q
    fi
    print_success "سیستم به‌روز شد"
    
    # نصب‌ها
    install_nodejs
    install_pm2
    install_git
    
    # دانلود و نصب
    download_app
    install_dependencies
    setup_env
    start_app
    
    # اختیاری
    install_nginx
    setup_firewall
    
    # نمایش اطلاعات
    show_info
}

# اجرا
main "$@"
