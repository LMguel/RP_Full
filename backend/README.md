# Backend - Sistema de Registro de Ponto

## 📁 Estrutura de Pastas

```
backend/
├── app.py                 # Aplicação Flask principal
├── wsgi.py                # Entry point para produção (Gunicorn)
├── models.py              # Modelos de dados (DailySummary, MonthlySummary, etc)
├── requirements.txt       # Dependências Python
├── env.example            # Exemplo de variáveis de ambiente
│
├── routes/                # Rotas da API organizadas por funcionalidade
│   ├── __init__.py
│   ├── api.py             # Rotas principais da API (v1)
│   ├── v2.py              # Rotas da API v2 (nova arquitetura)
│   ├── daily.py            # Rotas de resumos diários
│   ├── dashboard.py        # Rotas do dashboard
│   ├── facial.py           # Rotas de reconhecimento facial
│   ├── admin.py            # Rotas administrativas
│   └── admin_auth.py       # Autenticação administrativa
│
├── utils/                 # Utilitários e helpers
│   ├── __init__.py
│   ├── aws.py             # Clientes AWS (DynamoDB, Rekognition, S3)
│   ├── s3.py              # Gerenciamento de fotos no S3
│   ├── geolocation.py     # Validação de localização
│   ├── auth.py            # Autenticação JWT e hash de senhas
│   └── logger.py          # Configuração de logging
│
├── services/              # Serviços de negócio
│   ├── __init__.py
│   ├── summaries.py       # Serviço de resumos (DailySummary)
│   ├── summary.py         # Cálculo de resumos diários/mensais
│   └── overtime.py         # Cálculo de horas extras
│
├── config/                # Configurações
│   ├── __init__.py
│   ├── adapter.py         # Adaptador de configurações (compatibilidade)
│   └── gunicorn.py        # Configuração do Gunicorn
│
├── deploy/                # Arquivos de deploy
│   ├── nginx.conf         # Configuração do Nginx
│   └── registraponto.service  # Systemd service
│
└── scripts/               # Scripts auxiliares
    ├── generate_cert.py   # Geração de certificados SSL
    ├── start.py           # Script de desenvolvimento (Python)
    └── start-dev.ps1      # Script de desenvolvimento (PowerShell)
```

## 🚀 Iniciando o Servidor

### Desenvolvimento

```bash
# Usando script Python
python scripts/start.py

# Ou usando PowerShell
.\scripts\start-dev.ps1

# Ou diretamente
python app.py
```

### Produção (EC2)

```bash
# Usando Gunicorn
gunicorn --config config/gunicorn.py wsgi:app

# Ou usando systemd
sudo systemctl start registraponto
```

## ⚙️ Configuração

1. Copie o arquivo de exemplo:
```bash
cp env.example .env
```

2. Edite o `.env` com suas configurações:
- `SECRET_KEY`: Chave secreta para JWT (obrigatória)
- `AWS_REGION`: Região AWS
- `S3_BUCKET`: Bucket S3 para fotos
- `REKOGNITION_COLLECTION`: Collection do Rekognition
- E outras variáveis conforme necessário

## 📝 Variáveis de Ambiente Importantes

- `SECRET_KEY` - **OBRIGATÓRIA** - Chave secreta para JWT
- `FLASK_PORT` - Porta do servidor (padrão: 5000)
- `FLASK_HOST` - Host do servidor (padrão: 0.0.0.0)
- `AWS_REGION` - Região AWS (padrão: us-east-1)
- `S3_BUCKET` - Bucket S3 para fotos
- `REKOGNITION_COLLECTION` - Collection do Rekognition
- `REKOGNITION_THRESHOLD` - Threshold de similaridade (padrão: 85)

## 🔧 Dependências

Instale as dependências:
```bash
pip install -r requirements.txt
```

## 📚 Documentação das Rotas

### Rotas Principais (v1)
- `/api/*` - Rotas principais da API

### Rotas v2
- Rotas modernas com nova arquitetura

### Rotas de Reconhecimento Facial
- `/api/reconhecer_rosto` - Reconhecer funcionário por foto
- `/api/registrar_ponto_facial` - Registrar ponto com reconhecimento facial

### Rotas Administrativas
- `/api/admin/*` - Painel administrativo

## 🗑️ Arquivos Removidos

Os seguintes arquivos foram removidos na reorganização:
- `testar_sistema.py` - Script de teste
- `lambda_adapter.py` - Adaptador Lambda (não usado)
- `template.yaml` - Template SAM (não usado)
- `samconfig.toml` - Config SAM (não usado)
- Documentação desnecessária (.md)

## 📦 Estrutura Antiga vs Nova

### Antes:
```
backend/
├── routes.py
├── routes_v2.py
├── aws_utils.py
├── auth.py
└── ...
```

### Depois:
```
backend/
├── routes/
│   ├── api.py
│   ├── v2.py
│   └── ...
├── utils/
│   ├── aws.py
│   ├── auth.py
│   └── ...
└── ...
```

## 🔄 Migração de Imports

Se você tiver código que importa os módulos antigos, atualize:

```python
# Antes
from aws_utils import ...
from auth import ...
from routes import ...

# Depois
from utils.aws import ...
from utils.auth import ...
from routes import ...
```

