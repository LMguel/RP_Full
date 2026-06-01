# REGISTRA.PONTO — Employee Time-Tracking Platform

A production-grade, multi-tenant employee clock-in platform built around biometric verification and geofencing. The system spans a serverless Python backend, a React admin dashboard, a Progressive Web App for browser-based kiosk use, and a native Android kiosk application with fully on-device facial recognition.

---

## System Screenshots

### Admin Dashboard
<img src="landingpage/image/dashboard.png" alt="Admin Dashboard" width="600" />

Real-time attendance indicators, daily statistics, and record overview.

### Record Management
<img src="landingpage/image/registros.png" alt="Record List" width="600" />

Paginated record list with advanced server-side filtering.

### Record Detail
<img src="landingpage/image/registros_detalhados.png" alt="Record Detail" width="600" />

Per-entry detail showing capture photo, GPS coordinates, and timestamps.

### Employee Management
<img src="landingpage/image/funcionario.png" alt="Employee Management" width="600" />

Full CRUD with photo upload pipeline into AWS Rekognition face collections.

### Configuration
<img src="landingpage/image/configuracoes.png" alt="Settings" width="600" />

Per-company work schedule, geofence radius, and feature toggles.

### Kiosk in Production
<img src="landingpage/image/captura.jpg" alt="Tablet in kiosk mode" width="600" />

Android tablet running the native app in locked-down kiosk mode.

---

## Architecture Overview

```
RP_Full/
├── backend/          # Python · Flask · AWS Lambda
├── front/            # React 19 · TypeScript · Vite 7 (admin SPA)
├── pwa-mobile/       # React 18 · Vite · PWA (browser kiosk)
├── mobile/           # React Native 0.75 · Android (native kiosk)
└── landingpage/      # Marketing site (Vite + React)
```

The platform is multi-tenant at the data layer. Every DynamoDB item is partitioned by `empresa_id`, and every API route enforces ownership via JWT claims — one tenant can never read another's data.

---

## Backend — Python · Flask · AWS Serverless

**Runtime:** Python 3.11 on AWS Lambda (Mangum ASGI adapter), exposed through API Gateway HTTP API.

**Framework:** Flask with Blueprint-based modular routing. Domain boundaries are enforced at the Blueprint level: authentication, attendance records, facial biometrics, dashboard aggregations, HR chatbot, and public holiday lookups each live in their own Blueprint and are mounted at distinct prefixes.

**Database — Amazon DynamoDB (single-table design):**
- Partition key: `empresa_id` — hard tenant boundary at the storage layer.
- Sort key: `tipo#id` composite (e.g., `funcionario#uuid`, `registro#20240615T083000`).
- Global Secondary Indexes enable efficient queries by CPF, date range, and record status without full scans.
- Timestamps are stored in ISO 8601 with timezone offset to support multi-region deployments correctly.

**Object storage — Amazon S3:**
- Employee face photos stored with server-side AES-256 encryption.
- Access served via presigned URLs (short TTL) rather than public bucket policies — the bucket itself has no public access.
- Versioning enabled per bucket for audit and rollback.

**Biometric — AWS Rekognition:**
- Each company has its own Rekognition Face Collection, giving hard namespace isolation between tenants.
- The enrollment flow indexes a face into the collection and stores the `FaceId` on the employee record.
- At clock-in, the API calls `SearchFacesByImage` against the company collection — only that company's face vectors are searched.
- Confidence thresholds and similarity floors are configurable per company.

**Authentication:** Stateless JWT (PyJWT, HS256). Tokens carry `empresa_id` and `role` claims validated on every protected route. Separate token flows for company admins and individual employees.

**Infrastructure:**
- Lambda + API Gateway HTTP API (lower latency and cost than REST API).
- S3 + CloudFront for frontend assets; origin access control (OAC) keeps the bucket private.
- Route 53 for DNS; ACM for TLS certificates with automatic renewal.
- All secrets (JWT key, AWS credentials for local dev) are environment variables; Lambda reads them from Lambda environment config — no secrets in source.

