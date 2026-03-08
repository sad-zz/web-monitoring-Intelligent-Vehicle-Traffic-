/**
 * RMTO SOAP Client
 * Sends traffic data to otf.rmto.ir/Companies/Companies.asmx
 *
 * SOAP namespace: xmlns="ITS"
 * WSDL: http://otf.rmto.ir/Companies/Companies.asmx?WSDL
 *
 * Methods:
 *   - AddData  (v1.02): Simple total count + avg speed per 15-min period
 *   - AddData5 (v1.01): 5-class volume + 5-class speed + violations
 *   - AddData8 (v1.00): 8-class volume + 8-class speed + violations
 *
 * Expected SOAP XML format (AddData5 example):
 *   <soap:Envelope xmlns:xsi="..." xmlns:xsd="..." xmlns:soap="...">
 *     <soap:Body>
 *       <AddData5 xmlns="ITS">
 *         <CompanyCode>58</CompanyCode>
 *         <UserName>...</UserName>
 *         <Password>...</Password>
 *         <StationCode>0102</StationCode>
 *         <StartDateTime>2009-02-24T14:55:00</StartDateTime>
 *         <EndDateTime>2009-02-24T15:00:00</EndDateTime>
 *         <C1>500</C1> ... <C5>480</C5>
 *         <S1>70</S1> ... <S5>50</S5>
 *         <Violation>25</Violation>
 *         <Speed>13</Speed>
 *       </AddData5>
 *     </soap:Body>
 *   </soap:Envelope>
 */
var soap = require("soap");
var db = require("./db");

var WSDL_URL = process.env.RMTO_WSDL || "http://otf.rmto.ir/Companies/Companies.asmx?WSDL";
var COMPANY_CODE = process.env.RMTO_COMPANY_CODE || "58";
var USERNAME = process.env.RMTO_USERNAME || "";
var PASSWORD = process.env.RMTO_PASSWORD || "";

var soapClient = null;
var wsdlDescription = null;

/**
 * Load RMTO settings from database (overrides env vars).
 * Called before each send to pick up UI changes.
 */
function loadDbSettings() {
    try {
        var rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('rmto_company_code', 'rmto_username', 'rmto_password', 'rmto_wsdl')").all();
        var s = {};
        rows.forEach(function (r) { s[r.key] = r.value; });
        if (s.rmto_company_code) COMPANY_CODE = s.rmto_company_code;
        if (s.rmto_username !== undefined) USERNAME = s.rmto_username;
        if (s.rmto_password !== undefined) PASSWORD = s.rmto_password;
        if (s.rmto_wsdl && s.rmto_wsdl !== WSDL_URL) {
            WSDL_URL = s.rmto_wsdl;
            soapClient = null; // force re-creation with new URL
            wsdlDescription = null;
        }
    } catch (e) {
        console.error("[RMTO] Failed to load DB settings:", e.message);
    }
}

/**
 * Initialize SOAP client (called once at startup).
 */
function initClient(callback) {
    if (soapClient) return callback(null, soapClient);

    soap.createClient(WSDL_URL, function (err, client) {
        if (err) {
            console.error("[RMTO] Failed to create SOAP client:", err.message);
            return callback(err);
        }
        soapClient = client;
        console.log("[RMTO] SOAP client initialized");
        // Auto-detect binding name and log full WSDL description
        var desc = client.describe();
        wsdlDescription = desc;
        var serviceName = Object.keys(desc)[0];
        if (serviceName) {
            var portName = Object.keys(desc[serviceName])[0];
            if (portName) {
                console.log("[RMTO] Service=" + serviceName + " Port=" + portName);
                var methods = desc[serviceName][portName];
                console.log("[RMTO] Available methods:", Object.keys(methods));
                // Log parameter details for each method
                Object.keys(methods).forEach(function (methodName) {
                    var params = methods[methodName];
                    if (params && params.input) {
                        console.log("[RMTO] " + methodName + " parameters:", JSON.stringify(params.input));
                    }
                });
            } else {
                console.log("[RMTO] WARNING: No SOAP port found in service " + serviceName);
            }
        } else {
            console.log("[RMTO] WARNING: No SOAP service found in WSDL - check URL: " + WSDL_URL);
        }
        callback(null, client);
    });
}

/**
 * Get the WSDL description (for diagnostics/preview).
 * @returns {object|null} The WSDL description or null if not yet loaded.
 */
function getWsdlDescription() {
    return wsdlDescription;
}

/**
 * Get the last SOAP XML that was sent (for diagnostics).
 * @returns {string|null}
 */
function getLastRequestXml() {
    if (soapClient) {
        return soapClient.lastRequest || null;
    }
    return null;
}

/**
 * AddData (v1.02) - Simple traffic data
 * @param {object} data
 * @param {string} data.deviceCode     - Device/station code
 * @param {string} data.startDateTime  - Period start "YYYY-MM-DDTHH:mm:ss"
 * @param {string} data.endDateTime    - Period end "YYYY-MM-DDTHH:mm:ss"
 * @param {number} data.totalCount     - Total vehicles in period
 * @param {number} data.avgSpeed       - Average speed in period
 */
