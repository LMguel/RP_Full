#!/usr/bin/env bash
# deploy/deploy_front.sh — Deploy do frontend para S3 + CloudFront
# Uso: ./deploy/deploy_front.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$SCRIPT_DIR/.env"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

S3_BUCKET_FRONT="${S3_BUCKET_FRONT:-app-registra-ponto}"
CLOUDFRONT_ID_FRONT="${CLOUDFRONT_ID_FRONT:-E34SUQ0BNKFXYE}"

echo "━━━ Deploy Frontend → s3://$S3_BUCKET_FRONT ━━━"
echo "    CloudFront: $CLOUDFRONT_ID_FRONT"
echo ""

cd "$ROOT_DIR/front"
echo "▶ Build..."
npm ci --silent
npm run build

[[ ! -f "dist/index.html" ]] && echo "❌ Build falhou" && exit 1

echo "▶ Upload S3 (assets imutáveis)..."
aws s3 sync dist/ "s3://$S3_BUCKET_FRONT" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html" \
  --exclude "*.json" \
  --exclude "sw.js" \
  --exclude "workbox-*.js" \
  --region us-east-1

echo "▶ Upload S3 (entrypoints sem cache)..."
aws s3 sync dist/ "s3://$S3_BUCKET_FRONT" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --include "index.html" \
  --include "*.json" \
  --region us-east-1

echo "▶ CloudFront invalidation..."
aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_ID_FRONT" \
  --paths "/*" \
  --query 'Invalidation.Id' --output text

echo ""
echo "✅ Frontend em produção: https://app.registraponto.app.br"
