#!/usr/bin/env bash
# deploy/deploy_admin.sh — Deploy the Admin Portal SPA to S3 + CloudFront
# Usage: ./deploy/deploy_admin.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$SCRIPT_DIR/.env"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

S3_BUCKET_ADMIN="${S3_BUCKET_ADMIN:?S3_BUCKET_ADMIN must be set in deploy/.env}"
CLOUDFRONT_ID_ADMIN="${CLOUDFRONT_ID_ADMIN:?CLOUDFRONT_ID_ADMIN must be set in deploy/.env}"

echo "━━━ Deploy Admin Portal → s3://$S3_BUCKET_ADMIN ━━━"
echo "    CloudFront: $CLOUDFRONT_ID_ADMIN"
echo ""

cd "$ROOT_DIR/admin-portal"
echo "▶ Build..."
npm ci --silent
npm run build

[[ ! -f "dist/index.html" ]] && echo "❌ Build failed" && exit 1

echo "▶ Upload S3 (immutable hashed assets)..."
aws s3 sync dist/ "s3://$S3_BUCKET_ADMIN" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html" \
  --exclude "*.json" \
  --region us-east-1

echo "▶ Upload S3 (entrypoints — no cache)..."
aws s3 sync dist/ "s3://$S3_BUCKET_ADMIN" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --include "index.html" \
  --include "*.json" \
  --region us-east-1

echo "▶ CloudFront invalidation..."
aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_ID_ADMIN" \
  --paths "/*" \
  --query 'Invalidation.Id' --output text

echo ""
echo "✅ Admin Portal deployed"
