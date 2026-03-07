# معماری سیستم TC Manager
## مدیریت شمارنده‌های ترافیکی — نوآوران جنوب شرق

---

## ۱. خلاصه اجرایی

TC Manager یک سامانه‌ی **دریافت، پردازش و ارسال** داده‌های ترافیک جاده‌ای است.  
دستگاه‌های سخت‌افزاری RATCX1 روی محورهای جاده‌ای نصب می‌شوند، هر ۵ دقیقه تعداد و نوع وسایل نقلیه را شمارش می‌کنند، و از طریق شبکه موبایل به این سرور متصل می‌شوند. سرور داده را دریافت، در پایگاه داده ذخیره، و به سامانه ملی ترافیک (RMTO / راهسام) ارسال می‌کند.

```
[دستگاه RATCX1] ──TCP:2022──▶ [TC Manager Server] ──SOAP──▶ [RMTO / otf.rmto.ir]
                                       │
                                [SQLite DB]
                                       │
                               [مرورگر / UI :3000]
```

---

## ۲. مشخصات سرور

| پارامتر | مقدار |
|---------|-------|
| آدرس IP | 5.159.49.246 |
| سیستم‌عامل | Ubuntu Linux |
| مدیریت فرآیند | PM2 (Process Manager 2) |
| Runtime | Node.js v20 LTS |
| پورت HTTP (پنل مدیریت) | 3000 |
| پورت TCP (دستگاه‌ها) | 2022 |
| پایگاه داده | SQLite (`server/tc-manager.db`) |
| منطقه زمانی | Asia/Tehran (UTC+3:30) |

---

## ۳. ساختار فایل‌ها

```
/opt/tc-manager/
├── server/
│   ├── index.js          ← هسته اصلی (HTTP API + TCP server + پردازش داده)
│   ├── scheduler.js      ← وظایف زمان‌بندی‌شده (ارسال RMTO + بررسی آفلاین)
│   ├── db.js             ← پایگاه داده SQLite و schema
│   ├── rmto-client.js    ← کلاینت SOAP برای سرویس RMTO
│   ├── tc-manager.db     ← فایل پایگاه داده (داده‌های واقعی!)
│   └── .env              ← تنظیمات محرمانه (رمز RMTO و غیره)
├── js/
│   └── app.js            ← منطق رابط کاربری (Vanilla JavaScript)
├── css/
│   └── style.css         ← استایل‌ها (RTL - فارسی)
├── index.html            ← صفحه اصلی پنل مدیریت (SPA)
├── ecosystem.config.js   ← تنظیمات PM2
└── server/.env.example   ← نمونه فایل تنظیمات
```

---

## ۴. معماری نرم‌افزاری

### ۴.۱ ماژول‌ها و سرویس‌های در حال اجرا

```
┌─────────────────────────────────────────────────────┐
│               Node.js Process (PM2)                  │
│                                                     │
│  ┌──────────────┐   ┌──────────────┐                │
│  │  HTTP Server  │   │  TCP Server  │                │
│  │  (Express)    │   │  (net.Server)│                │
│  │  Port: 3000   │   │  Port: 2022  │                │
│  └──────┬───────┘   └──────┬───────┘                │
│         │                  │                        │
│  ┌──────▼──────────────────▼──────┐                 │
│  │         SQLite Database         │                 │
│  │  (better-sqlite3, synchronous)  │                 │
│  └─────────────────────────────────┘                 │
│                                                     │
│  ┌──────────────┐   ┌──────────────┐                │
│  │  Scheduler   │   │  RMTO Client │                │
│  │  (node-cron) │──▶│  (SOAP/WSDL) │                │
│  └──────────────┘   └──────────────┘                │
└─────────────────────────────────────────────────────┘
```

### ۴.۲ کتابخانه‌های اصلی (npm)

| کتابخانه | نسخه | کاربرد |
|---------|------|--------|
| `express` | ^4.18.2 | HTTP web framework |
| `better-sqlite3` | ^9.4.3 | پایگاه داده SQLite (همزمان/synchronous) |
| `soap` | ^1.0.0 | ارتباط SOAP با سرویس RMTO |
| `node-cron` | ^3.0.3 | زمان‌بندی وظایف دوره‌ای |
| `express-session` | ^1.17.3 | مدیریت نشست کاربر |
| `bcryptjs` | ^2.4.3 | رمزنگاری کلمه عبور |
| `dotenv` | ^16.4.1 | خواندن فایل `.env` |
| `multer` | ^1.4.5-lts.1 | آپلود فایل (backup restore) |

