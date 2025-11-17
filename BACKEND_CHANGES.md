# 🔧 Backend - Mudanças Implementadas

## ✅ Implementações Concluídas

### 1. **Sistema de Geolocalização**

#### Novo arquivo: `geolocation_utils.py`
Funções utilitárias para validação de geolocalização:
- `calcular_distancia()`: Calcula distância entre duas coordenadas usando fórmula de Haversine
- `validar_localizacao()`: Verifica se usuário está dentro do raio permitido
- `formatar_distancia()`: Formata distância para exibição (metros ou km)

#### Endpoint `/configuracoes` ATUALIZADO
Novos campos adicionados:
```python
{
  "latitude_empresa": float,          # Latitude da sede da empresa
  "longitude_empresa": float,         # Longitude da sede da empresa
  "raio_permitido": int,              # Raio em metros (padrão: 100m)
  "exigir_localizacao": bool          # Se True, bloqueia registro fora do raio
}
```

### 2. **Endpoint `/registrar_ponto` ATUALIZADO**

#### Validação de Geolocalização
Agora aceita parâmetros adicionais via FormData:
- `latitude`: Latitude do usuário (opcional)
- `longitude`: Longitude do usuário (opcional)

**Lógica de Validação:**
1. Se funcionário for `home_office=True`: **não valida localização**
2. Se empresa configurou `exigir_localizacao=True`:
   - Calcula distância entre usuário e empresa
   - Se distância > `raio_permitido`: **bloqueia registro** (HTTP 403)
   - Retorna mensagem: `"Você está muito longe da empresa. Distância: X.Xkm"`
3. Se `exigir_localizacao=False`: permite registro de qualquer lugar

**Respostas de Erro Específicas:**
```json
// Fora do raio
{
  "success": false,
  "message": "Você está muito longe da empresa. Distância: 1.2km",
  "fora_do_raio": true,
  "distancia": 1234.56
}

// Localização obrigatória mas não enviada
{
  "success": false,
  "message": "Localização é obrigatória para registrar ponto",
  "localizacao_obrigatoria": true
}
```

### 3. **Endpoint `/cadastrar_funcionario` ATUALIZADO**

Novo campo adicionado:
```python
{
  "home_office": bool  # Se True, funcionário não precisa estar na empresa
}
```

**Comportamento:**
- Funcionários com `home_office=True` podem registrar ponto de qualquer lugar
- Útil para: trabalho remoto, vendedores externos, etc.

### 4. **Estrutura de Dados - Tabela Employees**

Novos campos no schema:
```python
{
  "home_office": bool,           # Indica se funcionário trabalha remotamente
  "email": str,                  # Email para login no app individual
  "senha_hash": str              # Senha criptografada para login
}
```

### 5. **Estrutura de Dados - Tabela ConfigCompany**

Schema atualizado:
```python
{
  "company_id": str,                      # HASH key
  "tolerancia_atraso": int,               # Minutos de tolerância
  "hora_extra_entrada_antecipada": bool,
  "arredondamento_horas_extras": str,     # '5', '10', '15' ou 'exato'
  "intervalo_automatico": bool,
  "duracao_intervalo": int,
  
  # NOVOS CAMPOS DE GEOLOCALIZAÇÃO
  "latitude_empresa": float,              # Coordenadas da empresa
  "longitude_empresa": float,
  "raio_permitido": int,                  # Raio em metros (padrão: 100)
  "exigir_localizacao": bool,             # Se True, bloqueia fora do raio
  
  "data_atualizacao": str                 # ISO datetime
}
```

---

## 🎯 Endpoints Já Existentes (Mantidos)

### Autenticação
- `POST /api/login` - Login de empresa (modo kiosk)
- `POST /api/funcionario/login` - Login de funcionário (modo individual)
  - Retorna: `{ token, tipo: 'funcionario', funcionario_id, nome, company_id }`

### Funcionários
- `GET /api/funcionarios` - Listar funcionários
- `GET /api/funcionarios/<id>` - Obter funcionário específico
- `PUT /api/funcionarios/<id>` - Atualizar funcionário
- `DELETE /api/funcionarios/<id>` - Deletar funcionário

### Registros
- `GET /api/registros` - Listar registros (com filtros)
  - Query params: `funcionario_id`, `inicio`, `fim`
- `GET /api/funcionario/registros` - Registros do funcionário logado
- `GET /api/registros/resumo` - Resumo com horas extras/atrasos
- `DELETE /api/registros/<registro_id>` - Deletar registro

---

## 📱 Próximos Passos: Mobile App

### Estrutura Proposta

