# ROLLBACK.md — RegistraPonto

## Quando fazer rollback

- Deploy causou erros 5xx em >5% das requests
- Funcionalidade crítica quebrada (login, kiosk, sync)
- Dados corrompidos ou perdidos
- Vulnerabilidade de segurança introduzida

## Checklist antes do rollback

- [ ] Identificar o commit que causou o problema (`git log --oneline`)
- [ ] Confirmar que a versão anterior funcionava
- [ ] Notificar time sobre rollback
- [ ] Verificar se há migrações de banco (DynamoDB) que precisam ser revertidas

> **ATENÇÃO**: DynamoDB não tem rollback automático. Se o deploy alterou dados,
> um script manual de reversão pode ser necessário.

## Rollback do backend

```bash
# 1. Identificar versão estável anterior
git log --oneline -5

# 2. Fazer checkout da versão anterior
git checkout <commit-hash-anterior>

# 3. Reinstalar dependências se necessário
cd backend
source venv/bin/activate
pip install -r requirements.txt

# 4. Reiniciar gunicorn
pkill -f gunicorn
gunicorn --workers 3 --bind 127.0.0.1:8000 --timeout 120 app:app --daemon

# 5. Verificar saúde imediatamente
sleep 3
curl -s http://localhost:8000/health

# 6. Voltar ao branch principal após rollback
git checkout main
```

## Rollback do frontend (S3)

```bash
# Versões anteriores ficam no histórico de git
git checkout <commit-hash-anterior> -- front/dist

# Ou rebuildar a versão anterior
git checkout <commit-hash-anterior>
cd front && npm run build
aws s3 sync dist/ s3://$S3_BUCKET_FRONT --delete
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"

git checkout main
```

## Rollback do PWA

```bash
git checkout <commit-hash-anterior>
cd pwa-mobile && npm run build
aws s3 sync dist/ s3://$S3_BUCKET_PWA --delete
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_PWA_ID --paths "/*"
git checkout main
```

## Verificação pós-rollback

```bash
# 1. Health check
curl https://api.registra-ponto.duckdns.org/health

# 2. Testar login empresa
# 3. Testar login funcionário
# 4. Testar kiosk (reconhecimento facial)
# 5. Testar offline e sync

# 6. Monitorar logs por 15 minutos
tail -f /var/log/gunicorn/error.log
```

## Comunicação durante rollback

1. Notificar usuários afetados se downtime > 5 min
2. Registrar: data/hora, causa, versão revertida, duração
3. Criar post-mortem em até 24h

## Prevenção

- Nunca fazer deploy na sexta-feira tarde
- Sempre testar em ambiente staging antes
- Manter `git tag v{major}.{minor}.{patch}` em releases estáveis
- GitHub Actions valida build antes de deploy (ver `.github/workflows/`)
