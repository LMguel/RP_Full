# Front — Admin SPA

React 19 · TypeScript · Vite 6 · MUI 7 · Tailwind CSS 4 · Framer Motion · Recharts

The primary management interface for REGISTRA.PONTO. Consumed by company administrators to manage employees, review attendance records, configure schedules, run payroll pre-calculations, and monitor the audit trail.

Live: **app.registraponto.app.br** (S3 + CloudFront, `us-east-1`)

---

## Pages

| Route | Component | Description |
|---|---|---|
| `/dashboard` | `DashboardPage` | Real-time presence overview; daily chart; alert feed |
| `/employees` | `EmployeesPage` | Employee roster with CRUD, photo upload, Rekognition enrollment |
| `/records` | `RecordsPage` | Attendance record table; manual entry; Excel export |
| `/records/:id` | `EmployeeRecordsPage` | Per-employee monthly mirror with calendar heat-map; leave management |
| `/payroll` | `PayrollPage` | Pre-payroll calculation; bank-of-hours; monthly close |
| `/audit` | `AuditPage` | Structured audit log with `before`/`after` diffs per event |
| `/settings` | `SettingsPage` | Schedule presets, geofence radius, holiday calendar |
| `/users` | `UsersPage` | Sub-user management with role-based permission overrides |
| `/kiosk-logs` | `KioskLogsPage` | Kiosk telemetry; remote force-update trigger |

---

## Stack

```
React 19 (concurrent features, use hook)
TypeScript 5.x — strict mode, no `any`
Vite 6 + vite-plugin-legacy (ES2015 target for Android tablets)
MUI 7 (sx-prop only, no class-based overrides)
Tailwind CSS 4 (utility layer on top of MUI)
Framer Motion 11 (AnimatePresence on every route transition)
Recharts 2 (dashboard charts)
Axios (interceptors: JWT injection, 401 → auto-logout)
React Router 7
```

---

## Project Structure

```
src/
├── pages/               # One file per route (co-located state + UI)
├── sections/            # Shared layout components (PageLayout, Sidebar, Topbar)
├── components/          # Reusable primitives (dialogs, forms, guards)
├── services/api.ts      # Typed Axios wrapper; all API calls go through here
├── types/index.ts       # Canonical TypeScript interfaces (no duplication)
├── config/index.ts      # VITE_API_URL, feature flags
└── App.tsx              # Route declarations + AuthContext provider
```

---

## Notable Patterns

**Typed API service.** `services/api.ts` exports a single `ApiService` class. Every endpoint has a typed method — no raw `axios.get` calls in components.

**EmployeeRecordsPage calendar.** The monthly calendar grid is fully interactive: clicking any day opens a context-sensitive `<Menu>` with actions scoped to that day's status (mark leave, register medical certificate, undo, substitute document). Backed by three new API endpoints added alongside the UI.

**Audit integration.** Every mutating action (leave entry, record invalidation, document substitution) is logged server-side. `AuditPage` renders `before`/`after` snapshots with human-readable summary text generated from action + entity + payload type.

---

## Local Development

```bash
cd front
npm install
cp .env.example .env   # set VITE_API_URL=http://localhost:5000
npm run dev
```

---

## Build & Deploy

```bash
npm run build
# outputs to dist/ — deploy via ../deploy/deploy_front.sh
```

Assets with content hashes are served with `max-age=31536000,immutable`. `index.html` and `*.json` files use `no-cache` so CDN invalidations take effect immediately.
