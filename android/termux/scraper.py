#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TC Manager - Termux Scraper
============================
اسکریپت اجرا‌شونده روی Termux (اندروید) برای جمع‌آوری اطلاعات دستگاه‌ها
از سایت خارجی (با Selenium) و ارسال به سرور TC Manager (از طریق شبکه داخلی).

مسیر داده:  اینترنت → Termux → شبکه داخلی → سرور TC Manager

نصب:
    pkg install python chromium
    pip install selenium requests

اجرا:
    python scraper.py
    python scraper.py --once   # فقط یک بار اجرا، بدون حلقه
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime

import requests

# ── Selenium (اختیاری - فقط اگر سایت مقصد نیاز به مرورگر دارد) ──
try:
    from selenium import webdriver
    from selenium.common.exceptions import (
        NoSuchElementException,
        TimeoutException,
        WebDriverException,
    )
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False

# ──────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(SCRIPT_DIR, "config.json")


# ══════════════════════════════════════════════
# تنظیمات
# ══════════════════════════════════════════════
def load_config():
    if not os.path.exists(CONFIG_FILE):
        print(f"[خطا] فایل تنظیمات یافت نشد: {CONFIG_FILE}")
        print("      فایل config.json.example را به config.json کپی کرده و مقادیر را وارد کنید.")
        sys.exit(1)
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


# ══════════════════════════════════════════════
# لاگ‌گذاری
# ══════════════════════════════════════════════
def setup_logging(log_file="scraper.log"):
    log_path = os.path.join(SCRIPT_DIR, log_file)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )
    return logging.getLogger("scraper")


# ══════════════════════════════════════════════
# کلاینت TC Manager (REST API)
# ══════════════════════════════════════════════
class TCManagerClient:
    """ارتباط با TC Manager از طریق API داخلی"""

    def __init__(self, base_url, username, password, logger):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.log = logger
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def login(self):
        try:
            r = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={"username": self.username, "password": self.password},
                timeout=10,
            )
            if r.ok and r.json().get("success"):
                self.log.info(f"[TC Manager] لاگین موفق: {self.username}")
                return True
            self.log.error(f"[TC Manager] لاگین ناموفق: {r.text}")
            return False
        except requests.RequestException as e:
            self.log.error(f"[TC Manager] خطا در اتصال: {e}")
            return False

    def get_devices(self):
        """دریافت لیست دستگاه‌ها از TC Manager"""
        try:
            r = self.session.get(f"{self.base_url}/api/devices", timeout=10)
            if r.ok:
                return r.json()
            self.log.error(f"[TC Manager] خطا در دریافت دستگاه‌ها: {r.status_code}")
            return []
        except requests.RequestException as e:
            self.log.error(f"[TC Manager] خطا: {e}")
            return []

    def send_report(self, data):
        """
        ارسال گزارش به TC Manager
        data: لیستی از دیکشنری‌ها مثل:
              [{"device_code": "12345678", "status": "online", "datetime": "..."}]
        """
        if not data:
            self.log.warning("[TC Manager] داده‌ای برای ارسال وجود ندارد")
            return False
        try:
            r = self.session.post(
                f"{self.base_url}/api/external-report",
                json={"records": data, "source": "termux-scraper", "timestamp": datetime.now().isoformat()},
                timeout=15,
            )
            if r.ok:
                self.log.info(f"[TC Manager] {len(data)} رکورد ارسال شد")
                return True
            # اگر endpoint وجود نداشت، مستقیم وضعیت دستگاه را آپدیت کن
            if r.status_code == 404:
                return self._update_devices_status(data)
            self.log.error(f"[TC Manager] خطا در ارسال: {r.status_code} - {r.text}")
            return False
        except requests.RequestException as e:
            self.log.error(f"[TC Manager] خطا در ارسال: {e}")
            return False

    def _update_devices_status(self, data):
        """آپدیت وضعیت دستگاه‌ها از طریق API موجود"""
        success_count = 0
        for record in data:
            device_code = record.get("device_code") or record.get("device")
            if not device_code:
                continue
            try:
                r = self.session.put(
                    f"{self.base_url}/api/devices/{device_code}",
                    json={"status": record.get("status", "offline"), "last_seen": record.get("datetime", "")},
                    timeout=10,
                )
                if r.ok:
                    success_count += 1
            except requests.RequestException:
                pass
        self.log.info(f"[TC Manager] {success_count}/{len(data)} دستگاه آپدیت شد")
        return success_count > 0


