# راهنمای لاگین در Vercel / Vercel Login Guide

## ⚠️ هشدار امنیتی مهم / CRITICAL SECURITY WARNING

**این راهنما فقط برای محیط DEMO و TEST است!**
**This guide is for DEMO and TEST environment ONLY!**

### ❌ برای Production واقعی استفاده نکنید / DO NOT use for real production:

**مشکلات امنیتی این روش:**
1. رمز عبور ساده و عمومی است
2. در localStorage ذخیره می‌شود (آسیب‌پذیر به XSS)
3. بدون session timeout
4. بدون rate limiting
5. قابل دسترسی توسط هر کسی

**برای Production واقعی باید:**
- ✅ Backend authentication واقعی
- ✅ رمز عبور hash شده
- ✅ Session tokens امن
- ✅ HTTPS اجباری
- ✅ Rate limiting
- ✅ Two-factor authentication (2FA)
- ✅ مدیریت session ها
- ✅ لاگ تلاش‌های ناموفق

**این محیط فقط برای:**
- ✅ تست اولیه
- ✅ دمو برای مشتری
- ✅ بررسی رابط کاربری
- ✅ توسعه و آزمایش

**❌ این محیط نباید برای:**
- ❌ داده واقعی
- ❌ اطلاعات محرمانه
- ❌ استفاده تولیدی
- ❌ دسترسی عمومی طولانی مدت

---

## 🎯 مشکل شما / Your Issue

**سوال:** "برای تست در Vercel اضافه کردم ولی برای لاگین یوزر و پسورد قبول نمیکنه"

**URL:** https://web-monitoring-intelligent-vehicle-lime.vercel.app/

## ✅ اطلاعات لاگین صحیح / Correct Login Credentials

### برای Vercel deployment:

```
نام کاربری (Username): admin
رمز عبور (Password): admin1234
```

**نکته مهم:** دقیقاً همین را وارد کنید، با حروف کوچک (lowercase)

---

## 🔍 مراحل لاگین گام به گام / Step-by-Step Login

### گام 1: باز کردن سایت
```
https://web-monitoring-intelligent-vehicle-lime.vercel.app/
```

### گام 2: در صفحه لاگین
شما باید یک صفحه با فرم لاگین ببینید:
```
┌──────────────────────────┐
│   ورود به سیستم          │
│                          │
│  نام کاربری: [______]   │
│  رمز عبور:   [______]   │
│                          │
│  [  ورود  ]             │
└──────────────────────────┘
```

### گام 3: وارد کردن اطلاعات
```
نام کاربری: admin        ← دقیقاً این
رمز عبور: admin1234      ← دقیقاً این
```

### گام 4: کلیک روی دکمه "ورود"

### گام 5: صفحه اصلی باز می‌شود
اگر موفق بود، باید dashboard را ببینید با:
- آمار کلی
- لیست محورها
- منوی کناری

---

## ⚠️ اشتباهات رایج / Common Mistakes

### اشتباه 1: حروف بزرگ
```
❌ نادرست: Admin
❌ نادرست: ADMIN
✅ درست: admin
```

### اشتباه 2: فاصله اضافی
```
❌ نادرست: " admin"  (فاصله قبل)
❌ نادرست: "admin "  (فاصله بعد)
✅ درست: "admin"
```

### اشتباه 3: رمز عبور اشتباه
```
❌ نادرست: admin123
❌ نادرست: admin12345
✅ درست: admin1234
```

### اشتباه 4: استفاده از Tab
```
⚠️ احتمالاً اشتباه: استفاده از Tab بین فیلدها
✅ بهتر: استفاده از Mouse یا Enter
```

---

## 🔧 مشکل همچنان دارید؟ / Still Having Issues?

### راه‌حل 1: پاک کردن Cache

**Chrome/Edge:**
```
1. F12 برای باز کردن DevTools
2. Right-click روی دکمه Refresh
3. "Empty Cache and Hard Reload"
```

**Firefox:**
```
1. Ctrl + Shift + Delete
2. انتخاب "Cached Web Content"
3. "Clear Now"
```

### راه‌حل 2: حالت Incognito/Private

```
Chrome: Ctrl + Shift + N
Firefox: Ctrl + Shift + P
Edge: Ctrl + Shift + N
```

