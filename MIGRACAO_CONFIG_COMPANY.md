# 🔄 Guia de Migração - Tabela ConfigCompany

## 📋 Visão Geral

Este guia explica como migrar a estrutura de configurações da empresa de um formato plano para um formato hierárquico organizado.

---

## 🎯 Objetivos da Reestruturação

✅ **Organização**: Campos agrupados logicamente  
✅ **Escalabilidade**: Fácil adicionar novos campos  
✅ **Manutenibilidade**: Código mais claro e estruturado  
✅ **Padrões**: Nomes em inglês, sem acentos  
✅ **Compatibilidade**: Código antigo continua funcionando  

---

## 📊 Comparação das Estruturas

### ❌ Estrutura Antiga (Plana)

```json
{
  "company_id": "COMP001",
  "tolerancia_atraso": 10,
  "hora_extra_entrada_antecipada": true,
  "arredondamento_horas_extras": "15",
  "intervalo_automatico": true,
  "duracao_intervalo": 60,
  "compensar_saldo_horas": true,
  "exigir_localizacao": false,
  "raio_permitido": 100
}
```

**Problemas:**
- Campos misturados sem organização
- Difícil de expandir
- Nomes em português com acentuação

### ✅ Estrutura Nova (Hierárquica)

```json
{
  "company_id": "COMP001",
  "data_atualizacao": "2025-11-12T12:00:00",
  
  "work_days": ["mon", "tue", "wed", "thu", "fri"],
  
  "work_hours": {
    "default_start": "08:00",
    "default_end": "17:00",
    "break_duration": 60,
    "intervalo_automatico": true
  },
  
  "rounding_rules": {
    "tolerance_before": 10,
    "tolerance_after": 10,
    "round_to_nearest": 15
  },
  
  "extra_time_rules": {
    "count_early_as_extra": true,
    "count_late_as_extra": true
  },
  
  "auto_compensation": true,
  
  "location_rules": {
    "exigir_localizacao": false,
    "raio_permitido": 100,
    "latitude_empresa": null,
    "longitude_empresa": null
  },
  
  "holiday_policy": "ignore",
  "custom_holidays": [],
  
  "weekend_policy": {
    "enabled": false,
    "default_hours": {
      "sat": "00:00",
      "sun": "00:00"
    }
  }
}
```

**Vantagens:**
- Campos organizados por categoria
- Fácil de entender e manter
- Preparado para expansão futura

---

## 🚀 Processo de Migração

### Passo 1: Backup dos Dados

```bash
# Fazer backup da tabela atual
aws dynamodb scan --table-name ConfigCompany > backup_config_company.json
```

### Passo 2: Testar a Migração (Simulação)

```bash
cd backend
python migrate_config_table.py
```

**Saída esperada:**
```
🔍 Verificando status atual...
📊 Status da migração:
  ✅ Migradas: 0
  ⏳ Pendentes: 3
  📦 Total: 3

🔄 Executando migração em modo DRY RUN (simulação)...
======================================================================
MIGRAÇÃO DA TABELA ConfigCompany
======================================================================
Modo: DRY RUN (simulação)

📊 Encontradas 3 configurações para migrar

🏢 Processando empresa: COMP001
  ✓ Estrutura antiga: 9 campos planos
  ✓ Estrutura nova: 11 campos organizados
  ⚠️  Simulação - não salvo (use dry_run=False para salvar)

...

======================================================================
RESUMO DA MIGRAÇÃO
======================================================================
✅ Sucesso: 3
❌ Erros: 0
📊 Total: 3

⚠️  Esta foi uma SIMULAÇÃO. Execute com dry_run=False para aplicar.
```

### Passo 3: Executar a Migração Real

```bash
python migrate_config_table.py --execute
```

Digite `sim` quando solicitado.

### Passo 4: Verificar o Resultado

```bash
python migrate_config_table.py
```

Deve mostrar todas as configurações como "Migradas".

---

## 💻 Atualizando o Código

### Método 1: Usando o Adaptador (Recomendado)

O adaptador permite que o código antigo e novo funcionem juntos.

**Antes:**
```python
config_response = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
configuracoes = config_response.get('Item', {})
tolerancia = configuracoes.get('tolerancia_atraso', 5)
hora_extra = configuracoes.get('hora_extra_entrada_antecipada', False)
```

**Depois:**
```python
from config_adapter import wrap_config

config_response = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
configuracoes_raw = config_response.get('Item', {})
config = wrap_config(configuracoes_raw)

# Funciona com AMBOS os formatos!
tolerancia = config.tolerancia_atraso
hora_extra = config.hora_extra_entrada_antecipada
```

### Método 2: Acessando Nova Estrutura

```python
from config_adapter import wrap_config

config = wrap_config(configuracoes_raw)

# Acessar novos campos hierárquicos
work_hours = config.work_hours
print(f"Início: {work_hours['default_start']}")
print(f"Fim: {work_hours['default_end']}")

# Dias úteis
if 'sat' in config.work_days:
    print("Empresa trabalha aos sábados")

# Feriados customizados
for holiday in config.custom_holidays:
    print(f"Feriado: {holiday}")
```

---

## 📝 Checklist de Arquivos a Atualizar

### Backend

- [x] `migrate_config_table.py` - Script de migração (CRIADO)
- [x] `config_adapter.py` - Adaptador de compatibilidade (CRIADO)
- [ ] `routes.py` - Atualizar endpoint `/configuracoes`
- [ ] `overtime_calculator.py` - Usar adaptador
- [ ] `geolocation_utils.py` - Usar adaptador
- [ ] Qualquer outro arquivo que acesse configurações