# ══════════════════════════════════════════════
# اسکرپر Selenium (برای سایت خارجی)
# ══════════════════════════════════════════════
class ExternalSiteScraper:
    """
    اسکرپر وب‌سایت خارجی با Selenium.
    ساختار HTML سایت مقصد را بر اساس واقعیت تنظیم کنید.
    """

    def __init__(self, config, logger):
        self.cfg = config["source_site"]
        self.log = logger
        self.driver = None

    def _build_driver(self, headless=True):
        if not SELENIUM_AVAILABLE:
            raise RuntimeError("کتابخانه selenium نصب نیست: pip install selenium")

        options = Options()
        if headless:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1280,900")
        # در Termux، مسیر chromium را مشخص می‌کنیم
        if os.path.exists("/data/data/com.termux/files/usr/bin/chromium-browser"):
            options.binary_location = "/data/data/com.termux/files/usr/bin/chromium-browser"

        try:
            self.driver = webdriver.Chrome(options=options)
        except WebDriverException:
            # تلاش با chromedriver اختصاصی
            service = Service("/data/data/com.termux/files/usr/bin/chromedriver")
            self.driver = webdriver.Chrome(service=service, options=options)

        self.driver.set_page_load_timeout(30)
        self.log.info("[Selenium] مرورگر راه‌اندازی شد")

    def _wait(self, by, selector, timeout=10):
        return WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located((by, selector))
        )

    def login(self):
        """ورود به سایت خارجی"""
        try:
            self.driver.get(self.cfg["login_url"])
            time.sleep(1)

            # ━━ این سلکتورها را بر اساس سایت واقعی تنظیم کنید ━━
            # مثال: فیلدهای با ID مشخص
            username_field = self._wait(By.ID, "username")
            username_field.clear()
            username_field.send_keys(self.cfg["username"])

            password_field = self.driver.find_element(By.ID, "password")
            password_field.clear()
            password_field.send_keys(self.cfg["password"])

            self.driver.find_element(By.ID, "login_button").click()
            time.sleep(2)

            # بررسی موفقیت لاگین (URL یا عنصر خاص)
            if "login" not in self.driver.current_url.lower():
                self.log.info("[Selenium] لاگین موفق")
                return True

            self.log.error("[Selenium] لاگین ناموفق — هنوز در صفحه لاگین")
            return False

        except (NoSuchElementException, TimeoutException) as e:
            self.log.error(f"[Selenium] خطا در لاگین: {e}")
            return False

    def fetch_device_report(self):
        """
        دریافت گزارش دستگاه‌ها از سایت خارجی.
        مقدار بازگشتی: لیست دیکشنری‌ها
        """
        data = []
        try:
            self.driver.get(self.cfg.get("report_url", self.cfg["url"]))
            time.sleep(1)

            # ━━ این سلکتورها را بر اساس سایت واقعی تنظیم کنید ━━

            # کلیک روی تب آنلاین (اگر وجود دارد)
            try:
                online_tab = self.driver.find_element(By.ID, "online_tab")
                online_tab.click()
                time.sleep(1)
            except NoSuchElementException:
                pass

            # کلیک دکمه دریافت گزارش (اگر وجود دارد)
            try:
                report_btn = self.driver.find_element(By.ID, "get_report_button")
                report_btn.click()
                time.sleep(3)
            except NoSuchElementException:
                time.sleep(2)

            # استخراج جدول
            table = self._wait(By.ID, "report_table", timeout=15)
            rows = table.find_elements(By.TAG_NAME, "tr")

            for row in rows[1:]:  # رد کردن هدر
                cols = row.find_elements(By.TAG_NAME, "td")
                if len(cols) < 2:
                    continue

                # ━━ ستون‌ها را بر اساس ساختار جدول واقعی تنظیم کنید ━━
                record = {
                    "device_code": cols[0].text.strip(),      # شماره مرکزی
                    "status": self._normalize_status(cols[1].text.strip()),  # آنلاین/آفلاین
                    "datetime": cols[2].text.strip() if len(cols) > 2 else datetime.now().isoformat(),
                }
                if record["device_code"]:
                    data.append(record)

            self.log.info(f"[Selenium] {len(data)} رکورد استخراج شد")

        except (NoSuchElementException, TimeoutException) as e:
            self.log.error(f"[Selenium] خطا در استخراج جدول: {e}")
        except Exception as e:
            self.log.error(f"[Selenium] خطای غیرمنتظره: {e}")

        return data

    @staticmethod
    def _normalize_status(raw):
        """تبدیل متن وضعیت به مقدار استاندارد TC Manager"""
        raw_lower = raw.lower()
        if any(k in raw_lower for k in ["online", "آنلاین", "متصل", "فعال"]):
            return "online"
        if any(k in raw_lower for k in ["offline", "آفلاین", "قطع", "غیرفعال"]):
            return "offline"
        if any(k in raw_lower for k in ["warning", "هشدار", "خطا"]):
            return "warning"
        return "offline"

    def quit(self):
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None
            self.log.info("[Selenium] مرورگر بسته شد")

    def run(self, headless=True):
        """اجرای کامل: راه‌اندازی → لاگین → استخراج داده"""
        self._build_driver(headless=headless)
        try:
            if not self.login():
                return []
            return self.fetch_device_report()
        finally:
            self.quit()


