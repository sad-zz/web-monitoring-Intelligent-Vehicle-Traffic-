# Termux Scraper — راهنمای کامل

اسکریپت‌هایی برای اجرا روی **Termux** (اندروید) جهت جمع‌آوری اطلاعات از سایت خارجی و ارسال به سرور TC Manager از طریق شبکه داخلی.

## مسیر داده

```
اینترنت (موبایل)
      ↓
  Termux (گوشی)  ←── scraper.py یا api_client.py
      ↓
شبکه داخلی (WiFi/LAN)
      ↓
  سرور TC Manager
```

---

## فایل‌ها

| فایل | توضیح |
|------|-------|
| `scraper.py` | نسخه کامل با **Selenium** — برای سایت‌هایی که نیاز به مرورگر دارند |
| `api_client.py` | نسخه سبک فقط با **requests** — برای سایت‌هایی که JSON API دارند |
| `config.json.example` | نمونه تنظیمات — به `config.json` کپی کنید |

---

## نصب روی Termux

### ۱. نصب Termux از F-Droid

> از Play Store نصب نکنید — نسخه قدیمی است.

### ۲. نصب پکیج‌های اساسی

```bash
pkg update && pkg upgrade -y
pkg install -y python git openssh
pip install requests
```

### ۳. نصب Selenium (فقط برای `scraper.py`)

```bash
pkg install -y chromium
pip install selenium
```

### ۴. دریافت اسکریپت‌ها

```bash
# کلون ریپو
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git
cd web-monitoring-Intelligent-Vehicle-Traffic-/android/termux
```

### ۵. تنظیمات

```bash
cp config.json.example config.json
nano config.json   # مقادیر را ویرایش کنید
```

محتوای `config.json`:

```json
{
  "source_site": {
    "url": "https://سایت-خارجی.com",
    "username": "نام-کاربری",
    "password": "رمز-عبور",
    "login_url": "https://سایت-خارجی.com/login",
    "report_url": "https://سایت-خارجی.com/report"
  },
  "tc_manager": {
    "server_url": "http://192.168.1.100:3000",
    "username": "admin",
    "password": "رمز-TC-Manager"
  },
  "scraper": {
    "interval_seconds": 600,
    "headless": true,
    "log_file": "scraper.log",
    "max_retries": 3,
    "retry_delay_seconds": 30
  }
}
```

---

## اجرا

### نسخه سبک (بدون Selenium)

```bash
# اجرای یک‌بار برای تست
python api_client.py --once

# نمایش وضعیت دستگاه‌های TC Manager
python api_client.py --status

# اجرای دائمی هر ۱۰ دقیقه
python api_client.py
```

### نسخه Selenium (سایت‌های بدون API)

```bash
# اجرای یک‌بار برای تست
python scraper.py --once

# اجرای دائمی
python scraper.py

# فاصله زمانی دلخواه (ثانیه)
python scraper.py --interval 300
```

---

## اجرای خودکار در پس‌زمینه

### روش ۱ — با `nohup`

```bash
nohup python api_client.py > /dev/null 2>&1 &
echo $! > scraper.pid
```

برای متوقف کردن:

```bash
kill $(cat scraper.pid)
```

### روش ۲ — با Termux:Boot (اجرای خودکار بعد از راه‌اندازی گوشی)

```bash
# نصب Termux:Boot از F-Droid
mkdir -p ~/.termux/boot/

cat > ~/.termux/boot/start-scraper.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
cd ~/web-monitoring-Intelligent-Vehicle-Traffic-/android/termux
nohup python api_client.py >> scraper.log 2>&1 &
EOF

chmod +x ~/.termux/boot/start-scraper.sh
```

---

## سفارشی‌سازی برای سایت خارجی

اگر سایت خارجی ساختار متفاوتی دارد، در `scraper.py` بخش‌های مشخص‌شده را ویرایش کنید:

```python
# ━━ این سلکتورها را بر اساس سایت واقعی تنظیم کنید ━━
username_field = self._wait(By.ID, "username")   # ID فیلد نام کاربری
password_field = self.driver.find_element(By.ID, "password")   # ID رمز عبور
self.driver.find_element(By.ID, "login_button").click()        # ID دکمه ورود

# ...

table = self._wait(By.ID, "report_table")   # ID جدول گزارش
record = {
    "device_code": cols[0].text.strip(),   # ستون اول: کد دستگاه
    "status": cols[1].text.strip(),        # ستون دوم: وضعیت
    "datetime": cols[2].text.strip(),      # ستون سوم: تاریخ/زمان
}
```

---

## رفع اشکال

| مشکل | راه‌حل |
|------|---------|
| `chromium not found` | `pkg install chromium` |
| `selenium not installed` | `pip install selenium` |
| `Connection refused` | سرور TC Manager در دسترس نیست — IP را بررسی کنید |
| `Login failed` | نام کاربری/رمز عبور را در `config.json` بررسی کنید |
| `Table not found` | ID جدول در سایت را با Developer Tools بررسی کنید |

---

## انتقال فایل‌های به‌روزشده به سرور

```bash
# بعد از git pull
git pull

# انتقال به سرور
scp -r ~/web-monitoring-Intelligent-Vehicle-Traffic-/ USER@SERVER_IP:/opt/tc-manager/

# اجرای deploy
ssh USER@SERVER_IP "cd /opt/tc-manager/server && bash deploy-all.sh"
```
