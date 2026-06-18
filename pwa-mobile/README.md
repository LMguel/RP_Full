# PWA Mobile — Offline-First Kiosk

React 18 · TypeScript · Vite PWA Plugin · Dexie (IndexedDB) · Workbox · Framer Motion

Browser-based kiosk application installed on tablets at client locations. Handles facial-recognition clock-in with full offline capability — queues punches locally and syncs automatically when connectivity is restored.

Live: **painel.registraponto.app.br** (S3 + CloudFront, `us-east-1`)

---

## Offline Architecture

```
Tablet (Chrome, kiosk mode)
  ├── Service Worker (Workbox)          — precaches all assets; intercepts fetches
  ├── IndexedDB (Dexie)                 — pending punch queue; employee cache
  ├── Background sync loop              — retries queue every 30 s
  └── Heartbeat (every 5 min)           — checks for force-update flag in DynamoDB
                                           → triggers SW skipWaiting if flagged
```

**Contingency mode.** When the API is unreachable, the kiosk falls back to local employee data (synced during the last online window). Punches are queued in IndexedDB and flushed in FIFO order once the connection returns. No punch is lost.

---

## Key Screens

| Screen | Description |
|---|---|
| `KioskPage` | Full-screen camera; auto-captures on face detection; plays audio feedback |
| `KioskSetupPage` | Admin configures company + device before handing tablet to employees |
| `ContingencyPage` | Offline fallback; lists cached employees; accepts punches without camera |
| `SyncStatusPage` | Shows queue depth, last sync time, and manual flush trigger |

---

## Stack

```
React 18
TypeScript (strict)
Vite 5 + vite-plugin-pwa (Workbox GenerateSW strategy)
Dexie 3 — typed IndexedDB wrapper
Framer Motion — camera shutter animation; transition choreography
Axios — API calls with offline detection
```

---

## Service Worker Update Flow

The admin portal can push a force-update signal to all deployed tablets:

1. Admin clicks "Force Update" in `KioskLogsPage`.
2. Backend sets a TTL flag in DynamoDB (`kiosk_force_update`).
3. Each tablet's heartbeat (every 5 min) reads the flag.
4. On detection: `sw.postMessage({ type: 'SKIP_WAITING' })` → page reloads.
5. Flag auto-expires after 2 hours.

---

## Test Suite

```bash
npm run test
```

20 unit tests covering: offline queue flush order, sync retry with exponential backoff, contingency mode fallback, SW heartbeat logic, and IndexedDB schema migrations.

---

## Local Development

```bash
cd pwa-mobile
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:5000
npm run dev            # http://localhost:3000
```

HTTPS is required for camera access outside `localhost`. Use `mkcert` for local TLS or ngrok for device testing.

---

## Build & Deploy

```bash
npm run test && npm run build
# deploy via ../deploy/deploy_pwa.sh
```

`sw.js`, `index.html`, and `workbox-*.js` are uploaded with `no-cache` headers. Hashed assets under `assets/` are immutable. CloudFront invalidation ensures tablets pick up the new SW on next heartbeat.
