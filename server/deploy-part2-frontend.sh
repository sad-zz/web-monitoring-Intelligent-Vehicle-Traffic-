#!/bin/bash
# Part 2: Deploy frontend files
set -e
cd /opt/tc-manager

echo "=== Deploying frontend files ==="

mkdir -p css js data

# --- data/devices.js ---
cat > data/devices.js << 'ENDFILE'
var ROUTE_DATA = [
    { id: "R-001", name: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u06a9\u0631\u062c", origin: "\u062a\u0647\u0631\u0627\u0646", destination: "\u06a9\u0631\u062c", length: 45, deviceCount: 8, status: "online", totalVehicles: 124500, avgSpeed: 95, errors: 2, lastUpdate: "2026-02-15T10:23:00" },
    { id: "R-002", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0647\u0645\u062a", origin: "\u0634\u0631\u0642 \u062a\u0647\u0631\u0627\u0646", destination: "\u063a\u0631\u0628 \u062a\u0647\u0631\u0627\u0646", length: 22, deviceCount: 12, status: "online", totalVehicles: 89200, avgSpeed: 62, errors: 0, lastUpdate: "2026-02-15T10:22:45" },
    { id: "R-003", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0635\u062f\u0631", origin: "\u062a\u062c\u0631\u06cc\u0634", destination: "\u0633\u062a\u0627\u0631\u06cc", length: 18, deviceCount: 6, status: "warning", totalVehicles: 67800, avgSpeed: 48, errors: 3, lastUpdate: "2026-02-15T09:55:00" },
    { id: "R-004", name: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u0642\u0645", origin: "\u062a\u0647\u0631\u0627\u0646", destination: "\u0642\u0645", length: 155, deviceCount: 15, status: "online", totalVehicles: 56300, avgSpeed: 110, errors: 1, lastUpdate: "2026-02-15T10:20:00" },
    { id: "R-005", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0646\u06cc\u0627\u06cc\u0634", origin: "\u0634\u0631\u0642", destination: "\u063a\u0631\u0628", length: 12, deviceCount: 5, status: "online", totalVehicles: 43100, avgSpeed: 55, errors: 0, lastUpdate: "2026-02-15T10:22:30" },
    { id: "R-006", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0634\u06cc\u062e \u0641\u0636\u0644\u200c\u0627\u0644\u0644\u0647", origin: "\u0634\u0645\u0627\u0644", destination: "\u062c\u0646\u0648\u0628", length: 14, deviceCount: 7, status: "online", totalVehicles: 78900, avgSpeed: 58, errors: 0, lastUpdate: "2026-02-15T10:21:00" },
    { id: "R-007", name: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u0634\u0645\u0627\u0644", origin: "\u062a\u0647\u0631\u0627\u0646", destination: "\u0686\u0627\u0644\u0648\u0633", length: 120, deviceCount: 10, status: "error", totalVehicles: 31200, avgSpeed: 75, errors: 5, lastUpdate: "2026-02-15T08:10:00" },
    { id: "R-008", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0686\u0645\u0631\u0627\u0646", origin: "\u0627\u0648\u06cc\u0646", destination: "\u0622\u0631\u0698\u0627\u0646\u062a\u06cc\u0646", length: 10, deviceCount: 4, status: "online", totalVehicles: 52400, avgSpeed: 51, errors: 0, lastUpdate: "2026-02-15T10:23:10" },
    { id: "R-009", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0628\u0639\u062b\u062a", origin: "\u0634\u0631\u0642", destination: "\u063a\u0631\u0628", length: 16, deviceCount: 6, status: "offline", totalVehicles: 0, avgSpeed: 0, errors: 0, lastUpdate: "2026-02-14T23:45:00" },
    { id: "R-010", name: "\u0645\u062d\u0648\u0631 \u0622\u0632\u0627\u062f\u06cc", origin: "\u0645\u06cc\u062f\u0627\u0646 \u0622\u0632\u0627\u062f\u06cc", destination: "\u0645\u06cc\u062f\u0627\u0646 \u0627\u0646\u0642\u0644\u0627\u0628", length: 5, deviceCount: 3, status: "online", totalVehicles: 38700, avgSpeed: 35, errors: 1, lastUpdate: "2026-02-15T10:18:00" },
    { id: "R-011", name: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u06cc\u0627\u062f\u06af\u0627\u0631 \u0627\u0645\u0627\u0645", origin: "\u0634\u0645\u0627\u0644", destination: "\u062c\u0646\u0648\u0628", length: 20, deviceCount: 9, status: "online", totalVehicles: 71600, avgSpeed: 65, errors: 0, lastUpdate: "2026-02-15T10:22:00" },
    { id: "R-012", name: "\u0645\u062d\u0648\u0631 \u0648\u0644\u06cc\u0639\u0635\u0631", origin: "\u062a\u062c\u0631\u06cc\u0634", destination: "\u0631\u0627\u0647\u200c\u0622\u0647\u0646", length: 18, deviceCount: 8, status: "warning", totalVehicles: 45200, avgSpeed: 28, errors: 2, lastUpdate: "2026-02-15T10:10:00" }
];

var DEVICE_DATA = [
    { id: "CAM-001", deviceCode: "1001", name: "\u062f\u0648\u0631\u0628\u06cc\u0646 \u0633\u0631\u0639\u062a \u06a9\u06cc\u0644\u0648\u0645\u062a\u0631 \u06f5", type: "camera", route: "R-001", ip: "192.168.1.10", status: "online", lastSeen: "2026-02-15T10:23:00", firmware: "v3.2.1" },
    { id: "CAM-002", deviceCode: "1002", name: "\u062f\u0648\u0631\u0628\u06cc\u0646 \u067e\u0644\u0627\u06a9\u200c\u062e\u0648\u0627\u0646 \u0648\u0631\u0648\u062f\u06cc", type: "camera", route: "R-001", ip: "192.168.1.11", status: "online", lastSeen: "2026-02-15T10:22:50", firmware: "v3.2.1" },
    { id: "CAM-003", deviceCode: "1003", name: "\u062f\u0648\u0631\u0628\u06cc\u0646 \u0646\u0638\u0627\u0631\u062a\u06cc \u0647\u0645\u062a \u0634\u0631\u0642", type: "camera", route: "R-002", ip: "192.168.1.12", status: "online", lastSeen: "2026-02-15T10:22:30", firmware: "v3.1.5" },
    { id: "CAM-004", deviceCode: "1004", name: "\u062f\u0648\u0631\u0628\u06cc\u0646 \u0633\u0631\u0639\u062a \u0635\u062f\u0631", type: "camera", route: "R-003", ip: "192.168.1.13", status: "warning", lastSeen: "2026-02-15T09:50:00", firmware: "v3.1.5" },
    { id: "SEN-001", deviceCode: "2001", name: "\u0633\u0646\u0633\u0648\u0631 \u062a\u0631\u062f\u062f \u0634\u0645\u0627\u0631 \u06a9\u0631\u062c", type: "sensor", route: "R-001", ip: "192.168.2.10", status: "online", lastSeen: "2026-02-15T10:23:05", firmware: "v2.1.0" },
    { id: "SEN-002", deviceCode: "2002", name: "\u0633\u0646\u0633\u0648\u0631 \u062a\u0631\u062f\u062f \u0634\u0645\u0627\u0631 \u0647\u0645\u062a", type: "sensor", route: "R-002", ip: "192.168.2.11", status: "online", lastSeen: "2026-02-15T10:22:40", firmware: "v2.1.0" },
    { id: "SEN-003", deviceCode: "2003", name: "\u0633\u0646\u0633\u0648\u0631 \u0633\u0631\u0639\u062a \u0646\u06cc\u0627\u06cc\u0634", type: "sensor", route: "R-005", ip: "192.168.2.12", status: "online", lastSeen: "2026-02-15T10:22:20", firmware: "v2.0.8" },
    { id: "SEN-004", deviceCode: "2004", name: "\u0633\u0646\u0633\u0648\u0631 \u0628\u0627\u0631\u0634 \u062a\u0647\u0631\u0627\u0646-\u0634\u0645\u0627\u0644", type: "sensor", route: "R-007", ip: "192.168.2.13", status: "error", lastSeen: "2026-02-15T08:05:00", firmware: "v2.0.8" },
    { id: "TL-001", deviceCode: "3001", name: "\u0686\u0631\u0627\u063a \u0647\u0648\u0634\u0645\u0646\u062f \u0622\u0632\u0627\u062f\u06cc", type: "traffic-light", route: "R-010", ip: "192.168.3.10", status: "online", lastSeen: "2026-02-15T10:23:10", firmware: "v4.0.2" },
    { id: "TL-002", deviceCode: "3002", name: "\u0686\u0631\u0627\u063a \u0647\u0648\u0634\u0645\u0646\u062f \u0648\u0644\u06cc\u0639\u0635\u0631", type: "traffic-light", route: "R-012", ip: "192.168.3.11", status: "warning", lastSeen: "2026-02-15T10:10:00", firmware: "v4.0.1" },
    { id: "TL-003", deviceCode: "3003", name: "\u0686\u0631\u0627\u063a \u0647\u0648\u0634\u0645\u0646\u062f \u062a\u0642\u0627\u0637\u0639 \u0647\u0645\u062a", type: "traffic-light", route: "R-002", ip: "192.168.3.12", status: "online", lastSeen: "2026-02-15T10:22:55", firmware: "v4.0.2" },
    { id: "CTR-001", deviceCode: "4001", name: "\u06a9\u0646\u062a\u0631\u0644\u0631 \u0645\u0631\u06a9\u0632\u06cc \u0645\u0646\u0637\u0642\u0647 \u06f1", type: "controller", route: "R-001", ip: "192.168.4.1", status: "online", lastSeen: "2026-02-15T10:23:15", firmware: "v5.1.0" },
    { id: "CTR-002", deviceCode: "4002", name: "\u06a9\u0646\u062a\u0631\u0644\u0631 \u0645\u0646\u0637\u0642\u0647 \u06f6", type: "controller", route: "R-002", ip: "192.168.4.2", status: "online", lastSeen: "2026-02-15T10:22:45", firmware: "v5.1.0" },
    { id: "CTR-003", deviceCode: "4003", name: "\u06a9\u0646\u062a\u0631\u0644\u0631 \u062a\u0647\u0631\u0627\u0646-\u0634\u0645\u0627\u0644", type: "controller", route: "R-007", ip: "192.168.4.3", status: "error", lastSeen: "2026-02-15T08:00:00", firmware: "v5.0.9" },
    { id: "CAM-005", deviceCode: "1005", name: "\u062f\u0648\u0631\u0628\u06cc\u0646 \u0646\u0638\u0627\u0631\u062a \u0642\u0645", type: "camera", route: "R-004", ip: "192.168.1.14", status: "online", lastSeen: "2026-02-15T10:20:00", firmware: "v3.2.1" },
    { id: "SEN-005", deviceCode: "2005", name: "\u0633\u0646\u0633\u0648\u0631 \u062a\u0631\u0627\u0641\u06cc\u06a9 \u0686\u0645\u0631\u0627\u0646", type: "sensor", route: "R-008", ip: "192.168.2.14", status: "online", lastSeen: "2026-02-15T10:23:00", firmware: "v2.1.0" },
    { id: "CAM-006", deviceCode: "1006", name: "\u062f\u0648\u0631\u0628\u06cc\u0646 \u06cc\u0627\u062f\u06af\u0627\u0631 \u0627\u0645\u0627\u0645", type: "camera", route: "R-011", ip: "192.168.1.15", status: "online", lastSeen: "2026-02-15T10:22:00", firmware: "v3.2.1" },
    { id: "SEN-006", deviceCode: "2006", name: "\u0633\u0646\u0633\u0648\u0631 \u0628\u0639\u062b\u062a", type: "sensor", route: "R-009", ip: "192.168.2.15", status: "offline", lastSeen: "2026-02-14T23:40:00", firmware: "v2.0.8" }
];

var REPORT_DATA = [
    { date: "2026-02-15", route: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u06a9\u0631\u062c", vehicles: 124500, avgSpeed: 95, maxSpeed: 185, violations: 23 },
    { date: "2026-02-15", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0647\u0645\u062a", vehicles: 89200, avgSpeed: 62, maxSpeed: 130, violations: 8 },
    { date: "2026-02-15", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0635\u062f\u0631", vehicles: 67800, avgSpeed: 48, maxSpeed: 115, violations: 12 },
    { date: "2026-02-15", route: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u0642\u0645", vehicles: 56300, avgSpeed: 110, maxSpeed: 195, violations: 31 },
    { date: "2026-02-15", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0646\u06cc\u0627\u06cc\u0634", vehicles: 43100, avgSpeed: 55, maxSpeed: 105, violations: 5 },
    { date: "2026-02-15", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0634\u06cc\u062e \u0641\u0636\u0644\u200c\u0627\u0644\u0644\u0647", vehicles: 78900, avgSpeed: 58, maxSpeed: 120, violations: 9 },
    { date: "2026-02-14", route: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u06a9\u0631\u062c", vehicles: 118700, avgSpeed: 98, maxSpeed: 190, violations: 19 },
    { date: "2026-02-14", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0647\u0645\u062a", vehicles: 91500, avgSpeed: 60, maxSpeed: 128, violations: 11 },
    { date: "2026-02-14", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0635\u062f\u0631", vehicles: 70200, avgSpeed: 45, maxSpeed: 112, violations: 15 },
    { date: "2026-02-14", route: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u0642\u0645", vehicles: 52800, avgSpeed: 112, maxSpeed: 200, violations: 28 },
    { date: "2026-02-14", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0646\u06cc\u0627\u06cc\u0634", vehicles: 40200, avgSpeed: 52, maxSpeed: 100, violations: 3 },
    { date: "2026-02-14", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0634\u06cc\u062e \u0641\u0636\u0644\u200c\u0627\u0644\u0644\u0647", vehicles: 80100, avgSpeed: 56, maxSpeed: 118, violations: 7 },
    { date: "2026-02-13", route: "\u0622\u0632\u0627\u062f\u0631\u0627\u0647 \u062a\u0647\u0631\u0627\u0646-\u06a9\u0631\u062c", vehicles: 115300, avgSpeed: 92, maxSpeed: 180, violations: 21 },
    { date: "2026-02-13", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0647\u0645\u062a", vehicles: 87600, avgSpeed: 59, maxSpeed: 125, violations: 10 },
    { date: "2026-02-13", route: "\u0628\u0632\u0631\u06af\u0631\u0627\u0647 \u0635\u062f\u0631", vehicles: 65400, avgSpeed: 50, maxSpeed: 118, violations: 14 }
];
ENDFILE

echo "=== Part 2 done: data/devices.js deployed ==="
