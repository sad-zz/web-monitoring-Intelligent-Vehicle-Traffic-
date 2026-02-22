#!/usr/bin/env node
/**
 * verify-timesync.js — بررسی فرمت دستور 0012 تنظیم ساعت دستگاه
 *
 * اجرا روی سرور:
 *   cd /opt/tc-manager
 *   node verify-timesync.js
 */
"use strict";

// تابع فرمت‌دهی ساعت (همان تابع server/index.js)
function formatDeviceDatetime(date) {
    var yy = String(date.getFullYear()).substring(2); // 2 رقم آخر سال
    var mo = String(date.getMonth() + 1).padStart(2, "0");
    var dy = String(date.getDate()).padStart(2, "0");
    var h  = String(date.getHours()).padStart(2, "0");
    var m  = String(date.getMinutes()).padStart(2, "0");
    var s  = String(date.getSeconds()).padStart(2, "0");
    return yy + mo + dy + h + m + s;  // 12 کاراکتر: yyMMddHHmmss
}

var now = new Date();
var payload = formatDeviceDatetime(now);
var cmd = "0012" + payload;

console.log("==================================================");
console.log("  تست فرمت دستور تنظیم ساعت (0012)");
console.log("==================================================");
console.log("  زمان سرور:  " + now.toLocaleString("fa-IR"));
console.log("  دستور ارسالی به دستگاه: " + cmd);
console.log("  طول payload: " + payload.length + " کاراکتر");
console.log("");

// بررسی صحت
var ok = true;
if (payload.length !== 12) {
    console.log("  ❌ خطا: payload باید 12 کاراکتر باشد، نه " + payload.length);
    ok = false;
}
if (!/^\d{12}$/.test(payload)) {
    console.log("  ❌ خطا: payload باید فقط عدد باشد: " + payload);
    ok = false;
}

// بررسی مقادیر جداگانه
var year   = parseInt(payload.substring(0, 2), 10);
var month  = parseInt(payload.substring(2, 4), 10);
var day    = parseInt(payload.substring(4, 6), 10);
var hour   = parseInt(payload.substring(6, 8), 10);
var minute = parseInt(payload.substring(8, 10), 10);
var second = parseInt(payload.substring(10, 12), 10);

console.log("  تجزیه برای فریم‌ور (DS1305 RTC):");
console.log("    سال   (uart2_data[4..5]): " + payload.substring(0, 2) + " → " + year   + (year  >= 0 && year  <= 99 ? " ✅" : " ❌"));
console.log("    ماه   (uart2_data[6..7]): " + payload.substring(2, 4) + " → " + month  + (month >= 1 && month <= 12 ? " ✅" : " ❌ (نامعتبر!)"));
console.log("    روز   (uart2_data[8..9]): " + payload.substring(4, 6) + " → " + day    + (day   >= 1 && day   <= 31 ? " ✅" : " ❌ (نامعتبر!)"));
console.log("    ساعت  (uart2_data[10..11]):" + payload.substring(6, 8) + " → " + hour   + (hour  >= 0 && hour  <= 23 ? " ✅" : " ❌"));
console.log("    دقیقه (uart2_data[12..13]):" + payload.substring(8, 10) + " → " + minute + (minute>= 0 && minute<= 59 ? " ✅" : " ❌"));
console.log("    ثانیه (uart2_data[14..15]):" + payload.substring(10, 12) + " → " + second + (second>= 0 && second<= 59 ? " ✅" : " ❌"));

if (month < 1 || month > 12) { ok = false; }
if (day   < 1 || day   > 31) { ok = false; }

console.log("");
if (ok) {
    console.log("  ✅ فرمت 0012 درست است — دستگاه ساعت را تنظیم خواهد کرد");
} else {
    console.log("  ❌ فرمت 0012 اشتباه است — ساعت دستگاه تنظیم نمی‌شود");
    console.log("     راه‌حل: bash deploy-full.sh را اجرا کنید");
}
console.log("==================================================");
