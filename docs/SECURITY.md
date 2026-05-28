# SECURITY.md — RegistraPonto

## Contato para reportar vulnerabilidades

Envie um e-mail para o time de engenharia com o subject `[SECURITY]`. NÃO abra issues públicas.

---

## Arquitetura de segurança

### Autenticação
| Tipo | Método | Expiração |
|------|--------|-----------|
| Funcionário | JWT HS256 via `SECRET_KEY` | 12h |
| Empresa | JWT HS256 via `SECRET_KEY` | 12h |
| Admin | JWT HS256 via `JWT_SECRET_KEY` | 8h |

- Tokens armazenados em `localStorage` (risco XSS — ver mitigação abaixo)
- `@token_required` decorator valida e extrai `company_id` do JWT em todas as rotas
- Admin endpoints protegidos por `@admin_required` (role=super_admin)

### Multi-tenant
- `company_id` extraído **sempre** do JWT — nunca do request body
- `facial.py` tem isolamento de dupla camada (Rekognition + DynamoDB)
- Comentários de invariantes de segurança em `facial.py`

### Senhas
- Funcionários/Empresas: bcrypt via `bcrypt.hashpw()`
- Admins: bcrypt (migração automática de legado plaintext no próximo login)
- **PROIBIDO**: `senha_original`, `password` em plaintext no DynamoDB

### Logs
- Nenhuma senha, token ou dados biométricos em logs
- `safe_logger.py` com `mask_token()`, `sanitize_log_data()`
- `drop_console: true` nos builds de produção (front + PWA)

---

## Checklist de segurança — produção

### Antes de cada deploy
- [ ] `FLASK_DEBUG=False` no servidor
- [ ] `FLASK_ENV=production` no servidor
- [ ] `JWT_SECRET_KEY` diferente do `SECRET_KEY`
- [ ] Ambas as chaves com ≥48 chars (geradas com `secrets.token_urlsafe(48)`)
- [ ] `ALLOWED_ORIGINS` limitado aos domínios reais
- [ ] Credenciais AWS via IAM Role (não via env vars hardcoded)
- [ ] `ENABLE_HSTS=1` quando HTTPS estiver ativo
- [ ] `MAX_UPLOAD_MB=10` confirmado

### Após cada deploy
- [ ] `GET /health` retorna 200 com todos os serviços `ok`
- [ ] Testar login empresa e funcionário
- [ ] Testar kiosk online e offline
- [ ] Verificar que `/api/admin/*` retorna 401 sem token

---

## Gestão de incidentes

### Comprometimento de credenciais AWS
1. Revogar imediatamente no IAM Console
2. Gerar novas credenciais
3. Atualizar variáveis de ambiente no servidor
4. Reiniciar gunicorn: `pkill gunicorn && gunicorn ...`
5. Verificar CloudTrail para ações não autorizadas

### Comprometimento do SECRET_KEY
1. Gerar novo: `python -c "import secrets; print(secrets.token_urlsafe(48))"`
2. Atualizar variável no servidor
3. **Todos os tokens em uso serão invalidados** (usuários precisam relogar)
4. Reiniciar gunicorn

### Vazamento de dados
1. Identificar a empresa afetada (via logs com X-Request-ID)
2. Revogar token da sessão afetada (sem blacklist atual — aguardar expiração 12h)
3. Notificar ANPD em até 72h (LGPD Art. 48)
4. Documentar incidente no registro interno

---

## Riscos conhecidos e aceitos

| Risco | Nível | Motivo aceito |
|-------|-------|---------------|
| Tokens em localStorage | Médio | XSS improvável em app controlado; httpOnly cookies exigem backend mudança |
| DynamoDB scans em admin | Médio | Admin legítimo; volume baixo em dev |
| S3 URLs permanentes em dados legados | Médio | generate_presigned_url disponível para novas fotos |
| Rate limit in-memory | Médio | Multi-worker exigiria Redis; deploy single-worker atual |