function sendAddData(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CompanyCode: COMPANY_CODE,
            UserName: USERNAME,
            Password: PASSWORD,
            StationCode: data.deviceCode,
            StartDateTime: data.startDateTime,
            EndDateTime: data.endDateTime,
            Count: data.totalCount,
            Speed: Math.round(data.avgSpeed)
        };

        console.log("[RMTO] AddData request:", JSON.stringify(args));

        soapClient.AddData(args, function (err, result) {
            var lastXml = soapClient.lastRequest;
            if (lastXml) {
                console.log("[RMTO] AddData SOAP XML sent:\n" + lastXml);
            }
            if (err) {
                console.error("[RMTO] AddData error:", err.message);
                return callback(err, null, lastXml);
            }
            var response = result && result.AddDataResult;
            console.log("[RMTO] AddData response:", response);
            callback(null, response, lastXml);
        });
    });
}

/**
 * AddData5 (v1.01) - 5-class traffic data
 * @param {object} data
 * @param {string} data.deviceCode
 * @param {string} data.startDateTime  - Period start "YYYY-MM-DDTHH:mm:ss"
 * @param {string} data.endDateTime    - Period end "YYYY-MM-DDTHH:mm:ss"
 * @param {number} data.class1Count .. data.class5Count  (volume by vehicle class)
 * @param {number} data.speed1Count .. data.speed5Count  (count by speed range)
 * @param {number} data.violations
 * @param {number} data.avgSpeed
 */
function sendAddData5(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CompanyCode: COMPANY_CODE,
            UserName: USERNAME,
            Password: PASSWORD,
            StationCode: data.deviceCode,
            StartDateTime: data.startDateTime,
            EndDateTime: data.endDateTime,
            // 5 volume classes
            C1: data.class1Count || 0,
            C2: data.class2Count || 0,
            C3: data.class3Count || 0,
            C4: data.class4Count || 0,
            C5: data.class5Count || 0,
            // 5 speed classes
            S1: data.speed1Count || 0,
            S2: data.speed2Count || 0,
            S3: data.speed3Count || 0,
            S4: data.speed4Count || 0,
            S5: data.speed5Count || 0,
            // Violation & speed
            Violation: data.violations || 0,
            Speed: Math.round(data.avgSpeed || 0)
        };

        console.log("[RMTO] AddData5 request:", JSON.stringify(args));

        soapClient.AddData5(args, function (err, result) {
            var lastXml = soapClient.lastRequest;
            if (lastXml) {
                console.log("[RMTO] AddData5 SOAP XML sent:\n" + lastXml);
            }
            if (err) {
                console.error("[RMTO] AddData5 error:", err.message);
                return callback(err, null, lastXml);
            }
            var response = result && result.AddData5Result;
            console.log("[RMTO] AddData5 response:", response);
            callback(null, response, lastXml);
        });
    });
}

/**
 * AddData8 (v1.00) - 8-class traffic data
 * @param {object} data
 * @param {string} data.deviceCode
 * @param {string} data.startDateTime  - Period start "YYYY-MM-DDTHH:mm:ss"
 * @param {string} data.endDateTime    - Period end "YYYY-MM-DDTHH:mm:ss"
 * @param {number} data.class1Count .. data.class8Count
 * @param {number} data.speed1Count .. data.speed8Count
 * @param {number} data.violations
 * @param {number} data.avgSpeed
 */
function sendAddData8(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CompanyCode: COMPANY_CODE,
            UserName: USERNAME,
            Password: PASSWORD,
            StationCode: data.deviceCode,
            StartDateTime: data.startDateTime,
            EndDateTime: data.endDateTime,
            C1: data.class1Count || 0,
            C2: data.class2Count || 0,
            C3: data.class3Count || 0,
            C4: data.class4Count || 0,
            C5: data.class5Count || 0,
            C6: data.class6Count || 0,
            C7: data.class7Count || 0,
            C8: data.class8Count || 0,
            S1: data.speed1Count || 0,
            S2: data.speed2Count || 0,
            S3: data.speed3Count || 0,
            S4: data.speed4Count || 0,
            S5: data.speed5Count || 0,
            S6: data.speed6Count || 0,
            S7: data.speed7Count || 0,
            S8: data.speed8Count || 0,
            Violation: data.violations || 0,
            Speed: Math.round(data.avgSpeed || 0)
        };

        console.log("[RMTO] AddData8 request:", JSON.stringify(args));

        soapClient.AddData8(args, function (err, result) {
            var lastXml = soapClient.lastRequest;
            if (lastXml) {
                console.log("[RMTO] AddData8 SOAP XML sent:\n" + lastXml);
            }
            if (err) {
                console.error("[RMTO] AddData8 error:", err.message);
                return callback(err, null, lastXml);
            }
            var response = result && result.AddData8Result;
            console.log("[RMTO] AddData8 response:", response);
            callback(null, response, lastXml);
        });
    });
}

function ensureClient(callback) {
    loadDbSettings();
    if (soapClient) return callback(null);
    initClient(function (err) { callback(err); });
}

module.exports = {
    initClient: initClient,
    sendAddData: sendAddData,
    sendAddData5: sendAddData5,
    sendAddData8: sendAddData8,
    getWsdlDescription: getWsdlDescription,
    getLastRequestXml: getLastRequestXml
};
