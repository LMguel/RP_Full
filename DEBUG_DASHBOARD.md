# 🔍 Debug Dashboard - Nenhum Dado Sendo Exibido

## ✅ Alterações Feitas

### 1. **Logs de Debug Adicionados**
- `console.log` em cada etapa do carregamento
- Verificação de token
- Verificação de resposta da API
- Logs dos dados processados

### 2. **Melhoria no Tratamento de Erros**
- Estado de erro separado do loading
- Mensagem de erro detalhada
- Botão "Tentar Novamente"

### 3. **Verificação de Dados Vazios**
- Warning quando API retorna sem employees
- Fallback visual quando dashboardData é null

---

## 🧪 Como Debugar

### **Passo 1: Abrir Console do Navegador (F12)**

Ao acessar `http://localhost:5173/dashboard`, você verá logs como:

```
🔍 Carregando dashboard para data: 2025-11-13
🔑 User: { ... }
🔑 Token: Presente (ou AUSENTE)
📊 Resposta da API: { date: "2025-11-13", employees: [...], summary: {...} }
✅ Dados processados: { present_today: 1, total_employees: 1, ... }
🎨 Renderizando dashboard com dados: { ... }
```

### **Passo 2: Verificar Erros Comuns**

#### **❌ Erro: "Token AUSENTE"**
**Causa:** Usuário não está logado

**Solução:**
1. Fazer login em `/login`
2. Verificar se token está no localStorage: `localStorage.getItem('token')`

#### **❌ Erro: "401 Unauthorized"**
**Causa:** Token inválido ou expirado

**Solução:**
1. Fazer logout e login novamente
2. Verificar backend rodando: `python app.py`

#### **❌ Erro: "Network Error" ou "Failed to fetch"**
**Causa:** Backend não está rodando ou CORS bloqueado

**Solução:**
```bash
cd backend
python app.py
# Verificar se mostra: "Running on http://localhost:5000"
```

#### **❌ Erro: "Resposta da API sem dados de employees"**
**Causa:** Data selecionada não tem registros

**Solução:**
- Trocar data para `2025-11-13` (tem dados)
- Ou registrar ponto para criar dados hoje

---

## 🧪 Teste Manual da API (HTML Standalone)

**Arquivo criado:** `test_dashboard_frontend.html`

### **Como usar:**

1. **Abrir arquivo no navegador:**
   ```
   Duplo clique em: C:\RP_\REGISTRA.PONTO\test_dashboard_frontend.html
   ```

2. **Fazer login:**
   - Usuario: `aaa`
   - Senha: `aaaaaa`
   - Clicar em "🔐 Login"

3. **Buscar dashboard:**
   - Data: `2025-11-13`
   - Clicar em "📊 Buscar Dashboard"

4. **Verificar resultado:**
   - ✅ Verde = Sucesso
   - ❌ Vermelho = Erro

---

## 🔧 Checklist de Verificação

### **Backend**
- [ ] Backend rodando (`python app.py`)
- [ ] Porta 5000 livre
- [ ] Logs sem erro no terminal
- [ ] Teste da API funcionando:
  ```bash
  cd backend
  python test_dashboard_api.py
  ```

### **Frontend**
- [ ] Frontend rodando (`npm run dev`)
- [ ] Porta 5173 ou 3000
- [ ] Navegador apontando para URL correta
- [ ] Console sem erros (F12)

### **Autenticação**
- [ ] Usuário logado
- [ ] Token no localStorage
- [ ] Token não expirado

### **Dados**
- [ ] Data selecionada correta (2025-11-13)
- [ ] Funcionários cadastrados
- [ ] Registros de ponto existem

---

## 🐛 Possíveis Causas

### **1. Token Ausente/Inválido**
```javascript
// No console, verificar:
localStorage.getItem('token')
// Se retornar null → fazer login
```

### **2. Backend não está rodando**
```bash
# Testar:
curl http://localhost:5000/api/v2/health
# Ou no navegador:
http://localhost:5000/api/v2/health
# Deve retornar: {"status": "ok", "version": "2.0"}
```

### **3. CORS bloqueado**
**Sintoma:** Erro "CORS policy" no console

**Solução:** Verificar `routes_v2.py` linha 35-40:
```python
CORS(routes_v2, resources={
    r"/*": {
        "origins": ["http://localhost:3000", "http://localhost:5173"],
        ...
    }
})
```

### **4. Data sem dados**
**Sintoma:** Cards mostram "0 / 0", listas vazias

**Solução:** Usar data `2025-11-13` ou registrar ponto hoje

---

## 📋 Logs Esperados (Console)

### **✅ Sucesso:**
```
🔍 Carregando dashboard para data: 2025-11-13
🔑 User: {usuario_id: "aaa", company_id: "937373ab-..."}
🔑 Token: Presente
📊 Resposta da API: {
  date: "2025-11-13",
  employees: [{ employee_id: "luis_miguel_aa7c29", ... }],
  summary: { total_employees: 1, present: 1, ... }
}
✅ Dados processados: {
  present_today: 1,
  total_employees: 1,
  worked_hours: 12.0,
  ...
}
🎨 Renderizando dashboard com dados: {...}
```

### **❌ Erro (Token ausente):**
```
🔍 Carregando dashboard para data: 2025-11-13
🔑 User: null
🔑 Token: AUSENTE
❌ Erro ao carregar dashboard: Request failed with status code 401
❌ Detalhes: {error: "Token ausente"}
```

### **❌ Erro (Data sem dados):**
```
🔍 Carregando dashboard para data: 2025-11-15
🔑 Token: Presente
📊 Resposta da API: {
  date: "2025-11-15",
  employees: [],
  summary: { total_employees: 0, present: 0, ... }
}
⚠️ Resposta da API sem dados de employees
✅ Dados processados: { present_today: 0, ... }
🎨 Renderizando dashboard com dados: {...}
```

---

## 🚀 Solução Rápida

### **Se nada funcionar:**

1. **Limpar tudo e recomeçar:**
```bash
# Terminal 1 - Backend
cd C:\RP_\REGISTRA.PONTO\backend
python app.py

# Terminal 2 - Frontend
cd C:\RP_\REGISTRA.PONTO\front
npm run dev
```

2. **Fazer login:**
   - Ir para `http://localhost:5173/login`
   - Usuario: `aaa`
   - Senha: `aaaaaa`

3. **Verificar token:**
   - Abrir console (F12)
   - Digitar: `localStorage.getItem('token')`
   - Deve retornar um JWT longo

4. **Acessar dashboard:**
   - Ir para `http://localhost:5173/dashboard`
   - Trocar data para `2025-11-13`
   - Verificar console para logs

5. **Se ainda não funcionar:**
   - Abrir `test_dashboard_frontend.html` no navegador
   - Fazer login
   - Buscar dashboard
   - Ver exatamente qual erro a API retorna

---

## 📧 Informações para Debug

Ao reportar problema, enviar:

1. **Logs do console do navegador (F12)**
2. **Logs do terminal do backend**
3. **Resultado do `test_dashboard_frontend.html`**
4. **Screenshot da tela**
5. **Data selecionada no dashboard**

---

**Arquivos modificados:**
- ✅ `DashboardPage.tsx` - Logs de debug adicionados
- ✅ `test_dashboard_frontend.html` - Teste manual standalone criado
