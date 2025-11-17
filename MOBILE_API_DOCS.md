# 📱 API para App Mobile - Login de Funcionários

## 📋 Resumo da Implementação

Sistema de autenticação para funcionários acessarem seus próprios registros de ponto via app mobile.

---

## 🔐 Autenticação

### 1. Cadastro de Funcionário (Feito pelo Gestor)

**Endpoint:** `POST /api/cadastrar_funcionario`  
**Autenticação:** Token do Gestor  
**Body (JSON):**
```json
{
  "nome": "João Silva",
  "cpf": "12345678901",
  "cargo": "Desenvolvedor",
  "horario_entrada": "09:00",
  "horario_saida": "18:00",
  "email": "joao.silva@empresa.com",
  "senha": "senha123"
}
```

**Resposta (201):**
```json
{
  "success": true,
  "id": "joão_silva_abc123",
  "nome": "João Silva",
  "cargo": "Desenvolvedor",
  "foto_url": null
}
```

**Campos opcionais:**
- `email` - Email do funcionário (necessário para login mobile)
- `senha` - Senha para acesso mobile (será armazenada com hash)

---

### 2. Login do Funcionário

**Endpoint:** `POST /api/funcionario/login`  
**Autenticação:** Nenhuma (público)  
**Body (JSON):**
```json
{
  "email": "joao.silva@empresa.com",
  "senha": "senha123"
}
```

**Resposta (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "funcionario": {
    "id": "joão_silva_abc123",
    "nome": "João Silva",
    "cargo": "Desenvolvedor",
    "email": "joao.silva@empresa.com",
    "horario_entrada": "09:00",
    "horario_saida": "18:00"
  }
}
```

**Erros:**
- `401` - Email ou senha inválidos
- `403` - Funcionário não tem acesso configurado (sem email/senha cadastrados)

**Token JWT contém:**
- `funcionario_id` - ID do funcionário
- `nome` - Nome completo
- `empresa_nome` - Nome da empresa
- `company_id` - ID da empresa
- `cargo` - Cargo do funcionário
- `tipo` - "funcionario" (identifica que é token de funcionário)
- `exp` - Expira em 24 horas

---

## 📊 Endpoints para Funcionários

### 3. Meus Registros

**Endpoint:** `GET /api/funcionario/registros`  
**Autenticação:** Token do Funcionário  
**Headers:**
```
Authorization: Bearer <token>
```

**Query Params (opcionais):**
- `inicio` - Data inicial (formato: YYYY-MM-DD) - ex: 2025-11-01
- `fim` - Data final (formato: YYYY-MM-DD) - ex: 2025-11-30

**Exemplo:**
```
GET /api/funcionario/registros?inicio=2025-11-01&fim=2025-11-30
```

**Resposta (200):**
```json
[
  {
    "company_id": "abc123...",
    "employee_id#date_time": "joão_silva_abc123#2025-11-10 09:00:00",
    "registro_id": "reg123...",
    "funcionario_id": "joão_silva_abc123",
    "data_hora": "10-11-2025 09:00:00",
    "tipo": "entrada",
    "empresa_nome": "Empresa XYZ"
  },
  {
    "company_id": "abc123...",
    "employee_id#date_time": "joão_silva_abc123#2025-11-10 18:00:00",
    "registro_id": "reg456...",
    "funcionario_id": "joão_silva_abc123",
    "data_hora": "10-11-2025 18:00:00",
    "tipo": "saída",
    "empresa_nome": "Empresa XYZ",
    "horas_trabalhadas_minutos": 480,
    "horas_extras_minutos": 0,
    "atraso_minutos": 0
  }
]
```

**Erros:**
- `403` - Token não é de funcionário ou acesso negado

---

## 🔒 Segurança

### Separação de Acesso

- **Gestor** (token do endpoint `/api/login`):
  - Pode acessar: `/api/registros`, `/api/registros/resumo`, `/api/funcionarios`
  - NÃO pode acessar: `/api/funcionario/registros`

- **Funcionário** (token do endpoint `/api/funcionario/login`):
  - Pode acessar: `/api/funcionario/registros` (apenas seus próprios)
  - NÃO pode acessar: `/api/registros`, `/api/registros/resumo`, `/api/funcionarios`

### Proteções Implementadas

1. ✅ Email único por empresa (não pode cadastrar dois funcionários com mesmo email)
2. ✅ Senha armazenada com bcrypt hash
3. ✅ Token JWT expira em 24 horas
4. ✅ Funcionário só vê seus próprios registros
5. ✅ Endpoints de gestor bloqueados para funcionários

---

## 📱 Fluxo do App Mobile

```
1. Tela de Login
   └─> POST /api/funcionario/login
       └─> Salvar token no storage
       
