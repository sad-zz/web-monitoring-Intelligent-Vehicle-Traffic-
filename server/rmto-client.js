/**
 * RMTO SOAP Client - Raw HTTP implementation
 * Sends traffic data to otf.rmto.ir/Companies/Companies.asmx
 *
 * Uses raw SOAP XML (not node-soap) to guarantee exact format matching RMTO docs:
 *   - ADD DATA_WEB SERVICE_1.02.pdf (Add method)
 *   - ADD DATA5_WEB SERVICE_1.01.pdf (Add5 method)
 *
 * Callback signature: callback(err, response, soapXml)
 */
var http = require("http");
var os = require("os");
var db = require("./db");

var RMTO_URL = process.env.RMTO_URL || "http://otf.rmto.ir/Companies/Companies.asmx";
var COMPANY_CODE = process.env.RMTO_COMPANY_CODE || "58";
var USERNAME = process.env.RMTO_USERNAME || "";
var PASSWORD = process.env.RMTO_PASSWORD || "";
var SOURCE_IP = "";

/**
 * Load RMTO settings from database (overrides env vars).
 */
function loadDbSettings() {
    try {
        var rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('rmto_company_code', 'rmto_username', 'rmto_password', 'rmto_wsdl', 'rmto_url', 'rmto_source_ip')").all();
        var s = {};
        rows.forEach(function (r) { s[r.key] = r.value; });
        if (s.rmto_company_code) COMPANY_CODE = s.rmto_company_code;
        if (s.rmto_username !== undefined) USERNAME = s.rmto_username;
        if (s.rmto_password !== undefined) PASSWORD = s.rmto_password;
        if (s.rmto_url) RMTO_URL = s.rmto_url;
        else if (s.rmto_wsdl) RMTO_URL = s.rmto_wsdl.replace("?WSDL", "").replace("?wsdl", "");
        if (s.rmto_source_ip !== undefined) SOURCE_IP = (s.rmto_source_ip || "").trim();
    } catch (e) {
        console.error("[RMTO] Failed to load DB settings:", e.message);
    }
}

/**
 * List non-internal IPv4 addresses currently assigned to this host.
 */
function listLocalIPv4() {
    var out = [];
    try {
        var ifaces = os.networkInterfaces() || {};
        Object.keys(ifaces).forEach(function (name) {
            (ifaces[name] || []).forEach(function (addr) {
                if (!addr || addr.internal) return;
                // Node may report family as "IPv4" or 4 depending on version
                var fam = addr.family;
                if (fam !== "IPv4" && fam !== 4) return;
                out.push({ iface: name, address: addr.address });
            });
        });
    } catch (e) {
        console.error("[RMTO] listLocalIPv4 failed:", e.message);
    }
    return out;
}

/**
 * Validate that a source IP can be used as localAddress (must exist on host).
 * Empty IP is valid (= OS default route).
 */
function validateSourceIp(ip) {
    var cleaned = (ip || "").trim();
    if (!cleaned) {
        return { ok: true, ip: "", local: true, localIps: listLocalIPv4(), message: "استفاده از IP پیش‌فرض سیستم" };
    }
    // Basic IPv4 shape check
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(cleaned)) {
        return {
            ok: false,
            ip: cleaned,
            local: false,
            localIps: listLocalIPv4(),
            message: "فرمت IP مبدا نامعتبر است: " + cleaned
        };
    }
    var localIps = listLocalIPv4();
    var found = localIps.some(function (x) { return x.address === cleaned; });
    if (!found) {
        return {
            ok: false,
            ip: cleaned,
            local: false,
            localIps: localIps,
            message: "IP مبدا " + cleaned + " روی این سرور تنظیم نشده (localAddress). یکی از IPهای واقعی سرور را انتخاب کنید."
        };
    }
    return { ok: true, ip: cleaned, local: true, localIps: localIps, message: "IP مبدا روی سرور موجود است" };
}

/**
 * Returns the configured source IP.
 */
function getSourceIp() {
    loadDbSettings();
    return SOURCE_IP || "";
}

/**
 * Escape XML special characters.
 */
function xmlEscape(str) {
    if (str == null) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Format datetime for RMTO SOAP: "YYYY-MM-DDTHH:mm:ss" (local, no Z, no timezone).
 * Input is already stored as local ISO string in DB: "2026-03-10T08:45:00"
 */
function formatDateTime(str) {
    if (!str) return "";
    // Already in correct format? Return as-is
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(str)) return str;
    // Remove Z suffix, milliseconds, timezone offset
    return str.replace(/\.\d+/, "").replace(/Z$/, "").replace(/[+-]\d{2}:\d{2}$/, "");
}

