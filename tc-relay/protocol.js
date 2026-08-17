'use strict';

/**
 * protocol.js — پارسر پروتکل RATCX1
 *
 * پیام‌های پشتیبانی‌شده:
 *   8000  Device→Server  handshake
 *   8012  Device→Server  time-sync ACK
 *   8821  Device→Server  interval data
 *
 * پیام‌های ارسالی:
 *   0012  Server→Device  time sync command
 *   0197  Server→Device  request interval data
 */

// ─── ابزارها ─────────────────────────────────────────────────────────────────

/**
 * تاریخ/زمان فعلی را به فرمت yyMMddHHmmss برمی‌گرداند
 */
function nowStr() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yy}${MM}${dd}${HH}${mm}${ss}`;
}

/**
 * رشته YYMMDDHHmm را به Date تبدیل می‌کند (null اگر نامعتبر)
 * YY: دو رقم آخر سال، MM: ماه، DD: روز، HH: ساعت، mm: دقیقه
 */
function parseYYMMDDHHmm(s) {
  if (!s || s.length < 10) return null;
  const yy = parseInt(s.slice(0, 2), 10);
  const MM = parseInt(s.slice(2, 4), 10);
  const DD = parseInt(s.slice(4, 6), 10);
  const HH = parseInt(s.slice(6, 8), 10);
  const mm = parseInt(s.slice(8, 10), 10);
  if (MM < 1 || MM > 12 || DD < 1 || DD > 31) return null;
  const year = 2000 + yy;
  const d = new Date(year, MM - 1, DD, HH, mm, 0, 0);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * رشته datetime کامل دستگاه (21 کاراکتر) را به Date تبدیل می‌کند
 * فرمت: YYMMDDHHmmssmmm یا YYMMDDHHmmss...
 */
function parseDeviceDatetime(s) {
  if (!s || s.length < 12) return null;
  return parseYYMMDDHHmm(s.slice(0, 10));
}

/**
 * تاریخ را به فرمت YYMMDDHHmm برمی‌گرداند
 */
function toYYMMDDHHmm(date) {
  const yy = String(date.getFullYear()).slice(-2);
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const HH = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${yy}${MM}${dd}${HH}${mm}`;
}

/**
 * تاریخ را به فرمت ISO برای SOAP برمی‌گرداند: yyyy-MM-dd HH:mm:ss
 */
function toISOLocal(date) {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const HH = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
}

/**
 * زمان فعلی را به نزدیک‌ترین ۵ دقیقه گرد می‌کند
 */
function roundTo5Min(date) {
  const ms = date.getTime();
  const rounded = Math.round(ms / (5 * 60 * 1000)) * (5 * 60 * 1000);
  return new Date(rounded);
}

// ─── پارس پیام‌های دستگاه ────────────────────────────────────────────────────

/**
 * پارس پیام handshake 8000
 * فرمت: 8000 + datetime(21) + sysId(8) + model + READY
 * @returns {{ sysId, model, deviceTime, raw }} یا null
 */
function parse8000(msg) {
  if (!msg.startsWith('8000')) return null;
  const body = msg.slice(4);
  if (body.length < 29) return null; // 21 + 8 حداقل
  const datetimeStr = body.slice(0, 21);
  const sysId = body.slice(21, 29);
  const rest = body.slice(29);
  const readyIdx = rest.indexOf('READY');
  const model = readyIdx >= 0 ? rest.slice(0, readyIdx).trim() : rest.trim();
  const deviceTime = parseDeviceDatetime(datetimeStr);
  return { sysId, model, deviceTime, raw: msg };
}

/**
 * پارس پیام time-sync ACK 8012
 * فرمت: 8012 + datetime(21) + sysId(8)
 * @returns {{ sysId, deviceTime, raw }} یا null
 */
function parse8012(msg) {
  if (!msg.startsWith('8012')) return null;
  const body = msg.slice(4);
  if (body.length < 29) return null;
  const datetimeStr = body.slice(0, 21);
  const sysId = body.slice(21, 29);
  const deviceTime = parseDeviceDatetime(datetimeStr);
  return { sysId, deviceTime, raw: msg };
}

/**
 * پارس یک lane (19 کاراکتر × 6 کلاس = 114 کاراکتر) + occupancy (3 کاراکتر)
 * ساختار هر کلاس (19 کاراکتر): count(4) + avgSpeed(3) + violation(4) + grab(4) + headway(4)
 * @returns {{ classes: [{count,avgSpeed,violation,grab,headway}×6], occupancy }}
 */
function parseLane(s, offset) {
  const classes = [];
  for (let i = 0; i < 6; i++) {
    const base = offset + i * 19;
    classes.push({
      count: parseInt(s.slice(base, base + 4), 10) || 0,
      avgSpeed: parseInt(s.slice(base + 4, base + 7), 10) || 0,
      violation: parseInt(s.slice(base + 7, base + 11), 10) || 0,
      grab: parseInt(s.slice(base + 11, base + 15), 10) || 0,
      headway: parseInt(s.slice(base + 15, base + 19), 10) || 0,
    });
  }
  const occupancy = parseInt(s.slice(offset + 114, offset + 117), 10) || 0;
  return { classes, occupancy };
}