```
tablet/
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx          # Context global para auth
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginModeScreen.tsx  # Escolher: Empresa ou Funcionário
│   │   │   ├── CompanyLoginScreen.tsx
│   │   │   └── EmployeeLoginScreen.tsx
│   │   │
│   │   ├── company/                 # Modo Empresa (Kiosk)
│   │   │   └── CameraScreen.tsx     # ✅ JÁ EXISTE - adaptar
│   │   │
│   │   └── employee/                # Modo Funcionário
│   │       ├── HomeScreen.tsx       # Dashboard pessoal
│   │       ├── RegisterScreen.tsx   # Registrar ponto manual
│   │       └── RecordsScreen.tsx    # "Meus Registros"
│   │
│   ├── services/
│   │   ├── api.ts                   # ✅ JÁ EXISTE - adicionar métodos
│   │   └── location.ts              # NOVO - geolocalização
│   │
│   ├── components/
│   │   ├── RecordCard.tsx           # Card de registro
│   │   ├── SummaryCard.tsx          # Card de resumo (horas/atrasos)
│   │   └── LocationPermission.tsx   # Solicitar permissão
│   │
│   └── types/
│       └── index.ts                 # TypeScript types
```

---

## 🔐 Fluxos de Autenticação

### Modo Empresa (Kiosk)
```
1. LoginModeScreen → "Entrar como Empresa"
2. CompanyLoginScreen → Login com usuario_id + senha
3. Salvar token + tipo="empresa" no SecureStore
4. Redirecionar para CameraScreen (modo kiosk)
5. App permanece nessa tela permanentemente
```

### Modo Funcionário
```
1. LoginModeScreen → "Entrar como Funcionário"
2. EmployeeLoginScreen → Login com email + senha
3. Salvar token + tipo="funcionario" no SecureStore
4. Redirecionar para HomeScreen
5. Navegação livre: Home / Registrar / Meus Registros
```

---

## 📍 Integração de Geolocalização no Mobile

### Permissões Necessárias (app.json/app.config.js)
```json
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "O app precisa da sua localização para registrar o ponto.",
          "isAndroidBackgroundLocationEnabled": false
        }
      ]
    ]
  }
}
```

### Dependências
```bash
npx expo install expo-location
```

### Exemplo de Uso (services/location.ts)
```typescript
import * as Location from 'expo-location';

export const getCurrentLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  
  if (status !== 'granted') {
    throw new Error('Permissão de localização negada');
  }
  
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High
  });
  
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude
  };
};
```

### Ao Registrar Ponto
```typescript
// Obter localização atual
const { latitude, longitude } = await getCurrentLocation();

// Enviar no FormData junto com a foto
formData.append('latitude', latitude.toString());
formData.append('longitude', longitude.toString());

// Backend valida automaticamente
const response = await api.registerFaceTime(photo.uri, formData);
```

---

## 🎨 UI/UX Recomendações

### Modo Empresa (Kiosk)
- Tela cheia, sem barra de navegação
- Design minimalista (apenas câmera + relógio + feedback)
- Sem botão "Voltar" ou "Sair"
- Feedback visual claro: Verde (sucesso), Vermelho (erro)

### Modo Funcionário
- Bottom Tab Navigation: Home | Registrar | Histórico
- Card de perfil no topo (nome, cargo, foto)
- Resumo rápido: total horas este mês, extras, atrasos
- Lista de registros com filtros (hoje, semana, mês)

---

## 🔄 Sincronização Offline (Futuro)

Para implementar funcionalidade offline:
1. Usar `AsyncStorage` para cache local
2. Guardar fotos temporariamente
3. Fila de sincronização quando voltar online
4. Indicador visual de "pendente sincronização"

---

## 📊 Monitoramento e Logs

Todos os endpoints agora possuem logs detalhados:
```python
[REGISTRO] Tentando reconhecer funcionário...
[REGISTRO] Validação geolocalização: distância=45m, permitido=100m
[REGISTRO] ✅ Registro salvo com sucesso!
```

Logs incluem:
- ✅ Sucesso
- ⚠️ Avisos
- ❌ Erros
- 👁️ Modo preview
- 📍 Validações de localização

---

## 🚀 Deployment

### Variáveis de Ambiente Necessárias
```env
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
DYNAMODB_EMPLOYEES_TABLE=Employees
DYNAMODB_TIMERECORDS_TABLE=TimeRecords
DYNAMODB_CONFIG_TABLE=ConfigCompany
REKOGNITION_COLLECTION=registraponto-faces
S3_BUCKET=registraponto-prod-fotos
JWT_SECRET_KEY=your-secret-key
```

---

## 📝 Checklist de Implementação Mobile

- [ ] Instalar `expo-location`
- [ ] Criar estrutura de pastas (auth, company, employee)
- [ ] Implementar AuthContext com suporte a dois tipos de login
- [ ] Tela LoginModeScreen (escolher tipo)
- [ ] CompanyLoginScreen + EmployeeLoginScreen
- [ ] Adaptar CameraScreen existente para modo kiosk
- [ ] EmployeeHomeScreen com resumo
- [ ] EmployeeRecordsScreen (lista de registros)
- [ ] LocationService (obter coordenadas)
- [ ] Atualizar api.ts com novos métodos
- [ ] Testar geolocalização (dentro e fora do raio)
- [ ] Testar funcionário home_office (sem validação)
- [ ] Implementar navegação persistente
- [ ] Design e animações

---

**Status Atual:** Backend 100% pronto para suportar ambos os modos! 🎉
**Próximo:** Implementação do app mobile React Native.