### Frontend

- [ ] `front/src/types/index.ts` - Atualizar interface `CompanySettings`
- [ ] `front/src/pages/SettingsPage.tsx` - Suportar nova estrutura
- [ ] Adaptar formulários de configuração

---

## 🔧 Exemplos de Migração de Código

### Exemplo 1: overtime_calculator.py

**Antes:**
```python
def calculate_overtime(..., configuracoes, ...):
    tolerancia_atraso = configuracoes.get('tolerancia_atraso', 0)
    conta_entrada_antecipada = configuracoes.get('hora_extra_entrada_antecipada', False)
    arredondamento = configuracoes.get('arredondamento_horas_extras', 'exato')
    compensar_saldo_horas = configuracoes.get('compensar_saldo_horas', False)
```

**Depois:**
```python
from config_adapter import wrap_config

def calculate_overtime(..., configuracoes, ...):
    config = wrap_config(configuracoes)
    
    tolerancia_atraso = config.tolerancia_atraso
    conta_entrada_antecipada = config.hora_extra_entrada_antecipada
    arredondamento = config.arredondamento_horas_extras
    compensar_saldo_horas = config.compensar_saldo_horas
```

### Exemplo 2: routes.py (endpoint configuracoes)

**Antes:**
```python
configuracoes_padrao = {
    'company_id': empresa_id,
    'tolerancia_atraso': 5,
    'hora_extra_entrada_antecipada': False,
    'arredondamento_horas_extras': '5',
    'intervalo_automatico': False,
    'duracao_intervalo': 60,
    'compensar_saldo_horas': False
}
```

**Depois:**
```python
from config_adapter import wrap_config

# Se já existe no banco, usar adaptador
if 'Item' in response:
    config = wrap_config(response['Item'])
    return jsonify(config.to_dict(format='auto'))

# Se não existe, criar no novo formato
configuracoes_padrao = {
    'company_id': empresa_id,
    'work_days': ['mon', 'tue', 'wed', 'thu', 'fri'],
    'work_hours': {
        'default_start': '08:00',
        'default_end': '17:00',
        'break_duration': 60,
        'intervalo_automatico': False
    },
    'rounding_rules': {
        'tolerance_before': 5,
        'tolerance_after': 5,
        'round_to_nearest': 5
    },
    'extra_time_rules': {
        'count_early_as_extra': False,
        'count_late_as_extra': True
    },
    'auto_compensation': False,
    'location_rules': {
        'exigir_localizacao': False,
        'raio_permitido': 100
    }
}
```

---

## 🧪 Testes

### Testar Compatibilidade do Adaptador

```bash
python config_migration_examples.py
```

**Saída esperada:**
```
=== TESTE COM FORMATO ANTIGO ===
Tolerância: 10
Hora extra antecipada: True
Arredondamento: 15

=== TESTE COM FORMATO NOVO ===
Tolerância: 10
Hora extra antecipada: True
Arredondamento: 15

=== VERIFICAÇÃO ===
✅ Ambos formatos retornam os mesmos valores!
```

### Testar Endpoints da API

```bash
# Testar GET configurações
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/configuracoes

# Testar PUT configurações
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"auto_compensation": true}' \
  http://localhost:5000/api/configuracoes
```

---

## 🎯 Roadmap de Implementação

### Fase 1: Preparação ✅
- [x] Criar script de migração
- [x] Criar adaptador de compatibilidade
- [x] Criar exemplos e documentação

### Fase 2: Migração de Dados
- [ ] Fazer backup da tabela
- [ ] Executar migração em produção
- [ ] Verificar integridade dos dados

### Fase 3: Atualização de Código
- [ ] Atualizar `routes.py`
- [ ] Atualizar `overtime_calculator.py`
- [ ] Atualizar `geolocation_utils.py`
- [ ] Atualizar frontend

### Fase 4: Testes
- [ ] Testes unitários
- [ ] Testes de integração
- [ ] Testes end-to-end

### Fase 5: Deploy
- [ ] Deploy em staging
- [ ] Testes em staging
- [ ] Deploy em produção
- [ ] Monitoramento

---

## ⚠️ Cuidados e Considerações

### Rollback
Se algo der errado, você pode reverter:
1. Restaurar o backup: `aws dynamodb batch-write-item ...`
2. Remover importações do adaptador
3. Voltar ao código anterior

### Performance
- O adaptador adiciona overhead mínimo
- Considere cachear configurações se houver muitas requisições

### Compatibilidade
- APIs antigas continuam funcionando
- Frontend antigo continua funcionando
- Migração pode ser gradual

---

## 📚 Recursos Adicionais

- **Script de Migração**: `backend/migrate_config_table.py`
- **Adaptador**: `backend/config_adapter.py`
- **Exemplos**: `backend/config_migration_examples.py`
- **Testes**: Execute `python config_migration_examples.py`

---

## 🆘 Suporte

Se encontrar problemas:
1. Verifique os logs do servidor
2. Execute o script em modo dry-run
3. Teste o adaptador com dados de exemplo
4. Consulte os exemplos de código

---

## ✅ Conclusão

Esta migração torna o sistema mais:
- **Organizado**: Campos agrupados logicamente
- **Escalável**: Fácil adicionar recursos
- **Manutenível**: Código mais limpo
- **Seguro**: Mantém compatibilidade total

**Próximo passo**: Execute `python migrate_config_table.py` para testar!
