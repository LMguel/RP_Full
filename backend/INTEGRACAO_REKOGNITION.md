# 🎯 Guia de Integração AWS Rekognition

## ✅ O Que Foi Implementado

### Arquivos Criados
- ✅ **routes_facial.py** - Endpoints de reconhecimento facial
  - `/api/reconhecer_rosto` - Reconhece funcionário pela foto
  - `/api/registrar_ponto_facial` - Registra ponto após reconhecimento
  - `/api/facial/health` - Health check do serviço

### Arquivos Atualizados
- ✅ **app.py** - Registra rotas de reconhecimento facial
- ✅ **aws_utils.py** - JÁ TINHA função `reconhecer_funcionario()`

### Arquivos Excluídos
Backend:
- ❌ test_*.py (5 arquivos de teste)
- ❌ check_*.py (2 arquivos de verificação)
- ❌ list_*.py (3 arquivos de listagem)
- ❌ update_*.py (1 arquivo)
- ❌ setup_*.py (1 arquivo)
- ❌ diagnostico_dados.py
- ❌ config_geolocation.py
- ❌ cert.pem.bak, key.pem.bak

PWA-Mobile:
- ❌ certs/ (pasta vazia)
- ❌ dev-dist/ (pasta de build)
- ❌ setup-https.ps1
- ❌ TESTING_PERMISSIONS.md
- ❌ PWA_README.md (info duplicada)

---

## 🔧 Configuração AWS Rekognition

### 1. Criar Collection no Rekognition

```python
import boto3

rekognition = boto3.client('rekognition', region_name='us-east-1')

# Criar collection
response = rekognition.create_collection(
    CollectionId='registraponto-faces'
)

print(f"Collection criada: {response}")
```

### 2. ✅ Fotos dos Funcionários (JÁ CONFIGURADO)

**Status:** ✅ **9 faces cadastradas na collection**

As fotos dos funcionários já estão:
- ✅ Armazenadas no S3: `registraponto-prod-fotos`
- ✅ Indexadas no Rekognition: `registraponto-faces`
- ✅ Vinculadas aos funcionários no DynamoDB

**Funcionários cadastrados:**
- luis_miguel
- ana_carolina
- jaime
- miguel
- E outros (9 total)

### 3. Configurar Variáveis de Ambiente

No arquivo `.env`:

```bash
# AWS Credentials (se não usar IAM Role)
AWS_ACCESS_KEY_ID=sua_chave
AWS_SECRET_ACCESS_KEY=sua_secret

# AWS Configuration
AWS_REGION=us-east-1
S3_BUCKET=registraponto-prod-fotos
REKOGNITION_COLLECTION=registraponto-faces
ENABLE_REKOGNITION=1

# DynamoDB Tables
DYNAMODB_TABLE_EMPLOYEES=Employees
DYNAMODB_TABLE_RECORDS=TimeRecords
DYNAMODB_TABLE_USERS=UserCompany
DYNAMODB_TABLE_CONFIG=ConfigCompany
```

### 4. Configurar Permissões IAM

A aplicação precisa das seguintes permissões:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rekognition:SearchFacesByImage",
        "rekognition:IndexFaces",
        "rekognition:DeleteFaces",
        "rekognition:ListFaces"
      ],
      "Resource": "arn:aws:rekognition:*:*:collection/registraponto-faces"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::registraponto-prod-fotos/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/Employees",
        "arn:aws:dynamodb:*:*:table/TimeRecords"
      ]
    }
  ]
}
```

---

## 📡 Como os Endpoints Funcionam

### 1. `/api/reconhecer_rosto`

**Request:**
```http
POST /api/reconhecer_rosto
Authorization: Bearer <token>
Content-Type: multipart/form-data

Body:
  image: <file.jpg>
