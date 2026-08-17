'use strict';

/**
 * rmto.js — ارسال داده به سامانه RMTO (RAHSAM) از طریق SOAP
 *
 * متد: Add5
 * SOAP Action: ITS/Add5
 */

const axios = require('axios');
const cfg = require('./config');

/**
 * ساخت پیام SOAP برای متد Add5
 */
function buildSoapEnvelope({ fid, rid, st, et, c1, c2, c3, c4, c5, asp,
  so1, so2, so3, so4, so5, sso, oo = 0, esd = 0,
  s1 = 0, s2 = 0, s3 = 0, s4 = 0, s5 = 0 }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <Add5 xmlns="ITS">
      <CID>${escapeXml(cfg.CID)}</CID>
      <UID>${escapeXml(cfg.UID)}</UID>
      <PWD>${escapeXml(cfg.PWD)}</PWD>
      <FID>${escapeXml(String(fid))}</FID>
      <RID>${escapeXml(String(rid))}</RID>
      <ST>${escapeXml(st)}</ST>
      <ET>${escapeXml(et)}</ET>
      <C1>${c1}</C1><C2>${c2}</C2><C3>${c3}</C3><C4>${c4}</C4><C5>${c5}</C5>
      <ASP>${asp}</ASP>
      <S1>${s1}</S1><S2>${s2}</S2><S3>${s3}</S3><S4>${s4}</S4><S5>${s5}</S5>
      <SSO>${sso}</SSO>
      <SO1>${so1}</SO1><SO2>${so2}</SO2><SO3>${so3}</SO3><SO4>${so4}</SO4><SO5>${so5}</SO5>
      <OO>${oo}</OO>
      <ESD>${esd}</ESD>
    </Add5>
  </soap:Body>
</soap:Envelope>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * ارسال یک رکورد به سامانه RMTO
 * @param {object} params
 * @param {string} params.rid — کد محور در سامانه
 * @param {string} params.fid — شناسه یکتای رکورد (sysId + timestamp)
 * @param {string} params.st  — زمان شروع interval (yyyy-MM-dd HH:mm:ss)
 * @param {string} params.et  — زمان پایان interval
 * @param {number} params.c1..c5, asp, so1..so5, sso
 * @returns {Promise<{success: boolean, response: string}>}
 */
async function sendAdd5(params) {
  const envelope = buildSoapEnvelope(params);
  try {
    const res = await axios.post(cfg.RMTO_URL, envelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"ITS/Add5"',
      },
      timeout: 15000,
    });
    return { success: true, response: res.data };
  } catch (err) {
    const msg = err.response ? `HTTP ${err.response.status}: ${err.response.data}` : err.message;
    return { success: false, response: msg };
  }
}

module.exports = { sendAdd5 };
