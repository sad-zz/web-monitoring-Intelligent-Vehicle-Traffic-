# CLAUDE.md - AI Assistant Guide

## Project Overview

**نوآوران جنوب شرق (Noavaran Jonoob Shargh) - TC Manager** - A web-based dashboard for monitoring and managing traffic counters. Tracks routes, traffic counting devices, traffic reports, and system settings. Sends data to RMTO (RAHSAM).

## Project Structure

```
web-monitoring-Intelligent-Vehicle-Traffic-/
├── CLAUDE.md              # AI assistant guide (this file)
├── index.html             # Main dashboard (RTL, Persian UI, 5 views)
├── css/
│   └── style.css          # All styles (sidebar, tables, modals, responsive)
├── js/
│   └── app.js             # Application logic (navigation, CRUD, pagination, export)
└── data/
    └── devices.js         # Sample data (ROUTE_DATA, DEVICE_DATA, REPORT_DATA)
```

## Architecture

- **Pure HTML/CSS/JS** - No build tools, no frameworks, no dependencies
- **RTL layout** - Persian (Farsi) interface, right-to-left direction
- **Client-side only** - Data loaded from `data/devices.js` as global arrays
- **IIFE pattern** - `app.js` uses an immediately invoked function to avoid polluting the global scope

### Key Views (5 pages)

| View | ID | Description |
|------|----|-------------|
| UI1: خانه (Home) | `#view-home` | Stats cards + route data table with export/search |
| UI2: محورها (Routes) | `#view-routes` | Route management table with CRUD |
| UI3: دستگاه‌ها (Devices) | `#view-devices` | Device management table with CRUD |
| UI4: گزارشات (Reports) | `#view-reports` | Traffic reports with date/route filters |
| UI5: تنظیمات (Settings) | `#view-settings` | System settings and alert configuration |

### Data Models

**Route** (`ROUTE_DATA`): `id`, `name`, `origin`, `destination`, `length`, `deviceCount`, `status`, `totalVehicles`, `avgSpeed`, `errors`, `lastUpdate`

**Device** (`DEVICE_DATA`): `id`, `name`, `type` (camera/sensor/traffic-light/controller), `route`, `ip`, `status` (online/offline/warning/error), `lastSeen`, `firmware`

**Report** (`REPORT_DATA`): `date`, `route`, `vehicles`, `avgSpeed`, `maxSpeed`, `violations`

## Development Setup

### Prerequisites

- A web browser
- Any static file server (or just open `index.html` directly)

### Running Locally

```bash
# Option 1: Open directly
open index.html

# Option 2: Simple HTTP server
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## Conventions

### Code Style

- Vanilla JS, no ES6 modules (script tags in HTML)
- `escapeHtml()` used for all dynamic content to prevent XSS
- CSS custom properties (variables) defined in `:root` for theming
- BEM-like class naming: `.status-badge`, `.stat-card`, `.nav-item`

### File Naming

- Use lowercase with hyphens for file names (e.g., `traffic-monitor.js`)

### Localization

- All UI text is in Persian (Farsi)
- Status labels and type labels are mapped via `STATUS_LABELS` and `TYPE_LABELS` objects in `app.js`
- Dates/IPs use `direction: ltr` inline for correct display in RTL context

## Git Workflow

- **Main branch:** `main`
- Feature branches: `feature/<description>`
- Bug fix branches: `fix/<description>`
- Write clear, descriptive commit messages
- Keep commits atomic and focused on a single change

## TCP Device Protocol (RATCX1)

### Connection Lifecycle
1. Device connects TCP:2022
2. Device sends `8000` handshake (device ID + datetime + model + `READY`)
3. Server checks clock drift
4. Server sends `0012` TIME_SYNC (twice, 3s apart)
5. Device responds `8012` ACK
6. Server polls `0197` for last 3 intervals
7. Every 5 min: server sends `0197` for completed interval
8. Every 15 min: server re-syncs time with `0012`

### Message Formats

| Code | Direction | Format | Purpose |
|------|-----------|--------|---------|
| `8000` | Device→Server | `8000` + datetime(21) + sysId(8) + model + `READY` | Handshake |
| `0012` | Server→Device | `0012` + `yyMMddHHmmss` | Time sync command |
| `8012` | Device→Server | `8012` + datetime(21) + sysId(8) | Time sync ACK |
| `0197` | Server→Device | `0197` + `YYMMDDHHmm` | Request interval data |
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
- **< 2 min**: Normal, no action
- **2-5 min**: Sync time, request data immediately
- **> 5 min**: Sync time, DEFER data request until ACK
- **Invalid date** (month>12): Treat as drift=9999, sync + correct timestamps
- **NaN date in data** (8821): Replace with server time (rounded to 5-min)
- **> 30 min drift in data**: Replace timestamp with server time

### RMTO SOAP Format (Add5)
```xml
<Add5 xmlns="ITS">
  <CID>companyId</CID> <UID>user</UID> <PWD>pass</PWD>
  <FID>recordId</FID> <RID>routeCode</RID>
  <ST>startTime</ST> <ET>endTime</ET>
  <C1>c1</C1><C2>c2</C2><C3>c3</C3><C4>c4</C4><C5>c5</C5>
  <ASP>avgSpeed</ASP>
  <S1>s1</S1><S2>s2</S2><S3>s3</S3><S4>s4</S4><S5>s5</S5>
  <SSO>totalViolations</SSO>
  <SO1>so1</SO1><SO2>so2</SO2><SO3>so3</SO3><SO4>so4</SO4><SO5>so5</SO5>
  <OO>overtaking</OO> <ESD>tooClose</ESD>
</Add5>
```

Class mapping: C1=a(motorcycle) C2=b(car) C3=c(van) C4=d(bus) C5=e+x(truck+other)
Violation mapping: SO1=a SO2=b SO3=c SO4=d SO5=e+x (SSO=SO1+SO2+SO3+SO4+SO5)

## AI Assistant Guidelines

When working on this codebase:

1. **Read before modifying** - Always read existing files before suggesting changes
2. **Minimal changes** - Only make changes that are directly requested or clearly necessary
3. **No over-engineering** - Keep solutions simple and focused on the task at hand
4. **Security first** - Always use `escapeHtml()` for dynamic content; avoid `innerHTML` with unescaped data
5. **RTL aware** - Maintain right-to-left layout; use `direction: ltr` only for IPs, dates, and numbers
6. **Persian UI** - All user-facing text must be in Persian (Farsi)
7. **Test changes** - Open `index.html` in a browser to verify UI changes
8. **Update this file** - Keep CLAUDE.md in sync as the project evolves
