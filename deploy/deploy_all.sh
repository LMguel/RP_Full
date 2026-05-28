#!/usr/bin/env bash
# =============================================================================
# deploy/deploy_all.sh — Deploy completo: Git + Front + PWA + Backend EC2
# Uso: bash deploy/deploy_all.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$SCRIPT_DIR/.env"

[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

# ─── Configurações (lidas do deploy/.env ou defaults) ─────────────────────────
EC2_HOST="${EC2_HOST:-registra-ponto.duckdns.org}"
EC2_USER="${EC2_USER:-ubuntu}"
EC2_SSH_KEY="${EC2_SSH_KEY:-~/.ssh/registraponto.pem}"
EC2_APP_DIR="${EC2_APP_DIR:-/home/ubuntu/RP_Full/backend}"
S3_FRONT="${S3_BUCKET_FRONT:-app-registra-ponto}"
S3_PWA="${S3_BUCKET_PWA:-pwa-registra-ponto}"
CF_FRONT="${CLOUDFRONT_ID_FRONT:-E34SUQ0BNKFXYE}"
CF_PWA="${CLOUDFRONT_ID_PWA:-E2TE7LW6Z6QARR}"
SSH_OPTS="-i $EC2_SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=20"

STEP=0
ok()  { echo "  ✅ $*"; }
fail(){ echo "  ❌ $*"; exit 1; }
step(){ STEP=$((STEP+1)); echo ""; echo "━━━ [$STEP] $* ━━━"; }

echo "╔══════════════════════════════════════════════╗"
echo "║      DEPLOY COMPLETO — REGISTRA.PONTO        ║"
echo "╚══════════════════════════════════════════════╝"

# ─────────────────────────────────────────────────────────────────────────────
step "Git — commit e push das mudanças"
# ─────────────────────────────────────────────────────────────────────────────
cd "$ROOT_DIR"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "  Arquivos modificados:"
  git status --short
  echo ""
  read -r -p "  Mensagem do commit (Enter para 'deploy: atualização de produção'): " MSG
  MSG="${MSG:-deploy: atualização de produção}"
  git add -A
  git commit -m "$MSG"
  ok "Commit criado: $MSG"
else
  ok "Nada para commitar (working tree limpo)"
fi

git push origin main
ok "Push para main concluído"

# ─────────────────────────────────────────────────────────────────────────────
step "Frontend — build + S3 (app-registra-ponto) + CloudFront"
# ─────────────────────────────────────────────────────────────────────────────
cd "$ROOT_DIR/front"
echo "  Build..."
npm ci --silent && npm run build
[[ ! -f dist/index.html ]] && fail "Build do front falhou"
ok "Build concluído"

echo "  Sync S3 (assets imutáveis)..."
aws s3 sync dist/ "s3://$S3_FRONT" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html" --exclude "*.json" \
  --region us-east-1 --quiet

echo "  Sync S3 (entrypoints sem cache)..."
aws s3 sync dist/ "s3://$S3_FRONT" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --include "index.html" --include "*.json" \
  --region us-east-1 --quiet

echo "  CloudFront invalidation..."
CF_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$CF_FRONT" --paths "/*" \
  --query 'Invalidation.Id' --output text)
ok "Front publicado → https://app.registraponto.app.br  (inv: $CF_ID)"

# ─────────────────────────────────────────────────────────────────────────────
step "PWA Mobile — testes + build + S3 (pwa-registra-ponto) + CloudFront"
# ─────────────────────────────────────────────────────────────────────────────
cd "$ROOT_DIR/pwa-mobile"
echo "  Testes..."
npm ci --silent && npm run test
ok "90/90 testes OK"

echo "  Build..."
npm run build
for f in dist/index.html dist/sw.js dist/manifest.webmanifest; do
  [[ ! -f "$f" ]] && fail "Build do PWA falhou — $f ausente"
done
ok "Build concluído"

echo "  Sync S3 (assets imutáveis)..."
aws s3 sync dist/assets/ "s3://$S3_PWA/assets/" \
  --delete --cache-control "public,max-age=31536000,immutable" \
  --region us-east-1 --quiet

echo "  Sync S3 (sw.js e entrypoints — sem cache para update imediato nos tablets)..."
for file in index.html sw.js manifest.webmanifest registerSW.js; do
  [[ -f "dist/$file" ]] && \
    aws s3 cp "dist/$file" "s3://$S3_PWA/$file" \
      --cache-control "no-cache,no-store,must-revalidate" \
      --region us-east-1 --quiet && \
    echo "    → $file"
done
for wbfile in dist/workbox-*.js; do
  [[ -f "$wbfile" ]] && \
    aws s3 cp "$wbfile" "s3://$S3_PWA/$(basename "$wbfile")" \
      --cache-control "no-cache,no-store,must-revalidate" \
      --region us-east-1 --quiet && \
    echo "    → $(basename "$wbfile")"
done

echo "  CloudFront invalidation..."
CF_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$CF_PWA" --paths "/*" \
  --query 'Invalidation.Id' --output text)
ok "PWA publicado → https://painel.registraponto.app.br  (inv: $CF_ID)"

# ─────────────────────────────────────────────────────────────────────────────
step "Backend EC2 — sync + pip install + restart gunicorn"
# ─────────────────────────────────────────────────────────────────────────────
echo "  Sincronizando código para $EC2_HOST..."
rsync -az --delete \
  --exclude='.env' \
  --exclude='venv/' \
  --exclude='__pycache__/' \
  --exclude='*.pyc' \
  -e "ssh $SSH_OPTS" \
  "$ROOT_DIR/backend/" \
  "$EC2_USER@$EC2_HOST:$EC2_APP_DIR/"
ok "Código sincronizado"

echo "  Instalando dependências (inclui pacotes novos)..."
ssh $SSH_OPTS "$EC2_USER@$EC2_HOST" \
  "cd $EC2_APP_DIR && source venv/bin/activate && pip install -r requirements.txt -q"
ok "pip install concluído (flask-limiter e demais)"

echo "  Reiniciando gunicorn..."
ssh $SSH_OPTS "$EC2_USER@$EC2_HOST" bash <<'REMOTE'
  set -e
  pkill -f gunicorn || true
  sleep 2
  cd ~/RP_Full/backend
  source venv/bin/activate
  gunicorn \
    --workers 3 \
    --bind 127.0.0.1:8000 \
    --timeout 120 \
    --access-logfile /var/log/gunicorn/access.log \
    --error-logfile /var/log/gunicorn/error.log \
    app:app \
    --daemon
  sleep 3
REMOTE

echo "  Health check..."
HEALTH=$(ssh $SSH_OPTS "$EC2_USER@$EC2_HOST" \
  "curl -sf http://localhost:8000/health 2>/dev/null || echo FAIL")
echo "$HEALTH" | grep -q '"status"' || fail "Health check falhou: $HEALTH"
ok "Backend OK → $HEALTH"

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║         ✅  DEPLOY CONCLUÍDO                  ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Front:   https://app.registraponto.app.br   ║"
echo "║  PWA:     https://painel.registraponto.app.br║"
echo "║  API:     https://registra-ponto.duckdns.org ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  Os tablets receberão o novo sw.js e retornam"
echo "  automaticamente para a câmera (@kiosk:active)."
