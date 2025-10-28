# REGISTRA.PONTO - Frontend

Sistema de controle de ponto eletrônico com reconhecimento facial.

## 🚀 Tecnologias

- **React 18** - Framework principal
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Material UI (MUI)** - Biblioteca de componentes
- **TailwindCSS** - Framework CSS utilitário
- **Recharts** - Gráficos e visualizações
- **React Router** - Roteamento
- **Axios** - Cliente HTTP
- **Framer Motion** - Animações
- **React Hot Toast** - Notificações
- **Zustand** - Gerenciamento de estado

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview
```

## 🔧 Configuração

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_API_URL=http://localhost:5000
VITE_APP_NAME=REGISTRA.PONTO
VITE_APP_VERSION=1.0.0
```

## 🎨 Funcionalidades

### ✅ Implementadas

- **Autenticação**
  - Login com JWT
  - Cadastro de usuário/empresa
  - Proteção de rotas
  - Persistência de sessão

- **Dashboard**
  - Resumo da empresa
  - Gráficos de horas trabalhadas
  - Tabela de registros recentes
  - Estatísticas em tempo real

- **Gestão de Funcionários**
  - Listagem com filtros
  - Cadastro com foto
  - Edição de dados
  - Exclusão com confirmação
  - Upload de fotos para reconhecimento

- **Registros de Ponto**
  - Listagem com filtros avançados
  - Registro manual
  - Exclusão de registros
  - Exportação (preparado)

- **Configurações**
  - Perfil do usuário
  - Dados da empresa
  - Alteração de senha
  - Logout

### 🚧 Em Desenvolvimento

- Captura de foto com câmera
- Reconhecimento facial
- Exportação para PDF/CSV
- Modo escuro
- Notificações push

## 🏗️ Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── Layout.tsx      # Layout principal com sidebar
│   ├── LoginForm.tsx   # Formulário de login
│   ├── RegisterForm.tsx # Formulário de cadastro
│   ├── EmployeeForm.tsx # Formulário de funcionário
│   ├── TimeRecordForm.tsx # Formulário de registro
│   └── ProtectedRoute.tsx # Proteção de rotas
├── pages/              # Páginas da aplicação
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── DashboardPage.tsx
│   ├── EmployeesPage.tsx
│   ├── RecordsPage.tsx
│   └── SettingsPage.tsx
├── contexts/           # Contextos React
│   └── AuthContext.tsx # Contexto de autenticação
├── services/           # Serviços e APIs
│   └── api.ts         # Cliente HTTP
├── types/             # Definições TypeScript
│   └── index.ts       # Interfaces e tipos
├── config/            # Configurações
│   └── index.ts       # Configurações da app
└── App.tsx            # Componente principal
```

## 🎯 Funcionalidades Principais

### 1. Autenticação Segura
- Login com JWT
- Proteção de rotas
- Interceptadores Axios
- Logout automático em caso de token expirado

### 2. Dashboard Intuitivo
- Cards com estatísticas
- Gráficos interativos (Recharts)
- Tabela de registros recentes
- Design responsivo

### 3. Gestão Completa de Funcionários
- CRUD completo
- Upload de fotos
- Filtros e busca
- Validação de formulários

### 4. Registros de Ponto
- Listagem com filtros avançados
- Registro manual
- Interface preparada para câmera
- Exclusão com confirmação

### 5. Configurações
- Perfil do usuário
- Dados da empresa
- Segurança (alteração de senha)
- Zona de perigo (logout)

## 🎨 Design System

### Cores
- **Primária**: Azul (#3b82f6)
- **Secundária**: Cinza (#6b7280)
- **Sucesso**: Verde (#10b981)
- **Erro**: Vermelho (#ef4444)
- **Aviso**: Amarelo (#f59e0b)

### Tipografia
- **Fonte**: Inter
- **Tamanhos**: Responsivos
- **Pesos**: 300, 400, 500, 600, 700

### Componentes
- Material UI como base
- TailwindCSS para ajustes
- Animações com Framer Motion
- Ícones Material Icons

## 📱 Responsividade

- **Desktop**: Layout completo com sidebar
- **Tablet**: Sidebar colapsável
- **Mobile**: Menu hambúrguer
- **Breakpoints**: Material UI padrão

## 🔒 Segurança

- Autenticação JWT
- Interceptadores para tokens
- Validação de formulários
- Sanitização de dados
- Proteção de rotas

## 🚀 Deploy

### Build para Produção
```bash
npm run build
```

### Deploy no AWS S3 + CloudFront
1. Build do projeto
2. Upload para S3
3. Configurar CloudFront
4. Configurar variáveis de ambiente

## 📝 Scripts Disponíveis

- `npm run dev` - Servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm run preview` - Preview do build
- `npm run lint` - Linter (se configurado)

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.