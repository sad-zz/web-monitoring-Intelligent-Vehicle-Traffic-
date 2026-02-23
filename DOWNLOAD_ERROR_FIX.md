# ⚠️ خطای دانلود فایل / Download Error Fix

## مشکل / Problem

اگر هنگام دانلود این خطا را می‌گیرید:
If you get this error when downloading:

```bash
curl -O https://raw.githubusercontent.com/.../main/server/test-rmto.js
# Only 14 bytes downloaded (404 error)
```

## علت / Cause

فایل هنوز روی برنچ `main` نیست - فقط روی برنچ PR موجود است.
The file is not on `main` branch yet - only available on PR branch.

---

## ✅ راه‌حل / Solution

### روش 1: دانلود از برنچ PR (کار می‌کند الان!)

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server

# این کار می‌کند:
curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/test-rmto.js

# بررسی اندازه فایل (باید حدود 4KB باشد)
ls -lh test-rmto.js
```

### روش 2: دانلود از main (بعد از merge شدن PR)

```bash
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server

# بعد از merge شدن PR این کار می‌کند:
curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/main/server/test-rmto.js

ls -lh test-rmto.js
```

---

## 🔍 چگونه بفهمیم فایل دانلود شد؟

```bash
# بررسی اندازه فایل
ls -lh test-rmto.js

# باید چیزی شبیه این ببینید:
# -rw-r--r-- 1 root root 4.0K Feb 23 06:40 test-rmto.js

# اگر فقط 14 بایت است یعنی 404 است:
# -rw-r--r-- 1 root root  14 Feb 23 06:40 test-rmto.js
```

### مشاهده محتوای فایل:

```bash
# محتوای فایل را ببینید
head -20 test-rmto.js

# باید شروع فایل JavaScript را ببینید:
# /**
#  * RMTO SOAP Test Utility
#  * ...
```

اگر به جای کد JavaScript، چیزی مثل "404: Not Found" دیدید، یعنی باید از برنچ PR دانلود کنید.

---

## 📋 دستور کامل یک خط

```bash
# دانلود از PR branch (تضمینی!)
cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server && curl -O https://raw.githubusercontent.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/copilot/create-suggestions-folder/server/test-rmto.js && ls -lh test-rmto.js && npm install && node test-rmto.js
```

---

## 🆘 اگر باز هم کار نکرد

### گزینه A: کپی-پیست دستی

مراجعه کنید به: `MANUAL_COPY_INSTRUCTIONS.md` (روش 2)

### گزینه B: مشاهده فایل در GitHub

1. بروید به:
   https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-/blob/copilot/create-suggestions-folder/test-rmto.js.txt

2. محتوا را کپی کنید

3. روی سرور:
   ```bash
   cd /opt/tc-manager/web-monitoring-Intelligent-Vehicle-Traffic-/server
   nano test-rmto.js
   # پیست محتوا
   # Ctrl+X → Y → Enter
   ```

---

**موفق باشید! 🚀**
