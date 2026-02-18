# Database Migration Guide | راهنمای Migration دیتابیس

<div dir="rtl">

این راهنما نحوه migration از SQLite به PostgreSQL را توضیح می‌دهد.

</div>

---

## چرا PostgreSQL؟

<div dir="rtl">

**SQLite مناسب است برای:**
- ✅ نصب local
- ✅ تعداد کم دستگاه (< 50)
- ✅ تست و development
- ✅ نصب ساده روی ویندوز

**PostgreSQL مناسب است برای:**
- ✅ Cloud deployment (مقیاس‌پذیر)
- ✅ تعداد زیاد دستگاه (100+)
- ✅ تراکنش‌های concurrent بالا
- ✅ Production و enterprise

</div>

---

## وضعیت فعلی

<div dir="rtl">

**توجه مهم:** در نسخه فعلی، کد TC Manager برای SQLite بهینه شده است. پشتیبانی کامل از PostgreSQL نیاز به refactoring دارد (async/await).

**راه‌حل‌های موجود:**

### روش 1: SQLite در Cloud (Recommended برای شروع)

SQLite را می‌توانید روی cloud platforms استفاده کنید با volume persistence:

</div>

```yaml
# docker-compose.yml
services:
  app:
    image: your-tc-manager
    environment:
      - DATABASE_TYPE=sqlite
    volumes:
      - ./server/data.db:/app/server/data.db
```

<div dir="rtl">

**مزایا:**
- ✅ کد فعلی بدون تغییر کار می‌کند
- ✅ نصب سریع
- ✅ برای شروع کافی است

**معایب:**
- ❌ مقیاس‌پذیری محدود
- ❌ Concurrent writes محدود
- ❌ Replication ندارد

### روش 2: Export/Import به PostgreSQL

اگر می‌خواهید از PostgreSQL استفاده کنید:

1. از SQLite export بگیرید
2. Manually به PostgreSQL import کنید
3. CONNECTION_STRING را تنظیم کنید

**توجه:** نیاز به refactoring کد دارد (آینده)

</div>

---

## Export از SQLite

```bash
# SQL dump
sqlite3 server/data.db .dump > export.sql

# Clean up SQLite-specific syntax
sed -i 's/INTEGER PRIMARY KEY AUTOINCREMENT/SERIAL PRIMARY KEY/g' export.sql
sed -i 's/datetime(.*now.*)/CURRENT_TIMESTAMP/g' export.sql
sed -i 's/TEXT DEFAULT (datetime.*now.*))/TEXT DEFAULT CURRENT_TIMESTAMP)/g' export.sql

# Compress
gzip export.sql
```

---

## Import به PostgreSQL

```bash
# Create database
createdb tc_manager

# Import
psql tc_manager < export.sql

# Or if compressed
gunzip -c export.sql.gz | psql tc_manager
```

---

## Conversion نکات

<div dir="rtl">

### Data Types

| SQLite | PostgreSQL |
|--------|------------|
| INTEGER | INTEGER |
| TEXT | TEXT / VARCHAR |
| REAL | REAL / NUMERIC |
| BLOB | BYTEA |

### Auto-increment

</div>

```sql
-- SQLite
id INTEGER PRIMARY KEY AUTOINCREMENT

-- PostgreSQL
id SERIAL PRIMARY KEY
```

<div dir="rtl">

### Timestamps

</div>

```sql
-- SQLite
created_at TEXT DEFAULT (datetime('now'))

-- PostgreSQL
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

<div dir="rtl">

### Functions

| SQLite | PostgreSQL |
|--------|------------|
| `datetime('now')` | `CURRENT_TIMESTAMP` |
| `date('now')` | `CURRENT_DATE` |
| `strftime()` | `to_char()` |

</div>

---

## Roadmap | نقشه راه

<div dir="rtl">

### نسخه 1.0 (فعلی)
- ✅ SQLite support کامل
- ✅ Cloud deployment با SQLite
- ⚠️ PostgreSQL (experimental)

### نسخه 2.0 (آینده)
- 🔄 Async/await refactoring
- 🔄 Full PostgreSQL support
- 🔄 Connection pooling
- 🔄 Transaction management

### نسخه 3.0 (آینده)
- 🔄 Multi-database support (MySQL, SQL Server)
- 🔄 Database clustering
- 🔄 Read replicas
- 🔄 Automatic failover

</div>

---

## Best Practices | بهترین روش‌ها

<div dir="rtl">

### برای Production

1. **شروع با SQLite:**
   - Deploy با SQLite
   - Test و stabilize کنید
   - Monitor performance

2. **Scale up وقت نیاز است:**
   - اگر > 100 دستگاه
   - اگر concurrent load بالاست
   - اگر replication نیاز است

3. **Migration Planning:**
   - در maintenance window انجام دهید
   - Backup کامل بگیرید
   - Test migration در staging

### Volume Persistence (Cloud)

Railway.app:

</div>

```bash
railway volume create tc_data
railway volume attach tc_data /app/server/data.db
```

<div dir="rtl">

Fly.io:

</div>

```toml
[mounts]
  source = "tc_data"
  destination = "/app/server"
```

<div dir="rtl">

Render.com:

- Persistent Disks در settings

</div>

---

## Alternative: Docker Volume

```yaml
version: '3.8'

services:
  app:
    image: tc-manager
    volumes:
      - tc-data:/app/server
    environment:
      - DATABASE_TYPE=sqlite

volumes:
  tc-data:
    driver: local
```

---

## پشتیبانی

<div dir="rtl">

اگر به PostgreSQL نیاز دارید:
1. با تیم پشتیبانی تماس بگیرید
2. Enterprise support را بررسی کنید
3. Custom development ممکن است

**تماس:** support@noavaran-js.com

</div>

---

## فعلاً چه کنیم؟

<div dir="rtl">

**توصیه ما:**

1. **Start با SQLite** - کامل و stable است
2. **Deploy روی cloud** - با Docker volume
3. **Monitor performance** - اگر مشکلی بود، scale up کنید
4. **Wait برای v2.0** - PostgreSQL support کامل

</div>