---

## ۵. پروتکل ارتباطی دستگاه RATCX1

### ۵.۱ اتصال TCP

دستگاه RATCX1 یک **مودم SIM** دارد. هر ۵ دقیقه:
1. اتصال TCP به سرور (`CIPSTART`)
2. ارسال handshake (`8000`)
3. دریافت دستور ساعت‌سنجی (`0012`) یا درخواست داده (`0197`)
4. ارسال داده (`8821` یا `8012`)
5. قطع اتصال (`CIPSHUT`)

### ۵.۲ فرمت پیام‌ها

#### دستگاه → سرور: Handshake `8000` (59 بایت)
```
8000 YYYY.MM.DD-HH:mm:ss.t  XXXXXXXX  AAAAAAAAAAAAAAAA
└─┘  └────────────────────┘ └──────┘  └──────────────┘
کد   زمان دستگاه             کد دستگاه مشخصات فریم‌ور
4chr  21 char                 8 char    26 char
```
مثال: `80002026.02.28-08:15:11.052907910RATCX1HW:B-06,SW:JA11READY`

#### سرور → دستگاه: تنظیم ساعت `0012` (16 بایت)
```
0012  YY MM DD HH mm ss
└─┘   └────────────────┘
کد    تاریخ/ساعت ایران (12 کاراکتر)
4chr   format: yyMMddHHmmss
```
مثال: `0012260228081500` (28 اسفند 1404، ساعت 08:15:00 ایران)

#### سرور → دستگاه: درخواست داده `0197` (14 بایت)
```
0197  YY MM DD HH mm
└─┘   └────────────┘
کد    زمان شروع interval (10 کاراکتر)
4chr   format: yyMMddHHmm
```
مثال: `01972602280815` (درخواست داده interval 08:15-08:20)

#### دستگاه → سرور: تأیید تنظیم ساعت `8012` (33 بایت)
```
8012  YYYY.MM.DD-HH:mm:ss.t  XXXXXXXX
└─┘   └────────────────────┘ └──────┘
کد    زمان جدید دستگاه        کد دستگاه
```

#### دستگاه → سرور: داده ترافیکی `8821` (287 بایت)
```
8821  YYYY.MM.DD-HH:mm:ss.t  [262-byte interval data]
└─┘   └────────────────────┘ └─────────────────────┘
کد    زمان پاسخ               داده interval
4     21                       262 chars

262-byte interval:
  XXXXXXXX  YYMMddHHmm  [lane1: 65 chars × 2] [status: 2 chars]
  └──────┘  └────────┘  └──────────────────┘  └─────────────┘
  کد دستگاه زمان شروع   داده 2 باند           وضعیت باتری/خورشیدی
```

هر باند (lane) = 65 کاراکتر:
```
[a:5][sa:5][sao:5][b:5][sb:5][sbo:5][c:5][sc:5][sco:5][d:5][sd:5][sdo:5][e:5][se:5][seo:5]
 ──────── موتور ─────    ──────── سواری ──────   ──────── وانت ───────
[x:5][sx:5][sxo:5][r:5][sr:5][sro:5]...    ← کامیون‌ها و سنگین
```

### ۵.۳ نقشه‌برداری طبقات وسایل نقلیه

| کد Firmware | نوع وسیله | RMTO Class | توضیح RMTO |
|------------|-----------|------------|------------|
| `a` | موتورسیکلت | C1 | سواری و وانت |
| `b` | سواری | C1 | سواری و وانت |
| `c` | وانت | C1 | سواری و وانت |
| `d` | کامیونت/مینی‌بوس | C2 | کامیونت و مینی‌بوس |
| `e` | کامیون دو محور | C3 | کامیون دو محور |
| ندارد | اتوبوس | C4 | اتوبوس (صفر) |
| `x` | کامیون ۳+ محور | C5 | کامیون سه محور به بالا |

---

## ۶. جریان اجرایی (Workflow)

### ۶.۱ اتصال دستگاه و دریافت داده

