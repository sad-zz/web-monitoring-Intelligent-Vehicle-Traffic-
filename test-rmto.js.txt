/**
 * RMTO SOAP Test Utility
 * Tests connection and API calls to RMTO service
 * 
 * Usage: node test-rmto.js
 */

require("dotenv").config();
var soap = require("soap");

var WSDL_URL = process.env.RMTO_WSDL || "http://otf.rmto.ir/Companies/Companies.asmx?WSDL";
var COMPANY_CODE = process.env.RMTO_COMPANY_CODE || "58";
var USERNAME = process.env.RMTO_USERNAME || "";
var PASSWORD = process.env.RMTO_PASSWORD || "";

console.log("=".repeat(60));
console.log("RMTO SOAP Service Test");
console.log("=".repeat(60));
console.log("WSDL URL:", WSDL_URL);
console.log("Company Code:", COMPANY_CODE);
console.log("Username:", USERNAME);
console.log("Password:", PASSWORD ? "***" : "(empty)");
console.log("");

// Step 1: Create SOAP client
console.log("[1] Creating SOAP client...");
soap.createClient(WSDL_URL, { 
    wsdl_options: {
        timeout: 30000,
        rejectUnauthorized: false
    }
}, function (err, client) {
    if (err) {
        console.error("[ERROR] Failed to create SOAP client:");
        console.error("  Message:", err.message);
        console.error("  Code:", err.code);
        console.error("  Stack:", err.stack);
        process.exit(1);
    }

    console.log("[OK] SOAP client created successfully");
    console.log("");

    // Step 2: Inspect WSDL structure
    console.log("[2] WSDL Structure:");
    var description = client.describe();
    console.log(JSON.stringify(description, null, 2));
    console.log("");

    // Step 3: Test Add5 method
    console.log("[3] Testing AddData5 method...");
    
    // Sample test data
    var testData = {
        CompanyCode: COMPANY_CODE,
        UserName: USERNAME,
        Password: PASSWORD,
        StationCode: "1001", // Test device code
        DateTime: "2024/02/22 12:00", // Format: YYYY/MM/DD HH:mm
        C1: 10, // Class 1 count
        C2: 20, // Class 2 count
        C3: 15, // Class 3 count
        C4: 5,  // Class 4 count
        C5: 3,  // Class 5 count
        S1: 12, // Speed range 1
        S2: 18, // Speed range 2
        S3: 15, // Speed range 3
        S4: 8,  // Speed range 4
        S5: 0,  // Speed range 5
        Violation: 2, // Violations count
        Speed: 85 // Average speed
    };

    console.log("Test parameters:");
    console.log(JSON.stringify(testData, null, 2));
    console.log("");

    // Check if method exists
    if (!client.AddData5) {
        console.error("[ERROR] AddData5 method not found in WSDL");
        console.log("Available methods:", Object.keys(client));
        process.exit(1);
    }

    // Make the call
    client.AddData5(testData, function (err, result, rawResponse, soapHeader, rawRequest) {
        console.log("");
        console.log("=".repeat(60));
        console.log("SOAP Request (Raw XML):");
        console.log("=".repeat(60));
        console.log(rawRequest);
        console.log("");

        if (err) {
            console.log("=".repeat(60));
            console.log("ERROR Response:");
            console.log("=".repeat(60));
            console.error("Message:", err.message);
            console.error("Code:", err.code);
            
            if (err.response) {
                console.error("HTTP Status:", err.response.statusCode);
                console.error("Response Body:", err.response.body);
            }
            
            if (err.root && err.root.Envelope) {
                console.log("SOAP Fault:", JSON.stringify(err.root.Envelope.Body.Fault, null, 2));
            }
            
            console.log("");
            console.log("Full error object:");
            console.log(JSON.stringify(err, null, 2));
            process.exit(1);
        }

        console.log("=".repeat(60));
        console.log("SUCCESS Response:");
        console.log("=".repeat(60));
        console.log("Result:", JSON.stringify(result, null, 2));
        console.log("");
        console.log("Raw Response:");
        console.log(rawResponse);
        console.log("");
        console.log("[OK] AddData5 test completed successfully!");
        process.exit(0);
    });
});
