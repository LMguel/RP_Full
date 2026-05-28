#!/usr/bin/env bash
# deploy/deploy_pwa.sh — Deploy do PWA Mobile para S3 + CloudFront
# Uso: ./deploy/deploy_pwa.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$SCRIPT_DIR/.env"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

S3_BUCKET_PWA="${S3_BUCKET_PWA:-pwa-registra-ponto}"
CLOUDFRONT_ID_PWA="${CLOUDFRONT_ID_PWA:-E2TE7LW6Z6QARR}"

echo "━━━ Deploy PWA → s3://$S3_BUCKET_PWA ━━━"
echo "    CloudFront: $CLOUDFRONT_ID_PWA"
echo ""

cd "$ROOT_DIR/pwa-mobile"
echo "▶ Testes..."
npm ci --silent
npm run test

echo "▶ Build..."
npm run build

for f in dist/index.html dist/sw.js dist/manifest.webmanifest; do
  [[ ! -f "$f" ]] && echo "❌ Build falhou — $f ausente" && exit 1
done

echo "▶ Upload S3 (assets imutáveis com hash)..."
aws s3 sync dist/assets/ "s3://$S3_BUCKET_PWA/assets/" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --region us-east-1

echo "▶ Upload S3 (Service Worker e entrypoints — SEM cache)..."
# sw.js PRECISA de no-cache para que tablets recebam atualizações imediatamente
for file in index.html sw.js manifest.webmanifest registerSW.js; do
  [[ -f "dist/$file" ]] && \
    aws s3 cp "dist/$file" "s3://$S3_BUCKET_PWA/$file" \
      --cache-control "no-cache,no-store,must-revalidate" \
      --region us-east-1 && \
    echo "  → $file"
done

# workbox runtime file
for wbfile in dist/workbox-*.js; do
  [[ -f "$wbfile" ]] && \
    aws s3 cp "$wbfile" "s3://$S3_BUCKET_PWA/$(basename $wbfile)" \
      --cache-control "no-cache,no-store,must-revalidate" \
      --region us-east-1 && \
    echo "  → $(basename $wbfile)"
done

echo "▶ CloudFront invalidation (incluindo /* para garantir sw.js)..."
aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_ID_PWA" \
  --paths "/*" \
  --query 'Invalidation.Id' --output text

echo ""
echo "✅ PWA em produção: https://painel.registraponto.app.br"
echo ""
echo "ℹ  Os tablets vão detectar a nova versão do Service Worker."
echo "   Como kiosk_active está implementado, ao recarregar"
echo "   os tablets retornam automaticamente à tela da câmera."