```

**Fluxo Interno:**
1. Recebe imagem do frontend
2. Salva temporariamente em `/tmp/temp_XXXXX.jpg`
3. Chama `reconhecer_funcionario(temp_path)` de `aws_utils.py`
4. Rekognition faz `search_faces_by_image` na collection
5. Retorna `ExternalImageId` (que é o `employee_id`)
6. Busca dados do funcionário no DynamoDB
7. Retorna JSON com dados completos

**Response (Sucesso):**
```json
{
  "reconhecido": true,
  "funcionario": {
    "funcionario_id": "FUNC001",
    "nome": "João Silva",
    "cargo": "Desenvolvedor",
    "foto_url": "https://s3..."
  },
  "confianca": 95.0
}
```

**Response (Não reconhecido):**
```json
{
  "reconhecido": false,
  "mensagem": "Nenhum rosto correspondente encontrado"
}
```

### 2. `/api/registrar_ponto_facial`

**Request:**
```http
POST /api/registrar_ponto_facial
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "funcionario_id": "FUNC001",
  "metodo": "reconhecimento_facial"
}
```

**Fluxo Interno:**
1. Busca último registro do funcionário
2. Determina tipo automaticamente:
   - Se último foi "entrada" → agora é "saída"
   - Se último foi "saída" → agora é "entrada"
   - Se não tem registro → "entrada"
3. Cria registro com:
   - Timestamp atual
   - Tipo determinado
   - Method: "CAMERA"
   - Localização da empresa (quiosque)
   - Distance: 0 (dentro da empresa)
4. Salva no DynamoDB TimeRecords

**Response:**
```json
{
  "success": true,
  "tipo": "entrada",
  "timestamp": "2024-12-10T10:30:00",
  "mensagem": "Ponto de entrada registrado com sucesso!",
  "registro": {
    "tipo": "entrada",
    "horario": "10:30:00",
    "data": "10/12/2024",
    "metodo": "reconhecimento_facial"
  }
}
```

---

## 🧪 Como Testar

### 1. Testar Collection

```python
import boto3

rekognition = boto3.client('rekognition', region_name='us-east-1')

# Listar collections
response = rekognition.list_collections()
print(f"Collections: {response['CollectionIds']}")

# Listar faces na collection
response = rekognition.list_faces(
    CollectionId='registraponto-faces',
    MaxResults=10
)
print(f"Faces cadastradas: {len(response['Faces'])}")
for face in response['Faces']:
    print(f"  - {face['ExternalImageId']}")
```

### 2. Testar Endpoint (Postman/cURL)

```bash
# 1. Fazer login para obter token
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"usuario_id": "admin", "senha": "senha123"}'

# 2. Testar reconhecimento
curl -X POST http://localhost:5000/api/reconhecer_rosto \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "image=@/caminho/foto.jpg"

# 3. Testar registro
curl -X POST http://localhost:5000/api/registrar_ponto_facial \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"funcionario_id": "FUNC001"}'
```

### 3. Testar pelo Frontend

```bash
# 1. Iniciar backend
cd backend
python app.py

# 2. Iniciar frontend
cd pwa-mobile
npm run dev

