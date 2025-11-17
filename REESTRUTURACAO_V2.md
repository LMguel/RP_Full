# 🚀 GUIA DE REESTRUTURAÇÃO COMPLETA - REGISTRA.PONTO v2.0

## 📋 Visão Geral

Esta é uma reestruturação COMPLETA do sistema para arquitetura escalável multi-empresa.

### ✅ O que JÁ foi feito:

1. ✅ **Novas tabelas DynamoDB criadas**:
   - `DailySummary` - Resumos diários por funcionário
   - `MonthlySummary` - Resumos mensais por funcionário

2. ✅ **Novos módulos criados**:
   - `models.py` - Modelos de dados (DailySummary, MonthlySummary, etc.)
   - `summary_calculator.py` - Cálculo de resumos diários/mensais
   - `s3_manager.py` - Gerenciamento de fotos com nova estrutura

3. ✅ **Migração de configurações concluída** (etapa anterior):
   - `ConfiguracoesEmpresa` migrada para estrutura hierárquica

---

## 🎯 Próximos Passos Necessários

### Fase 1: Backend Core (CRÍTICO)
- [ ] Atualizar `routes.py` para usar novos resumos
- [ ] Criar endpoint para registrar ponto com resumos automáticos
- [ ] Criar endpoints de dashboard (daily/monthly summaries)
- [ ] Migrar lógica de overtime_calculator para summary_calculator

### Fase 2: Migração de Dados
- [ ] Script para migrar RegistrosPonto antigos
- [ ] Script para gerar DailySummary de dados históricos
- [ ] Script para gerar MonthlySummary de dados históricos
- [ ] Migrar fotos S3 para nova estrutura de pastas

### Fase 3: Frontend Web
- [ ] Atualizar dashboard para usar DailySummary/MonthlySummary
- [ ] Atualizar página de funcionários
- [ ] Atualizar relatórios

### Fase 4: Mobile
- [ ] Atualizar registro de ponto
- [ ] Atualizar dashboard do funcionário

---

## 🔧 Estrutura de Dados Implementada

### DailySummary
```python
{
    "company_id": "COMP123",
    "employee_id#date": "EMP456#2025-11-13",
    "employee_id": "EMP456",
    "date": "2025-11-13",
    "work_mode": "onsite",
    "scheduled_start": "08:00",
    "scheduled_end": "17:00",
    "actual_start": "07:55",
    "actual_end": "18:30",
    "expected_hours": 8.0,
    "worked_hours": 9.5,
    "extra_hours": 1.5,
    "delay_minutes": 0,
    "compensated_minutes": 0,
    "daily_balance": 1.5,
    "status": "extra"
}
```

### MonthlySummary
```python
{
    "company_id": "COMP123",
    "employee_id#month": "EMP456#2025-11",
    "employee_id": "EMP456",
    "month": "2025-11",
    "expected_hours": 176,
    "worked_hours": 180,
    "extra_hours": 4,
    "delay_minutes": 30,
    "compensated_minutes": 30,
    "final_balance": 4,
    "absences": 0,
    "worked_holidays": 0,
    "days_worked": 22,
    "status": "positive"
}
```

### Nova Estrutura S3
```
/registraponto-prod-fotos/
  └── company_id/
      └── employee_id/
          └── YYYY/
              └── MM/
                  └── DD/
                      └── HH-mm-ss.jpg
```

---

## ⚠️ DECISÃO NECESSÁRIA

**Esta é uma reestruturação MASSIVA** que requer:

1. **~3000+ linhas de código** para reescrever completamente
2. **Migração de TODOS os dados** existentes
3. **Testes extensivos** de todas as funcionalidades
4. **Atualização de frontend E mobile**

### Opções:

**Opção A: Implementação Completa Imediata** (8-12 horas)
- Reescrever TUDO agora
- Alto risco de bugs iniciais
- Sistema ficará offline durante migração

**Opção B: Implementação Gradual** (Recomendado)
- Manter sistema atual funcionando
- Adicionar novos endpoints em paralelo
- Migrar dados aos poucos
- Testar extensivamente antes de trocar

**Opção C: Implementação Híbrida**
- Implementar APENAS os módulos críticos agora
- Resto fica para próximas iterações
- Menor risco

---

## 🚨 STATUS ATUAL DO SISTEMA

### ✅ O que está funcionando AGORA:
- Sistema de login (empresa + funcionário)
- Registro de ponto básico
- Dashboard básico
- Cálculo de horas extras (overtime_calculator)
- Compensação de saldo de horas
- Configurações da empresa (migradas)

### ❌ O que PRECISA ser reescrito:
- Todo o fluxo de registro de ponto
- Todos os dashboards
- Todos os relatórios
- Geração de resumos
- Sistema de fotos S3

---

## 💡 RECOMENDAÇÃO

Dado que o sistema JÁ está funcionando e em produção, sugiro:

1. **MANTER** o sistema atual funcionando
2. **ADICIONAR** as novas tabelas e módulos (JÁ FEITO)
3. **CRIAR** scripts de migração de dados
4. **TESTAR** extensivamente em ambiente de desenvolvimento
5. **MIGRAR** em produção apenas quando 100% testado

Isso evita quebrar o sistema atual enquanto desenvolvemos a v2.0.

---

## 📝 Arquivos Criados Até Agora

1. `create_new_tables.py` - Cria DailySummary e MonthlySummary ✅
2. `models.py` - Modelos de dados completos ✅
3. `summary_calculator.py` - Cálculo de resumos ✅
4. `s3_manager.py` - Gerenciamento S3 ✅

---

## ❓ O que você quer fazer?

**Digite um dos números:**

1. **Implementar TUDO agora** (8-12h, alto risco)
2. **Implementar gradualmente** (seguro, testado)
3. **Apenas criar scripts de teste** (verificar se estrutura funciona)
4. **Implementar apenas endpoints críticos** (registro de ponto + dashboard básico)

**OU diga o que prefere!**
