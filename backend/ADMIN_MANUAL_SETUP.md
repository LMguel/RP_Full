# Manual: Criar Tabela AdminUsers na AWS Console

## 1. Criar Tabela DynamoDB

### Passo 1: Acessar DynamoDB
1. Acesse [AWS Console - DynamoDB](https://console.aws.amazon.com/dynamodb/)
2. Clique em **Criar tabela**

### Passo 2: Configurar Tabela
Preencha com:
- **Nome da tabela**: `AdminUsers`
- **Chave de partição**: `login` (String)
- **Chave de classificação**: (deixar em branco)
- **Modo de faturamento**: Sob demanda (PAY_PER_REQUEST)

### Passo 3: Criar
Clique em **Criar tabela**

Aguarde até a status ficar **ATIVO** (geralmente alguns segundos)

---

## 2. Inserir Admin Manualmente

### Passo 1: Abrir Tabela
1. Na lista de tabelas, clique em **AdminUsers**
2. Clique na aba **Explorar itens**

### Passo 2: Criar Item
Clique em **Criar item**

### Passo 3: Preencher Dados
Adicione os atributos:

| Atributo | Tipo | Valor |
|----------|------|-------|
| `login` | String | `admin` |
| `password` | String | `Admin@123456` |

**Como adicionar atributos na AWS Console**:
1. O campo `login` já vem pré-preenchido (é a chave de partição)
2. Para adicionar `password`: 
   - Clique em **Adicionar novo atributo**
   - Selecione **String**
   - Preencha nome: `password`
   - Preencha valor: `Admin@123456`

### Passo 4: Salvar
Clique em **Criar item**

---

## 3. Testar Login

### Criar Múltiplos Admins (Opcional)
Você pode criar quantos admins quiser repetindo o processo acima com logins diferentes.

**Exemplo**:
```
login: admin
password: Senha@123

login: gerente  
password: Outra@Senha123
```

---

## 4. Estrutura Final da Tabela

```
AdminUsers
├── login (PK, String)
└── password (String)
```

**Exemplo de um item**:
```json
{
  "login": "admin",
  "password": "Admin@123456"
}
```

---

## 5. Fazer Login no Portal

1. Acesse `http://localhost:5173/login`
2. Preencha:
   - **Login**: `admin`
   - **Senha**: `Admin@123456`
3. Clique em **Entrar**

---

## ⚠️ Importante

- **Não use** este setup em produção com senhas em texto plano
- A senha é armazenada **sem criptografia** - apenas para desenvolvimento
- Para produção, considere usar bcrypt ou equivalente
- Mude as senhas após o primeiro login

---

## 🆘 Troubleshooting

### Erro: "Login ou senha incorretos"
1. Verifique se a tabela **AdminUsers** foi criada
2. Verifique se o item foi inserido corretamente
3. Verifique se os valores de login/senha estão corretos (case-sensitive)

### Erro: "Erro interno do servidor"
1. Verifique se o backend está rodando (`python app.py`)
2. Verifique se as credenciais AWS estão configuradas no `.env`

### Não consigo ver a tabela no console
1. Verifique se está na região **us-east-1**
2. Refresque a página (F5)
