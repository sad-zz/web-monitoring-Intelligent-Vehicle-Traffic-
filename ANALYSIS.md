# TC Manager - Server Software Analysis & Reference

> **Last Updated:** 2026-02-22
> **Purpose:** This document saves comprehensive analysis of the TC Manager server so AI assistants don't need to re-analyze the codebase each session. Read this file first before making changes.

---

## Quick Reference

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| HTTP Server + TCP | `server/index.js` | ~1450 | Main app: REST API, TCP device protocol, auth |
| Database Schema | `server/db.js` | ~220 | SQLite tables, indexes, defaults (incl. users table) |
| Scheduler | `server/scheduler.js` | ~255 | Aggregate irawdata, send to RMTO, offline detection |
| RMTO Client | `server/rmto-client.js` | ~150 | SOAP client for RMTO web service |
| Frontend | `js/app.js` | ~800 | Dashboard, device mgmt, mehvar mgmt, TCP panel |
| Deploy Script | `server/deploy-part1-server.sh` | ~350 | Server deployment (has embedded code) |
| Patch 1 (applied) | `patch.js` | ~116 | TCP terminator, poll timing fixes — already in index.js |
| Patch 2 (applied) | `patch2.js` | ~184 | NaN dates, clock drift, deferred polling — already in index.js |

---

## Architecture Overview

```
RATCX1 Devices (TCP:2022) ──→ server/index.js ──→ SQLite (data.db)
HTTP Devices (POST /api) ──→ server/index.js ──→ SQLite (data.db)
                                                       ↓
                                              server/scheduler.js
                                                       ↓
                                              RMTO (SOAP) via rmto-client.js
                                                       ↓
                                              otf.rmto.ir (RAHSAM)
```

**Stack:** Node.js + Express + better-sqlite3 + soap + node-cron
**Ports:** HTTP=3000, TCP=2022
**Timezone:** Asia/Tehran (UTC+3:30)
**Process Manager:** PM2

---

## Database Tables

### devices
```
device_code (TEXT UNIQUE) | name | type | route | ip | status | last_seen | firmware | created_at
```
- `last_seen` updated via `datetime('now','localtime')` on every data reception
- `status`: online/offline/warning/error

### irawdata (main traffic data)
```
device_code | create_at | stop | lane | is_read |
a,b,c,d,e,x (counts) | sa,sb,sc,sd,se,sx (speed sums) |
sao,sbo,sco,sdo,seo,sxo (violations) | overtaking | tooclose | received_at
```
- `is_read=0` means not yet aggregated by scheduler
- `create_at` = period start (5-min interval), `stop` = period end
- Vehicle classes: a=motorcycle, b=car, c=van, d=bus, e=truck, x=unknown

### rmto_queue / rmto_queue_5class / rmto_queue_8class
```
device_code | period_start | period_end | counts... | avg_speed | sent | sent_at | rmto_response
```
- `sent=0` means pending, `sent=1` means successfully sent to RMTO

### Other Tables
- `traffic_data` - Generic per-vehicle records (from HTTP API)
- `send_log` - Audit trail for RMTO sends
- `mehvar` - Routes (code, name, send_enable, repair, ostan)
- `settings` - Key-value config store
- `users` - Admin auth (bcrypt hashed passwords)

---

## TCP Protocol (RATCX1 Devices)

### Connection Lifecycle
```
1. Device connects TCP:2022
2. Device sends "8000" handshake (device ID + datetime + model + "READY")
3. Server checks clock drift
4. Server sends "0012" TIME_SYNC (twice, 3s apart)
5. Device responds "8012" ACK
6. Server polls "0197" for last 3 intervals
7. Every 5 min: server sends "0197" for completed interval
8. Every 15 min: server re-syncs time with "0012"
```

### Message Formats

| Code | Direction | Format | Purpose |
|------|-----------|--------|---------|
| `8000` | Device→Server | `8000` + datetime(21) + sysId(8) + model + `READY` | Handshake |
| `0012` | Server→Device | `0012` + `YYYY.MM.DD-HH:MM:SS.0` | Time sync command |
| `8012` | Device→Server | `8012` + datetime(21) + sysId(8) | Time sync ACK |
| `0197` | Server→Device | `0197` + `YYMMDDHHMI` | Request interval data |
| `8821` | Device→Server | `8821` + datetime(21) + intervalData(262+) | Interval data response |

### Interval Data Structure (262+ chars after 8821+datetime)
```
[0-7]     sysId (8 digits)
[8-17]    datetime YYMMDDHHmm
[18-131]  Lane1: 6 classes x 19 chars (count4+avgSpeed3+violation4+grab4+headway4)
[132-134] Lane1 occupancy
[135-248] Lane2: same as Lane1
[249-251] Lane2 occupancy
[252-254] Battery voltage
[255-257] Solar voltage
[258-261] Error byte
```

### Clock Drift Handling
- **< 2 min:** Normal, no action
- **2-5 min:** Sync time, request data immediately
- **> 5 min:** Sync time, DEFER data request until ACK
- **Invalid date (month>12):** Treat as drift=9999, sync + correct timestamps
- **NaN date in data (8821):** Replace with server time (rounded to 5-min)
- **> 30 min drift in data:** Replace timestamp with server time

