#!/usr/bin/env bash
# deploy/deploy_backend.sh — Deploy do backend Flask para EC2
# Uso: ./deploy/deploy_backend.sh [--skip-install]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$SCRIPT_DIR/.env"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

EC2_HOST="${EC2_HOST:-registra-ponto.duckdns.org}"
EC2_USER="${EC2_USER:-ubuntu}"
EC2_SSH_KEY="${EC2_SSH_KEY:-~/.ssh/registraponto.pem}"
EC2_APP_DIR="${EC2_APP_DIR:-/home/ubuntu/RP_Full/backend}"
SKIP_INSTALL="${1:-}"
SSH_OPTS="-i $EC2_SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=15"

echo "━━━ Deploy Backend → $EC2_HOST ━━━"
echo "    Diretório: $EC2_APP_DIR"
echo ""

echo "▶ Sincronizando código..."
rsync -avz --delete \
  --exclude='.env' \
  --exclude='venv/' \
  --exclude='__pycache__/' \
  --exclude='*.pyc' \
  --exclude='.aws-sam/' \
  --exclude='lambda_dependencies/' \
  -e "ssh $SSH_OPTS" \
  "$ROOT_DIR/backend/" \
  "$EC2_USER@$EC2_HOST:$EC2_APP_DIR/"

if [[ "$SKIP_INSTALL" != "--skip-install" ]]; then
  echo "▶ Instalando dependências..."
  ssh $SSH_OPTS "$EC2_USER@$EC2_HOST" \
    "cd $EC2_APP_DIR && source venv/bin/activate && pip install -r requirements.txt -q"
fi

echo "▶ Validando configuração..."
ssh $SSH_OPTS "$EC2_USER@$EC2_HOST" \
  "cd $EC2_APP_DIR && source venv/bin/activate && python -c 'from app import app; print(\"App OK\")'"

echo "▶ Reiniciando gunicorn..."
ssh $SSH_OPTS "$EC2_USER@$EC2_HOST" bash <<'REMOTE'
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
  echo "Gunicorn PID: $(pgrep -f gunicorn | head -1)"
REMOTE

echo "▶ Health check..."
HEALTH=$(ssh $SSH_OPTS "$EC2_USER@$EC2_HOST" "curl -sf http://localhost:8000/health 2>/dev/null || echo 'FAIL'")
if echo "$HEALTH" | grep -q '"status"'; then
  echo "✅ Backend OK: $HEALTH"
else
  echo "❌ Health check falhou: $HEALTH"
  exit 1
fi

echo ""
echo "✅ Backend em produção: https://registra-ponto.duckdns.org"
