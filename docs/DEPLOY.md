# DEPLOY.md — RegistraPonto

## Pré-requisitos

- AWS CLI configurado com permissões: S3, CloudFront, EC2
- SSH access ao servidor EC2 com chave `.pem`
- Node.js ≥ 18, Python ≥ 3.11, git
- Variáveis de ambiente preenchidas (ver `deploy/env.example`)

## Deploy manual passo a passo

### 1. Backend (EC2)

```bash
# No servidor EC2
cd ~/RP_Full
git pull origin main

cd backend
source venv/bin/activate
pip install -r requirements.txt

# Validar configuração
python -c "from app import app; print('OK')"

# Reiniciar gunicorn
pkill -f gunicorn
gunicorn --workers 3 --bind 127.0.0.1:8000 --timeout 120 app:app --daemon

# Verificar saúde
curl -s http://localhost:8000/health
```

### 2. Frontend principal (S3 + CloudFront)

```bash
cd front
npm install
npm run build

aws s3 sync dist/ s3://$S3_BUCKET_FRONT --delete
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"
```

### 3. PWA Mobile (S3 + CloudFront)

```bash
cd pwa-mobile
npm install
npm run build

aws s3 sync dist/ s3://$S3_BUCKET_PWA --delete
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_PWA_ID --paths "/*"
```

## Verificação pós-deploy

```bash
# Backend health
curl https://api.registra-ponto.duckdns.org/health

# Frontend (verificar que não há erros 4xx/5xx)
curl -I https://registra-ponto.duckdns.org

# PWA
curl -I https://pwa.registra-ponto.duckdns.org
```

## Scripts automatizados

Ver `deploy/` para scripts parametrizados:
- `deploy_backend.sh` — rsync + restart gunicorn
- `deploy_front.sh` — build + S3 sync + CloudFront
- `deploy_pwa.sh` — build + S3 sync + CloudFront

## Variáveis de ambiente de produção obrigatórias

```
SECRET_KEY=<≥48 chars, gerado com secrets.token_urlsafe(48)>
JWT_SECRET_KEY=<≥48 chars, diferente do SECRET_KEY>
FLASK_ENV=production
FLASK_DEBUG=False
AWS_DEFAULT_REGION=us-east-1
S3_BUCKET=registraponto-prod-fotos
REKOGNITION_COLLECTION=registraponto-faces
DYNAMODB_TABLE_EMPLOYEES=Employees
DYNAMODB_TABLE_RECORDS=TimeRecords
DYNAMODB_TABLE_USERS=UserCompany
DYNAMODB_TABLE_CONFIG=ConfigCompany
ALLOWED_ORIGINS=https://registra-ponto.duckdns.org,https://pwa.registra-ponto.duckdns.org
ENABLE_HSTS=1
MAX_UPLOAD_MB=10
```

## Rollback rápido

```bash
# Ver últimos deploys
git log --oneline -10

# Reverter para commit anterior
git checkout <commit-hash>
pkill -f gunicorn && gunicorn --workers 3 --bind 127.0.0.1:8000 app:app --daemon
```

Ver `docs/ROLLBACK.md` para procedimento completo.