سپس دوباره سایت را باز کنید.

### راه‌حل 3: بررسی Console

1. F12 برای باز کردن DevTools
2. رفتن به تب "Console"
3. مشاهده خطاها

**خطاهای رایج:**
```javascript
// اگر این را دیدید:
"Authentication failed" 
→ username یا password اشتباه است

// اگر این را دیدید:
"Network error"
→ مشکل اتصال اینترنت
```

### راه‌حل 4: بررسی URL

اطمینان حاصل کنید URL دقیقاً این است:
```
https://web-monitoring-intelligent-vehicle-lime.vercel.app/
```

نه:
```
❌ http://... (بدون s)
❌ ...vercel.app/login
❌ ...vercel.app/index.html
```

---

## 🧪 تست سریع / Quick Test

برای اطمینان از کار کردن، این مراحل را دنبال کنید:

### مرحله 1: باز کردن Console
```
F12 → Console
```

### مرحله 2: اجرای این کد
```javascript
localStorage.clear();
location.reload();
```

### مرحله 3: دوباره لاگین
```
Username: admin
Password: admin1234
```

---

## 📱 لاگین از موبایل / Mobile Login

### Android Chrome:
1. باز کردن سایت
2. وارد کردن: admin
3. وارد کردن: admin1234
4. کلیک روی "ورود"

### iOS Safari:
1. باز کردن سایت
2. وارد کردن: admin
3. وارد کردن: admin1234
4. کلیک روی "ورود"

**نکته موبایل:** اطمینان حاصل کنید Auto-correct خاموش باشد

---

## 💡 نکات مهم / Important Notes

### 1. این لاگین برای تست است
```
این username/password فقط برای Vercel deployment 
و محیط تست است، نه production واقعی.
```

### 2. LocalStorage
```
اطلاعات لاگین در localStorage ذخیره می‌شود.
اگر localStorage پاک شود، باید دوباره login کنید.
```

### 3. بدون Backend
```
این یک static deployment است.
لاگین با localStorage کار می‌کند، نه API server.
```

### 4. امنیت
```
⚠️ برای production واقعی، باید:
- رمز عبور قوی‌تر
- Backend authentication
- HTTPS
- Session management
```

---

## 🎉 موفقیت! / Success!

اگر لاگین موفق بود، باید:

### ✅ در URL ببینید:
```
همان URL اصلی (بدون /login)
```

### ✅ در صفحه ببینید:
```
- نام کاربری در بالای صفحه (admin)
- منوی کناری با گزینه‌ها
- Dashboard با آمار
```

### ✅ در Console ببینید:
```
localStorage.getItem("tc_user")
// نتیجه: "admin"
```

---

## 📞 همچنان مشکل دارید؟ / Still Having Problems?

### اطلاعات مورد نیاز برای کمک:

1. **مرورگر شما:**
   - Chrome? Firefox? Safari? Edge?
   - نسخه?

2. **سیستم عامل:**
   - Windows? Mac? Linux? Android? iOS?

3. **خطای دقیق:**
   - چه پیامی می‌بینید؟
   - Screenshot بگیرید

4. **مراحل انجام شده:**
   - آیا username را درست وارد کردید؟
   - آیا password را درست وارد کردید؟
   - آیا cache را پاک کردید؟

### اطلاعات دیباگ:

```javascript
// در Console اجرا کنید و نتیجه را بفرستید:
console.log({
  url: window.location.href,
  hasLocalStorage: typeof localStorage !== 'undefined',
  savedUser: localStorage.getItem('tc_user'),
  loginForm: document.querySelector('#login-form') !== null
});
```

---

## ✅ خلاصه / Summary

**اطلاعات لاگین:**
```
Username: admin
Password: admin1234
```

**اگر کار نکرد:**
1. Cache را پاک کنید
2. Incognito mode را امتحان کنید
3. Console را بررسی کنید
4. URL را بررسی کنید

**موفق شدید؟**
- Dashboard را خواهید دید
- نام کاربری در بالا نمایش داده می‌شود

---

**همه چیز باید کار کند! اگر همچنان مشکل دارید، screenshot بفرستید. 🚀**
