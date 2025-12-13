# RegistraPonto - Sistema de Controle de Ponto Eletrônico

Sistema completo de controle de ponto eletrônico com reconhecimento facial e geolocalização, desenvolvido para empresas de diversos portes.

## 🚀 Visão Geral

O RegistraPonto é uma solução integrada que permite o registro de ponto de funcionários através de múltiplas interfaces: web, PWA mobile e portal administrativo. Utiliza tecnologias avançadas como reconhecimento facial via AWS Rekognition e geolocalização para garantir precisão e segurança nos registros.

## 🏗️ Arquitetura do Projeto

O projeto é dividido em módulos independentes, cada um responsável por uma parte específica do sistema:

### Backend (Flask + Python)
- **Localização**: `backend/`
- **Tecnologias**: Flask, AWS Rekognition, DynamoDB, S3
- **Responsabilidades**:
  - API RESTful para todas as operações
  - Integração com AWS para reconhecimento facial
  - Gerenciamento de dados e autenticação
  - Cálculos de horas extras e relatórios

### Frontend Web (React)
- **Localização**: `front/`
- **Tecnologias**: React 18, TypeScript, Vite, Material UI, TailwindCSS
- **Funcionalidades**:
  - Dashboard administrativo
  - Gestão de funcionários
  - Visualização de registros
  - Relatórios e estatísticas

### Portal Administrativo (React)
- **Localização**: `admin-portal/`
- **Tecnologias**: React, TypeScript, Vite
- **Propósito**: Interface dedicada para administradores do sistema

### PWA Mobile (Progressive Web App)
- **Localização**: `pwa-mobile/`
- **Tecnologias**: React, Vite, Tailwind CSS, PWA
- **Funcionalidades**:
  - Registro de ponto via geolocalização
  - Modo kiosk para reconhecimento facial
  - Funciona offline
  - Instalável como app nativo

## 🎯 Funcionalidades Principais

### ✅ Implementadas
- **Autenticação JWT** - Login seguro para empresas e funcionários
- **Reconhecimento Facial** - Integração com AWS Rekognition
- **Geolocalização** - Registro de ponto baseado em localização
- **Dashboard** - Visualização de estatísticas e relatórios
- **Gestão de Funcionários** - CRUD completo com upload de fotos
- **Registros de Ponto** - Listagem, filtros e exportação
- **Multi-empresa** - Isolamento de dados por empresa
- **PWA** - Experiência mobile nativa

### 🚧 Em Desenvolvimento
- Exportação avançada (PDF/CSV)
- Notificações push
- Modo escuro
- Relatórios mensais detalhados

## 📋 Pré-requisitos

- **Python 3.8+** (para backend)
- **Node.js 18+** (para frontends)
- **AWS Account** (Rekognition, S3, DynamoDB)
- **Expo CLI** (opcional, para desenvolvimento mobile)

## 🔧 Instalação e Configuração

### 1. Clonagem do Repositório
```bash
git clone <url-do-repositorio>
cd RP_Full
```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt
# Configure as variáveis de ambiente (AWS credentials, etc.)
python app.py
```

### 3. Frontend Web
```bash
cd front
npm install
npm run dev
```

### 4. Portal Administrativo
```bash
cd admin-portal
npm install
npm run dev
```

### 5. PWA Mobile
```bash
cd pwa-mobile
npm install
npm run dev
```

## 🌐 Configurações de Ambiente

### Backend (.env)
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
DYNAMODB_TABLE=registraponto-table
S3_BUCKET=registraponto-bucket
JWT_SECRET=your_jwt_secret
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000
VITE_APP_NAME=REGISTRA.PONTO
VITE_APP_VERSION=1.0.0
```

## 🔒 Segurança

- **Autenticação JWT** com expiração automática
- **HTTPS obrigatório** para funcionalidades de câmera e geolocalização
- **Isolamento de dados** por empresa
- **Validação de permissões** em todas as rotas
- **Armazenamento seguro** de tokens e credenciais

## 📊 Banco de Dados

- **DynamoDB** - Dados principais (funcionários, registros)
- **S3** - Armazenamento de fotos para reconhecimento facial
- **Estrutura**: Chaves compostas por empresa para isolamento

## 🚀 Deploy

### Backend (AWS)
- **Lambda** - Funções serverless
- **API Gateway** - Exposição da API
- **CloudFormation** - Infraestrutura como código

### Frontend (AWS)
- **S3 + CloudFront** - Hospedagem estática
- **Route 53** - DNS
- **Certificate Manager** - SSL/TLS

## 📝 Scripts Disponíveis

### Backend
```bash
python app.py              # Executar servidor de desenvolvimento
python testar_sistema.py   # Testes do sistema
```

### Frontend
```bash
npm run dev     # Desenvolvimento
npm run build   # Build para produção
npm run preview # Preview do build
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

## 👨‍💻 Suporte

Para dúvidas ou problemas:
1. Consulte a documentação específica de cada módulo
2. Verifique os logs de erro
3. Entre em contato com o suporte técnico

---

**Desenvolvido para controle de ponto eletrônico moderno**  
Versão 1.0.0
