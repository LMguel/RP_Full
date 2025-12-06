# Setup Completo: Autenticação de Admins via DynamoDB

## 📋 Resumo das Mudanças

### Backend (`backend/`)

1. **`create_admin_users_table.py`** ✨ NOVO
   - Script para criar a tabela DynamoDB `AdminUsers` com GSI
   - Uso: `python create_admin_users_table.py`

2. **`generate_admin_user.py`** ✨ NOVO
   - Script para gerar hash bcrypt de senha e inserir admin
   - Uso: `python generate_admin_user.py [--insert]`
   - Com `--insert`: insere diretamente no DynamoDB

3. **`routes_admin_auth.py`** ✨ NOVO
   - Endpoints de autenticação admin:
     - `POST /api/auth/admin-login` - Login com email + senha
     - `POST /api/auth/admin-logout` - Logout
     - `GET /api/auth/admin-verify` - Verificar token

4. **`app.py`** 🔄 ATUALIZADO
   - Importa `routes_admin_auth`
   - Registra blueprint de autenticação admin

5. **`requirements.txt`** 🔄 ATUALIZADO
   - Adicionado: `bcrypt==4.3.0`

6. **`ADMIN_SETUP.md`** ✨ NOVO
   - Guia completo de setup (em português)
   - Instruções de credenciais AWS
   - Troubleshooting

### Frontend (`admin-portal/`)

1. **`src/context/AuthContext.tsx`** 🔄 ATUALIZADO
   - Função `login` agora chama `/api/auth/admin-login`
   - Integração com backend real (em vez de mock)
   - Usa `VITE_API_URL` para configurar URL da API

2. **`.env.example`** ✨ NOVO
   - Template de variáveis de ambiente
   - Exemplo: `VITE_API_URL=http://localhost:5000`

3. **`.env.local`** ✨ NOVO
   - Configuração local (dev)
   - Deve ser adicionado a `.gitignore`

---

## 🚀 Quick Start

### 1. Criar Tabela DynamoDB

```bash
cd backend

# Configure credenciais AWS
$env:AWS_ACCESS_KEY_ID = "sua_access_key"
$env:AWS_SECRET_ACCESS_KEY = "sua_secret_key"

# Criar tabela
python create_admin_users_table.py
```

### 2. Criar Primeiro Admin

```bash
# Opção A: Inserção automática (recomendado)
python generate_admin_user.py --insert

# Opção B: Apenas gerar hash (para inserir manualmente no console)
python generate_admin_user.py
```

### 3. Iniciar Backend

```bash
python app.py
# ou
python start.py
```

Backend estará em: `http://localhost:5000`

### 4. Iniciar Frontend

```bash
cd ../admin-portal
npm run dev
```

Frontend estará em: `http://localhost:5173`

### 5. Testar Login

Acesse `http://localhost:5173/login` e use:
- **Email**: seu email cadastrado
- **Senha**: a senha que definiu

---

## 🔐 Fluxo de Autenticação

```
1. User submits email + password
   ↓
2. POST /api/auth/admin-login (backend)
   ↓
3. Backend busca admin por email (GSI)
   ↓
4. Backend verifica hash bcrypt
   ↓
5. Se válido: gera JWT token
   ↓
6. Frontend recebe token + admin info
   ↓
7. Frontend armazena em localStorage
   ↓
8. Requisições subsequentes: Authorization: Bearer <token>
```

---

## 📝 Estrutura de Dados

### Tabela AdminUsers

```
Partition Key: admin_id (String)

Attributes:
  - admin_id: "admin-root" (ou similar)
  - email: "admin@empresa.com"
  - password_hash: "$2b$12$..." (bcrypt)
  - role: "super_admin"

GSI:
  - email_index (Partition Key: email)
```

### JWT Token Payload

```json
{
  "admin_id": "admin-root",
  "email": "admin@empresa.com",
  "role": "super_admin",
  "iat": 1701700000,
  "exp": 1701786400
}
```

---

## 🛠️ Troubleshooting

### AWS Credentials Error

Se receber `botocore.exceptions.NoCredentialsError`:

```bash
# Verificar variáveis de ambiente
$env:AWS_ACCESS_KEY_ID
$env:AWS_SECRET_ACCESS_KEY

# ou configurar via arquivo (~/.aws/credentials)
[default]
aws_access_key_id = sua_access_key
aws_secret_access_key = sua_secret_key
```

### Login Falha

1. Verifique se a tabela `AdminUsers` existe
2. Verifique se o admin está no DynamoDB
3. Tente gerar novo hash com `python generate_admin_user.py`
4. Verifique logs do backend

### Frontend Não Conecta ao Backend

1. Backend está rodando em `http://localhost:5000`?
2. CORS está ativado (deve estar em `app.py`)
3. Verifique `VITE_API_URL` em `.env.local`

---

## 🔒 Segurança

### Recomendações

- ✅ Senhas com bcrypt (12 rounds)
- ✅ JWT tokens com expiração (24h padrão)
- ✅ CORS restrito para domínios conhecidos
- ⚠️ JWT_SECRET_KEY: mude em produção
- ⚠️ Implemente rate limiting para login
- ⚠️ Adicione 2FA em produção

### Variáveis de Ambiente (produção)

```bash
# backend/.env
JWT_SECRET_KEY=sua_chave_super_secreta_aqui
JWT_EXPIRATION_HOURS=24
AWS_REGION=us-east-1
```

---

## 📚 Arquivos Relacionados

- **ADMIN_SETUP.md**: Guia detalhado em português
- **routes_admin_auth.py**: Implementação dos endpoints
- **AuthContext.tsx**: Contexto de autenticação frontend
- **app.py**: Registro do blueprint de rotas

---

## ✅ Próximos Passos

1. ✅ Tabela DynamoDB criada
2. ✅ Scripts de setup criados
3. ✅ Backend endpoints implementados
4. ✅ Frontend integrado com backend
5. ⏳ **A fazer**: Implementar refresh token
6. ⏳ **A fazer**: Adicionar 2FA
7. ⏳ **A fazer**: Rate limiting
8. ⏳ **A fazer**: Auditoria de logins

---

## 📞 Suporte

Para dúvidas ou problemas, consulte `ADMIN_SETUP.md` para instruções detalhadas.
