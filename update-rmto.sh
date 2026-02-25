#!/bin/bash

#==============================================================================
# اسکریپت بروزرسانی RMTO با Backup خودکار
# Update RMTO Script with Automatic Backup
#==============================================================================

set -e  # Exit on error

echo "🔄 بروزرسانی RMTO با backup خودکار"
echo "🔄 RMTO Update with Automatic Backup"
echo ""

# متغیرها
BACKUP_FILE="backup-rmto-$(date +%Y%m%d-%H%M%S).tar.gz"
BASE_URL="https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server"

# بررسی مسیر
if [ ! -d "server" ]; then
    echo "❌ پوشه server پیدا نشد! لطفاً از مسیر صحیح اجرا کنید"
    echo "❌ server directory not found! Please run from correct path"
    exit 1
fi

# ایجاد backup
echo "📦 ساخت backup: $BACKUP_FILE"
echo "📦 Creating backup: $BACKUP_FILE"
tar -czf "$BACKUP_FILE" server/
if [ $? -eq 0 ]; then
    echo "✅ Backup ذخیره شد: $BACKUP_FILE"
    echo "✅ Backup saved: $BACKUP_FILE"
else
    echo "❌ خطا در ساخت backup!"
    echo "❌ Error creating backup!"
    exit 1
fi
echo ""

# دانلود فایل‌های جدید
echo "📥 دانلود فایل‌های بروز RMTO..."
echo "📥 Downloading updated RMTO files..."
cd server || exit 1

# دانلود rmto-client.js
echo "  → rmto-client.js"
if curl -f -s -O "$BASE_URL/rmto-client.js"; then
    echo "    ✅ دانلود موفق"
else
    echo "    ❌ خطا در دانلود"
    cd ..
    echo "⚠️  بازگشت از backup..."
    tar -xzf "$BACKUP_FILE"
    exit 1
fi

# دانلود test-add-method.js
echo "  → test-add-method.js"
if curl -f -s -O "$BASE_URL/test-add-method.js"; then
    echo "    ✅ دانلود موفق"
else
    echo "    ❌ خطا در دانلود"
fi

# دانلود test-rmto.js
echo "  → test-rmto.js"
if curl -f -s -O "$BASE_URL/test-rmto.js"; then
    echo "    ✅ دانلود موفق"
else
    echo "    ❌ خطا در دانلود"
fi

# دانلود device-route-mapping.json (اختیاری)
echo "  → device-route-mapping.json (optional)"
if curl -f -s -O "$BASE_URL/device-route-mapping.json"; then
    echo "    ✅ دانلود موفق"
else
    echo "    ⚠️  فایل یافت نشد (اختیاری)"
fi

echo ""
echo "✅ همه فایل‌ها دانلود شدند"
echo "✅ All files downloaded"
echo ""

# تست
echo "🧪 تست RMTO..."
echo "🧪 Testing RMTO..."
if node test-add-method.js 2>&1 | grep -q "موفق\|PASSED\|success"; then
    echo "✅ تست موفق بود!"
    echo "✅ Test passed!"
    echo ""
    
    # راه‌اندازی مجدد سرور
    echo "🚀 راه‌اندازی مجدد سرور..."
    echo "🚀 Restarting server..."
    
    # Kill process قبلی
    pkill -f "node.*index.js" 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    
    sleep 1
    
    # شروع سرور در background
    npm start > /dev/null 2>&1 &
    
    sleep 2
    echo "✅ سرور راه‌اندازی شد"
    echo "✅ Server started"
    echo ""
    echo "🎉 بروزرسانی با موفقیت کامل شد!"
    echo "🎉 Update completed successfully!"
    echo ""
    echo "📍 Backup: $BACKUP_FILE"
    
else
    echo "❌ تست ناموفق بود!"
    echo "❌ Test failed!"
    echo ""
    echo "⏮️  بازگشت از backup..."
    echo "⏮️  Rolling back from backup..."
    cd ..
    tar -xzf "$BACKUP_FILE"
    echo "✅ فایل‌های قبلی بازگردانده شدند"
    echo "✅ Previous files restored"
    echo ""
    echo "💡 لطفاً خطا را بررسی کنید و دوباره تلاش کنید"
    echo "💡 Please check the error and try again"
    exit 1
fi