/**
 * Build a SOAP XML element. If value is null, emit xsi:nil="true".
 */
function xmlElement(name, value) {
    if (value === null || value === undefined) {
        return "<" + name + " xsi:nil=\"true\"/>";
    }
    return "<" + name + ">" + xmlEscape(value) + "</" + name + ">";
}

/**
 * Send raw SOAP request to RMTO and parse response.
 * @param {string} soapAction - e.g. "ITS/Add" or "ITS/Add5"
 * @param {string} bodyXml - the inner SOAP body XML
 * @param {string|null} sourceIp - local IP to bind (overrides SOURCE_IP); null = use module default
 * @param {function} callback - callback(err, parsedResponse, fullSoapXml)
 */
function sendSoapRequest(soapAction, bodyXml, sourceIp, callback) {
    // Allow legacy 3-arg call: sendSoapRequest(action, body, callback)
    if (typeof sourceIp === "function") { callback = sourceIp; sourceIp = null; }
    var soapEnvelope =
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
        'xmlns:xsd="http://www.w3.org/2001/XMLSchema" ' +
        'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
        '<soap:Body>' + bodyXml + '</soap:Body>' +
        '</soap:Envelope>';

    var urlObj = require("url").parse(RMTO_URL);
    var options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 80,
        path: urlObj.path,
        method: "POST",
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": '"' + soapAction + '"',
            "Content-Length": Buffer.byteLength(soapEnvelope, "utf8")
        }
    };
    // sourceIp param overrides module-level SOURCE_IP (null/undefined = module default)
    loadDbSettings();
    var effectiveIp = (sourceIp !== null && sourceIp !== undefined) ? String(sourceIp).trim() : SOURCE_IP;
    if (effectiveIp) {
        var ipCheck = validateSourceIp(effectiveIp);
        if (!ipCheck.ok) {
            console.error("[RMTO] " + ipCheck.message);
            return callback(new Error(ipCheck.message), null, soapEnvelope);
        }
        options.localAddress = effectiveIp;
        console.log("[RMTO] Using source IP: " + effectiveIp);
    } else {
        console.log("[RMTO] Using OS default source IP");
    }

    console.log("[RMTO] SOAP " + soapAction + " to " + RMTO_URL);
    console.log("[RMTO] Request XML:\n" + bodyXml.substring(0, 500));

    var settled = false;
    function finish(err, parsed) {
        if (settled) return;
        settled = true;
        callback(err, parsed, soapEnvelope);
    }

    var req = http.request(options, function (res) {
        var data = "";
        res.on("data", function (chunk) { data += chunk; });
        res.on("end", function () {
            console.log("[RMTO] Response status: " + res.statusCode);
            console.log("[RMTO] Response body:\n" + data.substring(0, 1000));

            if (res.statusCode !== 200) {
                return finish(new Error("HTTP " + res.statusCode + ": " + data.substring(0, 500)), null);
            }

            // Parse response XML to extract Re fields
            var parsed = parseReResponse(data);
            if (parsed.error) {
                return finish(new Error(parsed.error), null);
            }
            finish(null, parsed);
        });
    });

    req.on("error", function (err) {
        console.error("[RMTO] Request error:", err.message);
        var msg = err.message || String(err);
        if (err.code === "EADDRNOTAVAIL") {
            msg = "IP مبدا روی سرور موجود نیست (EADDRNOTAVAIL): " + (effectiveIp || "");
        } else if (err.code === "ECONNREFUSED") {
            msg = "اتصال به RMTO رد شد (ECONNREFUSED) - فایروال/مسیر شبکه را بررسی کنید";
        } else if (err.code === "ETIMEDOUT" || err.code === "ESOCKETTIMEDOUT") {
            msg = "اتصال به RMTO تایم‌اوت شد - مسیر شبکه از IP مبدا را بررسی کنید";
        } else if (err.code === "ENOTFOUND") {
            msg = "DNS نام میزبان RMTO پیدا نشد: " + (options.hostname || "");
        }
        finish(new Error(msg), null);
    });

    req.setTimeout(20000, function () {
        req.destroy();
        finish(new Error("RMTO request timeout (20s)"), null);
    });

    req.write(soapEnvelope);
    req.end();
}

