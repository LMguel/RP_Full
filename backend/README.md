# Backend — Flask REST API

Python 3.11 · Flask 3.0 · Gunicorn · AWS DynamoDB · S3 · Rekognition

Production API for the REGISTRA.PONTO multi-tenant time-tracking SaaS. Handles biometric clock-in, payroll pre-calculation, attendance records, facial recognition enrollment, and a natural-language HR chatbot.

---

## Architecture

```
backend/
├── app.py              # Flask application factory; Blueprint registration
├── wsgi.py             # Gunicorn entry point
├── models.py           # DailySummary / MonthlySummary dataclasses
├── routes/             # One Blueprint per domain
│   ├── api.py          # Attendance records, employees, leave management, audit
│   ├── v2.py           # V2 endpoints: daily/monthly summaries, company dashboard
│   ├── daily.py        # Per-employee mirror (espelho de ponto) read path
│   ├── dashboard.py    # Real-time company-wide presence dashboard
│   ├── facial.py       # Rekognition enroll / clock-in endpoints
│   ├── admin.py        # Platform-level admin operations
│   ├── admin_auth.py   # Admin JWT issuance and verification
│   ├── feriados.py     # Brazilian public holiday calendar (per-state)
│   └── chatbot_rh.py   # Groq-powered HR Q&A chatbot
├── services/
│   ├── calculation_engine.py  # Hour calculation: standard / flex / bank-of-hours
│   ├── audit_service.py       # Fire-and-forget audit logger (AuditLogs table)
│   ├── summaries.py           # DailySummary writer
│   └── summary.py             # MonthlySummary aggregation
├── utils/
│   ├── aws.py          # DynamoDB / S3 / Rekognition clients; presigned-URL helpers
│   ├── auth.py         # JWT encode/decode; bcrypt password hashing; @token_required
│   ├── geolocation.py  # Haversine geofence validation
│   └── safe_logger.py  # PII-scrubbing log wrapper
└── config/
    ├── gunicorn.py     # Workers, timeout, bind, pidfile
    └── adapter.py      # Backward-compat shim for legacy config keys
```

---

## Key Design Decisions

**Multi-tenancy at the storage layer.** Every DynamoDB item carries `company_id` as partition key. The `@token_required` decorator validates the JWT and injects `company_id` into the route; every query filters by it — cross-tenant reads are structurally impossible.

**Single-table DynamoDB.** `TimeRecords` uses `company_id` (PK) + `employee_id#date_time` (SK). Point reads, date-range scans per employee, and aggregate dashboard queries all use `query()` — no `scan()` in hot paths.

**Biometric isolation.** Each company has its own Rekognition Face Collection. `SearchFacesByImage` is scoped to that collection so one company's face vectors are never searched against another's.

**Stateless JWT.** Tokens carry `company_id`, `role`, and `usuario_id`. No server-side session state; any Gunicorn worker can serve any request. Token expiry is enforced on every protected route.

**Audit trail.** `services/audit_service.py` writes to `AuditLogs` (DynamoDB) on every mutating operation — record creation, edits, leave entries, atestado substitution, and invalidations — with `before` / `after` snapshots and IP attribution.

---

## Data Flow — Clock-In via Facial Recognition

```
Kiosk (browser) → POST /api/registrar_ponto
  → routes/facial.py
    → S3: save frame temporarily
    → Rekognition SearchFacesByImage (company collection, threshold=85)
    → Validate company_id match (TENANT_MISMATCH check)
    → Write TimeRecords item: company_id / employee_id#timestamp / type / method=FACIAL
    → services/summaries.py: upsert DailySummary
    → Return employee name + clock type to kiosk
```

---

## Calculation Engine

`services/calculation_engine.py` supports three payroll modes:

| Mode | Description |
|---|---|
| `standard` | Fixed daily hours; tracks tardiness, absences, overtime |
| `variable` | Hour-bank accumulation; configurable carry-over rules |
| `interval_manual` | Custom clock-in/out windows per shift |

Overtime (`adicional_noturno`, `hora_extra`) is computed at summary-write time and stored on the `MonthlySummary` record for payroll export.

---

## Local Development

```bash
cd backend
python -m venv venv && source venv/bin/activate   # venv\Scripts\activate on Windows
pip install -r requirements.txt
cp env.example .env   # fill AWS credentials and table names
python app.py
```

The dev server starts on `http://localhost:5000`.

---

## Running Tests

```bash
cd backend
python -m pytest tests/ -v --tb=short
```

The test suite covers the calculation engine exhaustively (standard / variable / interval modes, edge cases for overnight shifts and bank-of-hours overflow).

---

## Production

Deployed on an EC2 instance behind Nginx (TLS termination). Gunicorn runs 3 workers bound to `127.0.0.1:8000`. Graceful reload (zero-downtime):

```bash
kill -HUP $(cat gunicorn.pid)
```

Environment variables are set in `/home/ubuntu/RP_Full/backend/.env` (never committed).
