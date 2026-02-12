# RegistraPonto - Sistema de Controle de Ponto Eletronico

Plataforma completa de controle de ponto com reconhecimento facial e geolocalizacao. O projeto integra backend em Python/Flask, web app React e PWA mobile, com foco em seguranca, precisao de registros e experiencia fluida para equipes e administradores.

## 🚀 Visao Geral

O RegistraPonto permite o registro de ponto por multiplas interfaces (web e PWA), centralizando operacoes administrativas em um painel unico. A solução utiliza AWS Rekognition para reconhecimento facial e DynamoDB/S3 para armazenamento escalavel.

## 🖼️ Preview do Sistema

### Dashboard
<img src="landingpage/image/dashboard.png" alt="Dashboard" width="500" />

### Registros
<img src="landingpage/image/registros.png" alt="Registros" width="500" />

### Registros detalhados
<img src="landingpage/image/registros_detalhados.png" alt="Registros detalhados" width="500" />

### Funcionario
<img src="landingpage/image/funcionario.png" alt="Funcionario" width="500" />

### Configurações
<img src="landingpage/image/configuracoes.png" alt="Configuracoes" width="500" />

### Captura (tablet em uso real)
<img src="landingpage/image/captura.jpg" alt="Captura" width="500" />

## 🧩 Modulos do Projeto

- **Backend (Flask + Python)**: API REST, regras de negocio, autenticação e integrações AWS.
- **Frontend Web (React + TypeScript)**: dashboard administrativo e gestao de funcionarios e registros.
- **Portal Administrativo (React + TypeScript)**: interface dedicada para administradores.
- **PWA Mobile (React + Vite + PWA)**: registro de ponto com geolocalizacao e suporte offline.

## 🔧 Tecnologias e Servicos

- **Backend**: Flask, JWT, boto3, AWS Rekognition, DynamoDB, S3.
- **Frontend**: React 18, TypeScript, Vite, Material UI, TailwindCSS.
- **Infra**: AWS Lambda, API Gateway, S3, CloudFront.
- **Mobile**: PWA com instalacao e funcionamento offline.

## ✨ Funcionalidades Principais

- Reconhecimento facial e validacao por geolocalizacao.
- Painel administrativo com relatorios e indicadores.
- CRUD completo de funcionarios com upload de fotos.
- Registros de ponto com filtros e exportação para CSV.
- Isolamento de dados por empresa e controle de permissões.

## 📌 Destaques de Arquitetura

- Separação clara por módulos (API, web, portal, PWA).
- Uso de servços gerenciados AWS para escala e resiliencia.
- Pipeline de autenticação JWT e autorizacao por perfis.

---

**Projeto de portfolio**
