"""
Motor canônico de cálculo de ponto.
TODA lógica de cálculo de horas deve passar por aqui.

Regras oficiais:
  intervalo_automatico=False:
    - Ordena registros cronologicamente (ignora tipo salvo)
    - Pareia posicionalmente: (0,1), (2,3), (4,5), ...
    - horas_trabalhadas = soma de cada par
    - Exemplo 4 batidas: (pos0→pos1) + (pos2→pos3)

  intervalo_automatico=True:
    - horas_trabalhadas = (última - primeira) - duracao_intervalo

Atraso e saída antecipada são calculados sobre a 1ª entrada e
última saída reais vs horário previsto, considerando tolerância.
"""

from datetime import datetime
from typing import List, Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Helpers internos
# ─────────────────────────────────────────────

def _parse_dt(s: str) -> Optional[datetime]:
    """Parse ISO datetime string (com ou sem timezone)."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace('Z', '+00:00'))
    except Exception:
        try:
            return datetime.strptime(s[:19], '%Y-%m-%dT%H:%M:%S')
        except Exception:
            return None


def _parse_hhmm(s: str) -> Optional[int]:
    """Converte 'HH:MM' para minutos desde meia-noite."""
    if not s:
        return None
    try:
        parts = s.strip().split(':')
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return None


def _extract_hhmm_from_iso(iso_str: str) -> Optional[str]:
    """Extrai 'HH:MM' de uma string ISO ou 'HH:MM'."""
    if not iso_str:
        return None
    s = str(iso_str)
    if 'T' in s:
        return s.split('T')[1][:5]
    if ' ' in s:
        return s.split(' ')[1][:5]
    return s[:5] if len(s) >= 5 else None


def _sorted_punches(records: List[Dict]) -> List[Tuple[datetime, str, Dict]]:
    """
    Filtra dia_inteiro, ordena cronologicamente.
    Usa data_hora_calculo se disponível, senão data_hora.
    Retorna lista de (datetime, iso_str, record_dict).
    """
    punches = []
    for r in records:
        tipo = str(r.get('type') or r.get('tipo') or '').lower().strip()
        if tipo == 'dia_inteiro':
            continue
        record_status = str(r.get('status') or 'ATIVO').upper()
        if record_status in ('INVALIDADO', 'AJUSTADO'):
            continue
        dt_str = r.get('data_hora_calculo') or r.get('data_hora') or ''
        if not dt_str:
            continue
        dt = _parse_dt(dt_str)
        if dt:
            punches.append((dt, dt_str, r))
    punches.sort(key=lambda x: x[0])
    return punches


# ─────────────────────────────────────────────
# API Pública
# ─────────────────────────────────────────────

def count_valid_punches(records: List[Dict]) -> int:
    """Returns the number of valid (active, non-dia_inteiro) chronological punches."""
    return len(_sorted_punches(records))


def get_actual_break_minutes(records: List[Dict]) -> Optional[int]:
    """
    For 4-punch days (manual mode): returns the actual break gap in minutes
    between punch[1] (break-out) and punch[2] (break-in), chronologically.
    Returns None if fewer than 4 valid punches.
    """
    punches = _sorted_punches(records)
    if len(punches) < 4:
        return None
    gap = int((punches[2][0] - punches[1][0]).total_seconds() / 60)
    return max(0, gap)


def minutes_to_hhmm(minutes: int) -> str:
    """Converte minutos (pode ser negativo) para 'HH:MM'."""
    sign = '-' if minutes < 0 else ''
    abs_min = abs(int(minutes))
    return f"{sign}{abs_min // 60:02d}:{abs_min % 60:02d}"


def calculate_worked_minutes(
    records: List[Dict],
    intervalo_automatico: bool,
    break_duration: int = 60,
) -> Tuple[int, Optional[str], Optional[str]]:
    """
    Calcula minutos trabalhados usando regra canônica posicional.

    intervalo_automatico=False:
        - Pareia (pos0→pos1), (pos2→pos3), ...
        - Soma durações de cada par completo

    intervalo_automatico=True:
        - Total = (última batida - primeira batida) - break_duration

    Retorna: (worked_minutes, first_punch_iso, last_punch_iso)
    Ignora campo tipo/type — apenas ordem cronológica importa.
    """
    punches = _sorted_punches(records)
    if not punches:
        return 0, None, None

    first_iso = punches[0][1]
    n = len(punches)

    if intervalo_automatico:
        if n < 2:
            return 0, first_iso, None
        last_iso = punches[-1][1]
        total_min = int((punches[-1][0] - punches[0][0]).total_seconds() / 60)
        worked = max(0, total_min - break_duration)
        return worked, first_iso, last_iso

    # 3 batidas: entrada + saída intervalo + saída final (sem volta intervalo registrada)
    # Usa (último - primeiro) - break_duration como melhor estimativa
    if n == 3:
        total_span = int((punches[2][0] - punches[0][0]).total_seconds() / 60)
        worked = max(0, total_span - break_duration)
        return worked, first_iso, punches[2][1]

    # Pareamento posicional para n=2 e n>=4
    worked_total = 0
    pairs_complete = n // 2
    for i in range(pairs_complete):
        dt_in = punches[i * 2][0]
        dt_out = punches[i * 2 + 1][0]
        diff = int((dt_out - dt_in).total_seconds() / 60)
        if diff > 0:
            worked_total += diff

    last_out_idx = pairs_complete * 2 - 1
    last_iso = punches[last_out_idx][1] if pairs_complete >= 1 else None
    return worked_total, first_iso, last_iso


def get_display_times(
    records: List[Dict],
    intervalo_automatico: bool,
) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Retorna horários para exibição (HH:MM) baseados na quantidade de batidas.

    intervalo_automatico=True  → (entrada, None, None, saida)
    intervalo_automatico=False → regra por contagem:
      1 batida  → (entrada, —, —, —)
      2 batidas → (entrada, —, —, saida)
      3 batidas → (entrada, saida_intervalo, —, saida)
      4+ batidas → (entrada, saida_intervalo, volta_intervalo, saida)
    """
    punches = _sorted_punches(records)
    n = len(punches)

    if n == 0:
        return None, None, None, None

    entry = _extract_hhmm_from_iso(punches[0][1])

    if intervalo_automatico:
        exit_ = _extract_hhmm_from_iso(punches[-1][1]) if n >= 2 else None
        return entry, None, None, exit_

    if n == 1:
        return entry, None, None, None
    if n == 2:
        exit_ = _extract_hhmm_from_iso(punches[1][1])
        return entry, None, None, exit_
    if n == 3:
        break_start = _extract_hhmm_from_iso(punches[1][1])
        exit_ = _extract_hhmm_from_iso(punches[2][1])
        return entry, break_start, None, exit_
    # n >= 4
    break_start = _extract_hhmm_from_iso(punches[1][1])
    break_end = _extract_hhmm_from_iso(punches[2][1])
    exit_ = _extract_hhmm_from_iso(punches[3][1])
    return entry, break_start, break_end, exit_