# ══════════════════════════════════════════════
# حلقه اصلی
# ══════════════════════════════════════════════
def run_once(cfg, tc, log):
    """یک دور اجرا: scrape → send"""
    scraper_cfg = cfg.get("scraper", {})
    max_retries = scraper_cfg.get("max_retries", 3)
    headless = scraper_cfg.get("headless", True)

    # ── مرحله ۱: لاگین به TC Manager ─────────────────────────
    if not tc.login():
        log.error("اتصال به TC Manager ممکن نیست — این دور رد شد")
        return False

    # ── مرحله ۲: اسکرپ سایت خارجی ──────────────────────────
    data = []
    scraper = ExternalSiteScraper(cfg, log)

    for attempt in range(1, max_retries + 1):
        log.info(f"تلاش اسکرپ {attempt}/{max_retries}")
        data = scraper.run(headless=headless)
        if data:
            break
        if attempt < max_retries:
            delay = scraper_cfg.get("retry_delay_seconds", 30)
            log.info(f"تلاش مجدد بعد از {delay} ثانیه...")
            time.sleep(delay)

    if not data:
        log.warning("هیچ داده‌ای استخراج نشد")
        return False

    # ── مرحله ۳: ارسال به TC Manager ──────────────────────────
    return tc.send_report(data)


def main():
    parser = argparse.ArgumentParser(description="TC Manager Termux Scraper")
    parser.add_argument("--once", action="store_true", help="فقط یک بار اجرا شود")
    parser.add_argument("--interval", type=int, help="فاصله زمانی به ثانیه (پیش‌فرض از config)")
    args = parser.parse_args()

    cfg = load_config()
    scraper_cfg = cfg.get("scraper", {})

    log = setup_logging(scraper_cfg.get("log_file", "scraper.log"))
    log.info("═" * 50)
    log.info("TC Manager Termux Scraper شروع به کار کرد")
    log.info("═" * 50)

    tc = TCManagerClient(
        base_url=cfg["tc_manager"]["server_url"],
        username=cfg["tc_manager"]["username"],
        password=cfg["tc_manager"]["password"],
        logger=log,
    )

    interval = args.interval or scraper_cfg.get("interval_seconds", 600)

    if args.once:
        success = run_once(cfg, tc, log)
        sys.exit(0 if success else 1)

    # حلقه اصلی
    log.info(f"اجرای هر {interval} ثانیه ({interval // 60} دقیقه)")
    while True:
        start = time.time()
        try:
            run_once(cfg, tc, log)
        except KeyboardInterrupt:
            log.info("متوقف شد (Ctrl+C)")
            break
        except Exception as e:
            log.error(f"خطای غیرمنتظره در حلقه اصلی: {e}", exc_info=True)

        elapsed = time.time() - start
        sleep_time = max(0, interval - elapsed)
        log.info(f"بعدی دور {sleep_time:.0f} ثانیه دیگر...")
        try:
            time.sleep(sleep_time)
        except KeyboardInterrupt:
            log.info("متوقف شد (Ctrl+C)")
            break


if __name__ == "__main__":
    main()
