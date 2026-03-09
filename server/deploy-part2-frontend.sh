#!/bin/bash
# Part 2: Deploy frontend files
set -e
cd /opt/tc-manager

echo "=== Deploying frontend files ==="

mkdir -p css js data

# --- data/devices.js ---
cat > data/devices.js << 'ENDFILE'
/**
 * Sample data - only used when opening index.html without server.
 * When running with server, all data comes from API.
 */
var ROUTE_DATA = [];
var DEVICE_DATA = [];
var REPORT_DATA = [];
ENDFILE

echo "=== Part 2 done: data/devices.js deployed ==="
