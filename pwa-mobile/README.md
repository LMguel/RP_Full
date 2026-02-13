# PWA Mobile - Registro de Ponto

Versão PWA (Progressive Web App) do sistema de registro de ponto com geolocalização.

## 🚀 Características

- ✅ **PWA Completo** - Funciona como app nativo
- ✅ **Offline Ready** - Service Worker configurado
- ✅ **Responsivo** - Otimizado para mobile
- ✅ **Geolocalização** - API nativa do navegador
- ✅ **Login Persistente** - LocalStorage
- ✅ **Animações Suaves** - Framer Motion
- ✅ **Instalável** - Adicionar à tela inicial

## 📦 Instalação

```bash
cd pwa-mobile
npm install
```

## 🏃 Executar

### Desenvolvimento
```bash
npm run dev
```
Acesse: `http://localhost:3000`

### Build para Produção
```bash
npm run build
npm run preview
```

## 📱 Funcionalidades

### Para Funcionários
- ✅ Login com ID e senha
- ✅ Lembrar login
- ✅ Dashboard com histórico
- ✅ Registro de ponto por geolocalização
- ✅ Visualização de registros

### Para Empresas (Modo Kiosk)
- ✅ Login administrativo
- ✅ Câmera frontal automática
- ✅ Reconhecimento facial
- ✅ Registro por detecção de rosto

### Sistema de Permissões (Primeira Visita)
- ✅ Modal interativo solicita permissões
- ✅ Explicação clara do uso de câmera e localização
- ✅ Fluxo em 3 etapas (boas-vindas → câmera → localização)
- ✅ Opção de pular permissões
- ✅ Persistência no localStorage (não solicita novamente)
- 📖 Documentação completa: [PERMISSIONS_SYSTEM.md](./PERMISSIONS_SYSTEM.md)

## 🔧 Tecnologias

- **React 18** - Framework
- **Vite** - Build tool
- **Tailwind CSS** - Estilização
- **Framer Motion** - Animações
- **Axios** - HTTP client
- **React Router** - Navegação
- **Vite PWA Plugin** - PWA features

## 📲 Instalar como App

### Android (Chrome)
1. Abra o site no Chrome
2. Menu → "Adicionar à tela inicial"
3. Confirme a instalação

### iOS (Safari)
1. Abra o site no Safari
2. Compartilhar → "Adicionar à Tela de Início"
3. Confirme

## 🌐 API

Configure a URL da API no arquivo **`.env`** na raiz do projeto (copie de `.env.example`):

```env
VITE_API_URL=http://localhost:5000
```

Em produção, use a URL do seu backend. O arquivo `.env` não é commitado (está no `.gitignore`).

## 📝 Estrutura

```
pwa-mobile/
├── public/
│   └── icon-*.png          # Ícones PWA
├── src/
│   ├── components/
│   │   └── ProtectedRoute.jsx
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── FuncionarioLoginPage.jsx
│   │   ├── EmpresaLoginPage.jsx
│   │   ├── FuncionarioDashboardPage.jsx
│   │   ├── RegistroPontoPage.jsx
│   │   └── EmpresaDashboardPage.jsx
│   ├── services/
│   │   └── api.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## 🔒 Segurança e Permissões

### HTTPS Obrigatório

⚠️ **Importante**: Câmera e geolocalização exigem HTTPS ou `localhost`

Veja o guia completo: **[HTTPS_SETUP.md](./HTTPS_SETUP.md)**

### Opções Rápidas

1. **Desenvolvimento Local**:
   ```bash
   # Use localhost ao invés de IP
   npm run dev
   # Acesse: http://localhost:3000
   ```

2. **Rede Local com HTTPS**:
   ```powershell
   # Instale mkcert e gere certificados
   choco install mkcert
   mkcert -install
   ```

3. **Túnel HTTPS (Testes Externos)**:
   ```powershell
   ngrok http 3000
   # Fornece URL HTTPS pública
   ```

### Permissões Necessárias

- 📷 **Câmera** - Modo Kiosk (empresa)
- 📍 **Localização** - Registro de ponto (funcionário)

### Segurança

- JWT Token no localStorage
- Rotas protegidas por autenticação
- Validação de tipo de usuário
- CORS configurado no backend

## 🎨 Personalização

### Cores
Edite `tailwind.config.js` para mudar o tema:

```javascript
theme: {
  extend: {
    colors: {
      primary: { ... }
    }
  }
}
```

### Manifest PWA
Edite `vite.config.js` para customizar o manifest:

```javascript
manifest: {
  name: 'Seu App',
  short_name: 'App',
  theme_color: '#2563eb',
  // ...
}
```

## 📊 Status

- ✅ Autenticação funcionário/empresa
- ✅ Dashboard funcionário
- ✅ Registro por geolocalização
- ✅ Histórico de registros
- ✅ Dashboard empresa (básico)
- ✅ PWA configurado
- ✅ Responsivo mobile-first

## 🐛 Troubleshooting

### Geolocalização não funciona
- Use HTTPS (ou localhost)
- Permita localização no navegador
- Ative GPS no dispositivo

### PWA não instala
- Use HTTPS
- Verifique manifest.webmanifest
- Limpe cache do navegador

### Build falha
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📄 Licença

Uso interno - Todos os direitos reservados
