# Mobile API Configuration

## Credenciais cadastradas:
- **user_id**: miguel123
- **senha**: 123123
- **empresa**: Mingas

## Configuração do Backend

O backend está rodando em `http://localhost:5000`

### Para testar no mobile:

1. **Descubra o IP da sua máquina na rede local:**

   No PowerShell, execute:
   ```powershell
   ipconfig
   ```
   
   Procure por "Endereço IPv4" na seção "Adaptador de Rede sem Fio" ou "Ethernet".
   Exemplo: `192.168.1.100`

2. **Configure a variável de ambiente no mobile:**

   Crie um arquivo `.env` na pasta `mobile/` com:
   ```
   EXPO_PUBLIC_API_URL=http://SEU_IP_AQUI:5000/api
   ```
   
   Exemplo:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.100:5000/api
   ```

3. **Reinicie o Expo:**
   ```bash
   # Pare o servidor Expo (Ctrl+C)
   # Inicie novamente
   npm start
   ```

4. **Teste o login no app com:**
   - user_id: `miguel123`
   - senha: `123123`

## Testando a conexão

Para verificar se o mobile consegue acessar o backend:

1. No navegador do seu celular, acesse:
   ```
   http://SEU_IP:5000/api/health
   ```
   
   Deve retornar:
   ```json
   {"status":"OK","message":"API endpoints funcionando","service":"Ponto Inteligente API"}
   ```

2. Se não funcionar, verifique:
   - Firewall do Windows (liberar porta 5000)
   - Celular e computador na mesma rede WiFi
   - Backend está rodando (`python app.py`)

## Liberando o Firewall (se necessário)

No PowerShell como Administrador:
```powershell
New-NetFirewallRule -DisplayName "Flask API" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

## URLs de teste:

- Health check: `http://SEU_IP:5000/api/health`
- Login teste: `http://SEU_IP:5000/api/login`
