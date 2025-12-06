# Setup de Autenticação Admin - Portal Administrativo

## Pré-requisitos

1. **Tabela DynamoDB criada**: `AdminUsers`
2. **AWS Credentials configuradas** no seu ambiente
3. **Python 3.8+** com `boto3` e `bcrypt` instalados

## Estrutura da Tabela AdminUsers

```
Partition Key: admin_id (String)
Attributes:
  - admin_id (String): identificador único do admin (PK)
  - email (String): email para login
  - password_hash (String): hash bcrypt da senha
  - role (String): "super_admin"
```

### Global Secondary Index
- **Index Name**: `email_index`
- **Partition Key**: `email`
- **Projection**: ALL

---

## 1️⃣ Criar a Tabela DynamoDB

### Opção A: Via Script Python (Recomendado)

```bash
cd backend

# Configure as credenciais AWS (veja seção abaixo)

# Criar a tabela
python create_admin_users_table.py
```

**Saída esperada**:
```
Creating table 'AdminUsers' in region us-east-1...
CreateTable submitted. Current status: CREATING
Waiting for table to become ACTIVE...
Table 'AdminUsers' is ACTIVE.
```

### Opção B: Via AWS Console

1. Acesse **DynamoDB** no console AWS
2. Clique em **Create table**
3. Configure:
   - **Table name**: `AdminUsers`
   - **Partition key**: `admin_id` (String)
4. Clique em **Create**
5. Após criação, vá para **Indexes**:
   - Crie GSI com:
     - **Index name**: `email_index`
     - **Partition key**: `email`
     - **Projection type**: All

---

## 2️⃣ Configurar Credenciais AWS

### Opção A: Variáveis de Ambiente (Recomendado para local development)

**PowerShell**:
```powershell
$env:AWS_ACCESS_KEY_ID = "sua_access_key"
$env:AWS_SECRET_ACCESS_KEY = "sua_secret_key"
$env:AWS_REGION = "us-east-1"  # opcional, default é us-east-1
```

**CMD**:
```batch
set AWS_ACCESS_KEY_ID=sua_access_key
set AWS_SECRET_ACCESS_KEY=sua_secret_key
set AWS_REGION=us-east-1
```

### Opção B: Arquivo `~/.aws/credentials`

Crie ou edite `C:\Users\SEU_USUARIO\.aws\credentials`:

```ini
[default]
aws_access_key_id = sua_access_key
aws_secret_access_key = sua_secret_key

[my-profile]
aws_access_key_id = outra_access_key
aws_secret_access_key = outra_secret_key
```

Depois use:
```powershell
$env:AWS_PROFILE = "my-profile"
python create_admin_users_table.py
```

### Opção C: Arquivo `~/.aws/config`

```ini
[default]
region = us-east-1

[profile my-profile]
region = us-east-1
```

---

## 3️⃣ Criar Primeiro Admin (Super Admin)

### Opção A: Gerar Hash e Inserir via Script (Automático)

```bash
python generate_admin_user.py --insert
```

Será solicitado:
1. Email do admin
2. Senha (será pedida confirmação)

O script irá:
- Gerar hash bcrypt da senha
- Criar `admin_id` único
- **Inserir automaticamente no DynamoDB**

**Saída esperada**:
```
============================================================
AdminUsers - Password Hash Generator
============================================================

Enter admin email: admin@empresa.com
Enter password (min 8 chars):
Confirm password:

✅ Password hash generated:

email:          admin@empresa.com
password_hash:  $2b$12$...xQg46JqM1M...
```

### Opção B: Gerar Hash Manualmente

```bash
python generate_admin_user.py
```

Será exibido o hash. Copie e insira manualmente no console AWS:

1. Acesse **DynamoDB** > **Tables** > **AdminUsers**
2. Clique em **Create item**
3. Adicione os atributos:
   - `admin_id` (String): `admin-root` ou similar
   - `email` (String): seu email
   - `password_hash` (String): cole o hash gerado
   - `role` (String): `super_admin`

---

## 4️⃣ Testar Autenticação

### Via cURL

```bash
curl -X POST http://localhost:5000/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"admin@empresa.com\",
    \"password\": \"SuaSenha123\"
  }"
```

**Resposta esperada**:
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "admin": {
    "admin_id": "admin-root",
    "email": "admin@empresa.com",
    "role": "super_admin"
  }
}
```

### Via Portal Admin (Frontend)

1. Acesse `http://localhost:5173/login`
2. Login com:
   - **Email**: seu email
   - **Senha**: sua senha

---

## 🔒 Segurança

### Recomendações

1. **Senhas fortes**: mínimo 12 caracteres com números e símbolos
2. **2FA**: considere implementar 2FA no futuro
3. **Rotate credentials**: atualize access keys periodicamente
4. **IAM policies**: restrinja permissões DynamoDB ao mínimo necessário

### Exemplo IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/AdminUsers"
    }
  ]
}
```

---

## 🛠️ Troubleshooting

### Erro: "Unable to locate credentials"

Verifique se as credenciais AWS estão configuradas:

```bash
# PowerShell
$env:AWS_ACCESS_KEY_ID
$env:AWS_SECRET_ACCESS_KEY

# ou verifique o arquivo
cat ~/.aws/credentials
```

### Erro: "ResourceNotFoundException"

A tabela pode não existir. Execute:

```bash
python create_admin_users_table.py
```

### Erro: "ValidationException: One or more parameter values were invalid"

Verifique que:
- `admin_id` é string e não vazio
- `email` é string e válido
- `password_hash` é string (formato bcrypt)
- `role` é exatamente `"super_admin"`

---

## 📝 Exemplo de Fluxo Completo

```bash
# 1. Ativar ambiente virtual
.\.venv\Scripts\Activate.ps1

# 2. Configurar credenciais
$env:AWS_ACCESS_KEY_ID = "AKIA..."
$env:AWS_SECRET_ACCESS_KEY = "..."
$env:AWS_REGION = "us-east-1"

# 3. Criar tabela
python create_admin_users_table.py

# 4. Criar primeiro admin (com inserção automática)
python generate_admin_user.py --insert

# 5. Testar login
curl -X POST http://localhost:5000/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@empresa.com", "password": "..."}'
```

---

## 📚 Referências

- [AWS DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)
- [Boto3 DynamoDB Guide](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/dynamodb.html)
- [bcrypt documentation](https://github.com/pyca/bcrypt)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
