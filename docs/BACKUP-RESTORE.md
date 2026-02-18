# Backup & Restore Guide | راهنمای بکاپ و بازیابی

<div dir="rtl">

این راهنما نحوه بکاپ‌گیری و بازیابی داده‌ها در TC Manager را توضیح می‌دهد.

</div>

---

## فرمت‌های پشتیبانی شده

<div dir="rtl">

TC Manager از فرمت‌های زیر پشتیبانی می‌کند:

- ✅ **SQLite Database** (`.db`) - Native SQLite
- ✅ **SQL Dump** (`.sql`) - SQL statements
- ✅ **Compressed SQL** (`.sql.gz`) - Gzip compressed SQL
- ✅ **MySQL Dump** - از MySQL export شده
- ✅ **PostgreSQL Dump** - از PostgreSQL export شده

</div>

---

## دانلود بکاپ (Download Backup)

### از طریق وب اینترفیس

<div dir="rtl">

1. ورود به سیستم
2. رفتن به: **تنظیمات** → **پشتیبان‌گیری**
3. کلیک روی **"دانلود بکاپ"**
4. فایل با نام `tc-manager-backup-YYYY-MM-DD.db` دانلود می‌شود

</div>

### از طریق API

```bash
curl -X GET http://localhost:3000/api/backup/download \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -o backup.db
```

### با ابزار command-line

#### SQLite (Local)

```bash
# Copy database file
cp server/data.db backups/backup-$(date +%Y%m%d).db

# Create SQL dump
sqlite3 server/data.db .dump > backup-$(date +%Y%m%d).sql

# Compress
gzip backup-*.sql
```

#### PostgreSQL (Cloud)

```bash
# Using DATABASE_URL
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Compress
gzip backup-*.sql

# Or direct to compressed file
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz
```

---

## آپلود و Import بکاپ

### روش 1: از طریق وب اینترفیس (Recommended)

<div dir="rtl">

#### مرحله 1: آپلود فایل

1. ورود به سیستم
2. **تنظیمات** → **پشتیبان‌گیری**
3. تب **"بازیابی از بکاپ"**
4. کلیک روی **"انتخاب فایل"**
5. فایل بکاپ خود را انتخاب کنید:
   - `.db` - SQLite database
   - `.sql` - SQL dump
   - `.sql.gz` - Compressed SQL dump
6. کلیک روی **"آپلود"**

#### مرحله 2: Import

1. فایل آپلود شده در لیست نمایش داده می‌شود
2. کلیک روی **"Import"** کنار نام فایل
3. پیشرفت import را مشاهده کنید:
   - Preparing...
   - Importing: X of Y records
   - Complete: X records imported

#### مرحله 3: بررسی

- تعداد رکوردهای import شده نمایش داده می‌شود
- در صورت خطا، پیام خطا نمایش داده می‌شود
- دستگاه‌ها و داده‌های import شده را بررسی کنید

</div>

### روش 2: از طریق API

#### آپلود فایل بکاپ

```bash
curl -X POST http://localhost:3000/api/backup/import-sql-gz \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -F "backup=@/path/to/backup.sql.gz"
```

Response:

```json
{
  "success": true,
  "importId": "1708249999000",
  "message": "Import started..."
}
```

#### پیگیری پیشرفت Import

```bash
curl http://localhost:3000/api/backup/import-progress/1708249999000 \
  -H "Cookie: connect.sid=YOUR_SESSION"
```

Response (در حال Import):

```json
{
  "status": "importing",
  "message": "Imported: 1500 of 5000",
  "imported": 1500,
  "total": 5000,
  "progress": 30
}
```

Response (تکمیل شده):

```json
{
  "status": "complete",
  "message": "Import successful: 5000 records",
  "imported": 5000,
  "errors": 0
}
```

#### لیست فایل‌های بکاپ

```bash
curl http://localhost:3000/api/backup/list \
  -H "Cookie: connect.sid=YOUR_SESSION"
```

Response:

```json
[
  {
    "name": "iccore-2025-06-24_11-47-53.sql.gz",
    "size": 21234567,
    "sizeFormatted": "20.25 MB",
    "date": "2025-06-24T11:47:53.000Z",
    "type": "sql.gz"
  }
]
```

---

## Import فایل‌های بزرگ

<div dir="rtl">

برای فایل‌های بکاپ بزرگ (بیش از 100MB):

### تنظیمات

1. افزایش حافظه Node.js:

</div>

```bash
# In package.json
"scripts": {
  "start": "node --max-old-space-size=4096 index.js"
}
```

<div dir="rtl">

2. افزایش timeout import:

</div>

```env
# In .env
IMPORT_TIMEOUT_SECONDS=3600
```

<div dir="rtl">

3. افزایش limit آپلود:

در `server/index.js`:

</div>

```javascript
var upload = multer({ 
  dest: path.join(__dirname, "uploads/"), 
  limits: { fileSize: 1000 * 1024 * 1024 } // 1GB
});
```

---

## Conversion بین Database Types

<div dir="rtl">

TC Manager به طور خودکار syntax SQL را بین MySQL, PostgreSQL, و SQLite تبدیل می‌کند.

### MySQL → SQLite

</div>

```sql
-- MySQL
CREATE TABLE devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Converted to SQLite
CREATE TABLE devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT datetime('now')
);
```

<div dir="rtl">

### PostgreSQL → SQLite

</div>

```sql
-- PostgreSQL
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Converted to SQLite
CREATE TABLE devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT datetime('now')
);
```

<div dir="rtl">

### MySQL → PostgreSQL

</div>