---

## API Endpoints

### No Auth Required
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/login` | Login (username, password) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/check` | Check session |
| POST | `/api/data` | HTTP device data (generic) |
| POST | `/api/irawdata` | HTTP device data (5-class) |

### Auth Required
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/devices` | List all devices |
| POST | `/api/devices` | Create device |
| PUT | `/api/devices/:code` | Update device |
| DELETE | `/api/devices/:code` | Delete device |
| POST | `/api/devices/import` | Batch import JSON |
| GET | `/api/irawdata/list` | Query raw data (pagination) |
| GET | `/api/stats` | Dashboard stats |
| GET | `/api/server/time` | Server time + uptime |
| GET | `/api/mehvar` | List routes |
| POST | `/api/mehvar` | Create route |
| GET | `/api/rmto/queue` | RMTO send queue |
| GET | `/api/rmto/logs` | RMTO send history |
| POST | `/api/rmto/send-now` | Manual RMTO send |
| POST | `/api/rmto/aggregate` | Manual aggregation |
| GET | `/api/settings` | Load settings |
| POST | `/api/settings` | Save settings |
| GET | `/api/tcp/connected` | Connected TCP devices |
| POST | `/api/tcp/sync-time` | Send TIME_SYNC to device |
| POST | `/api/tcp/poll` | Send poll to device |
| GET | `/api/backup/download` | Download DB backup |
| POST | `/api/backup/restore` | Restore from backup |
| POST | `/api/auth/change-password` | Change password |

---

## RMTO Integration

**WSDL:** `http://otf.rmto.ir/Companies/Companies.asmx?WSDL`
**Company Code:** 58
**Methods:** AddData (simple), AddData5 (5-class), AddData8 (8-class)

### Scheduler Flow (every 15 min)
```
1. Calculate period: last completed 15-min block
2. For each device: SELECT SUM(a,b,c,d,e,x) FROM irawdata WHERE is_read=0
3. Calculate: totalVehicles, avgSpeed, speedDistribution(S1-S5), violations
4. INSERT into rmto_queue + rmto_queue_5class
5. UPDATE irawdata SET is_read=1
6. Send unsent queue items to RMTO via SOAP
```

### Speed Classes for RMTO
| Class | Range |
|-------|-------|
| S1 | < 60 km/h |
| S2 | 60-80 km/h |
| S3 | 80-100 km/h |
| S4 | 100-120 km/h |
| S5 | > 120 km/h |

---

## Date/Time Handling

