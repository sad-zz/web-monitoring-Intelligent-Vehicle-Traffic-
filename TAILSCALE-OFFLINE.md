# نصب آفلاین Tailscale / Tailscale Offline Installation Guide

> **مناسب برای سرورهایی که دسترسی مستقیم به اینترنت ندارند**  
> For servers with **no direct internet access**

---

## چرا نصب آفلاین؟

اسکریپت رسمی `tailscale.com/install.sh` نیاز به اینترنت دارد و روی سرورهای محدود (مثلاً سرورهای داخل ایران) کار نمیکند.  
راه حل: بسته `.deb` را روی یک دستگاه دارای اینترنت دانلود کرده، به سرور منتقل کرده و آفلاین نصب کنید.

---

## مراحل سریع (Quick Steps)

### مرحله ۱ — بررسی مشخصات سرور

روی **سرور** اجرا کنید:

```bash
lsb_release -a      # نسخه سیستم عامل (Ubuntu 22.04 / Debian 11 / ...)
uname -m            # معماری: x86_64 (=amd64) یا aarch64 (=arm64)
```

یا از اسکریپت کمکی استفاده کنید:

```bash
bash install-tailscale-offline.sh info
```

### مرحله ۲ — دانلود بسته (روی دستگاه دارای اینترنت)

روی **لپتاپ / PC / گوشی** دارای اینترنت آزاد:

```bash
bash install-tailscale-offline.sh download
```

یا به صورت دستی:

| معماری | لینک دانلود |
|--------|------------|
| amd64 (x86_64) | https://pkgs.tailscale.com/stable/tailscale_latest_amd64.deb |
| arm64 (aarch64) | https://pkgs.tailscale.com/stable/tailscale_latest_arm64.deb |
| arm (armv7l) | https://pkgs.tailscale.com/stable/tailscale_latest_arm.deb |

برای دریافت بسته متناسب با **distro** خاص (Ubuntu focal / Debian bullseye / ...):

```
https://pkgs.tailscale.com/stable/<distro>/<codename>/pool/tailscale_latest_<arch>.deb
```

مثال Ubuntu 22.04 (jammy) amd64:
```
https://pkgs.tailscale.com/stable/ubuntu/jammy/pool/tailscale_latest_amd64.deb
```

### مرحله ۳ — انتقال فایل به سرور

فایل `.deb` (و در صورت استفاده از اسکریپت، فایل `install-tailscale-offline.sh`) را به سرور منتقل کنید:

```bash
scp tailscale_latest_amd64.deb root@<SERVER_IP>:/tmp/
scp install-tailscale-offline.sh root@<SERVER_IP>:/tmp/
```

یا از فلش / SFTP استفاده کنید.

### مرحله ۴ — نصب آفلاین روی سرور

```bash
# روی سرور:
bash /tmp/install-tailscale-offline.sh install /tmp/tailscale_latest_amd64.deb
```

یا به صورت دستی:

```bash
dpkg -i /tmp/tailscale_latest_amd64.deb
# در صورت خطای وابستگی:
apt-get install -f -y
```

### مرحله ۵ — راهاندازی Tailscale

```bash
sudo systemctl enable --now tailscaled
sudo tailscale up
```

پس از اجرای `tailscale up`، یک لینک احراز هویت نمایش داده میشود.  
لینک را در مرورگر باز کرده و سرور را به شبکه Tailscale خود اضافه کنید.

---

## استفاده به عنوان Exit Node (اختیاری)

اگر میخواهید ترافیک سرور ایران از طریق یک نود خارجی عبور کند:

**روی نود خارجی** (دستگاه دارای اینترنت آزاد):
```bash
sudo tailscale up --advertise-exit-node
# سپس در پنل Tailscale Admin آن دستگاه را به عنوان Exit Node تأیید کنید
```

**روی سرور ایران**:
```bash
sudo tailscale up --exit-node=<IP_OR_NAME_OF_EXIT_NODE>
```

---

## رفع اشکال (Troubleshooting)

| مشکل | راه حل |
|------|--------|
| `dpkg: dependency problems` | `apt-get install -f -y` |
| `tailscaled.service not found` | `systemctl daemon-reload && systemctl enable tailscaled` |
| `Login expired` | دوباره `sudo tailscale up` را اجرا کنید |
| فایل .deb دانلود نمیشود | URL را در مرورگر باز کنید یا VPN روی دستگاه دانلود فعال کنید |

---

## اسکریپت کمکی موجود در این مخزن

فایل `install-tailscale-offline.sh` موجود در ریشه مخزن، همه مراحل را خودکار میکند:

```bash
# 1. بررسی مشخصات سیستم
bash install-tailscale-offline.sh info

# 2. دانلود (روی سیستم دارای اینترنت)
bash install-tailscale-offline.sh download

# 3. نصب آفلاین روی سرور
bash install-tailscale-offline.sh install /tmp/tailscale_latest_amd64.deb
```
