#!/bin/bash

# safe-backup.sh - اسکریپت backup خودکار
# نسخه: 1.0
# تاریخ: 2026-02-25

set -e

# رنگ‌ها برای خروجی
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Safe Backup Script${NC}"
echo ""

# تنظیمات
PROJECT_DIR="/opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-"
BACKUP_DIR="/root/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.tar.gz"

# ساخت پوشه backup اگر وجود ندارد
mkdir -p "$BACKUP_DIR"

# بررسی پوشه project
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}⚠️  Warning: Project directory not found: $PROJECT_DIR${NC}"
    echo "Using current directory instead"
    PROJECT_DIR="."
fi

# رفتن به پوشه project
cd "$PROJECT_DIR" || exit 1

# ساخت backup
echo -e "${BLUE}📦 Creating backup...${NC}"
echo "   Source: $PROJECT_DIR/server"
echo "   Target: $BACKUP_FILE"
echo ""

if tar -czf "$BACKUP_FILE" server/ 2>/dev/null; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup created successfully!${NC}"
    echo "   File: $BACKUP_FILE"
    echo "   Size: $BACKUP_SIZE"
    echo ""
    
    # نمایش 5 backup اخیر
    echo -e "${BLUE}📋 Recent backups:${NC}"
    ls -lht "$BACKUP_DIR"/*.tar.gz 2>/dev/null | head -5 | awk '{print "   " $9 " (" $5 ")"}'
    echo ""
    
    # حذف backup های قدیمی‌تر از 7 روز (اختیاری)
    echo -e "${BLUE}🧹 Cleaning old backups (>7 days)...${NC}"
    OLD_BACKUPS=$(find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +7 2>/dev/null)
    if [ -n "$OLD_BACKUPS" ]; then
        echo "$OLD_BACKUPS" | while read -r file; do
            rm -f "$file"
            echo "   Deleted: $(basename "$file")"
        done
    else
        echo "   No old backups to clean"
    fi
    echo ""
    
    echo -e "${GREEN}✅ Done!${NC}"
else
    echo -e "${YELLOW}❌ Failed to create backup${NC}"
    exit 1
fi