```
دستگاه RATCX1                    TC Manager Server
      │                                  │
      │──── TCP connect (port 2022) ────▶│
      │                                  │
      │──── 8000 handshake ─────────────▶│ 1. ثبت IP + کد دستگاه
      │                                  │ 2. محاسبه اختلاف ساعت
      │                                  │ 3. startDevicePoll()
      │                                  │
      │◀─── 0012 (تنظیم ساعت) ──────────│ [اگر drift > 2 دقیقه]
      │                                  │
      │──── 8012 (تأیید ساعت) ──────────▶│ 4. ثبت تأیید
      │                                  │
      │◀─── 0197 (درخواست interval) ────│ 5. startDataRequests()
      │                                  │   (از آخرین رکورد DB + 5min)
      │──── 8821 (داده interval) ────────▶│ 6. ratcx1ToIrawdata()
      │                                  │ 7. storeIrawdata() → DB
      │◀─── 0197 (interval بعدی) ────────│ 8. drain loop
      │──── 8821 (داده interval) ────────▶│
      │     ...                          │
      │──── CIPSHUT (قطع) ───────────────▶│ وقتی buffer خالی شد
      │                                  │
```

### ۶.۲ تصمیم‌گیری `startDevicePoll`

```
startDevicePoll(deviceCode, socket)
│
├── آیا اختلاف ساعت > 2 دقیقه؟
│   ├── بله ──▶ syncDeviceTime() → ارسال 0012
│   │          دستگاه 8012 می‌فرستد → startDataRequests()
│   └── خیر ──▶ startDataRequests() مستقیم
│
startDataRequests(deviceCode, socket)
│
├── آخرین رکورد irawdata برای این دستگاه از DB
├── refTime = lastRecord.create_at + 5 دقیقه
│   OR  = server_now - 5min (اگر بیش از 4 ساعت قدیمی)
│
├── آیا refTime > lastCompletedInterval؟
│   ├── بله ──▶ هیچ interval کاملی نیست → متوقف
│   └── خیر ──▶ ارسال 0197 با timestamp refTime
│
پس از دریافت 8821:
│
├── بررسی timestamp: آیا در آینده است (>10 دقیقه)؟
│   ├── بله ──▶ تصحیح به server_now - 5min
│   └── خیر ──▶ timestamp دستگاه استفاده می‌شود
│
├── ذخیره در irawdata (UPSERT)
│
├── nextStart = dataDate + 5min
├── آیا nextStart > server_now - 5min؟
│   ├── بله ──▶ "buffer drained" → متوقف
│   └── خیر ──▶ ارسال 0197 با nextStart (drain loop ادامه)
```

### ۶.۳ ارسال به RMTO (Scheduler)

```
هر 5 دقیقه: processAndSendIrawdata()
│
├── SELECT از irawdata WHERE rmto_id IS NULL AND device_code > 0
│   LIMIT 20 رکورد
│
├── برای هر رکورد:
│   ├── UPDATE irawdata SET rmto_id = -1 (in-flight marker)
│   │
│   ├── پیدا کردن mehvar_code از جدول devices
│   │   └── RID = mehvar_code (شناسه محور RMTO)
│   │
│   ├── محاسبه C1-C5 و S1-S5 و SSO/SO1-SO5
│   │
│   ├── sendAdd5(params) ── SOAP ──▶ otf.rmto.ir
│   │
│   └── پس از پاسخ:
│       ├── موفق (ID > 0) ──▶ rmto_id = response.ID
│       ├── DUPLICATE ──▶ rmto_id = -3 (دائمی، no retry)
│       ├── auth error ──▶ rmto_id = -2 (دائمی، no retry)
│       └── خطای موقت ──▶ rmto_id = NULL (retry در دوره بعد)
│
هر دقیقه: checkOfflineDevices()
└── UPDATE devices SET status='offline' WHERE last_seen < 30 دقیقه پیش
```

---

## ۷. طراحی پایگاه داده

### جداول اصلی

#### `devices` — دستگاه‌های ثبت‌شده
```sql
id              INTEGER PK
device_code     TEXT UNIQUE        ← کد 8 رقمی دستگاه (مثلاً 52907910)
name            TEXT               ← نام مکان نصب
type            TEXT               ← sensor / camera / ...
route           TEXT               ← نام مسیر
ip              TEXT               ← آخرین IP متصل‌شده
status          TEXT               ← online / offline / warning
last_seen       TEXT               ← آخرین زمان اتصال
firmware        TEXT               ← نسخه firmware (مثلاً JA11)
mehvar_code     INTEGER            ← شناسه محور RMTO (مثلاً 613151) ← مهم!
```

