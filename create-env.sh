#!/bin/bash
# ============================================================
#  TC Manager — ساخت فایل .env روی سرور
#  اجرا: bash create-env.sh
# ============================================================
set -e

ENV_FILE="/opt/tc-manager/server/.env"
EXAMPLE_URL="https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/review-project-issues/server/.env.example"

echo "========================================================"
echo "  TC Manager — تنظیم فایل .env"
echo "========================================================"

# ── اگر .env قبلاً وجود دارد، پشتیبان بگیر ──────────────────
if [ -f "$ENV_FILE" ]; then
  BAK="$ENV_FILE.bak-$(date +%Y%m%d_%H%M%S)"
  cp "$ENV_FILE" "$BAK"
  echo "⚠️   فایل قبلی پشتیبان گرفته شد: $BAK"
fi

# ── دانلود .env.example ───────────────────────────────────────
echo ""
echo "⬇️   دانلود نمونه .env ..."
wget -q "$EXAMPLE_URL" -O "$ENV_FILE" || \
  wget -q --no-check-certificate "$EXAMPLE_URL" -O "$ENV_FILE"

if [ ! -s "$ENV_FILE" ]; then
  echo "❌ دانلود ناموفق. فایل را دستی بسازید:"
  echo "   nano $ENV_FILE"
  exit 1
fi

echo "✅  $ENV_FILE ساخته شد"
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  حالا اعتبارنامه RMTO را وارد کنید:"
echo "══════════════════════════════════════════════════════════"

# ── ورود نام کاربری RMTO ─────────────────────────────────────
read -rp "  نام کاربری RMTO (مثال: NOGSH): " RMTO_USER
if [ -n "$RMTO_USER" ]; then
  sed -i "s/^RMTO_USERNAME=.*/RMTO_USERNAME=$RMTO_USER/" "$ENV_FILE"
fi

# ── ورود کلمه عبور RMTO ─────────────────────────────────────
read -rsp "  کلمه عبور RMTO: " RMTO_PASS
echo ""
if [ -n "$RMTO_PASS" ]; then
  # escape special chars for sed
  RMTO_PASS_ESC=$(printf '%s' "$RMTO_PASS" | sed 's/[\/&]/\\&/g')
  sed -i "s/^RMTO_PASSWORD=.*/RMTO_PASSWORD=$RMTO_PASS_ESC/" "$ENV_FILE"
fi

# ── ورود کد شرکت ──────────────────────────────────────────────
read -rp "  کد شرکت RMTO (پیش‌فرض: 58، Enter برای رد کردن): " RMTO_CO
if [ -n "$RMTO_CO" ]; then
  sed -i "s/^RMTO_COMPANY_CODE=.*/RMTO_COMPANY_CODE=$RMTO_CO/" "$ENV_FILE"
fi

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  ✅  فایل .env ذخیره شد: $ENV_FILE"
echo ""
echo "  محتوای فعلی (بدون کلمه عبور):"
grep -v "PASSWORD" "$ENV_FILE" | grep -v "^#" | grep -v "^$"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "  قدم بعدی: pm2 restart tc-manager --update-env"
echo ""