/**
 * پارس پیام داده interval 8821
 * فرمت: 8821 + datetime(21) + intervalData(262+)
 *
 * ساختار intervalData:
 *   [0-7]     sysId
 *   [8-17]    datetime YYMMDDHHmm
 *   [18-131]  Lane1 (6 کلاس × 19 + occupancy 3)
 *   [132-134] Lane1 occupancy  ← داخل parseLane محاسبه می‌شود
 *   [135-248] Lane2 (همانند Lane1)
 *   [249-251] Lane2 occupancy
 *   [252-254] Battery voltage
 *   [255-257] Solar voltage
 *   [258-261] Error byte
 *
 * @returns {{ sysId, intervalTime, lane1, lane2, battery, solar, error, raw }} یا null
 */
function parse8821(msg) {
  if (!msg.startsWith('8821')) return null;
  const body = msg.slice(4);
  if (body.length < 29) return null;
  const datetimeStr = body.slice(0, 21);
  const data = body.slice(21);
  if (data.length < 262) return null;

  const sysId = data.slice(0, 8);
  const intervalTimeStr = data.slice(8, 18);
  let intervalTime = parseYYMMDDHHmm(intervalTimeStr);

  // اگر تاریخ NaN یا ماه نامعتبر بود → از زمان سرور استفاده کن
  if (!intervalTime) {
    intervalTime = roundTo5Min(new Date());
  }

  // اگر اختلاف با سرور بیش از 30 دقیقه بود → از زمان سرور استفاده کن
  const now = new Date();
  if (Math.abs(now.getTime() - intervalTime.getTime()) > 30 * 60 * 1000) {
    intervalTime = roundTo5Min(now);
  }

  const lane1 = parseLane(data, 18);
  const lane2 = parseLane(data, 135);
  const battery = parseInt(data.slice(252, 255), 10) || 0;
  const solar = parseInt(data.slice(255, 258), 10) || 0;
  const error = data.slice(258, 262);
  const deviceTime = parseDeviceDatetime(datetimeStr);

  return { sysId, intervalTime, deviceTime, lane1, lane2, battery, solar, error, raw: msg };
}

// ─── ساخت پیام‌های سرور ──────────────────────────────────────────────────────

/**
 * ساخت پیام time-sync 0012
 */
function build0012() {
  return `0012${nowStr()}`;
}

/**
 * ساخت پیام request interval 0197
 * @param {Date} intervalTime — زمان interval مورد درخواست
 */
function build0197(intervalTime) {
  return `0197${toYYMMDDHHmm(intervalTime)}`;
}

/**
 * محاسبه اختلاف زمانی دستگاه با سرور (میلی‌ثانیه)
 * @param {Date|null} deviceTime
 * @returns {number} — مقدار مطلق اختلاف؛ Infinity اگر نامعتبر
 */
function clockDriftMs(deviceTime) {
  if (!deviceTime || isNaN(deviceTime.getTime())) return Infinity;
  return Math.abs(new Date().getTime() - deviceTime.getTime());
}

/**
 * تبدیل داده interval به فرمت قابل ارسال RMTO
 * کلاس‌ها: a=motorcycle b=car c=van d=bus e=truck x=other
 * C1=a C2=b C3=c C4=d C5=e+x
 * Violation: SO1=a SO2=b SO3=c SO4=d SO5=e+x SSO=sum
 */
function intervalToRmto(parsed) {
  const l1 = parsed.lane1.classes;
  const l2 = parsed.lane2.classes;

  // جمع دو lane برای هر کلاس
  const sum = (idx) => (l1[idx] ? l1[idx].count : 0) + (l2[idx] ? l2[idx].count : 0);
  const vsum = (idx) => (l1[idx] ? l1[idx].violation : 0) + (l2[idx] ? l2[idx].violation : 0);

  const c1 = sum(0); // motorcycle
  const c2 = sum(1); // car
  const c3 = sum(2); // van
  const c4 = sum(3); // bus
  const c5 = sum(4) + sum(5); // truck + other

  const so1 = vsum(0);
  const so2 = vsum(1);
  const so3 = vsum(2);
  const so4 = vsum(3);
  const so5 = vsum(4) + vsum(5);
  const sso = so1 + so2 + so3 + so4 + so5;

  // میانگین سرعت از هر دو lane
  const speedSum = [...l1, ...l2].reduce((a, c) => a + c.avgSpeed * c.count, 0);
  const countSum = c1 + c2 + c3 + c4 + c5;
  const asp = countSum > 0 ? Math.round(speedSum / countSum) : 0;

  // زمان شروع = intervalTime، زمان پایان = intervalTime + 5 دقیقه
  const st = toISOLocal(parsed.intervalTime);
  const et = toISOLocal(new Date(parsed.intervalTime.getTime() + 5 * 60 * 1000));

  return { c1, c2, c3, c4, c5, asp, so1, so2, so3, so4, so5, sso, st, et };
}

module.exports = {
  parse8000,
  parse8012,
  parse8821,
  build0012,
  build0197,
  clockDriftMs,
  intervalToRmto,
  toISOLocal,
  roundTo5Min,
  toYYMMDDHHmm,
};
