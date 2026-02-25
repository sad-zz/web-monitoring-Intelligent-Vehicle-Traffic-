# 🚨 راهنمای فوری بازیابی / EMERGENCY RESTORE GUIDE

**مشکل:** اطلاعات پرید - نیاز به بازگشت سریع!

---

## 🆘 بازیابی فوری (در 3 دقیقه)

### گام 1: بررسی backup های موجود

```bash
ssh root@5.159.49.246
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-

# لیست backup ها
ls -lh backup*.tar.gz
ls -lh /root/backups/*.tar.gz 2>/dev/null
```

**نمونه خروجی:**
```
-rw-r--r-- 1 root root 2.3M Feb 24 10:50 backup-20260224.tar.gz
-rw-r--r-- 1 root root 2.4M Feb 25 06:20 backup-rmto-20260225-0620.tar.gz
```

---

### گام 2: restore از جدیدترین backup

```bash
# استفاده از جدیدترین backup
tar -xzf backup-20260224.tar.gz

# بررسی فایل‌ها بازگردانده شدند
ls -la server/

# راه‌اندازی سرور
cd server
npm start
```

---

### گام 3: تست

```bash
# بررسی سرور
curl http://localhost:3000/

# تست RMTO
node test-add-method.js
```

---

## 📋 راه‌حل‌های دیگر اگر backup ندارید

### روش 1: بازیابی از Git

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-

# بررسی stash
git stash list

# اگر stash دارید
git stash pop

# یا بازگشت به commit قبلی
git log --oneline -10
git checkout <COMMIT_ID> -- server/

# مثال:
git checkout HEAD~1 -- server/
```

### روش 2: بازگشت به main branch

```bash
# دانلود فایل‌های اصلی از repository
git fetch origin main
git checkout origin/main -- server/

cd server
npm install
npm start
```

### روش 3: دانلود از سیستم محلی

```bash
# اگر در کامپیوتر خود backup دارید
# از کامپیوتر محلی:
scp -r /path/to/your/backup/* root@5.159.49.246:/opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server/

# سپس در سرور:
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
npm start
```

### روش 4: بازیابی تدریجی با Git reflog

```bash
# پیدا کردن commit های اخیر
git reflog

# خروجی مثال:
# 15cd391 HEAD@{0}: commit: Add update-rmto.sh
# 22114df HEAD@{1}: commit: Fix DateTime
# ...

# بازگشت به وضعیت خاص
git reset --hard HEAD@{1}
```

---

## 🛡️ پیشگیری از این مشکل در آینده

### 1. همیشه قبل از تغییر backup بگیرید

```bash
# دستور ساده backup
tar -czf backup-$(date +%Y%m%d-%H%M).tar.gz server/
```

### 2. نصب اسکریپت safe-backup

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-
curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/safe-backup.sh
chmod +x safe-backup.sh
sudo mv safe-backup.sh /usr/local/bin/safe-backup
```

**استفاده:**
```bash
safe-backup  # قبل از هر تغییر
```

### 3. Backup خودکار روزانه با cron

```bash
# ویرایش crontab
crontab -e

# اضافه کردن این خط:
0 2 * * * tar -czf /root/backups/auto-backup-$(date +\%Y\%m\%d).tar.gz /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server/

# ساخت پوشه backups
mkdir -p /root/backups
```

### 4. Git commit تغییرات مهم

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-
git add server/
git commit -m "My custom changes - $(date +%Y%m%d)"
git push origin custom-branch
```

---

## ⚠️ قانون طلایی

```
╔═══════════════════════════════════════╗
║                                       ║
║   قبل از هر تغییر: BACKUP بگیر!      ║
║                                       ║
║   backup → change → test → restore    ║
║                                       ║
╚═══════════════════════════════════════╝
```

**هرگز بدون backup تغییر ندهید!**

---

## 🔍 عیب‌یابی

### اگر tar خطا می‌دهد:

```bash
# بررسی فایل معتبر است
tar -tzf backup-20260224.tar.gz | head -10

# اگر خطا داشت، از cp استفاده کنید
cp -r server-backup-20260224/ server/
```

### اگر npm start خطا می‌دهد:

```bash
cd server
rm -rf node_modules
npm install
npm start
```

### اگر پورت مشغول است:

```bash
kill -9 $(lsof -t -i:3000) 2>/dev/null
npm start
```

---

## 📞 چک‌لیست بازیابی سریع

- [ ] SSH به سرور
- [ ] `cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-`
- [ ] `ls -lh backup*.tar.gz` - یافتن backup
- [ ] `tar -xzf backup-YYYYMMDD.tar.gz` - restore
- [ ] `cd server && npm start` - راه‌اندازی
- [ ] تست سایت: http://5.159.49.246:3000/
- [ ] از این به بعد: همیشه backup!

---

## 💡 نکته مهم

**این بار سوم نباید باشد!**

لطفاً:
1. ✅ همیشه backup قبل از تغییر
2. ✅ نصب safe-backup script
3. ✅ تنظیم cron برای backup خودکار
4. ✅ Git commit فایل‌های مهم

**بدون backup = خطر از دست دادن داده! 🚨**

---

راهنماهای مرتبط:
- BACKUP_GUIDE.md - راهنمای کامل backup
- ROLLBACK_RESTORE_GUIDE.md - راهنمای بازگشت
- SAFE_DEPLOYMENT.md - deployment ایمن