# 3. Acessar
# http://localhost:3000
# Login como Empresa → Registro Facial
# Câmera vai abrir e capturar frames automaticamente
```

---

## 🔍 Logs e Debug

### Backend Logs

Quando o reconhecimento funciona, você verá:

```
[FACIAL] Recebida requisição de reconhecimento
[FACIAL] Imagem salva temporariamente em: /tmp/temp_xxxxx.jpg
[FACIAL] Tamanho do arquivo: 45678 bytes
[REKOGNITION] Iniciando busca facial na collection: registraponto-faces
[REKOGNITION] Foto: /tmp/temp_xxxxx.jpg
[REKOGNITION] Tamanho da imagem: 45678 bytes
[REKOGNITION] Resposta recebida: {...}
[REKOGNITION] Match encontrado! ExternalImageId: FUNC001, Similarity: 98.5%
[FACIAL] Buscando funcionário com ID: FUNC001
[FACIAL] Funcionário reconhecido: João Silva
```

### Frontend Logs (Console do navegador)

```
[QUIOSQUE] Componente montado
[QUIOSQUE] Câmera aberta com sucesso
[FRAME] Frame capturado: 50000 bytes
[QUIOSQUE] Enviando frame para reconhecimento...
[QUIOSQUE] Resultado: {reconhecido: true, funcionario: {...}}
[QUIOSQUE] Funcionário reconhecido: João Silva
[QUIOSQUE] Registrando ponto para: FUNC001
[QUIOSQUE] Ponto registrado: {success: true, tipo: "entrada"}
```

---

## ⚠️ Troubleshooting

### Erro: "Collection não encontrada"

```
[REKOGNITION] Collection não encontrada
```

**Solução:** Criar a collection
```python
rekognition.create_collection(CollectionId='registraponto-faces')
```

### Erro: "Nenhum rosto correspondente"

Possíveis causas:
1. Funcionário não cadastrado no Rekognition
2. Foto de baixa qualidade
3. Face muito de lado/escura
4. Threshold muito alto (padrão: 85%)

**Solução:**
- Verificar se funcionário está na collection: `list_faces()`
- Cadastrar funcionário: `index_faces()`
- Melhorar iluminação
- Diminuir threshold (em `aws_utils.py`, linha 84)

### Erro: "Token inválido"

```
{'error': 'Token inválido ou expirado'}
```

**Solução:** Fazer login novamente para obter novo token

### Erro: "InvalidParameterException"

```
[REKOGNITION] Erro de parâmetro inválido
```

Possíveis causas:
- Imagem muito grande (max 15MB)
- Formato não suportado
- Imagem corrompida

**Solução:**
- Comprimir imagem no frontend antes de enviar
- Garantir formato JPEG
- Verificar integridade do arquivo

---

## 📊 Métricas e Performance

### Tempo Médio de Processamento

- Upload da imagem: ~100ms
- Rekognition search: ~500-1000ms
- Query DynamoDB: ~50ms
- **Total: ~1-2 segundos**

### Custos AWS (Estimativa)

**Rekognition:**
- SearchFacesByImage: $0.001 por imagem
- IndexFaces: $0.001 por face
- 1000 reconhecimentos/mês: ~$1.00

**S3:**
- Storage: $0.023/GB/mês
- 1000 fotos (5MB cada): ~$0.12/mês

**DynamoDB:**
- On-Demand pricing
- 1000 leituras/gravações: ~$0.50

**Total estimado: ~$2/mês para 1000 reconhecimentos**

---

## 🚀 Próximos Passos

### Melhorias Recomendadas

1. **Ajustar Threshold**
   - Testar diferentes valores (80-95%)
   - Balancear entre precisão e recall

2. **Adicionar Retry**
   - Tentar 2-3 vezes se não reconhecer
   - Melhorar taxa de sucesso

3. **Cooldown entre Registros**
   - Evitar registros duplicados
   - Mínimo 5 minutos entre entrada/saída

4. **Feedback de Qualidade**
   - Detectar se foto está muito escura
   - Avisar se face não detectada
   - Guiar posicionamento

5. **Dashboard de Monitoramento**
   - Taxa de reconhecimento
   - Tempo médio de processamento
   - Erros mais comuns

---

## ✅ Checklist de Ativação

Antes de usar em produção:

- [ ] Collection criada no Rekognition
- [ ] Funcionários cadastrados com fotos
- [ ] Variáveis de ambiente configuradas
- [ ] Permissões IAM configuradas
- [ ] Bucket S3 acessível
- [ ] DynamoDB tables criadas
- [ ] Backend rodando sem erros
- [ ] Frontend conectado ao backend
- [ ] Teste com funcionário real (sucesso)
- [ ] Teste com pessoa não cadastrada (falha esperada)
- [ ] Logs funcionando corretamente

---

**Status:** ✅ PRONTO PARA INTEGRAÇÃO
**Última atualização:** 10/12/2025