2. Tela Principal (Dashboard)
   └─> GET /api/funcionario/registros?inicio=hoje&fim=hoje
       └─> Mostrar registros do dia
       
3. Tela de Histórico
   └─> GET /api/funcionario/registros?inicio=mes_atual_inicio&fim=mes_atual_fim
       └─> Mostrar registros do mês
       └─> Calcular total de horas
```

---

## 🧪 Testes

Execute o teste completo:
```bash
cd backend
python test_login_funcionario.py
```

**O teste valida:**
- ✅ Cadastro de funcionário com email e senha
- ✅ Login de funcionário
- ✅ Funcionário consegue ver seus registros
- ✅ Funcionário NÃO consegue acessar endpoints de gestor
- ✅ Senha incorreta é rejeitada

---

## 💡 Próximos Passos para Mobile

### Funcionalidades Sugeridas:

1. **Tela de Login**
   - Input de email e senha
   - Botão "Lembrar-me" (salvar credenciais)
   - Link "Esqueci minha senha"

2. **Dashboard**
   - Card com foto do funcionário
   - Horário de entrada/saída esperado
   - Último registro do dia
   - Botão para registrar ponto (via foto)

3. **Histórico**
   - Lista de registros por data
   - Filtro por mês
   - Indicador de horas extras/atrasos
   - Botão para exportar PDF

4. **Perfil**
   - Dados do funcionário
   - Horários
   - Botão "Alterar senha"
   - Botão "Sair"

---

## 🔧 Configuração no Frontend Web

O gestor precisa cadastrar funcionários com email e senha através do painel web:

1. Ir em "Funcionários"
2. Clicar em "Adicionar Funcionário"
3. Preencher dados + **Email** + **Senha**
4. Salvar

O funcionário poderá então usar essas credenciais no app mobile.

---

## 📝 Notas Importantes

- **Email** e **Senha** são **opcionais** no cadastro
- Funcionários SEM email/senha NÃO poderão fazer login no app mobile
- Apenas funcionários COM email/senha cadastrados têm acesso mobile
- O gestor pode adicionar email/senha posteriormente (via edição do funcionário)

---

## 🎯 Exemplo de Uso Completo

```javascript
// 1. Login
const loginResponse = await fetch('http://api.empresa.com/api/funcionario/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'joao.silva@empresa.com',
    senha: 'senha123'
  })
});

const { token, funcionario } = await loginResponse.json();
// Salvar token no AsyncStorage/SecureStore

// 2. Buscar registros de hoje
const hoje = new Date().toISOString().split('T')[0];
const registrosResponse = await fetch(
  `http://api.empresa.com/api/funcionario/registros?inicio=${hoje}&fim=${hoje}`,
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const registros = await registrosResponse.json();
// Mostrar registros na tela
```

---

## ✅ Status

- ✅ Backend implementado
- ✅ Testes passando
- ✅ Segurança validada
- ✅ Documentação completa
- ⏳ Frontend web (adicionar campos email/senha no formulário)
- ⏳ App mobile (implementar telas)
