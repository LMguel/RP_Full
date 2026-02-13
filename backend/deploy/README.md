# Arquivos de Deploy

## ⚠️ Atenção

Os arquivos nesta pasta contêm configurações específicas do servidor de produção.

**IMPORTANTE:** Se o repositório for público:

1. **Use o arquivo template:** `nginx.conf.template` (sem informações sensíveis)
2. **Não commite** `nginx.conf` com domínios/IPs reais
3. **Substitua** `SEU_DOMINIO_AQUI` pelo domínio real durante o deploy

## Arquivos

- `nginx.conf` - ⚠️ **NÃO COMMITAR** - Configuração do Nginx com domínio específico
- `nginx.conf.template` - ✅ **COMMITAR** - Template sem informações sensíveis
- `registraponto.service` - Systemd service file

## Como Usar

1. Copie o template:
   ```bash
   cp nginx.conf.template nginx.conf
   ```

2. Substitua `SEU_DOMINIO_AQUI` pelo seu domínio real

3. Ajuste os caminhos dos certificados SSL se necessário

4. **NÃO commite** o `nginx.conf` final (adicione ao `.gitignore`)

