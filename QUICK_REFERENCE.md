# 🚀 مرجع سریع / Quick Reference

این فایل یک راهنمای **فوری** برای دسترسی سریع به همه منابع است.

---

## 🆘 مشکل دارید؟ / Having Issues?

### مشکلات رایج:

| مشکل | راه‌حل سریع | فایل کامل |
|------|------------|-----------|
| **نمیشه لاگین کنم** | admin/admin1234 | VERCEL_LOGIN_GUIDE.md |
| **Port 3000 in use** | `kill -9 $(lsof -t -i:3000)` | PORT_CONFLICT_SOLUTION.md |
| **404 error** | از برنچ PR دانلود کن | DOWNLOAD_ERROR_FIX.md |
| **فایل ندارم** | COPY_FILES_MANUAL.md | MANUAL_COPY_INSTRUCTIONS.md |
| **چطور تست کنم** | `node server/test-add-method.js` | HOW_TO_TEST.md |
| **Add خطا می‌ده** | بررسی .env | DEBUG_RMTO_ERRORS.md |
| **دستگاه ثبت نمیشه** | device-route-mapping.json | DEVICE_ROUTE_MAPPING.md |

---

## 📚 شروع از کجا؟ / Where to Start?

### برای اولین بار:
```
1. START_HERE.md → شروع
2. COMPLETE_WORKFLOW_GUIDE.md → workflow کامل
3. HOW_TO_TEST.md → تست
```

### برای تست سریع:
```bash
cd server
node test-add-method.js
```

### برای مشاهده UI:
```
http://localhost:3000/test-traffic-system.html
```

---

## 🔧 دستورات مفید / Useful Commands

### شروع سرور:
```bash
cd server
kill -9 $(lsof -t -i:3000) 2>/dev/null || true
npm start
```

### تست CLI:
```bash
cd server
node test-add-method.js
```

### مشاهده لاگ:
```bash
tail -f server.log | grep Traffic
```

### دانلود فایل:
```bash
cd server
curl -O https://raw.githubusercontent.com/.../server/test-add-method.js
```

---

## 📁 فایل‌های کلیدی / Key Files

### راهنماهای اصلی:
- **START_HERE.md** - شروع
- **HOW_TO_TEST.md** - تست
- **COMPLETE_WORKFLOW_GUIDE.md** - workflow

### ابزارهای تست:
- **server/test-add-method.js** - تست Add
- **server/test-rmto.js** - تست Add5
- **test-traffic-system.html** - UI جدید

### رفع مشکل:
- **PORT_CONFLICT_SOLUTION.md** - خطای پورت
- **TROUBLESHOOTING.md** - عیب‌یابی
- **DEBUG_RMTO_ERRORS.md** - خطاهای RMTO

---

## 🎯 آمار

- 📄 30 فایل مستندات
- 🔧 15 فایل کد
- 🧪 6 ابزار تست
- ✅ 15 مشکل حل شده

**همه چیز آماده! 🚀**
