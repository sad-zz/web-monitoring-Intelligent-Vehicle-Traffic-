# راهنمای پاکسازی فایل‌های اضافی / Cleanup Guide for Excess Files

## 🎯 هدف / Goal

شما اطلاعات زیادی و اضافه روی سرور upload کرده‌اید. این راهنما به شما کمک می‌کند:
1. فایل‌های اضافی را پاک کنید
2. فایل‌های درست خود را upload کنید

---

## 🧹 دستور سریع پاکسازی / Quick Cleanup

```bash
ssh root@5.159.49.246
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-

# 1. Backup قبل از پاک کردن (مهم!)
tar -czf /root/backup-before-cleanup-$(date +%Y%m%d).tar.gz .

# 2. پاک کردن فایل‌های راهنما (55+ فایل .md)
rm -f *.md *GUIDE.md *_GUIDE.md

# 3. پاک کردن اسکریپت‌ها
rm -f *.sh

# 4. پاک کردن فایل‌های تست
rm -f test-*.html

# 5. پاک کردن پوشه suggestions
rm -rf suggestions/

# 6. پاک کردن backup های قدیمی
rm -f backup-*.tar.gz

# 7. بررسی نتیجه
ls -la
```

---

## 📋 لیست فایل‌ها / File List

### ✅ فایل‌های ضروری (نگه دارید)

```
index.html                  ← صفحه اصلی
css/style.css              ← استایل‌ها
js/app.js                  ← کد جاوااسکریپت
data/devices.js            ← داده‌ها
server/index.js            ← سرور Node.js
server/rmto-client.js      ← کلاینت RMTO
server/package.json        ← وابستگی‌ها
server/.env                ← تنظیمات (با اطلاعات شما)
```

### ❌ فایل‌های اضافی (می‌توانید پاک کنید)

```
50+ فایل *.md              ← راهنماها (اضافی)
5 فایل *.sh               ← اسکریپت‌ها (اضافی)
test-rmto.html            ← تست (اضافی)
test-traffic-system.html  ← تست (اضافی)
suggestions/              ← نسخه demo (اضافی)
backup-*.tar.gz           ← backup های قدیمی (اضافی)
```

---

## 🎯 دستور یک خطی / One-Line Command

```bash
ssh root@5.159.49.246 'cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic- && tar -czf /root/backup-cleanup.tar.gz . && rm -f *.md *.sh test-*.html && rm -rf suggestions/ && rm -f backup-2026*.tar.gz && echo "✅ Cleanup complete" && ls -la'
```

---

## 📤 Upload فایل‌های درست خود / Upload Your Correct Files

### روش 1: SCP (ساده)

```bash
# از سیستم محلی خود
cd /path/to/your/correct/files/

# Upload انتخابی
scp index.html root@5.159.49.246:/opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/
scp -r css/ root@5.159.49.246:/opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/
scp -r js/ root@5.159.49.246:/opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/
scp -r data/ root@5.159.49.246:/opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/
scp -r server/ root@5.159.49.246:/opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/
```

### روش 2: rsync (پیشرفته)

```bash
# Upload با exclude
rsync -av --exclude='*.md' --exclude='*.sh' --exclude='test-*.html' \
  /local/path/ root@5.159.49.246:/opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/
```

### روش 3: WinSCP (Windows GUI)

1. باز کردن WinSCP
2. اتصال به: 5.159.49.246
3. مسیر سرور: `/opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/`
4. Drag & Drop فایل‌های خود

---

## 🔍 بررسی بعد از cleanup / Verification

```bash
ssh root@5.159.49.246
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-

# بررسی فایل‌ها
ls -la

# بررسی سرور
cd server
npm start

# تست در مرورگر
# http://5.159.49.246:3000/
```

---

## ⚠️ نکات مهم / Important Notes

1. **همیشه backup بگیرید** قبل از پاک کردن
2. **فایل‌های ضروری را پاک نکنید** (index.html, css/, js/, data/, server/)
3. **فایل .env خود را نگه دارید** (اطلاعات RMTO شما)
4. **بعد از cleanup تست کنید** که سرور کار می‌کند

---

## 📊 ساختار پیشنهادی نهایی / Recommended Final Structure

```
/opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/
├── index.html              ← ضروری
├── css/
│   └── style.css          ← ضروری
├── js/
│   └── app.js             ← ضروری
├── data/
│   └── devices.js         ← ضروری
├── server/
│   ├── index.js           ← ضروری
│   ├── rmto-client.js     ← ضروری
│   ├── .env               ← ضروری (اطلاعات شما)
│   ├── package.json       ← ضروری
│   └── node_modules/      ← (خودکار نصب می‌شود)
└── README.md              ← اختیاری
```

---

## 🆘 در صورت مشکل / If Problems

اگر بعد از cleanup مشکلی پیش آمد:

```bash
# Restore از backup
ssh root@5.159.49.246
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-
tar -xzf /root/backup-before-cleanup-YYYYMMDD.tar.gz
cd server && npm start
```

---

## ✅ چک‌لیست / Checklist

**قبل از cleanup:**
- [ ] Backup گرفتید
- [ ] می‌دانید چه چیزی را پاک می‌کنید
- [ ] فایل‌های خود را آماده دارید

**حین cleanup:**
- [ ] دستورات با دقت اجرا شدند
- [ ] فایل‌های ضروری پاک نشدند
- [ ] با `ls -la` بررسی کردید

**بعد از cleanup:**
- [ ] سرور کار می‌کند
- [ ] فایل‌های خود را upload کردید
- [ ] سایت را تست کردید

---

**✨ آماده برای پاکسازی و upload مجدد! / Ready for cleanup and re-upload!**