def calculate_expected_minutes(
    scheduled_start: Optional[str],
    scheduled_end: Optional[str],
    intervalo_automatico: bool = False,
    break_duration: int = 0,
) -> int:
    """
    Calcula minutos previstos de trabalho.

    intervalo_automatico=True:  desconta break_duration (intervalo não aparece nas batidas).
    intervalo_automatico=False: previsto = jornada bruta (saída - entrada cadastradas).
      O intervalo aparece como batidas reais; o pareamento posicional já exclui a pausa
      do worked. Descontar break do expected geraria previsto incorreto.
    """
    start_min = _parse_hhmm(scheduled_start)
    end_min = _parse_hhmm(scheduled_end)
    if start_min is None or end_min is None:
        return 0
    total = end_min - start_min
    if total <= 0:
        return 0
    if intervalo_automatico and break_duration > 0:
        total = max(0, total - break_duration)
    return total


def calculate_delay_minutes(
    first_punch_iso: Optional[str],
    scheduled_start: Optional[str],
    tolerance_minutes: int = 0,
) -> int:
    """
    Calcula atraso em minutos medido A PARTIR do limiar de tolerância.
    Retorna 0 se dentro da tolerância.

    Exemplo: entrada 07:15, contratado 07:00, tolerância 10 min → atraso = 5 min.
    """
    if not first_punch_iso or not scheduled_start:
        return 0
    scheduled_min = _parse_hhmm(scheduled_start)
    if scheduled_min is None:
        return 0
    hhmm = _extract_hhmm_from_iso(first_punch_iso)
    actual_min = _parse_hhmm(hhmm)
    if actual_min is None:
        return 0
    diff = actual_min - scheduled_min
    return max(0, diff - tolerance_minutes)