#### `irawdata` — داده خام هر interval 5 دقیقه‌ای
```sql
id              INTEGER PK
device_code     TEXT               ← کد دستگاه
create_at       TEXT               ← زمان شروع interval (YYYY-MM-DDTHH:mm:ss)
stop            TEXT               ← زمان پایان (create_at + 5min)
lane            INTEGER            ← شماره باند (1 یا 2)
a,b,c,d,e,x    INTEGER            ← تعداد هر طبقه وسیله نقلیه
sa,sb,...,sx   INTEGER            ← سرعت متوسط هر طبقه
sao,sbo,...   INTEGER            ← تعداد تخلف سرعت هر طبقه
overtaking     INTEGER            ← تخلف سبقت
tooclose       INTEGER            ← تخلف فاصله
rmto_id        INTEGER            ← NULL=ارسال نشده / >0=ID موفق / -2=auth خطا / -3=تکراری
rmto_cfl       INTEGER            ← CFL از RMTO
rmto_srvdt     TEXT               ← زمان ثبت RMTO
rmto_err       TEXT               ← پیام خطا
received_at    TEXT               ← زمان دریافت توسط سرور
```

**Index یکتایی:** `(device_code, create_at, stop, lane)` — جلوگیری از ثبت تکراری

#### `mehvar` — جدول محورها
```sql
code            INTEGER PK         ← شناسه محور RMTO (همان RID)
name            TEXT               ← نام محور
send_enable     INTEGER            ← آیا ارسال فعال است؟
ostan           TEXT               ← نام استان
```

#### `send_log` — لاگ ارسال‌ها
```sql
method          TEXT               ← Add5
device_code     TEXT
request_data    TEXT               ← پارامترهای SOAP ارسالی (JSON)
response_data   TEXT               ← پاسخ RMTO (JSON)
success         INTEGER            ← 1=موفق / 0=ناموفق
error_message   TEXT               ← پیام خطا
created_at      TEXT
```

---

## ۸. API Endpoints

### احراز هویت
| Method | URL | توضیح |
|--------|-----|-------|
| POST | `/api/auth/login` | ورود به سیستم |
| POST | `/api/auth/logout` | خروج |
| GET | `/api/auth/check` | بررسی نشست فعال |

### دستگاه‌ها
| Method | URL | توضیح |
|--------|-----|-------|
| GET | `/api/devices` | لیست همه دستگاه‌ها |
| GET | `/api/devices/:code` | جزئیات یک دستگاه |
| POST | `/api/devices` | افزودن دستگاه جدید |
| PUT | `/api/devices/:code` | ویرایش (شامل `mehvar_code`) |
| DELETE | `/api/devices/:code` | حذف دستگاه |

### داده‌ها
| Method | URL | توضیح |
|--------|-----|-------|
| GET | `/api/irawdata/list` | لیست داده‌های خام |
| GET | `/api/stats` | آمار کلی (تعداد، وضعیت) |
| GET | `/api/traffic` | داده ترافیکی |

### RMTO
| Method | URL | توضیح |
|--------|-----|-------|
| GET | `/api/rmto/queue` | صف ارسال + تاریخچه |
| POST | `/api/rmto/send-now` | ارسال فوری |
| POST | `/api/rmto/reinit` | بازراه‌اندازی SOAP client |
| POST | `/api/rmto/reset-auth-errors` | بازنشانی خطاهای احراز هویت |
| GET | `/api/rmto/preview/:id` | پیش‌نمایش payload SOAP یک رکورد |

### TCP (کنترل دستگاه)
| Method | URL | توضیح |
|--------|-----|-------|
| GET | `/api/tcp/connected` | لیست دستگاه‌های متصل |
| POST | `/api/tcp/sync-time` | ارسال دستور تنظیم ساعت |
| POST | `/api/tcp/poll` | درخواست داده فوری |

### پشتیبان‌گیری
| Method | URL | توضیح |
|--------|-----|-------|
| GET | `/api/backup/download` | دانلود DB |
| POST | `/api/backup/restore` | بازیابی از فایل |
| GET | `/api/backup/list` | لیست backup‌ها |

---

## ۹. رابط کاربری (UI)

پنل مدیریت یک **SPA (Single Page Application)** ساده است:
- **زبان**: فارسی (RTL)
- **فناوری**: HTML + Vanilla JavaScript + CSS — بدون framework
- **احراز هویت**: نشست در SQLite (پایدار پس از restart)

### بخش‌های اصلی پنل

