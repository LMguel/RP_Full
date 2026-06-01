"""
Normalização canônica de registros de ponto.

TODA lógica de extração de employee_id e data_hora deve passar por aqui.
Todos os endpoints (api.py, daily.py, funcionario/registros) devem usar
este módulo para garantir comportamento idêntico e consistente.

Schemas suportados (compatibilidade retroativa):
  V1 legado  : employee_id#date_time é o sort key; sem campo data_hora explícito
  V2 padrão  : data_hora como campo explícito; employee_id#date_time como sort key
  V3 motor   : data_hora_calculo calculado pelo calculation_engine
  V4 explícito: funcionario_id como campo separado (criado via kiosk moderno)
"""

from typing import Optional, List, Dict, Any
from collections import defaultdict


# ---------------------------------------------------------------------------
# Extração canônica de campos
# ---------------------------------------------------------------------------

def extrair_employee_id(record: Dict[str, Any]) -> str:
    """
    Extrai o employee_id canônico de qualquer schema de registro DynamoDB.

    Prioridade:
    1. funcionario_id  (campo explícito mais confiável)
    2. employee_id     (campo alternativo explícito)
    3. prefixo de employee_id#date_time (campo composto — apenas se não-vazio)

    Case-preserving: retorna o valor original sem modificação de case.
    Use .lower() ao comparar.
    """
    emp = (
        record.get('funcionario_id') or
        record.get('employee_id') or
        ''
    )
    if emp:
        return str(emp).strip()

    composite = str(record.get('employee_id#date_time') or '')
    if '#' in composite:
        prefix = composite.split('#', 1)[0].strip()
        if prefix:
            return prefix

    return ''


def extrair_data_hora(record: Dict[str, Any]) -> str:
    """
    Extrai o datetime canônico de qualquer schema de registro DynamoDB.

    Prioridade (idêntica ao calculation_engine._sorted_punches):
    1. data_hora_calculo  (campo calculado pelo motor; mais preciso para timezone)
    2. data_hora          (campo explícito padrão)
    3. timestamp          (campo legado de alguns kiosks)
    4. sufixo de employee_id#date_time (campo composto)

    Retorna a string original sem normalização de formato.
    Use para_iso_date() para comparações de data.
    """
    dh = (
        record.get('data_hora_calculo') or
        record.get('data_hora') or
        record.get('timestamp') or
        ''
    )
    if dh is not None and str(dh).strip():
        return str(dh).strip()

    composite = str(record.get('employee_id#date_time') or '')
    if '#' in composite:
        suffix = composite.split('#', 1)[1].strip()
        if suffix:
            return suffix

    return ''


def para_iso_date(dt_str: str) -> str:
    """
    Converte qualquer formato de data/datetime para YYYY-MM-DD.

    Formatos aceitos:
      YYYY-MM-DD           → retorna diretamente
      YYYY-MM-DDTHH:MM:SS  → fatia os 10 primeiros chars
      YYYY-MM-DD HH:MM:SS  → fatia os 10 primeiros chars
      DD-MM-YYYY HH:MM:SS  → converte para YYYY-MM-DD

    Retorna '' se não conseguir interpretar.
    """
    if not dt_str:
        return ''
    p = str(dt_str).strip()

    if len(p) < 10:
        return ''

    prefix = p[:10]

    # YYYY-MM-DD (inclui variantes ISO com T ou espaço)
    if len(prefix) == 10 and prefix[4:5] == '-' and prefix[7:8] == '-':
        return prefix

    # DD-MM-YYYY
    if len(prefix) == 10 and prefix[2:3] == '-' and prefix[5:6] == '-':
        try:
            dd, mm, yyyy = prefix[:2], prefix[3:5], prefix[6:10]
            if len(yyyy) == 4 and yyyy.isdigit():
                return f'{yyyy}-{mm}-{dd}'
        except (IndexError, ValueError):
            pass

    return ''


def para_hora_display(dt_str: str) -> Optional[str]:
    """
    Extrai 'HH:MM' de uma string datetime em qualquer formato.
    Retorna None se não conseguir.
    """
    if not dt_str:
        return None
    s = str(dt_str).strip()
    if 'T' in s:
        time_part = s.split('T', 1)[1]
    elif ' ' in s:
        parts = s.split(' ')
        time_part = parts[1] if len(parts) > 1 else ''
    else:
        return None
    return time_part[:5] if len(time_part) >= 5 else None


# ---------------------------------------------------------------------------
# Filtragem canônica
# ---------------------------------------------------------------------------

def filtrar_registros(
    records: List[Dict[str, Any]],
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    employee_id: Optional[str] = None,
    ignorar_invalidos: bool = True,
) -> List[Dict[str, Any]]:
    """
    Filtra registros usando a lógica canônica.

    Comparação de employee_id: CASE-INSENSITIVE (correção do bug histórico).
    Comparação de data: baseada em data_hora canônica (extrair_data_hora).
    Registros com data não determinável são INCLUÍDOS (evita perda silenciosa).

    Args:
        records: itens DynamoDB brutos
        start_date: YYYY-MM-DD inclusive (None = sem filtro)
        end_date: YYYY-MM-DD inclusive (None = sem filtro)
        employee_id: ID do funcionário, case-insensitive (None = todos)
        ignorar_invalidos: se True, ignora INVALIDADO/AJUSTADO
    """
    emp_filter = employee_id.strip().lower() if employee_id else None
    filtrar_data = bool(start_date and end_date)
    result = []

    for r in records:
        # ── Status ──────────────────────────────────────────────────────────
        if ignorar_invalidos:
            status = str(r.get('status') or 'ATIVO').upper()
            if status in ('INVALIDADO', 'AJUSTADO'):
                continue

        # ── Funcionário (case-insensitive) ───────────────────────────────────
        if emp_filter:
            rec_emp = extrair_employee_id(r).lower()
            if rec_emp != emp_filter:
                continue

        # ── Data ────────────────────────────────────────────────────────────
        if filtrar_data:
            dh = extrair_data_hora(r)
            date = para_iso_date(dh)
            if not date:
                # Data indeterminável → incluir (nunca descartar silenciosamente)
                result.append(r)
                continue
            if start_date <= date <= end_date:  # type: ignore[operator]
                result.append(r)
        else:
            result.append(r)

    return result


# ---------------------------------------------------------------------------
# Agrupamento canônico
# ---------------------------------------------------------------------------

def agrupar_por_employee_data(
    records: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Agrupa registros por chave 'employee_id#YYYY-MM-DD'.

    Usa as funções canônicas de extração para garantir que registros
    com diferentes schemas sejam agrupados corretamente.
    Registros sem employee_id ou data válida são descartados do agrupamento.
    """
    grouped: Dict[str, List] = defaultdict(list)

    for r in records:
        emp  = extrair_employee_id(r)
        dh   = extrair_data_hora(r)
        date = para_iso_date(dh)

        if emp and date:
            grouped[f'{emp}#{date}'].append(r)

    return dict(grouped)
