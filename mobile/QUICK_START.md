# 🚀 Guia de Início Rápido - RegistraPonto Tablet

## ⚡ Setup Rápido (5 minutos)

### 1. Instalar Dependências
```bash
cd tablet
npm install
```

### 2. Configurar API
Edite `src/services/api.js` linha 6:
```javascript
const API_URL = 'http://SEU_IP_AQUI:5000/api';
```

**Como descobrir seu IP:**
- Windows: `ipconfig` → Procure "IPv4"
- Mac/Linux: `ifconfig` → Procure "inet"
- Exemplo: `192.168.1.4`

### 3. Iniciar Backend
```bash
cd ../backend
python app.py
```

### 4. Iniciar Tablet App
```bash
cd ../tablet
npm start
```

### 5. Abrir no Dispositivo
- Instale **Expo Go** no tablet (Play Store/App Store)
- Escaneie o QR code que aparece no terminal
- Aguarde o app carregar

### 6. Fazer Login
- Usuário: mesmo do painel web
- Senha: mesma do painel web

### 7. Testar Reconhecimento
- Posicione um rosto cadastrado na câmera
- Clique em "Registrar Ponto"
- Veja a confirmação aparecer!

## ✅ Checklist de Funcionamento

- [ ] Backend rodando (http://localhost:5000/health retorna 200)
- [ ] IP correto configurado em `api.js`
- [ ] Tablet e PC na mesma rede WiFi
- [ ] Expo Go instalado no tablet
- [ ] Funcionários cadastrados com fotos no sistema
- [ ] AWS Rekognition configurado
- [ ] Câmera do tablet funcionando

## 🎯 Teste Rápido

1. **Teste de Conexão:**
   ```bash
   # No tablet, abra o navegador e acesse:
   http://SEU_IP:5000/health
   # Deve retornar: {"status": "OK"}
   ```

2. **Teste de Login:**
   - Abra o app
   - Digite credenciais
   - Deve entrar na tela da câmera

3. **Teste de Reconhecimento:**
   - Mostre um rosto cadastrado
   - Clique em "Registrar Ponto"
   - Deve aparecer: "Bom dia, [Nome]!"

## 🐛 Problemas Comuns

### "Network Error"
**Solução:** IP errado ou backend não está rodando
```bash
# Verifique se backend está rodando:
curl http://localhost:5000/health
```

### "Nenhum rosto detectado"
**Solução:** 
- Melhore a iluminação
- Aproxime mais o rosto
- Verifique se funcionário está cadastrado

### App não carrega
**Solução:**
- Verifique se está na mesma rede WiFi
- Reinicie o Expo: `npm start --clear`

## 📱 Modo Produção

### Para deixar o tablet fixo (Kiosk Mode):

**Android:**
1. Instale: **"Fully Kiosk Browser"** (Play Store)
2. Configure para abrir o RegistraPonto
3. Ative "Kiosk Mode"
4. Configure para iniciar no boot

**iOS:**
1. Settings → Accessibility → Guided Access
2. Ative Guided Access
3. Abra o RegistraPonto
4. Triplo clique no botão lateral
5. Toque em "Start"

## 🎨 Personalização

### Alterar cores:
Edite `src/screens/CameraScreen.js`:
```javascript
// Linha 245 - Cor primária
backgroundColor: '#3b82f6', // Azul (padrão)

// Outras cores disponíveis:
// '#10b981' - Verde
// '#f59e0b' - Laranja
// '#ef4444' - Vermelho
// '#8b5cf6' - Roxo
```

### Alterar logo:
Substitua os arquivos em `assets/`:
- `icon.png` - Ícone do app (1024x1024)
- `splash.png` - Tela de carregamento
- `adaptive-icon.png` - Ícone Android

## 📊 Monitoramento

### Ver logs em tempo real:
```bash
npx react-native log-android  # Android
npx react-native log-ios       # iOS
```

### Debug remoto:
- Shake o dispositivo
- Selecione "Debug"
- Abra Chrome: `chrome://inspect`

## 🔄 Atualizar App

```bash
cd tablet
git pull
npm install
npm start
```

## 📞 Contato

Problemas? Entre em contato com o suporte técnico.

---

**🎉 Pronto! Seu totem de reconhecimento facial está funcionando!**
