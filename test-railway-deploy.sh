#!/bin/bash
# TC Manager - Railway Deployment Test Script
# اسکریپت تست deploy روی Railway

echo "════════════════════════════════════════════════════════════"
echo "  TC Manager - Railway Deployment Tester"
echo "  تست deploy روی Railway"
echo "════════════════════════════════════════════════════════════"
echo ""

# رنگ‌ها برای output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# تابع برای نمایش وضعیت
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# تابع برای نمایش اطلاعات
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# تابع برای نمایش هشدار
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# دریافت URL از کاربر
echo -e "${YELLOW}لطفاً URL اپلیکیشن Railway خود را وارد کنید:${NC}"
echo "مثال: https://tc-manager-production.up.railway.app"
read -p "URL: " APP_URL

# حذف slash انتهایی اگر وجود داشت
APP_URL=${APP_URL%/}

if [ -z "$APP_URL" ]; then
    echo -e "${RED}خطا: URL وارد نشده است${NC}"
    exit 1
fi

echo ""
echo "شروع تست‌ها..."
echo "════════════════════════════════════════════════════════════"
echo ""

# کانتر برای نتایج
PASSED=0
FAILED=0

# تست 1: دسترسی به صفحه اصلی
echo "🧪 تست 1: دسترسی به صفحه اصلی"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL" --max-time 10)
if [ "$HTTP_CODE" == "200" ]; then
    print_status 0 "صفحه اصلی در دسترس است (HTTP $HTTP_CODE)"
    ((PASSED++))
else
    print_status 1 "صفحه اصلی در دسترس نیست (HTTP $HTTP_CODE)"
    ((FAILED++))
fi
echo ""

# تست 2: Health Check
echo "🧪 تست 2: Health Check Endpoint"
HEALTH_RESPONSE=$(curl -s "$APP_URL/health" --max-time 10)
if echo "$HEALTH_RESPONSE" | grep -q '"status"'; then
    print_status 0 "Health check موفق"
    echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
    ((PASSED++))
else
    print_status 1 "Health check شکست خورد"
    echo "پاسخ: $HEALTH_RESPONSE"
    ((FAILED++))
fi
echo ""

# تست 3: Metrics Endpoint
echo "🧪 تست 3: Metrics Endpoint"
METRICS_RESPONSE=$(curl -s "$APP_URL/metrics" --max-time 10)
if echo "$METRICS_RESPONSE" | grep -q 'devices_total'; then
    print_status 0 "Metrics endpoint موفق"
    echo "$METRICS_RESPONSE" | jq '.' 2>/dev/null || echo "$METRICS_RESPONSE"
    ((PASSED++))
else
    print_status 1 "Metrics endpoint شکست خورد"
    ((FAILED++))
fi
echo ""

# تست 4: API Data Endpoint (بدون auth)
echo "🧪 تست 4: Device API Endpoint"
API_RESPONSE=$(curl -s -X POST "$APP_URL/api/data" \
    -H "Content-Type: application/json" \
    -d '{"device_code":"9999","vehicle_class":2,"speed":85}' \
    --max-time 10)

if echo "$API_RESPONSE" | grep -q 'success\|error'; then
    if echo "$API_RESPONSE" | grep -q '"success".*true'; then
        print_status 0 "Device API در حال کار است (داده دریافت شد)"
        ((PASSED++))
    elif echo "$API_RESPONSE" | grep -q 'unauthorized'; then
        print_status 0 "Device API در حال کار است (API key فعال است)"
        print_warning "نکته: برای ارسال داده، API key لازم است"
        ((PASSED++))
    else
        print_status 1 "Device API خطا برگرداند"
        echo "پاسخ: $API_RESPONSE"
        ((FAILED++))
    fi
else
    print_status 1 "Device API پاسخ نداد"
    ((FAILED++))
fi
echo ""

# تست 5: Auth Check Endpoint
echo "🧪 تست 5: Authentication System"
AUTH_RESPONSE=$(curl -s "$APP_URL/api/auth/check" --max-time 10)
if echo "$AUTH_RESPONSE" | grep -q 'loggedIn'; then
    print_status 0 "سیستم احراز هویت در حال کار است"
    ((PASSED++))
else
    print_status 1 "سیستم احراز هویت پاسخ نداد"
    ((FAILED++))
fi
echo ""

# تست 6: بررسی SSL/HTTPS
echo "🧪 تست 6: SSL/HTTPS"
if [[ $APP_URL == https://* ]]; then
    SSL_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL" --max-time 10)
    if [ "$SSL_RESPONSE" == "200" ]; then
        print_status 0 "HTTPS فعال است و کار می‌کند"
        ((PASSED++))
    else
        print_status 1 "HTTPS مشکل دارد (HTTP $SSL_RESPONSE)"
        ((FAILED++))
    fi
else
    print_warning "HTTPS استفاده نشده (HTTP در حال استفاده است)"
    print_warning "توصیه: از HTTPS استفاده کنید"
    ((PASSED++))
fi
echo ""

# تست 7: Response Time
echo "🧪 تست 7: Response Time"
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$APP_URL/health" --max-time 10)
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc)

if (( $(echo "$RESPONSE_TIME < 2" | bc -l) )); then
    print_status 0 "Response time خوب است (${RESPONSE_TIME_MS} ms)"
    ((PASSED++))
elif (( $(echo "$RESPONSE_TIME < 5" | bc -l) )); then
    print_warning "Response time متوسط است (${RESPONSE_TIME_MS} ms)"
    ((PASSED++))
else
    print_status 1 "Response time کند است (${RESPONSE_TIME_MS} ms)"
    ((FAILED++))
fi
echo ""

# نمایش خلاصه
echo "════════════════════════════════════════════════════════════"
echo "  خلاصه نتایج"
echo "════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}موفق:${NC} $PASSED تست"
echo -e "${RED}ناموفق:${NC} $FAILED تست"
echo ""

TOTAL=$((PASSED + FAILED))
SUCCESS_RATE=$(echo "scale=1; $PASSED * 100 / $TOTAL" | bc)
echo "نرخ موفقیت: ${SUCCESS_RATE}%"
echo ""

# راهنمایی‌های نهایی
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ عالی! همه تست‌ها موفق بودند${NC}"
    echo ""
    echo "اپلیکیشن شما آماده استفاده است:"
    echo "  • Dashboard: $APP_URL"
    echo "  • Health: $APP_URL/health"
    echo "  • API: $APP_URL/api/data"
    echo ""
    echo "نکات بعدی:"
    echo "  1. با admin/password خود لاگین کنید"
    echo "  2. دستگاه‌های خود را register کنید"
    echo "  3. تنظیمات RMTO را بررسی کنید"
else
    echo -e "${YELLOW}⚠ توجه: برخی تست‌ها شکست خوردند${NC}"
    echo ""
    echo "برای رفع مشکل:"
    echo "  1. لاگ‌های Railway را بررسی کنید"
    echo "  2. Environment variables را چک کنید"
    echo "  3. مطمئن شوید PostgreSQL متصل است"
    echo "  4. Application را restart کنید"
    echo ""
    echo "راهنما: docs/RAILWAY-TEST-GUIDE.md"
fi

echo "════════════════════════════════════════════════════════════"

# خروج با کد مناسب
if [ $FAILED -eq 0 ]; then
    exit 0
else
    exit 1
fi
