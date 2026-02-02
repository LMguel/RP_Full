# 🚀 Deploy no EC2 - Guia Completo

## 📋 Pré-requisitos

```bash
# No servidor EC2 (Ubuntu)
sudo apt update
sudo apt install -y python3-pip python3-venv nginx certbot python3-certbot-nginx
```

## 1️⃣ Preparar Backend

```bash
# Clonar/atualizar código
cd /home/ubuntu
git clone https://github.com/LMguel/RP_Full.git
cd RP_Full/backend

# Criar ambiente virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Criar arquivo .env
nano .env
```

**Exemplo .env:**
```env
SECRET_KEY=sua-chave-secreta-aqui
JWT_SECRET_KEY=sua-jwt-secret-aqui
AWS_REGION=us-east-1
S3_BUCKET=registraponto-prod-fotos
REKOGNITION_COLLECTION=FuncionariosCollection
DISABLE_SSL_DEV=1
```

## 2️⃣ Criar diretórios de log

```bash
sudo mkdir -p /var/log/registraponto
sudo chown ubuntu:ubuntu /var/log/registraponto
```

## 3️⃣ Configurar Systemd Service

```bash
# Copiar arquivo de serviço
sudo cp registraponto.service /etc/systemd/system/

# Ajustar caminhos no arquivo se necessário
sudo nano /etc/systemd/system/registraponto.service

# Recarregar daemon
sudo systemctl daemon-reload

# Habilitar e iniciar serviço
sudo systemctl enable registraponto
sudo systemctl start registraponto

# Verificar status
sudo systemctl status registraponto
```

## 4️⃣ Configurar Nginx

```bash
# Copiar configuração
sudo cp nginx-registraponto.conf /etc/nginx/sites-available/registraponto

# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/registraponto /etc/nginx/sites-enabled/

# Remover default se existir
sudo rm /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

## 5️⃣ Configurar SSL (Certbot)

```bash
# Obter certificado Let's Encrypt
sudo certbot --nginx -d registra-ponto.duckdns.org

# Renovação automática já está configurada
```

## 6️⃣ Testar Deploy

```bash
# Verificar serviço
curl http://localhost:5000/health

# Verificar Nginx
curl https://registra-ponto.duckdns.org/health
```

## 🔄 Atualizar Código

```bash
cd /home/ubuntu/RP_Full
git pull
sudo systemctl restart registraponto
```

## 📊 Monitoramento

```bash
# Logs do backend
sudo journalctl -u registraponto -f

# Logs Gunicorn
tail -f /var/log/registraponto/error.log
tail -f /var/log/registraponto/access.log

# Logs Nginx
tail -f /var/log/nginx/registraponto-error.log
```

## 🐛 Troubleshooting

### Serviço não inicia
```bash
sudo journalctl -u registraponto -n 50
sudo systemctl status registraponto
```

### CORS ainda com erro
1. Verificar se Nginx está aplicando headers
2. Verificar se Flask CORS está configurado
3. Verificar logs: `tail -f /var/log/nginx/registraponto-error.log`

### Permissões AWS
- Verificar IAM role do EC2
- Necessário acesso a: DynamoDB, S3, Rekognition

## 🔒 Security Group EC2

Portas necessárias:
- **22** (SSH)
- **80** (HTTP - redirect)
- **443** (HTTPS)

## ⚙️ Performance

Para ajustar workers do Gunicorn:
```bash
nano /home/ubuntu/RP_Full/backend/gunicorn.conf.py
# Modificar: workers = X
sudo systemctl restart registraponto
```
