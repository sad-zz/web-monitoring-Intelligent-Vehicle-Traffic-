/**
 * RMTO SOAP Client
 * Sends traffic data to otf.rmto.ir/Companies/Companies.asmx
 *
 * Methods:
 *   - AddData  (v1.02): Simple total count + avg speed per 15-min period
 *   - AddData5 (v1.01): 5-class volume + 5-class speed + violations
 *   - AddData8 (v1.00): 8-class volume + 8-class speed + violations
 */
var soap = require("soap");
var db = require("./db");

var WSDL_URL = process.env.RMTO_WSDL || "http://otf.rmto.ir/Companies/Companies.asmx?WSDL";
var COMPANY_CODE = process.env.RMTO_COMPANY_CODE || "58";
var USERNAME = process.env.RMTO_USERNAME || "";
var PASSWORD = process.env.RMTO_PASSWORD || "";

var soapClient = null;

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
        // Auto-detect binding name (could be CompanySoap, CompaniesSoap, etc.)
        var desc = client.describe();
        var serviceName = Object.keys(desc)[0];
        if (serviceName) {
            var portName = Object.keys(desc[serviceName])[0];
            if (portName) {
                console.log("[RMTO] Service=" + serviceName + " Port=" + portName);
                console.log("[RMTO] Available methods:", Object.keys(desc[serviceName][portName]));
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
 * Add (v1.02) - Simple traffic data
 *
 * RMTO expects route/mehvar code as FID, NOT device serial number.
 *
 * @param {object} data
 * @param {string} data.FID        - Route/mehvar code (e.g. "613151")
 * @param {string} data.ST         - Start time "YYYY-MM-DDTHH:mm:00"
 * @param {string} data.ET         - End time "YYYY-MM-DDTHH:mm:00"
 * @param {number} data.totalCount - Total vehicles in period
 * @param {number} data.avgSpeed   - Average speed in period
 */
function sendAddData(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CID: parseInt(COMPANY_CODE) || 0,
            UID: USERNAME,
            PWD: PASSWORD,
            FID: parseInt(data.FID) || 0,
            ST: data.ST,
            ET: data.ET,
            Count: data.totalCount || 0,
            Speed: Math.round(data.avgSpeed || 0)
        };

        console.log("[RMTO] Add request:", JSON.stringify(args));

        soapClient.Add(args, function (err, result) {
            if (err) {
                console.error("[RMTO] Add error:", err.message);
                return callback(err, null);
            }
            var response = result && result.AddResult;
            console.log("[RMTO] Add response:", response);
            callback(null, response);
        });
    });
}

/**
 * AddData5 → RMTO "Add5" method (v1.01) - 5-class traffic data
 *
 * Expected SOAP body by RMTO:
 *   <Add5 xmlns="ITS">
 *     <CID>companyId</CID> <UID>user</UID> <PWD>pass</PWD>
 *     <FID>0</FID> <RID>routeId</RID>
 *     <ST>startTime</ST> <ET>endTime</ET>
 *     <C1>..</C1> <C2>..</C2> <C3>..</C3> <C4>..</C4> <C5>..</C5>
 *     <ASP>avgSpeed</ASP>
 *     <S1>..</S1> <S2>..</S2> <S3>..</S3> <S4>..</S4> <S5>..</S5>
 *     <SSO>totalViolations</SSO>
 *     <SO1>..</SO1> <SO2>..</SO2> <SO3>..</SO3> <SO4>..</SO4> <SO5 xsi:nil="true"/>
 *     <OO>overtaking</OO> <ESD>tooClose</ESD>
 *   </Add5>
 *
 * @param {object} data
 * @param {string} data.RID        - Route ID (mehvar code, e.g. "102030")
 * @param {string} data.ST         - Start time "YYYY-MM-DDTHH:mm:00"
 * @param {string} data.ET         - End time "YYYY-MM-DDTHH:mm:00"
 * @param {number} data.C1..C5     - Vehicle counts by class
 * @param {number} data.ASP        - Average speed (all classes)
 * @param {number} data.S1..S5     - Average speed per class
 * @param {number} data.SSO        - Total speed violations
 * @param {number} data.SO1..SO5   - Speed violations per class (SO5 can be null)
 * @param {number} data.OO         - Overtaking count
 * @param {number} data.ESD        - Too-close (headway) count
 */
function sendAddData5(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CID: parseInt(COMPANY_CODE) || 0,
            UID: USERNAME,
            PWD: PASSWORD,
            FID: 0,
            RID: parseInt(data.RID) || 0,
            ST: data.ST,
            ET: data.ET,
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
            if (err) {
                console.error("[RMTO] Add5 error:", err.message);
                return callback(err, null);
            }
            var response = result && result.Add5Result;
            console.log("[RMTO] Add5 response:", response);
            callback(null, response);
        });
    });
}

/**
 * AddData8 (v1.00) - 8-class traffic data
 * @param {object} data
 * @param {string} data.deviceCode
 * @param {string} data.dateTime
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
            DateTime: data.dateTime,
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
            if (err) {
                console.error("[RMTO] AddData8 error:", err.message);
                return callback(err, null);
            }
            var response = result && result.AddData8Result;
            console.log("[RMTO] AddData8 response:", response);
            callback(null, response);
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
    sendAddData8: sendAddData8
};
