#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TC Manager - Termux API Client (بدون Selenium)
================================================
نسخه سبک‌تر بدون نیاز به Selenium — فقط با کتابخانه requests.
مناسب برای زمانی که می‌خواهید مستقیماً از TC Manager دیگری یا
هر API که JSON برمی‌گرداند، داده بگیرید.

نصب:
    pip install requests

اجرا:
    python api_client.py
    python api_client.py --once
    python api_client.py --status   # فقط نمایش وضعیت دستگاه‌ها
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime

import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(SCRIPT_DIR, "config.json")


# ══════════════════════════════════════════════
# تنظیمات
# ══════════════════════════════════════════════
def load_config():
    if not os.path.exists(CONFIG_FILE):
        print(f"[خطا] فایل تنظیمات یافت نشد: {CONFIG_FILE}")
        print("      فایل config.json.example را به config.json کپی کنید.")
        sys.exit(1)
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def setup_logging(log_file="api_client.log"):
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
    return logging.getLogger("api_client")


# ══════════════════════════════════════════════
# TC Manager Client
# ══════════════════════════════════════════════
class TCManagerClient:
    def __init__(self, base_url, username, password, logger):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.log = logger
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self._logged_in = False

    def login(self):
        try:
            r = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={"username": self.username, "password": self.password},
                timeout=10,
            )
            if r.ok and r.json().get("success"):
                self._logged_in = True
                self.log.info(f"لاگین موفق به TC Manager: {self.base_url}")
                return True
            self.log.error(f"لاگین ناموفق: {r.text}")
            return False
        except requests.RequestException as e:
            self.log.error(f"خطا در اتصال به TC Manager ({self.base_url}): {e}")
            return False

    def ensure_login(self):
        if not self._logged_in:
            return self.login()
        # بررسی اینکه session هنوز معتبر است
        try:
            r = self.session.get(f"{self.base_url}/api/auth/check", timeout=5)
            if r.ok and r.json().get("loggedIn"):
                return True
        except requests.RequestException:
            pass
        self._logged_in = False
        return self.login()

    def get_stats(self):
        """دریافت آمار کلی"""
        try:
            r = self.session.get(f"{self.base_url}/api/stats", timeout=10)
            return r.json() if r.ok else None
        except requests.RequestException as e:
            self.log.error(f"خطا در دریافت آمار: {e}")
            return None

    def get_devices(self):
        """دریافت لیست دستگاه‌ها"""
        try:
            r = self.session.get(f"{self.base_url}/api/devices", timeout=10)
            return r.json() if r.ok else []
        except requests.RequestException as e:
            self.log.error(f"خطا در دریافت دستگاه‌ها: {e}")
            return []

    def get_offline_devices(self):
        """فیلتر دستگاه‌های آفلاین"""
        devices = self.get_devices()
        return [d for d in devices if d.get("status") != "online"]

    def get_online_devices(self):
        """فیلتر دستگاه‌های آنلاین"""
        devices = self.get_devices()
        return [d for d in devices if d.get("status") == "online"]

    def update_device_status(self, device_code, status, last_seen=None):
        """آپدیت وضعیت یک دستگاه"""
        payload = {"status": status}
        if last_seen:
            payload["last_seen"] = last_seen
        try:
            r = self.session.put(
                f"{self.base_url}/api/devices/{device_code}",
                json=payload,
                timeout=10,
            )
            return r.ok
        except requests.RequestException as e:
            self.log.error(f"خطا در آپدیت دستگاه {device_code}: {e}")
            return False

    def sync_devices_from_external(self, external_data):
        """
        همگام‌سازی وضعیت دستگاه‌ها با داده‌های خارجی.
        external_data: لیست دیکشنری با کلیدهای device_code, status, datetime
        """
        if not external_data:
            return 0

        updated = 0
        for record in external_data:
            code = str(record.get("device_code", "")).strip()
            status = record.get("status", "offline")
            dt = record.get("datetime", datetime.now().isoformat())

            if not code:
                continue

            if self.update_device_status(code, status, dt):
                updated += 1
                self.log.info(f"  دستگاه {code}: {status}")

        self.log.info(f"همگام‌سازی کامل: {updated}/{len(external_data)} دستگاه آپدیت شد")
        return updated

    def print_status_table(self):
        """نمایش جدول وضعیت دستگاه‌ها در ترمینال"""
        stats = self.get_stats()
        devices = self.get_devices()

        print("\n" + "═" * 60)
        print("  TC Manager — وضعیت دستگاه‌ها")
        print("═" * 60)

        if stats:
            print(f"  کل دستگاه‌ها: {stats.get('totalDevices', '?')}")
            print(f"  آنلاین:        {stats.get('onlineDevices', '?')}")
            print(f"  وسایل امروز:  {stats.get('todayVehicles', '?')}")
            print(f"  صف RMTO:       {stats.get('unsentRMTO', '?')}")
            print("─" * 60)

        status_icon = {"online": "🟢", "offline": "🔴", "warning": "🟡", "error": "🔴"}
        for d in devices:
            icon = status_icon.get(d.get("status", "offline"), "⚪")
            code = d.get("device_code", "")
            name = d.get("name", "")
            status = d.get("status", "offline")
            last_seen = d.get("last_seen", "")[:19] if d.get("last_seen") else "—"
            print(f"  {icon} [{code}] {name:<20} {status:<8} {last_seen}")

        print("═" * 60 + "\n")