| نام | شرح |
|-----|-----|
| **داشبورد** | آمار کلی، وضعیت اتصال TCP، لاگ زنده |
| **دستگاه‌ها** | مدیریت دستگاه‌ها، ستون **شناسه محور (RID)** |
| **محورها** | مدیریت محورها (جدول mehvar) |
| **دریافت داده** | مشاهده irawdata با فیلتر تاریخ و دستگاه |
| **ارسال سامانه** | صف RMTO، وضعیت ارسال، دکمه **جزئیات** و **SOAP Preview** |
| **تنظیمات** | اعتبارنامه RMTO، تنظیمات سیستم، دکمه **تست اتصال** |

---

## ۱۰. تنظیمات (فایل `server/.env`)

```env
# منطقه زمانی (بسیار مهم!)
TZ=Asia/Tehran

# پورت‌ها
PORT=3000
TCP_PORT=2022

# RMTO Web Service
RMTO_WSDL=http://otf.rmto.ir/Companies/Companies.asmx?WSDL
RMTO_CID=58
RMTO_USERNAME=your_username
RMTO_PASSWORD=your_password

# فاصله ارسال به RMTO (دقیقه)
SEND_INTERVAL_MINUTES=15

# رمز ورود مدیریت
ADMIN_PASS=admin123
```

---

## ۱۱. SOAP Web Service (RMTO)

### آدرس سرویس
`http://otf.rmto.ir/Companies/Companies.asmx?WSDL`

### متد مورد استفاده: `Add5`
| پارامتر | نام | توضیح |
|---------|-----|-------|
| CID | Company ID | شناسه شرکت (مثلاً 58) |
| UID | User ID | نام کاربری |
| PWD | Password | رمز عبور |
| FID | First ID | شناسه رکورد (= id در irawdata) |
| **RID** | **Road ID** | **شناسه محور (mehvar_code دستگاه — نه device_code!)** |
| ST | Start DateTime | `YYYY-MM-DDTHH:mm:ss` بدون Z |
| ET | End DateTime | `YYYY-MM-DDTHH:mm:ss` بدون Z |
| C1 | Class 1 Flow | سواری و وانت (a+b+c) |
| C2 | Class 2 Flow | کامیونت و مینی‌بوس (d) |
| C3 | Class 3 Flow | کامیون دو محور (e) |
| C4 | Class 4 Flow | اتوبوس (0) |
| C5 | Class 5 Flow | کامیون سه محور+ (x) |
| ASP | Avg Speed | سرعت متوسط وزنی (km/h) |
| S1-S5 | Class Avg Speed | سرعت متوسط هر طبقه |
| SSO | Sum Speeding Offence | کل تخلف سرعت |
| SO1-SO5 | Class Speeding Offence | تخلف سرعت هر طبقه |
| OO | Overtaking Offence | تخلف سبقت |
| ESD | Exceeding Safe Distance | تخلف فاصله |

---

## ۱۲. فلوچارت کامل سیستم

```
┌─────────────────────────────────────────────────────────────────┐
│                    RATCX1 (هر 5 دقیقه)                         │
│  CIPSTART → TCP:2022 ──────────────────────────────────────────┐│
└─────────────────────────────────────────────────────────────────┘│
                                                                   │
              ┌────────────────────────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TCP Server (port 2022)                      │
│                                                                  │
│  دریافت 8000 handshake                                          │
│         │                                                        │
│         ▼                                                        │
│  محاسبه clock drift                                             │
│    drift > 2min? ──YES──▶ ارسال 0012 ──▶ دریافت 8012           │
│         │ NO                                                     │
│         ▼                                                        │
│  startDataRequests():                                            │
│    آخرین رکورد DB + 5min = refTime                              │
│    ارسال 0197(refTime)                                           │
│         │                                                        │
│         ▼                                                        │
│  دریافت 8821 (interval data)                                    │
│    ↳ ratcx1ToIrawdata() → parse کلاس‌ها                        │
│    ↳ storeIrawdata() ──▶ SQLite UPSERT                          │
│    ↳ nextTime = intervalTime + 5min                              │
│    ↳ nextTime < now-5min? ──YES──▶ ارسال 0197(nextTime)         │
│                          ──NO──▶ "buffer drained" متوقف         │
│                                                                  │
│  دستگاه CIPSHUT (قطع اتصال خودکار)                             │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼ (هر 5 دقیقه)
┌─────────────────────────────────────────────────────────────────┐
│                   Scheduler: processAndSendIrawdata              │
│                                                                  │
│  SELECT irawdata WHERE rmto_id IS NULL                          │
│  برای هر رکورد:                                                  │
│    1. UPDATE rmto_id = -1 (in-flight)                            │
│    2. RID = devices.mehvar_code                                  │
│    3. محاسبه C1-C5, ASP, S1-S5, SSO...                         │
│    4. sendAdd5(SOAP) ──▶ otf.rmto.ir                            │
│    5. پاسخ:                                                      │
│       ID>0 ──▶ rmto_id=ID (موفق ✅)                             │
│       DUPLICATE ──▶ rmto_id=-3 (skip 🔁)                        │
│       AUTH ERROR ──▶ rmto_id=-2 (stop ❌)                       │
│       other ──▶ rmto_id=NULL (retry ⏳)                         │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│              RMTO: otf.rmto.ir/Companies.asmx                   │
│              Response: {ID, FID, CFL, SRVDT, BIL, ERR}          │
└─────────────────────────────────────────────────────────────────┘
```