```sql
-- MySQL
CREATE TABLE devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255)
);

-- Converted to PostgreSQL
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255)
);
```

---

## Auto-Import در اولین اجرا

<div dir="rtl">

برای import خودکار بکاپ در اولین اجرا:

</div>

```env
# In .env
AUTO_IMPORT_BACKUP=./backups/initial-backup.sql.gz
```

<div dir="rtl">

یا از طریق environment variable:

</div>

```bash
AUTO_IMPORT_BACKUP=/path/to/backup.sql.gz npm start
```

---

## Migration از سیستم قبلی

### از MySQL

<div dir="rtl">

1. **Export از MySQL:**

</div>

```bash
mysqldump -u root -p iccore > iccore-backup.sql
gzip iccore-backup.sql
```

<div dir="rtl">

2. **Import به TC Manager:**

آپلود `iccore-backup.sql.gz` از طریق وب اینترفیس

### از PostgreSQL

1. **Export از PostgreSQL:**

</div>

```bash
pg_dump -h localhost -U postgres iccore > iccore-backup.sql
gzip iccore-backup.sql
```

<div dir="rtl">

2. **Import به TC Manager:**

آپلود `iccore-backup.sql.gz` از طریق وب اینترفیس

</div>

---

## بکاپ خودکار (Automated Backups)

### Linux (Cron)

```bash
# Create backup script
cat > /home/tc-manager/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/home/tc-manager/backups
DATE=$(date +%Y%m%d-%H%M%S)
mkdir -p $BACKUP_DIR

# SQLite
cp /home/tc-manager/server/data.db $BACKUP_DIR/backup-$DATE.db

# Or PostgreSQL
# pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/backup-$DATE.sql.gz

# Delete backups older than 30 days
find $BACKUP_DIR -name "backup-*.db" -mtime +30 -delete
EOF

chmod +x /home/tc-manager/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /home/tc-manager/backup.sh
```

### Windows (Task Scheduler)

<div dir="rtl">

مراجعه کنید به: [DEPLOY-WINDOWS.md](DEPLOY-WINDOWS.md#backup-خودکار)

</div>

### Docker

```yaml
# docker-compose.yml
services:
  backup:
    image: alpine:latest
    volumes:
      - ./server:/app/server
      - ./backups:/backups
    entrypoint: |
      /bin/sh -c "
      while true; do
        sleep 86400  # 24 hours
        cp /app/server/data.db /backups/backup-$(date +%Y%m%d).db
      done
      "
```

---

## بازیابی اضطراری (Emergency Recovery)

<div dir="rtl">

### اگر دیتابیس خراب شد

#### SQLite

</div>

```bash
# Check database integrity
sqlite3 server/data.db "PRAGMA integrity_check;"

# If corrupted, try to recover
sqlite3 server/data.db ".recover" | sqlite3 recovered.db

# Replace with recovered database
mv recovered.db server/data.db
```

<div dir="rtl">

#### PostgreSQL

</div>

```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1"

# If needed, restore from backup
psql $DATABASE_URL < backup.sql
```

<div dir="rtl">

### اگر فایل بکاپ خراب است

1. بررسی کنید فایل compressed است یا نه:

</div>

```bash
file backup.sql.gz
# Should show: gzip compressed data
```

<div dir="rtl">

2. سعی کنید decompress کنید:

</div>

```bash
gunzip -t backup.sql.gz  # Test integrity
gunzip -c backup.sql.gz > backup.sql  # Extract
```

<div dir="rtl">

3. بررسی محتوای SQL:

</div>

```bash
head -100 backup.sql
# Should show SQL CREATE TABLE statements
```

---

## Best Practices | بهترین روش‌ها

<div dir="rtl">

1. **بکاپ منظم:**
   - روزانه: بکاپ کامل
   - هفتگی: بکاپ برای نگهداری طولانی
   - قبل از هر update

2. **نگهداری بکاپ:**
   - 7 روز اخیر: بکاپ روزانه
   - 4 هفته اخیر: بکاپ هفتگی
   - 12 ماه اخیر: بکاپ ماهیانه

3. **تست بازیابی:**
   - ماهی یک بار بکاپ را تست کنید
   - در محیط تست restore کنید
   - صحت داده‌ها را بررسی کنید

4. **ذخیره‌سازی:**
   - بکاپ را در location متفاوت نگه دارید
   - از cloud storage استفاده کنید
   - رمزگذاری بکاپ‌ها

5. **مانیتورینگ:**
   - بررسی موفقیت بکاپ
   - اندازه فایل را چک کنید
   - alert برای خطاهای بکاپ

</div>

---

## Troubleshooting | رفع مشکل

<div dir="rtl">

### Import کند است

- فایل بزرگ است، صبر کنید
- RAM کافی نیست، Node.js را با `--max-old-space-size` اجرا کنید
- CPU زیاد است، process‌های دیگر را ببندید

### خطاهای SQL

- Syntax متفاوت است، converter خودکار تبدیل می‌کند
- برخی دستورات skip می‌شوند (مثل `SET`, `LOCK`)
- Foreign key constraints ممکن است مشکل ایجاد کنند

### فایل آپلود نمی‌شود

- اندازه فایل زیاد است، limit را افزایش دهید
- Timeout، timeout را افزایش دهید
- Permission، دسترسی نوشتن به `uploads/` را بررسی کنید

</div>

---

## پشتیبانی

<div dir="rtl">

اگر مشکلی در بکاپ یا restore داشتید:
1. لاگ‌های server را بررسی کنید
2. فایل بکاپ را در محیط تست امتحان کنید
3. با تیم پشتیبانی تماس بگیرید

</div>
