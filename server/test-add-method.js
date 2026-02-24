#!/usr/bin/env node
/**
 * Simple test for RMTO Add method
 * Tests sending basic traffic data to RMTO
 */

var rmto = require('./rmto-client.js');

console.log('============================================================');
console.log('Testing RMTO Add Method');
console.log('============================================================');

// استفاده از تاریخ فعلی سرور
var currentDateTime = rmto.getCurrentDateTime();

var testData = {
    deviceCode: '1001',
    dateTime: currentDateTime,  // تاریخ واقعی سرور
    totalCount: 45,
    avgSpeed: 85
};

console.log('\nCurrent Server DateTime:', currentDateTime);
console.log('Test data:', JSON.stringify(testData, null, 2));

rmto.sendAddData(testData, function(err, result) {
    console.log('\n============================================================');
    
    if (err) {
        console.log('[ERROR] Test FAILED');
        console.log('Error message:', err.message);
        if (err.root && err.root.Envelope && err.root.Envelope.Body && err.root.Envelope.Body.Fault) {
            console.log('SOAP Fault:', JSON.stringify(err.root.Envelope.Body.Fault, null, 2));
        }
        console.log('============================================================\n');
        process.exit(1);
    }
    
    console.log('[OK] Test PASSED');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('============================================================\n');
    process.exit(0);
});