/**
 * Parse RMTO SOAP response XML to extract Re object fields.
 * Fields: ID, FID, CFL, SRVDT, DLY, BIL, ERR
 */
function parseReResponse(xml) {
    function extractTag(tag) {
        var re = new RegExp("<" + tag + ">([^<]*)</" + tag + ">", "i");
        var m = xml.match(re);
        return m ? m[1] : null;
    }

    // Check for SOAP fault
    var faultMatch = xml.match(/<faultstring>([^<]*)<\/faultstring>/i);
    if (faultMatch) {
        return { error: faultMatch[1], ID: 0, FID: 0, CFL: 0 };
    }

    // Check for more detailed error
    var detailMatch = xml.match(/<(?:\w+:)?Text[^>]*>([^<]*)<\/(?:\w+:)?Text>/i);

    return {
        ID: parseInt(extractTag("ID")) || 0,
        FID: parseInt(extractTag("FID")) || 0,
        CFL: parseInt(extractTag("CFL")) || 0,
        SRVDT: extractTag("SRVDT") || "",
        DLY: parseInt(extractTag("DLY")) || 0,
        BIL: parseInt(extractTag("BIL")) || 0,
        ERR: extractTag("ERR") || (detailMatch ? detailMatch[1] : "")
    };
}

/**
 * Add - Simple traffic data (per PDF: ADD DATA_WEB SERVICE_1.02)
 *
 * SOAP body example from PDF:
 *   <Add xmlns="ITS">
 *     <CID>30</CID><UID>USER NAME</UID><PWD>PASSWORD</PWD>
 *     <FID>102030</FID><RID>405060</RID>
 *     <ST>2014-09-07T09:45:00</ST><ET>2014-09-07T10:00:00</ET>
 *     <C1>15</C1><C2>8</C2><C3>17</C3><C4>6</C4><C5>11</C5>
 *     <ASP>91</ASP><SO>3</SO><OO>0</OO><ESD>7</ESD>
 *   </Add>
 *
 * callback(err, response, soapXml)
 */
function sendAddData(data, callback) {
    loadDbSettings();

    var cid = parseInt(COMPANY_CODE, 10) || 0;
    var fid = parseInt(data.FID, 10) || 0;
    var rid = parseInt(data.RID, 10) || 0;
    var st = formatDateTime(data.ST);
    var et = formatDateTime(data.ET);

    // Validate RID - must be a positive integer (RMTO route code)
    if (!rid || rid <= 0) {
        return callback(new Error("RID نامعتبر: '" + data.RID + "' - کد محور باید عدد مثبت باشد. لطفا محور دستگاه را بررسی کنید"), null, null);
    }

    var bodyXml =
        '<Add xmlns="ITS">' +
        '<CID>' + cid + '</CID>' +
        '<UID>' + xmlEscape(USERNAME) + '</UID>' +
        '<PWD>' + xmlEscape(PASSWORD) + '</PWD>' +
        '<FID>' + fid + '</FID>' +
        '<RID>' + rid + '</RID>' +
        '<ST>' + st + '</ST>' +
        '<ET>' + et + '</ET>' +
        '<C1>' + (parseInt(data.C1) || 0) + '</C1>' +
        '<C2>' + (parseInt(data.C2) || 0) + '</C2>' +
        '<C3>' + (parseInt(data.C3) || 0) + '</C3>' +
        '<C4>' + (parseInt(data.C4) || 0) + '</C4>' +
        '<C5>' + (parseInt(data.C5) || 0) + '</C5>' +
        '<ASP>' + (parseInt(data.ASP) || 0) + '</ASP>' +
        '<SO>' + (parseInt(data.SO) || 0) + '</SO>' +
        '<OO>' + (parseInt(data.OO) || 0) + '</OO>' +
        '<ESD>' + (parseInt(data.ESD) || 0) + '</ESD>' +
        '</Add>';

    console.log("[RMTO] Add request: CID=" + cid + " FID=" + fid + " RID=" + rid + " ST=" + st + " ET=" + et);

    sendSoapRequest("ITS/Add", bodyXml, data.sourceIp !== undefined ? data.sourceIp : null, callback);
}