---

## Admin Frontend — React 19 · TypeScript · Vite 7

A single-page application serving company administrators.

**Core stack:**
- **React 19** with concurrent features; hooks-based architecture throughout.
- **TypeScript** with strict mode — all API response shapes typed end-to-end.
- **Vite 7** with `@vitejs/plugin-react` (SWC transform); production bundle split by route via dynamic `import()`.

**UI layer:**
- **Material UI v7** (MUI) for the component system, including `@mui/x-data-grid` for server-paged record tables and `@mui/x-date-pickers` for date range filters.
- **TailwindCSS v4** for layout and utility composition alongside MUI.
- **Framer Motion** for transition animations and skeleton loaders.
- **Recharts** for attendance trend charts (daily/weekly/monthly aggregations).
- **React Leaflet + Leaflet** to render the geofence boundary and per-record GPS pin on an interactive map.

**State management:**
- **Zustand v5** for global client state (authenticated session, UI preferences).
- **Axios** with request/response interceptors: automatic JWT header injection, 401 → logout redirect, centralized error normalization.

**Data export:**
- `xlsx` + `xlsx-js-style` for styled Excel exports with frozen header rows, column autowidth, and conditional cell formatting.

**Routing:** React Router v7 (data router API) with lazy-loaded route modules.

---

## PWA Mobile — React 18 · Vite · Service Worker

A browser-based kiosk interface deployed as a Progressive Web App. Designed for tablets or fixed terminals where installing a native app is not feasible.

**PWA mechanics (`vite-plugin-pwa`):**
- Generates a Workbox service worker with a precache manifest for the full app shell.
- `NetworkFirst` strategy for API calls with a fallback to cached responses when offline.
- `web app manifest` with `display: standalone` and `orientation: portrait` for a native-app feel when installed to the home screen.

**Geolocation API:** Browser Geolocation API with high-accuracy mode. Captures `latitude`, `longitude`, and `accuracy` radius; the backend validates that the coordinate falls within the company's configured geofence before accepting the record.

**Camera API:** MediaDevices `getUserMedia` with `facingMode: environment` for rear camera access on tablets; frames are captured as JPEG blobs and uploaded to the backend for Rekognition verification.

**Stack:** React 18, React Router v6, Axios, React Leaflet, Framer Motion, TailwindCSS v3.

---

## Native Android App — React Native · On-Device ML · Offline-First

The most technically complex module: a locked-down Android kiosk app that performs facial recognition **entirely on-device**, with zero network dependency at clock-in time.

### On-Device Facial Recognition Pipeline

**Camera — React Native Vision Camera v4:**
- Frame processor runs in a dedicated JS worklet thread (via `react-native-worklets-core`) — the hot path never blocks the React UI thread.
- Frames are processed at native speed using the Vision Camera frame processor plugin API.

**Face detection — Google ML Kit (`@react-native-ml-kit/face-detection`):**
- Detects bounding box, landmark positions, and per-frame probability scores for left/right eye open state, head yaw, pitch, and roll.
- Used both in the live frame processor and in the one-shot enrollment path.

**Embedding model — MobileFaceNet (TFLite, `react-native-fast-tflite`):**
- Model: `mobilefacenet@112x112-192d` — 112×112 RGB input, 192-dimensional L2-normalized face embedding output.
- Loaded once at app boot; the `TensorflowModel` instance is shared via a module-level singleton so the frame processor worklet can call `model.runSync()` without re-loading.
- Input preprocessing: face crop from ML Kit bounding box → `@bam.tech/react-native-image-resizer` to 112×112 → typed Float32Array normalization → L2 normalization of the output vector.

**Matching:** Cosine similarity (equivalent to dot product on L2-normalized vectors) between the live embedding and all enrolled embeddings cached in SQLite. A confidence gap between the top-1 and top-2 candidates is used to reject ambiguous matches.

