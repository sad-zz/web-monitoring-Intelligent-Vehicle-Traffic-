# 🚀 راهنمای سریع بروزرسانی RMTO / Quick RMTO Update Guide

## 🎯 دستور صحیح دانلود / Correct Download Command

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-
curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/update-rmto.sh
chmod +x update-rmto.sh
./update-rmto.sh
```

## ✅ خروجی موفق / Successful Output

```
🔄 بروزرسانی RMTO با backup خودکار
📦 ساخت backup: backup-rmto-20260225-0620.tar.gz
✅ Backup ذخیره شد
📥 دانلود فایل‌های بروز...
  → rmto-client.js ✅
  → test-add-method.js ✅
  → test-rmto.js ✅
🧪 تست RMTO...
✅ تست موفق بود!
🚀 راه‌اندازی مجدد سرور...
✅ سرور راه‌اندازی شد
🎉 بروزرسانی با موفقیت کامل شد!
```

## 🎯 دستور یک خطی / One-Line Command

اگر دانلود اسکریپت مشکل دارد:

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic- && \
tar -czf backup-$(date +%Y%m%d-%H%M).tar.gz server/ && \
echo "✅ Backup created" && \
cd server && \
curl -f -s -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/rmto-client.js && \
curl -f -s -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/test-add-method.js && \
curl -f -s -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/test-rmto.js && \
echo "✅ Files downloaded" && \
node test-add-method.js && \
echo "✅ Test passed" && \
pkill -f "node.*index.js" 2>/dev/null || true && \
lsof -ti:3000 | xargs kill -9 2>/dev/null || true && \
npm start > /dev/null 2>&1 & \
echo "✅ Server restarted" && \
echo "🎉 Update complete!"
```

## 🔍 بررسی موفقیت / Verify Success

```bash
# بررسی سرور
curl http://localhost:3000/health

# یا
curl http://5.159.49.246:3000/

# تست RMTO
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
node test-add-method.js
```

## 📁 فایل‌های بروز شده / Updated Files

| فایل | تغییرات |
|------|---------|
| rmto-client.js | ✅ getCurrentDateTime() (2026) |
| rmto-client.js | ✅ getStationCode() (mapping) |
| test-add-method.js | ✅ DateTime 2026 |
| test-rmto.js | ✅ DateTime 2026 |

## ⚠️ در صورت مشکل / Troubleshooting

### مشکل: 404 error (14 bytes)

```bash
# بررسی فایل
curl -I https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/update-rmto.sh

# باید نمایش دهد:
HTTP/2 200
content-length: 3800+ (not 14!)
```

### مشکل: تست fail شد

اسکریپت خودکار از backup بازگشت می‌کند:

```bash
# بازیابی دستی
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-
tar -xzf backup-rmto-YYYYMMDD-HHMMSS.tar.gz
cd server && npm start
```

## 📋 چک‌لیست / Checklist

- [ ] backup گرفته شد
- [ ] فایل‌ها دانلود شدند
- [ ] تست موفق بود
- [ ] سرور راه‌اندازی شد
- [ ] DateTime = 2026
- [ ] ارسال به RMTO موفق

## 💬 پس از بروزرسانی / After Update

```bash
# لیست backup ها
ls -lh backup-rmto-*.tar.gz

# حذف backup های قدیمی (اختیاری)
# rm backup-rmto-20260224-*.tar.gz
```

## 🎉 موفقیت! / Success!

بعد از بروزرسانی موفق:
- ✅ DateTime با سال 2026
- ✅ mapping دستگاه → محور
- ✅ تست موفق
- ✅ سرور در حال اجرا

**سیستم شما آماده ارسال به RMTO است! 🚀**
