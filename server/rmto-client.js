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

var WSDL_URL = process.env.RMTO_WSDL || "http://otf.rmto.ir/Companies/Companies.asmx?WSDL";
var COMPANY_CODE = process.env.RMTO_COMPANY_CODE || "58";
var USERNAME = process.env.RMTO_USERNAME || "";
var PASSWORD = process.env.RMTO_PASSWORD || "";

var soapClient = null;

/**
 * تبدیل DateTime از فرمت string به Unix timestamp (Int32)
 * @param {string} dateTimeStr - Format: "YYYY/MM/DD HH:mm"
 * @returns {number} Unix timestamp (seconds since 1970-01-01)
 */
function convertDateTimeToInt32(dateTimeStr) {
    try {
        // Parse "2024/02/23 14:30"
        var parts = dateTimeStr.trim().split(' ');
        if (parts.length !== 2) {
            throw new Error('Invalid DateTime format. Expected "YYYY/MM/DD HH:mm"');
        }
        
        var dateParts = parts[0].split('/');
        var timeParts = parts[1].split(':');
        
        if (dateParts.length !== 3 || timeParts.length !== 2) {
            throw new Error('Invalid DateTime format. Expected "YYYY/MM/DD HH:mm"');
        }
        
        var year = parseInt(dateParts[0], 10);
        var month = parseInt(dateParts[1], 10) - 1; // 0-indexed
        var day = parseInt(dateParts[2], 10);
        var hour = parseInt(timeParts[0], 10);
        var minute = parseInt(timeParts[1], 10);
        
        // Create date object
        var date = new Date(year, month, day, hour, minute, 0, 0);
        
        // Convert to Unix timestamp (seconds)
        var timestamp = Math.floor(date.getTime() / 1000);
        
        console.log('[RMTO] DateTime conversion:', dateTimeStr, '->', timestamp);
        
        return timestamp;
    } catch (e) {
        console.error('[RMTO] DateTime conversion error:', e.message);
        console.error('[RMTO] Input was:', dateTimeStr);
        // Fallback: return current timestamp
        return Math.floor(Date.now() / 1000);
    }
}

/**
 * Initialize SOAP client (called once at startup).
 */
function initClient(callback) {
    if (soapClient) return callback(null, soapClient);

    console.log("[RMTO] Initializing SOAP client...");
    console.log("[RMTO] WSDL URL:", WSDL_URL);
    console.log("[RMTO] Company Code:", COMPANY_CODE);
    console.log("[RMTO] Username:", USERNAME);

    soap.createClient(WSDL_URL, {
        wsdl_options: {
            timeout: 30000,
            rejectUnauthorized: false
        }
    }, function (err, client) {
        if (err) {
            console.error("[RMTO] Failed to create SOAP client:");
            console.error("[RMTO] Error message:", err.message);
            console.error("[RMTO] Error code:", err.code);
            if (err.stack) {
                console.error("[RMTO] Stack trace:", err.stack);
            }
            return callback(err);
        }
        soapClient = client;
        console.log("[RMTO] SOAP client initialized successfully");
        
        var services = client.describe();
        console.log("[RMTO] Available services:", Object.keys(services));
        if (services.CompanySoap) {
            console.log("[RMTO] Available methods:", Object.keys(services.CompanySoap || {}));
        }
        
        callback(null, client);
    });
}

/**
 * AddData (v1.02) - Simple traffic data
 * @param {object} data
 * @param {string} data.deviceCode - 4-digit device code
 * @param {string} data.dateTime   - Period date/time "YYYY/MM/DD HH:mm"
 * @param {number} data.totalCount - Total vehicles in period
 * @param {number} data.avgSpeed   - Average speed in period
 */
function sendAddData(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CompanyCode: COMPANY_CODE,
            UserName: USERNAME,
            Password: PASSWORD,
            StationCode: data.deviceCode,
            DateTime: convertDateTimeToInt32(data.dateTime),  // تبدیل به Int32
            Count: data.totalCount,
            Speed: Math.round(data.avgSpeed)
        };

        console.log("[RMTO] AddData request:", JSON.stringify(args));

        soapClient.AddData(args, function (err, result) {
            if (err) {
                console.error("[RMTO] AddData error:", err.message);
                return callback(err, null);
            }
            var response = result && result.AddDataResult;
            console.log("[RMTO] AddData response:", response);
            callback(null, response);
        });
    });
}

/**
 * AddData5 (v1.01) - 5-class traffic data
 * @param {object} data
 * @param {string} data.deviceCode
 * @param {string} data.dateTime
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
            DateTime: convertDateTimeToInt32(data.dateTime),  // تبدیل به Int32
            // 5 volume classes
            C1: parseInt(data.class1Count) || 0,
            C2: parseInt(data.class2Count) || 0,
            C3: parseInt(data.class3Count) || 0,
            C4: parseInt(data.class4Count) || 0,
            C5: parseInt(data.class5Count) || 0,
            // 5 speed classes
            S1: parseInt(data.speed1Count) || 0,
            S2: parseInt(data.speed2Count) || 0,
            S3: parseInt(data.speed3Count) || 0,
            S4: parseInt(data.speed4Count) || 0,
            S5: parseInt(data.speed5Count) || 0,
            // Violation & speed
            Violation: parseInt(data.violations) || 0,
            Speed: Math.round(data.avgSpeed || 0)
        };

        console.log("[RMTO] AddData5 request:", JSON.stringify(args));

        soapClient.AddData5(args, function (err, result, rawResponse, soapHeader, rawRequest) {
            if (err) {
                console.error("[RMTO] AddData5 error:", err.message);
                console.error("[RMTO] Error code:", err.code);
                
                // Log SOAP fault details
                if (err.root && err.root.Envelope && err.root.Envelope.Body && err.root.Envelope.Body.Fault) {
                    var fault = err.root.Envelope.Body.Fault;
                    console.error("[RMTO] SOAP Fault:");
                    console.error("  faultcode:", fault.faultcode);
                    console.error("  faultstring:", fault.faultstring);
                    if (fault.detail) {
                        console.error("  detail:", JSON.stringify(fault.detail));
                    }
                }
                
                // Log HTTP response if available
                if (err.response) {
                    console.error("[RMTO] HTTP Status:", err.response.statusCode);
                    console.error("[RMTO] Response Body:", err.response.body);
                }
                
                // Log the request XML for debugging
                if (rawRequest) {
                    console.error("[RMTO] Request XML:", rawRequest);
                }
                
                return callback(err, null);
            }
            var response = result && result.AddData5Result;
            console.log("[RMTO] AddData5 response:", response);
            console.log("[RMTO] Raw response:", rawResponse);
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
            DateTime: convertDateTimeToInt32(data.dateTime),  // تبدیل به Int32
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
    if (soapClient) return callback(null);
    initClient(function (err) { callback(err); });
}

module.exports = {
    initClient: initClient,
    sendAddData: sendAddData,
    sendAddData5: sendAddData5,
    sendAddData8: sendAddData8
};