def calculate_early_departure_minutes(
    last_punch_iso: Optional[str],
    scheduled_end: Optional[str],
    tolerance_minutes: int = 0,
) -> int:
    """
    Calcula saída antecipada em minutos medido A PARTIR do limiar de tolerância.
    Retorna 0 se dentro da tolerância.
    """
    if not last_punch_iso or not scheduled_end:
        return 0
    scheduled_min = _parse_hhmm(scheduled_end)
    if scheduled_min is None:
        return 0
    hhmm = _extract_hhmm_from_iso(last_punch_iso)
    actual_min = _parse_hhmm(hhmm)
    if actual_min is None:
        return 0
    diff = scheduled_min - actual_min  # positivo = saiu antes
    return max(0, diff - tolerance_minutes)


def calculate_overtime_exit_minutes(
    last_punch_iso: Optional[str],
    scheduled_end: Optional[str],
    tolerance_minutes: int = 0,
) -> int:
    """
    Calcula hora extra baseada no horário de saída real vs contratado.
    Usado exclusivamente no modo manual (intervalo_automatico=False).

    hora_extra = max(0, saida_real - (saida_contratada + tolerancia))

    Exemplo: contratado 17:00, tolerância 10 min.
      Saiu 17:05 → 0 min.
      Saiu 17:15 → 5 min.
      Saiu 17:30 → 20 min.
    """
    if not last_punch_iso or not scheduled_end:
        return 0
    scheduled_min = _parse_hhmm(scheduled_end)
    if scheduled_min is None:
        return 0
    hhmm = _extract_hhmm_from_iso(last_punch_iso)
    actual_min = _parse_hhmm(hhmm)
    if actual_min is None:
        return 0
    diff = actual_min - scheduled_min  # positivo = saiu depois
    return max(0, diff - tolerance_minutes)


def apply_bank_tolerance(balance_minutes: int, tolerance_minutes: int) -> int:
    """
    Zera o saldo diário quando dentro da tolerância configurada.
    Aplicar APENAS ao saldo final do dia (worked - expected).
    Evita micro-descontos e banco poluído por diferenças irrelevantes.
    """
    if tolerance_minutes > 0 and abs(balance_minutes) <= tolerance_minutes:
        return 0
    return balance_minutes


def apply_monthly_tolerance(
    saldo_min: int,
    tolerance_min: int = 120,
) -> Tuple[bool, int]:
    """
    Aplica tolerância mensal ao saldo acumulado (padrão: 2h = 120 min).

    Se abs(saldo) <= tolerance_min → considera cumprimento integral.
      - Retorna (True, 0): tolerância aplicada, saldo zerado.
    Caso contrário → retorna (False, saldo_min): saldo real preservado.

    Aplicar ao saldo MENSAL (extras - atrasos), nunca ao diário.
    """
    if abs(saldo_min) <= tolerance_min:
        return True, 0
    return False, saldo_min


def apply_rounding(minutes: int, round_to: int) -> int:
    """Arredonda minutos para baixo ao bloco mais próximo."""
    if round_to <= 1:
        return minutes
    return (minutes // round_to) * round_to


def calculate_banco_horas(
    daily_worked_list: List[Dict],
    carga_horaria_mensal_hours: Optional[float],
    year: int,
    month: int,
    up_to_day: int,
) -> Dict:
    """
    Calcula banco de horas acumulado até up_to_day do mês.

    daily_worked_list: lista de {'date': 'YYYY-MM-DD', 'worked_min': int, 'expected_min': int}

    Se carga_horaria_mensal_hours estiver definido:
        expected_till_today = (carga * 60) / total_dias_mes * up_to_day
    Senão:
        expected_till_today = soma de expected_min dos dias <= up_to_day

    Retorna:
        worked_min, expected_min, saldo_min, saldo_hhmm
    """
    from calendar import monthrange
    total_days = monthrange(year, month)[1]
    cutoff = f"{year:04d}-{month:02d}-{up_to_day:02d}"

    worked_total = sum(
        d.get('worked_min', 0) for d in daily_worked_list
        if (d.get('date') or '') <= cutoff
    )

    if carga_horaria_mensal_hours and carga_horaria_mensal_hours > 0:
        expected_total = int(carga_horaria_mensal_hours * 60 * up_to_day / total_days)
    else:
        expected_total = sum(
            d.get('expected_min', 0) for d in daily_worked_list
            if (d.get('date') or '') <= cutoff
        )

    saldo = worked_total - expected_total
    return {
        'worked_min': worked_total,
        'expected_min': expected_total,
        'saldo_min': saldo,
        'saldo_hhmm': minutes_to_hhmm(saldo),
    }