**Anti-spoofing (no extra model required):**
A lightweight liveness check runs on a sliding window of recent frames:
1. Minimum face-to-frame size ratio to reject tiny/distant faces.
2. Minimum ML Kit detection confidence.
3. **Blink detection:** requires a complete open→closed→open eye state transition within the window.
4. **Head movement:** requires minimum yaw variance across the window to reject still photos.

**Cloud fallback:** When the local engine reports `AMBIGUOUS` or `EMPTY_CACHE`, the app falls back to uploading the frame to the backend for AWS Rekognition verification.

### Offline-First Architecture

The app writes clock-in records to local storage immediately and syncs to the server asynchronously — network connectivity is never a hard dependency for core functionality.

**Local database — SQLite (`react-native-sqlite-storage`):**
- WAL journal mode for concurrent read/write performance.
- Versioned schema migrations: the bootstrap routine compares `PRAGMA user_version` against the migration array length and runs only pending migrations sequentially.
- Repository pattern: `EmployeeRepository`, `EmbeddingRepository`, `TimeRecordRepository`, `SyncQueueRepository` each encapsulate all SQL for their entity — no raw queries outside the repository layer.

**Sync queue:** Clock-in events are enqueued as `PENDING` rows in `sync_queue`. The `QueueProcessor` runs them in batches, marking rows `OK` or `FAILED` with retry metadata.

**Background sync (`react-native-background-fetch`):**
- Registers a periodic background task (Android `JobScheduler`) that fires the sync queue even when the app is not in the foreground.
- Headless JS handler keeps the sync logic running without a React root.
- The foreground sync ticker (`setInterval`) and the connectivity listener (NetInfo) both call the same `tick()` function — no duplicated logic.

**Embedding cache:** Enrolled face embeddings are pulled from the server and stored in SQLite. A pull is scheduled every 10 minutes when online, so new employees become recognizable without a manual refresh.

**Secure storage:**
- `react-native-keychain` for JWT tokens — stored in Android Keystore-backed secure storage, not AsyncStorage.
- `react-native-mmkv` (C++ backed) for high-frequency read/write app state (sync counters, last sync timestamp) — ~30× faster than AsyncStorage.

**State management:** Zustand v4 stores (`authStore`, `syncStore`, `kioskStore`, `configStore`) mirror the relevant SQLite state into React's render cycle. TanStack Query v5 manages server-state for any screens that require fresh remote data.

---

## Security Model

| Layer | Mechanism |
|---|---|
| Transport | TLS 1.2+ enforced by CloudFront and API Gateway |
| Authentication | Stateless JWT (HS256); tokens carry tenant + role claims |
| Tenant isolation | DynamoDB partition key + Rekognition collection per company |
| Photo access | S3 presigned URLs with short TTL; bucket is not public |
| Mobile credentials | Android Keystore via `react-native-keychain` |
| Liveness | Blink + head-movement anti-spoofing on every clock-in attempt |
| Input validation | Pydantic-style validation on all API inputs; no raw SQL |
| CORS | Allowlist of trusted origins; no wildcard in production |

---

## Tech Stack Summary

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.11, Flask, AWS Lambda, API Gateway, DynamoDB, S3, Rekognition, CloudFront, Route 53, ACM, JWT |
| **Admin SPA** | React 19, TypeScript, Vite 7, MUI v7, MUI X DataGrid, TailwindCSS v4, Zustand v5, Recharts, React Leaflet, Framer Motion |
| **PWA** | React 18, Vite, vite-plugin-pwa, Workbox, TailwindCSS, Service Worker, Web Geolocation API |
| **Native Android** | React Native 0.75, TypeScript, Vision Camera v4, react-native-fast-tflite, MobileFaceNet TFLite, ML Kit Face Detection, SQLite (WAL), react-native-mmkv, Keychain, TanStack Query v5, Zustand v4, Background Fetch |

---

*Stack: Python · React · TypeScript · React Native · AWS · TFLite · SQLite*
