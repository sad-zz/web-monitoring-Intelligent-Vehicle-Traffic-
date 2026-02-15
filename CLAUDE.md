# CLAUDE.md - AI Assistant Guide

## Project Overview

**سیستان اکبری (Sistan Akbari) - TC Manager** - A web-based dashboard for monitoring and managing intelligent vehicle traffic. Tracks routes, devices (cameras, sensors, traffic lights, controllers), traffic reports, and system settings.

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
