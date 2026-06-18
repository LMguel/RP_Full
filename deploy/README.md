# Deploy

Deployment scripts for all REGISTRA.PONTO components.

## Infrastructure

| Component | Target | Distribution |
|---|---|---|
| `front/` | S3 `app-registra-ponto` | CloudFront `E2TE7LW6Z6QARR` |
| `pwa-mobile/` | S3 `pwa-registra-ponto` | CloudFront `E34SUQ0BNKFXYE` |
| `admin-portal/` | S3 (see `deploy/.env`) | CloudFront (see `deploy/.env`) |
| `backend/` | EC2 via SSH + rsync | Nginx → Gunicorn `127.0.0.1:8000` |

All AWS resources are in `us-east-1`.

---

## Setup

```bash
cp deploy/env.example deploy/.env
# Fill all values — deploy/.env is in .gitignore and never committed
```

The scripts source `deploy/.env` at startup. If a required variable is unset they fail fast with an error message.

---

## Scripts

### Full deploy (all components)
```bash
bash deploy/deploy_all.sh
```
Commits any pending changes, deploys front + PWA to S3/CloudFront, then rsyncs backend to EC2 and reloads Gunicorn.

### Individual components
```bash
bash deploy/deploy_front.sh      # React admin SPA
bash deploy/deploy_pwa.sh        # Kiosk PWA (runs test suite first)
bash deploy/deploy_admin.sh      # Admin portal (requires S3_BUCKET_ADMIN + CLOUDFRONT_ID_ADMIN)
bash deploy/deploy_backend.sh    # Flask API on EC2
```

---

## Backend — Graceful Reload (zero downtime)

Gunicorn supports SIGHUP for a rolling worker restart — no requests are dropped:

```bash
ssh ubuntu@registra-ponto.duckdns.org 'kill -HUP $(cat ~/RP_Full/backend/gunicorn.pid)'
```

Use full restart only if the pidfile is stale or Gunicorn is unresponsive:

```bash
pkill -f gunicorn
sleep 2
cd ~/RP_Full/backend && source venv/bin/activate
gunicorn --workers 3 --bind 127.0.0.1:8000 --daemon app:app
```

---

## Cache Strategy

Static assets with a content hash in the filename (`index-Ab3x.js`) are served with `max-age=31536000,immutable`. Entry points (`index.html`, `*.json`, `sw.js`) use `no-cache` — CloudFront invalidation (`/*`) propagates the new version to all edge nodes in ~30 seconds.

The PWA Service Worker (`sw.js`) requires `no-cache` so tablets pick up updates on next heartbeat without manual intervention.

---

## Secrets

`deploy/.env` is in `.gitignore`. It is the single source of truth for all deployment parameters (host, SSH key path, bucket names, CloudFront IDs, app secrets). The `env.example` file documents every required variable without real values.