### Critical Rules
1. **SQLite:** Always use `datetime('now','localtime')` - NOT `datetime('now')` (returns UTC)
2. **JavaScript dates:** `new Date()` returns local time; `.toISOString()` returns UTC (don't use for DB queries)
3. **Scheduler queries:** Use `toLocalISOString()` helper (formats local time without 'Z')
4. **Device dates:** May be invalid (month=26) - always validate before using
5. **Server timezone:** `Asia/Tehran` (UTC+3:30) - set via TZ env or system

### Frontend formatTime()
```javascript
function formatTime(iso) {
    if (!iso) return "-";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return YYYY/MM/DD HH:mm;
}
```
- Used for: `last_seen`, `create_at`, `stop`, `period_start`, `sent_at`, `created_at`
- All date cells use `dir="ltr"` in RTL context

---

## Applied Patches History

### patch.js (v1) — ✅ Applied to server/index.js
- Fix 0: Added `\r\n` terminator to TCP commands
- Fix 1: Call `startDataRequests` (not `startPeriodicPoll`) after TIME_SYNC ACK
- Fix 2: Request COMPLETED interval (now-5min), not current
- Fix 3a: Added `toLocalISOString()` to scheduler
- Fix 3b: Scheduler uses local time in DB queries

### patch2.js (v2) — ✅ Applied to server/index.js
- Fix A: Added `deviceClockDrift` tracking variable
- Fix B: Added `deferDataRequest` field to `pendingSyncs`
- Fix C: Detect invalid dates (month=26) in handshake
- Fix D: `startDevicePoll` checks drift level
- Fix E: Defer data request on large drift (>5min)
- Fix F: Correct timestamps when drift >30min in data
- Fix G: Correct NaN dates in interval data
- Fix H: TIME_SYNC ACK triggers deferred polling
- Fix I: Log shows `(timestamp corrected)` flag

### Inline Fix (2026-02-21) — ✅ Applied
- Changed ALL `datetime('now')` to `datetime('now','localtime')` across all files
- Added NaN date pre-check in 8821 handler (was missing from patch2 Fix G)

### Bug Fixes (2026-02-22) — ✅ Applied & Production DB Migrated
- **Fix 1:** `/api/stats` used `toISOString()` (UTC) for irawdata query → replaced with local time string
- **Fix 2:** HTTP devices never went offline → `checkOfflineDevices()` added to scheduler (runs every 1 min)
- **Fix 3:** Duplicate irawdata records on TCP reconnect → `UNIQUE INDEX idx_irawdata_unique` added to db.js; all `INSERT INTO irawdata` changed to `INSERT OR IGNORE`; **production DB migration (delete duplicates) completed ✅**
- **Fix 4:** No UI for mehvar management → added «محورها» nav + view + CRUD to index.html and app.js
- **Fix 5:** TCP connected devices not shown → added «اتصالات TCP فعال» panel to dashboard with sync/poll buttons
- **Fix 6:** `users` table defined in `initAdmin()` → moved to db.js schema
- **Fix 7:** `formatDeviceDatetime()` sent `YYYY.MM.DD-HH:MM:SS.0` (device output format) instead of `yyMMddHHmmss` (firmware input format) → device clocks never updated after TIME_SYNC; corrected to match C# original and `DS1305_Lib.h rtc_write` expectation

---

## Settings (defaults)

| Key | Default | Description |
|-----|---------|-------------|
| `system_name` | نوآوران جنوب شرق | System display name |
| `server_port` | 3000 | HTTP port |
| `tcp_port` | 2022 | TCP device port |
| `refresh_interval` | 30 | Dashboard refresh (seconds) |
| `max_speed` | 120 | Speed limit (km/h) |
| `offline_timeout` | 5 | Minutes before device marked offline |
| `rmto_company_code` | 58 | RMTO company ID |
| `rmto_wsdl` | http://otf.rmto.ir/...?WSDL | RMTO endpoint |
| `alert_offline` | 1 | Alert on device offline |
| `alert_speed` | 1 | Alert on speed violation |
| `alert_error` | 1 | Alert on device error |

---

## Key Functions Reference

### server/index.js
| Function | Line | Purpose |
|----------|------|---------|
| `formatPollTimestamp(date)` | ~808 | Format date as `YYMMDDHHMI` for 0197 command |
| `formatDeviceDatetime(date)` | ~817 | Format as `yyMMddHHmmss` (12 chars) for 0012 TIME_SYNC |
| `sendToDevice(code, socket, cmd, label)` | ~830 | Send TCP command with logging |
| `syncDeviceTime(code, socket)` | ~849 | Send 0012 TIME_SYNC with retry |
| `startDevicePoll(code, socket)` | ~886 | Full poll sequence (sync→data→periodic) |
| `startDataRequests(code, socket)` | ~932 | Request last 3 intervals + start periodic |
| `startPeriodicPoll(code, socket)` | varies | 5-min interval polling loop |
| `parseRATCX1Interval(str)` | ~642 | Parse 262-char interval to object |
| `ratcx1ToIrawdata(parsed)` | ~696 | Convert parsed interval to DB rows |
| `storeIrawdata(row)` | varies | INSERT into irawdata + traffic_data |
| `processRawData(raw, ip)` | ~1140 | Main TCP message dispatcher |
| `autoRegisterDevice(code)` | ~226 | Create device if not exists, update last_seen |
| `addLiveLog(entry)` | varies | Add to circular live log buffer |

### js/app.js
| Function | Line | Purpose |
|----------|------|---------|
| `formatTime(iso)` | 17 | Format ISO date to `YYYY/MM/DD HH:mm` |
| `escapeHtml(str)` | 10 | XSS prevention for dynamic content |
| `api(method, url, body, cb)` | 29 | XHR wrapper for API calls |
| `loadDashboard()` | ~175 | Load stats + device table + TCP panel |
| `loadTcpConnected()` | ~205 | Load active TCP connections from `/api/tcp/connected` |
| `loadDevices()` | ~293 | Device management table with CRUD |
| `loadReception()` | ~470 | irawdata table with pagination |
| `loadRMTO()` | ~526 | RMTO queue and send log |
| `loadMehvar()` | ~618 | Mehvar (routes) table with add/delete |
| `loadSettings()` | ~740 | Settings form (general + RMTO + password + backup) |

---

## Debugging

### PM2 Logs
```bash
pm2 logs tc-manager --lines 100
pm2 logs tc-manager --err --lines 50
```

### Key Log Prefixes
- `[TCP]` - TCP connection/protocol events
- `[TCP] >>>` - Commands sent TO device
- `[TCP] ***` - Important data events (handshake, data, ACK)
- `[Scheduler]` - Aggregation events
- `[RMTO]` - RMTO send events

### Test Device via curl
```bash
# Send 5-class data
curl -X POST http://localhost:3000/api/irawdata \
  -H "Content-Type: application/json" \
  -d '{"device_id":"1001","create_at":"2026-02-21T10:30:00","stop":"2026-02-21T10:35:00","lane":1,"a":5,"b":20,"c":8,"d":2,"e":3,"x":1,"sa":300,"sb":1800,"sc":800,"sd":200,"se":300,"sx":50}'
```

### Check Database
```bash
sqlite3 /opt/tc-manager/server/data.db "SELECT device_code, last_seen, status FROM devices;"
sqlite3 /opt/tc-manager/server/data.db "SELECT * FROM irawdata ORDER BY id DESC LIMIT 5;"
sqlite3 /opt/tc-manager/server/data.db "SELECT * FROM rmto_queue WHERE sent=0;"
```