---

## ۱۳. وظایف زمان‌بندی‌شده (Cron Jobs)

| زمان‌بندی | وظیفه | توضیح |
|-----------|-------|-------|
| هر ۵ دقیقه | `processAndSendIrawdata` | ارسال رکوردهای ارسال‌نشده به RMTO |
| هر ۱ دقیقه | `checkOfflineDevices` | علامت‌گذاری دستگاه‌های offline |
| هر ۱۵ دقیقه | `sendUnsentData` (legacy) | بازارسال داده‌های قدیمی (backward compat) |
| هر ۱ ساعت | `processAndSendIrawdata` | اجرای مجدد اضافی (safety net) |

---

## ۱۴. مدیریت پایداری (PM2)

فایل `ecosystem.config.js`:
```javascript
{
  name: "tc-manager",
  script: "server/index.js",
  env: {
    TZ: "Asia/Tehran",   // منطقه زمانی ایران
    NODE_ENV: "production"
  },
  restart_delay: 5000,  // 5 ثانیه بین restart‌ها
  kill_timeout: 6000,   // 6 ثانیه مهلت graceful shutdown
  min_uptime: 3000      // برنامه باید حداقل 3 ثانیه بالا بیاید
}
```

### Graceful Shutdown (Fix40):
وقتی PM2 دستور restart می‌دهد:
1. `SIGTERM` دریافت می‌شود
2. تمام سوکت‌های TCP فعال `destroy()` می‌شوند
3. TCP server بسته می‌شود
4. HTTP server بسته می‌شود
5. پورت‌ها **قبل** از restart جدید آزاد می‌شوند → بدون `EADDRINUSE`

---

## ۱۵. امنیت

| جنبه | پیاده‌سازی |
|------|-----------|
| احراز هویت | session-based + bcrypt password hash |
| نشست | SQLite store (پایدار پس از restart) |
| XSS | `escapeHtml()` برای همه خروجی‌های dynamic |
| SQL Injection | `better-sqlite3` prepared statements |
| محرمانگی | اعتبارنامه RMTO فقط در `.env` (gitignore شده) |

---

## ۱۶. محدودیت‌های فعلی

| محدودیت | توضیح |
|---------|-------|
| SQLite | مناسب برای یک سرور، برای مقیاس بزرگ به PostgreSQL نیاز است |
| Single-process | Node.js تک‌thread — برای ده‌ها دستگاه همزمان کافی است |
| UART Buffer | فریم‌ور RATCX1 فقط یک دستور در هر اتصال پردازش می‌کند |
| Session memory | بدون redis — فقط یک نمونه سرور پشتیبانی می‌شود |

---

## ۱۷. راهنمای نصب و راه‌اندازی

### نصب اولیه روی سرور جدید
```bash
# 1. نصب Node.js و PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

# 2. کلون پروژه
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic- /opt/tc-manager
cd /opt/tc-manager/server
npm install

# 3. تنظیم محیط
cp .env.example .env
nano .env  # وارد کردن اعتبارنامه RMTO

# 4. شروع با PM2
cd /opt/tc-manager
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### به‌روزرسانی (بدون اینترنت روی سرور)
```bash
# روی PC: دانلود deploy-offline.sh از GitHub
# انتقال به سرور: scp deploy-offline.sh root@SERVER_IP:/tmp/
# اجرا:
bash /tmp/deploy-offline.sh
```

### دستورات PM2 مفید
```bash
pm2 status            # وضعیت
pm2 logs tc-manager   # لاگ زنده
pm2 restart tc-manager --update-env  # restart + بارگذاری env جدید
pm2 stop tc-manager   # توقف
```

---

*نوآوران جنوب شرق — TC Manager v2026-02-27-v3 — Fix1 تا Fix46*
