/**
 * RMTO SOAP Client
 * Sends traffic data to otf.rmto.ir/Companies/Companies.asmx
 *
 * Methods:
 *   - Add   (v1.02): Simple total count + avg speed per period
 *   - Add5  (v1.01): 5-class volume + 5-class speed + violations
 *   - Add8  (v1.00): 8-class volume + 8-class speed + violations
 *
 * Callback signature: callback(err, response, soapXml)
 *   soapXml = the raw SOAP XML envelope that was sent to RMTO
 */
var soap = require("soap");
var db = require("./db");

var WSDL_URL = process.env.RMTO_WSDL || "http://otf.rmto.ir/Companies/Companies.asmx?WSDL";
var COMPANY_CODE = process.env.RMTO_COMPANY_CODE || "58";
var USERNAME = process.env.RMTO_USERNAME || "";
var PASSWORD = process.env.RMTO_PASSWORD || "";

var soapClient = null;

/**
 * Convert local ISO string (e.g. "2026-03-10T08:00:00") to proper SOAP dateTime.
 * RMTO expects DateTime format like "2026-03-10T08:00:00" (no timezone suffix needed,
 * as the C# reference sends local DateTime without explicit timezone).
 */
function toSoapDateTime(str) {
    if (!str) return new Date().toISOString();
    // If already in ISO-like format, ensure it's a proper Date for node-soap serialization
    var d = new Date(str);
    if (isNaN(d.getTime())) return str;
    // Return as Date object - node-soap serializes Date objects to proper xs:dateTime
    return d;
}

/**
 * Load RMTO settings from database (overrides env vars).
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
            soapClient = null;
        }
    } catch (e) {
        console.error("[RMTO] Failed to load DB settings:", e.message);
    }
}

/**
 * Initialize SOAP client.
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
        var desc = client.describe();
        var serviceName = Object.keys(desc)[0];
        if (serviceName) {
            var portName = Object.keys(desc[serviceName])[0];
            if (portName) {
                console.log("[RMTO] Service=" + serviceName + " Port=" + portName);
                console.log("[RMTO] Available methods:", Object.keys(desc[serviceName][portName]));
            }
        }
        callback(null, client);
    });
}

/**
 * Add - Simple traffic data (C1-C5 classes + ASP + SO + OO + ESD)
 * callback(err, response, soapXml)
 */
function sendAddData(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CID: parseInt(COMPANY_CODE) || 0,
            UID: USERNAME,
            PWD: PASSWORD,
            FID: parseInt(data.FID) || 0,
            RID: parseInt(data.RID) || 0,
            ST: toSoapDateTime(data.ST),
            ET: toSoapDateTime(data.ET),
            C1: data.C1 || 0,
            C2: data.C2 || 0,
            C3: data.C3 || 0,
            C4: data.C4 || 0,
            C5: data.C5 || 0,
            ASP: data.ASP || 0,
            SO: data.SO || 0,
            OO: data.OO || 0,
            ESD: data.ESD || 0
        };

        console.log("[RMTO] Add request:", JSON.stringify(args));

        soapClient.Add(args, function (err, result) {
            var xml = soapClient.lastRequest || "";
            if (err) {
                console.error("[RMTO] Add error:", err.message);
                return callback(err, null, xml);
            }
            var response = result && result.AddResult;
            console.log("[RMTO] Add response:", JSON.stringify(response));
            callback(null, response, xml);
        });
    });
}

/**
 * Add5 - 5-class traffic data
 *
 * RMTO expected SOAP body:
 *   <Add5 xmlns="ITS">
 *     <CID>80</CID> <UID>user</UID> <PWD>pass</PWD>
 *     <FID>0</FID> <RID>102030</RID>
 *     <ST>2009-02-24T14:55:00</ST> <ET>2009-02-24T15:00:00</ET>
 *     <C1>500</C1><C2>50</C2><C3>0</C3><C4>10</C4><C5>5</C5>
 *     <ASP>74</ASP>
 *     <S1>80</S1><S2>70</S2><S3>60</S3><S4>50</S4><S5>40</S5>
 *     <SSO>50</SSO><SO1>25</SO1><SO2>13</SO2><SO3>7</SO3><SO4>5</SO4><SO5 xsi:nil="true"/>
 *     <OO>7</OO><ESD>7</ESD>
 *   </Add5>
 *
 * callback(err, response, soapXml)
 */
function sendAddData5(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CID: parseInt(COMPANY_CODE) || 0,
            UID: USERNAME,
            PWD: PASSWORD,
            FID: parseInt(data.FID) || 0,
            RID: parseInt(data.RID) || 0,
            ST: toSoapDateTime(data.ST),
            ET: toSoapDateTime(data.ET),
            C1: data.C1 || 0,
            C2: data.C2 || 0,
            C3: data.C3 || 0,
            C4: data.C4 || 0,
            C5: data.C5 || 0,
            ASP: data.ASP || 0,
            S1: data.S1 || 0,
            S2: data.S2 || 0,
            S3: data.S3 || 0,
            S4: data.S4 || 0,
            S5: data.S5 || 0,
            SSO: data.SSO || 0,
            SO1: data.SO1 || 0,
            SO2: data.SO2 || 0,
            SO3: data.SO3 || 0,
            SO4: data.SO4 || 0,
            SO5: data.SO5 != null ? data.SO5 : null,
            OO: data.OO || 0,
            ESD: data.ESD || 0
        };

        console.log("[RMTO] Add5 request:", JSON.stringify(args));

        soapClient.Add5(args, function (err, result) {
            var xml = soapClient.lastRequest || "";
            if (err) {
                console.error("[RMTO] Add5 error:", err.message);
                return callback(err, null, xml);
            }
            var response = result && result.Add5Result;
            console.log("[RMTO] Add5 response:", JSON.stringify(response));
            callback(null, response, xml);
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
    sendAddData5: sendAddData5
};