# ══════════════════════════════════════════════
# دریافت از API خارجی (بدون Selenium)
# ══════════════════════════════════════════════
def fetch_from_external_api(cfg, log):
    """
    دریافت داده از یک API خارجی که JSON برمی‌گرداند.
    این تابع را برای هر API خارجی که نیاز دارید تنظیم کنید.
    """
    source = cfg.get("source_site", {})
    base_url = source.get("url", "")
    if not base_url:
        log.warning("آدرس سایت منبع تنظیم نشده")
        return []

    session = requests.Session()

    # لاگین (اگر API نیاز دارد)
    try:
        login_r = session.post(
            source.get("login_url", f"{base_url}/api/login"),
            json={"username": source.get("username"), "password": source.get("password")},
            timeout=15,
        )
        if not login_r.ok:
            log.error(f"لاگین به سایت خارجی ناموفق: {login_r.status_code}")
            return []
        log.info("لاگین به سایت خارجی موفق")
    except requests.RequestException as e:
        log.error(f"خطا در اتصال به سایت خارجی: {e}")
        return []

    # دریافت گزارش
    try:
        report_r = session.get(
            source.get("report_url", f"{base_url}/api/devices"),
            timeout=15,
        )
        if not report_r.ok:
            log.error(f"خطا در دریافت گزارش: {report_r.status_code}")
            return []

        raw = report_r.json()

        # ━━ پردازش پاسخ API خارجی را اینجا تنظیم کنید ━━
        # اگر پاسخ لیست مستقیم است:
        if isinstance(raw, list):
            records = raw
        # اگر داده درون یک کلید است:
        elif isinstance(raw, dict):
            records = raw.get("data") or raw.get("records") or raw.get("devices") or []
        else:
            records = []

        # نرمال‌سازی فیلدها
        result = []
        for item in records:
            code = str(item.get("device_code") or item.get("id") or item.get("code") or "").strip()
            if not code:
                continue
            status_raw = str(item.get("status") or item.get("state") or "offline")
            result.append({
                "device_code": code,
                "status": _normalize_status(status_raw),
                "datetime": item.get("datetime") or item.get("last_seen") or datetime.now().isoformat(),
            })

        log.info(f"دریافت {len(result)} رکورد از سایت خارجی")
        return result

    except (requests.RequestException, ValueError) as e:
        log.error(f"خطا در پردازش پاسخ خارجی: {e}")
        return []


def _normalize_status(raw):
    raw_lower = raw.lower()
    if any(k in raw_lower for k in ["online", "آنلاین", "متصل", "فعال", "1", "true"]):
        return "online"
    if any(k in raw_lower for k in ["warning", "هشدار"]):
        return "warning"
    return "offline"


# ══════════════════════════════════════════════
# حلقه اصلی
# ══════════════════════════════════════════════
def run_once(cfg, tc, log):
    if not tc.ensure_login():
        log.error("اتصال به TC Manager ممکن نیست")
        return False

    external_data = fetch_from_external_api(cfg, log)
    if external_data:
        tc.sync_devices_from_external(external_data)
    else:
        log.warning("داده‌ای از سایت خارجی دریافت نشد")
        tc.print_status_table()
        return False

    return True


def main():
    parser = argparse.ArgumentParser(description="TC Manager API Client (Termux)")
    parser.add_argument("--once", action="store_true", help="فقط یک بار اجرا شود")
    parser.add_argument("--status", action="store_true", help="نمایش وضعیت فعلی TC Manager")
    parser.add_argument("--interval", type=int, help="فاصله زمانی به ثانیه")
    args = parser.parse_args()

    cfg = load_config()
    scraper_cfg = cfg.get("scraper", {})
    log = setup_logging("api_client.log")

    tc = TCManagerClient(
        base_url=cfg["tc_manager"]["server_url"],
        username=cfg["tc_manager"]["username"],
        password=cfg["tc_manager"]["password"],
        logger=log,
    )

    if args.status:
        if tc.login():
            tc.print_status_table()
        sys.exit(0)

    interval = args.interval or scraper_cfg.get("interval_seconds", 600)

    if args.once:
        success = run_once(cfg, tc, log)
        sys.exit(0 if success else 1)

    log.info(f"TC Manager API Client شروع — هر {interval} ثانیه")
    while True:
        start = time.time()
        try:
            run_once(cfg, tc, log)
        except KeyboardInterrupt:
            log.info("متوقف شد")
            break
        except Exception as e:
            log.error(f"خطا: {e}", exc_info=True)

        elapsed = time.time() - start
        sleep_time = max(0, interval - elapsed)
        log.info(f"بعدی دور {sleep_time:.0f} ثانیه دیگر...")
        try:
            time.sleep(sleep_time)
        except KeyboardInterrupt:
            log.info("متوقف شد")
            break


if __name__ == "__main__":
    main()
