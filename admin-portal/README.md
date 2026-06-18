# Admin Portal — Internal Operations Dashboard

React 19 · TypeScript · Vite · Radix UI · Tailwind CSS 3

Internal super-admin panel for the REGISTRA.PONTO platform. Provides cross-tenant visibility: company provisioning, subscription management, kiosk telemetry, and platform-level feature flags. Separate auth domain from the per-company admin SPA (`front/`).

---

## Scope

This portal operates at the **platform** level, not the company level. A single operator account can see and act across all tenants — it is never exposed to end-customer users.

| Page | Description |
|---|---|
| `Dashboard` | Platform KPIs: active companies, total employees, daily punch volume |
| `Companies` | Company list; provision new tenants; toggle features per company |
| `KioskLogs` | Per-device telemetry; connectivity status; force-update trigger |
| `Users` | Platform operator accounts and permission scopes |

---

## Stack

```
React 19
TypeScript 5.x — strict mode
Vite 5
Radix UI — accessible, unstyled primitives (Dialog, Select, Tooltip, etc.)
Tailwind CSS 3 — utility-first styling over Radix components
Axios — API client with JWT interceptor
React Router 7
```

The Radix UI + Tailwind pairing (vs. MUI in `front/`) was a deliberate design choice: Radix provides WAI-ARIA compliant primitives with zero default styles, giving full control over the visual layer while maintaining accessibility guarantees.

---

## Project Structure

```
src/
├── pages/              # One file per route
├── components/         # Shared layout (Sidebar, Topbar, AppLayout) + UI library
├── services/api.ts     # Typed Axios wrapper for platform-level endpoints
├── context/
│   └── AuthContext.tsx # Session state; JWT storage; auto-logout on 401
└── App.tsx             # Route tree + ProtectedRoute guard
```

---

## Local Development

```bash
cd admin-portal
npm install
cp .env.example .env   # VITE_API_URL=https://registra-ponto.duckdns.org
npm run dev            # http://localhost:5173
```

---

## Build & Deploy

```bash
npm run build
# deploy via ../deploy/deploy_admin.sh
# requires S3_BUCKET_ADMIN and CLOUDFRONT_ID_ADMIN in deploy/.env
```
