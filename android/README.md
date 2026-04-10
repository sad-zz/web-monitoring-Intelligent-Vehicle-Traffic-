# TC Manager Android App

اپلیکیشن اندروید برای مانیتورینگ و مدیریت دستگاه‌های شمارش ترافیک RATCX1.

## ویژگی‌ها

### ۱. پنل مانیتورینگ (اتصال به سرور)
- **داشبورد** — آمار دستگاه‌های آنلاین/آفلاین، وسایل نقلیه امروز، صف RMTO با رفرش خودکار ۳۰ ثانیه
- **مدیریت محورها** — افزودن، ویرایش، حذف محورها
- **مدیریت دستگاه‌ها** — CRUD دستگاه‌ها، تنظیم ساعت و درخواست داده از طریق TCP
- **لاگ‌های RMTO** — تاریخچه ارسال با فیلتر موفق/خطا
- **چک وضعیت RMTO** — بررسی اتصال TCP به سرور RMTO + وضعیت صف ارسال

### ۲. ترمینال USB Serial
دقیقاً مثل اپ **USB Serial Terminal** — اتصال مستقیم به دستگاه RATCX1 از طریق کابل USB:
- پشتیبانی از CH340، CP210x، FTDI، PL2303 (بدون نیاز به root)
- نمایش داده در سه حالت: ASCII، HEX، یا هر دو
- تنظیمات پورت: Baud Rate، Data Bits، Stop Bits، Parity
- دکمه‌های میانبر:
  - **Handshake** — انتظار پیام `8000`
  - **Time Sync** — ارسال `0012` + تأیید `8012`
  - **Poll Data** — ارسال `0197` + دریافت `8821`
- پارس خودکار پیام `8821` با نمایش جدول:
  - ۶ کلاس وسیله نقلیه (موتور، سواری، وانت، اتوبوس، کامیون، سایر)
  - سرعت میانگین، تخلفات، اشغال لاین
  - ولتاژ باتری/خورشیدی، کد خطا
- قفل اسکرول، نمایش timestamp، اسکرول خودکار

### ۳. ابزار تست
- **ارسال تست RMTO** — ارسال داده تست با RID و تعداد وسایل دلخواه
- **زمان‌بندی تست** — ارسال خودکار هر ۵ دقیقه تا ۱۵ روز
- **ارسال دستور TCP** — ارسال دستور مستقیم به دستگاه‌های متصل

## نصب و راه‌اندازی

### پیش‌نیازها
- Android Studio Hedgehog یا جدیدتر
- Android SDK 26+
- JDK 17

### مراحل Build

```bash
cd android
./gradlew assembleDebug
```

فایل APK در `app/build/outputs/apk/debug/app-debug.apk` قرار می‌گیرد.

### تنظیمات اولیه

۱. اپ را باز کنید
۲. در صفحه ورود:
   - **آدرس سرور**: IP و پورت سرور TC Manager (مثلاً `192.168.1.100:3000`)
   - **نام کاربری و رمز عبور**
۳. پس از ورود، به تمام بخش‌ها دسترسی خواهید داشت

### اتصال USB

۱. به صفحه **ترمینال USB** بروید
۲. دستگاه RATCX1 را با کابل USB OTG به گوشی وصل کنید
۳. روی **اتصال** کلیک کنید (درخواست مجوز USB نمایش داده می‌شود)
۴. Baud Rate پیش‌فرض: 9600

## ساختار کد

```
app/src/main/java/ir/tcmanager/
├── MainActivity.kt              # نقطه ورود
├── data/
│   ├── ApiService.kt            # Retrofit interface (تمام endpointها)
│   ├── NetworkClient.kt         # OkHttp + CookieJar
│   ├── PreferencesManager.kt    # ذخیره آدرس سرور در SharedPreferences
│   ├── UsbSerialManager.kt      # مدیریت اتصال USB Serial
│   └── models/                  # Data classes
├── domain/
│   └── Ratcx1Parser.kt          # پارسر پروتکل RATCX1 (8000/8012/8821)
└── ui/
    ├── theme/Theme.kt
    ├── components/CommonComponents.kt
    ├── navigation/AppNavigation.kt
    └── screens/
        ├── LoginScreen.kt
        ├── HomeScreen.kt        + HomeViewModel.kt
        ├── MehvarScreen.kt      + MehvarViewModel.kt
        ├── DevicesScreen.kt     + DevicesViewModel.kt
        ├── RmtoLogsScreen.kt    + RmtoLogsViewModel.kt
        ├── RmtoCheckScreen.kt   + RmtoCheckViewModel.kt
        ├── UsbSerialScreen.kt   + UsbSerialViewModel.kt  ← ترمینال USB
        └── TestToolsScreen.kt   + TestToolsViewModel.kt
```

## نکات فنی

| موضوع | راه‌حل |
|-------|---------|
| Auth | Cookie-based session با OkHttp CookieJar |
| RTL | `CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl)` |
| USB | کتابخانه `usb-serial-for-android` (mik3y) |
| پروتکل | RATCX1 بر اساس مستندات CLAUDE.md |
| تنظیمات | SharedPreferences برای آدرس سرور |
| Cleartext | `usesCleartextTraffic="true"` برای اتصال به سرور لوکال |
