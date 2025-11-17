# 📱 RegistraPonto Tablet - Totem de Reconhecimento Facial

Aplicativo tablet React Native + Expo para reconhecimento facial em modo totem/kiosk.

## 🚀 Características

- ✅ **Login com credenciais web** - Usa as mesmas credenciais do painel administrativo
- 📸 **Reconhecimento facial automático** - AWS Rekognition
- 🎯 **Modo Landscape** - Otimizado para tablets em posição horizontal
- ⏰ **Saudações personalizadas** - "Bom dia/Boa tarde/Boa noite" baseado no horário
- 🎨 **Interface moderna** - Design glassmorphism com animações suaves
- 🔒 **Seguro** - Token JWT, armazenamento seguro de credenciais
- 🌐 **Multi-empresa** - Cada empresa vê apenas seus funcionários

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- Dispositivo Android/iOS ou emulador
- Backend da API rodando

## 🔧 Instalação

### 1. Instalar dependências

```bash
cd tablet
npm install
```

### 2. Configurar a API

Edite `src/services/api.js` e altere a URL da API:

```javascript
const API_URL = 'http://SEU_IP:5000/api'; // Substitua SEU_IP pelo IP da máquina do backend
```

**Importante:** 
- Use o IP da rede local (ex: 192.168.1.4)
- NÃO use `localhost` ou `127.0.0.1` no dispositivo físico
- Para descobrir seu IP:
  - Windows: `ipconfig` no CMD
  - Mac/Linux: `ifconfig` no terminal

### 3. Executar o app

```bash
npm start
```

Depois:
- Pressione `a` para Android
- Pressione `i` para iOS
- Escaneie o QR code com o app Expo Go

## 📱 Como usar

### 1. Login
- Use as mesmas credenciais do painel web da empresa
- Usuário: `usuario_empresa`
- Senha: senha da empresa

### 2. Reconhecimento Facial
- O app abre a câmera frontal automaticamente
- Posicione o rosto do funcionário no centro
- Clique em "Registrar Ponto"
- O sistema reconhece e registra automaticamente

### 3. Confirmação
- Aparece uma mensagem: "Bom dia/Boa tarde, [Nome]!"
- Mostra se foi entrada ou saída
- Horário do registro

## 🏗️ Estrutura do Projeto

```
tablet/
├── App.js                      # Arquivo principal
├── app.json                    # Configuração Expo
├── package.json                # Dependências
├── src/
│   ├── contexts/
│   │   └── AuthContext.js      # Contexto de autenticação
│   ├── routes/
│   │   └── index.js            # Navegação
│   ├── screens/
│   │   ├── LoginScreen.js      # Tela de login
│   │   └── CameraScreen.js     # Tela da câmera
│   └── services/
│       └── api.js              # Serviço de API
└── assets/                     # Imagens e ícones
```

## 🎨 Tecnologias

- **React Native** - Framework mobile
- **Expo** - Plataforma de desenvolvimento
- **Expo Camera** - Acesso à câmera
- **Expo SecureStore** - Armazenamento seguro de tokens
- **React Navigation** - Navegação entre telas
- **Axios** - Requisições HTTP
- **React Native Animatable** - Animações

## 🔐 Segurança

- ✅ Token JWT armazenado com SecureStore
- ✅ HTTPS recomendado em produção
- ✅ Timeout de 15s nas requisições
- ✅ Logout manual disponível
- ✅ Validações de permissões de câmera

## 🌐 Integração com Backend

### Endpoints utilizados:

1. **Login**
   ```
   POST /api/login
   Body: { usuario_id, senha }
   ```

2. **Registro de Ponto (Facial)**
   ```
   POST /api/registrar_ponto
   Header: Authorization: Bearer <token>
   Body: FormData com foto
   ```

### Formato da resposta esperada:

```json
{
  "mensagem": "Ponto registrado com sucesso",
  "funcionario_nome": "João Silva",
  "tipo_registro": "entrada",
  "horario": "09:00:00"
}
```

## 📊 Fluxo de Funcionamento

```
1. Empresa faz login com credenciais web
   └─> Token JWT salvo localmente

2. Câmera frontal é ativada
   └─> Guia visual para posicionamento do rosto

3. Funcionário clica em "Registrar Ponto"
   └─> Foto capturada
   └─> Enviada para backend (FormData)
   └─> Backend usa AWS Rekognition
   └─> Reconhece funcionário da empresa
   └─> Registra ponto no DynamoDB

4. App recebe resposta
   └─> Mostra "Bom dia/Boa tarde, [Nome]!"
   └─> Tipo: Entrada/Saída
   └─> Horário do registro

5. Modal fecha após 4 segundos
   └─> Pronto para próximo funcionário
```

## 🎯 Modo Totem/Kiosk

Para usar como totem fixo:

### Android:
1. Instale um app de kiosk mode (ex: "Kiosk Browser Lockdown")
2. Configure para abrir apenas o RegistraPonto
3. Desative botões físicos
4. Fixe o tablet na parede

### iOS:
1. Use o "Guided Access" nativo
2. Settings > Accessibility > Guided Access
3. Configure para bloquear o tablet no app

## 🐛 Troubleshooting

### Câmera não funciona
- Verifique permissões no app
- Settings > Apps > RegistraPonto > Permissions > Camera

### Erro "Network Error"
- Confirme que o backend está rodando
- Verifique se o IP está correto em `api.js`
- Certifique-se que tablet e backend estão na mesma rede

### Reconhecimento falha
- Verifique se há boa iluminação
- Funcionário deve estar cadastrado no sistema
- Foto do funcionário deve estar no AWS S3

### Token expirado
- Faça logout e login novamente
- Token válido por 12 horas

## 🚀 Build para Produção

### Android (APK)

```bash
expo build:android
```

### iOS (IPA)

```bash
expo build:ios
```

## 📝 Configurações Recomendadas

### Para Totem:
- **Orientação:** Landscape (já configurado)
- **Modo Kiosk:** Ativado
- **Brilho:** Automático
- **Sleep:** Desativado
- **Updates:** Automáticos desativados

### Para Backend:
- **AWS Rekognition:** Collection por empresa
- **S3:** Bucket com pastas por empresa
- **DynamoDB:** Composite keys (company_id + ...)

## 📄 Licença

Proprietary - Todos os direitos reservados

## 👨‍💻 Suporte

Para dúvidas ou problemas:
1. Verifique este README
2. Consulte os logs no terminal
3. Entre em contato com o suporte técnico

---

**Desenvolvido para RegistraPonto**  
Versão Tablet 1.0.0