/**
 * Add5 - 5-class traffic data (per PDF: ADD DATA5_WEB SERVICE_1.01)
 *
 * SOAP body example from PDF:
 *   <Add5 xmlns="ITS">
 *     <CID>6</CID><UID>USERNAME</UID><PWD>PASSWORD</PWD>
 *     <FID>0</FID><RID>102030</RID>
 *     <ST>2009-02-24T14:55:00</ST><ET>2009-02-24T15:00:00</ET>
 *     <C1>500</C1><C2>50</C2><C3>0</C3><C4>10</C4><C5>5</C5>
 *     <ASP>74</ASP>
 *     <S1>80</S1><S2>70</S2><S3>60</S3><S4>50</S4><S5>40</S5>
 *     <SSO>50</SSO><SO1>25</SO1><SO2>13</SO2><SO3>7</SO3><SO4>5</SO4>
 *     <SO5 xsi:nil="true"/>
 *     <OO>7</OO><ESD>7</ESD>
 *   </Add5>
 *
 * Per PDF: All numeric fields are Nullable<ushort>.
 * null = device did not measure this field (all fields null = skip record).
 * 0 = device measured but found no instances.
 * Per C# reference: SO5 should be numeric (not null) when data exists.
 * SSO must equal SO1+SO2+SO3+SO4+SO5 (RMTO validates this sum).
 *
 * callback(err, response, soapXml)
 */
function sendAddData5(data, callback) {
    loadDbSettings();

    var cid = parseInt(COMPANY_CODE, 10) || 0;
    var fid = parseInt(data.FID, 10) || 0;
    var rid = parseInt(data.RID, 10) || 0;
    var st = formatDateTime(data.ST);
    var et = formatDateTime(data.ET);

    // Validate RID - must be a positive integer (RMTO route code)
    if (!rid || rid <= 0) {
        return callback(new Error("RID نامعتبر: '" + data.RID + "' - کد محور باید عدد مثبت باشد. لطفا محور دستگاه را بررسی کنید"), null, null);
    }

    var bodyXml =
        '<Add5 xmlns="ITS">' +
        '<CID>' + cid + '</CID>' +
        '<UID>' + xmlEscape(USERNAME) + '</UID>' +
        '<PWD>' + xmlEscape(PASSWORD) + '</PWD>' +
        '<FID>' + fid + '</FID>' +
        '<RID>' + rid + '</RID>' +
        '<ST>' + st + '</ST>' +
        '<ET>' + et + '</ET>' +
        xmlElement("C1", valOrNull(data.C1)) +
        xmlElement("C2", valOrNull(data.C2)) +
        xmlElement("C3", valOrNull(data.C3)) +
        xmlElement("C4", valOrNull(data.C4)) +
        xmlElement("C5", valOrNull(data.C5)) +
        xmlElement("ASP", valOrNull(data.ASP)) +
        xmlElement("S1", valOrNull(data.S1)) +
        xmlElement("S2", valOrNull(data.S2)) +
        xmlElement("S3", valOrNull(data.S3)) +
        xmlElement("S4", valOrNull(data.S4)) +
        xmlElement("S5", valOrNull(data.S5)) +
        xmlElement("SSO", valOrNull(data.SSO)) +
        xmlElement("SO1", valOrNull(data.SO1)) +
        xmlElement("SO2", valOrNull(data.SO2)) +
        xmlElement("SO3", valOrNull(data.SO3)) +
        xmlElement("SO4", valOrNull(data.SO4)) +
        xmlElement("SO5", valOrNull(data.SO5)) +
        xmlElement("OO", valOrNull(data.OO)) +
        xmlElement("ESD", valOrNull(data.ESD)) +
        '</Add5>';

    console.log("[RMTO] Add5 request: CID=" + cid + " FID=" + fid + " RID=" + rid + " ST=" + st + " ET=" + et +
        " C1=" + data.C1 + " C2=" + data.C2 + " C3=" + data.C3 + " C4=" + data.C4 + " C5=" + data.C5);

    sendSoapRequest("ITS/Add5", bodyXml, data.sourceIp !== undefined ? data.sourceIp : null, callback);
}

/**
 * Convert value to integer or null. Keeps 0 as 0 (not null).
 */
function valOrNull(v) {
    if (v === null || v === undefined) return null;
    var n = parseInt(v);
    return isNaN(n) ? null : n;
}

/**
 * Stub initClient for backward compatibility (no longer needed with raw HTTP).
 */
function initClient(callback) {
    callback(null);
}

module.exports = {
    initClient: initClient,
    sendAddData: sendAddData,
    sendAddData5: sendAddData5,
    getSourceIp: getSourceIp,
    listLocalIPv4: listLocalIPv4,
    validateSourceIp: validateSourceIp,
    loadDbSettings: loadDbSettings
};
