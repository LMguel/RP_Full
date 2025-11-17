# Compensação de Saldo de Horas

## Descrição
Quando a opção **"Compensar Saldo de Horas"** está ativada nas configurações da empresa, o sistema automaticamente compensa atrasos com horas extras trabalhadas no mesmo dia.

## Como Funciona

### Cenário 1: Horas Extras Cobrem Todo o Atraso
**Configuração:**
- Horário de entrada esperado: 08:00
- Horário de saída esperado: 17:00
- Tolerância de atraso: 5 minutos
- Compensar saldo de horas: ✅ Ativado

**Registro:**
- Entrada real: 08:20 (20 minutos de atraso)
- Saída real: 17:30 (30 minutos de hora extra)

**Resultado SEM compensação:**
- Atrasos: 15 minutos (20min - 5min tolerância)
- Horas extras: 25 minutos (30min - 5min tolerância)

**Resultado COM compensação:**
- Atrasos: 0 minutos (compensado pelas horas extras)
- Horas extras: 10 minutos (25min - 15min de atraso)

---

### Cenário 2: Horas Extras Compensam Parcialmente
**Configuração:**
- Horário de entrada esperado: 08:00
- Horário de saída esperado: 17:00
- Tolerância de atraso: 5 minutos
- Compensar saldo de horas: ✅ Ativado

**Registro:**
- Entrada real: 08:30 (30 minutos de atraso)
- Saída real: 17:15 (15 minutos de hora extra)

**Resultado SEM compensação:**
- Atrasos: 25 minutos (30min - 5min tolerância)
- Horas extras: 10 minutos (15min - 5min tolerância)

**Resultado COM compensação:**
- Atrasos: 15 minutos (25min - 10min de horas extras)
- Horas extras: 0 minutos (totalmente usadas na compensação)

---

### Cenário 3: Sem Compensação (Opção Desativada)
**Configuração:**
- Compensar saldo de horas: ❌ Desativado

**Resultado:**
- Atrasos e horas extras são calculados independentemente
- Não há compensação automática entre eles

## Configuração no Sistema

### Web (Front)
1. Acesse **Configurações** no menu lateral
2. Localize a seção **"Configurações de Ponto e Horas Extras"**
3. Ative o switch **"Compensar Saldo de Horas"**
4. Clique em **"Salvar Configurações"**

### Observações Importantes
- A compensação é feita automaticamente no cálculo de cada registro
- A ordem de processamento é:
  1. Calcular atrasos
  2. Calcular horas extras
  3. Aplicar arredondamento nas horas extras
  4. Compensar atrasos com horas extras (se ativado)
- A compensação ocorre no mesmo registro (mesmo dia)
- Horas extras de entrada antecipada também podem compensar atrasos
- A tolerância é aplicada ANTES da compensação

## Implementação Técnica

### Frontend
- **Arquivo:** `front/src/types/index.ts`
  - Adicionado campo `compensar_saldo_horas: boolean` em `CompanySettings`

- **Arquivo:** `front/src/pages/SettingsPage.tsx`
  - Nova opção de configuração com switch
  - Ícone: CheckCircle (verde)
  - Cor do switch: `#10b981` (verde)

### Backend
- **Arquivo:** `backend/routes.py`
  - Endpoint `/configuracoes` (GET/PUT)
  - Campo `compensar_saldo_horas` salvo no DynamoDB

- **Arquivo:** `backend/overtime_calculator.py`
  - Função `calculate_overtime()`
  - Lógica de compensação:
    ```python
    if compensar_saldo_horas and resultado['atraso_minutos'] > 0 and resultado['horas_extras_minutos'] > 0:
        if resultado['horas_extras_minutos'] >= resultado['atraso_minutos']:
            # Horas extras cobrem todos os atrasos
            resultado['horas_extras_minutos'] -= resultado['atraso_minutos']
            resultado['atraso_minutos'] = 0
        else:
            # Horas extras compensam parcialmente os atrasos
            resultado['atraso_minutos'] -= resultado['horas_extras_minutos']
            resultado['horas_extras_minutos'] = 0
    ```

## Logs de Debug
O sistema registra logs quando há compensação:
```
[COMPENSAÇÃO] Antes - Horas Extras: 25min, Atrasos: 15min
[COMPENSAÇÃO] Depois - Horas Extras: 10min, Atrasos: 0min
```

## Impacto nos Relatórios
- Os relatórios mostrarão os valores já compensados
- O histórico de registros exibirá apenas o saldo final
- A compensação é transparente para o usuário final
