"""
Motor de extração de horas da pré-folha.
Lê TimeRecords diretamente via query na chave composta (company_id + employee_id#date_time).
DailySummary não é utilizada pois as rotas modernas não garantem sua população.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Set
from boto3.dynamodb.conditions import Key, Attr
import boto3
import calendar

from services.calculation_engine import (
    calculate_worked_minutes,
    calculate_delay_minutes,
)

dynamodb       = boto3.resource('dynamodb', region_name='us-east-1')
table_records  = dynamodb.Table('TimeRecords')
table_feriados = dynamodb.Table('Feriados')
table_config   = dynamodb.Table('ConfigCompany')


def _query_all(table, **kwargs) -> List[Dict[str, Any]]:
    items: List[Dict] = []
    last = None
    while True:
        kw = dict(kwargs)
        if last:
            kw['ExclusiveStartKey'] = last
        resp = table.query(**kw)
        items.extend(resp.get('Items', []))
        last = resp.get('LastEvaluatedKey')
        if not last:
            break
    return items


def _scan_all(table, **kwargs) -> List[Dict[str, Any]]:
    items: List[Dict] = []
    last = None
    while True:
        kw = dict(kwargs)
        if last:
            kw['ExclusiveStartKey'] = last
        resp = table.scan(**kw)
        items.extend(resp.get('Items', []))
        last = resp.get('LastEvaluatedKey')
        if not last:
            break
    return items


def _feriados_mes(company_id: str, year: int, month: int) -> Set[str]:
    mes_str = f"{year}-{month:02d}"
    try:
        nacionais    = _scan_all(table_feriados, FilterExpression=Attr('date').begins_with(mes_str) & Attr('national').eq(True))
        empresariais = _scan_all(table_feriados, FilterExpression=Attr('date').begins_with(mes_str) & Attr('company_id').eq(company_id))
        return {str(i['date'])[:10] for i in nacionais + empresariais}
    except Exception:
        return set()


def _get_company_config(company_id: str) -> Dict[str, Any]:
    try:
        return table_config.get_item(Key={'company_id': company_id}).get('Item', {})
    except Exception:
        return {}


def _data_hora_to_date(dh: str) -> str:
    """Extrai YYYY-MM-DD de uma data_hora (ISO ou 'YYYY-MM-DD HH:MM')."""
    s = str(dh or '').strip()
    if 'T' in s:
        return s.split('T')[0][:10]
    return s[:10]


def _fetch_records_for_employee(company_id: str, employee_id: str, competencia: str) -> List[Dict]:
    """
    Busca TimeRecords do mês para um funcionário via query na chave composta.
    TimeRecords: PK=company_id, SK=employee_id#date_time (ex: 'joao_abc1#2026-06-10 09:15')
    """
    sk_prefix = f"{employee_id}#{competencia}"
    try:
        items = _query_all(
            table_records,
            KeyConditionExpression=(
                Key('company_id').eq(company_id)
                & Key('employee_id#date_time').begins_with(sk_prefix)
            ),
        )
        if items:
            return items
    except Exception:
        pass

    # Fallback: scan por company_id + filtro por employee_id (registros legados com 'funcionario_id')
    try:
        eid_lower = employee_id.lower()
        raw = _scan_all(
            table_records,
            FilterExpression=Attr('company_id').eq(company_id),
        )
        items = [
            r for r in raw
            if (
                str(r.get('employee_id') or r.get('funcionario_id') or '').lower() == eid_lower
                and str(r.get('data_hora') or '').startswith(competencia)
            )
        ]
        return items
    except Exception:
        return []


def compute_worked_data(
    company_id: str,
    employee_id: str,
    competencia: str,
    emp_info: Dict[str, Any],
    horas_diarias: float = 8.0,
) -> Dict[str, Any]:
    """
    Agrega dados de horas do mês para um funcionário a partir de TimeRecords.
    competencia: 'YYYY-MM'
    """
    year, month = map(int, competencia.split('-'))
    _, last_day  = calendar.monthrange(year, month)
    today        = date.today()

    feriados = _feriados_mes(company_id, year, month)

    cfg_empresa           = _get_company_config(company_id)
    intervalo_automatico  = bool(cfg_empresa.get('intervalo_automatico', False))
    duracao_intervalo     = int(cfg_empresa.get('duracao_intervalo', 60) or 60)
    tolerancia_atraso_min = int(cfg_empresa.get('tolerancia_atraso', 0) or 0)
    horario_entrada_padrao = emp_info.get('horario_entrada') or '08:00'

    # Dias úteis passados até hoje
    dias_uteis = 0
    dias_passados: List[date] = []
    for d in range(1, last_day + 1):
        dt = date(year, month, d)
        if dt > today:
            break
        dias_passados.append(dt)
        if dt.weekday() < 5 and dt.isoformat() not in feriados:
            dias_uteis += 1

    horas_previstas = Decimal(str(dias_uteis * horas_diarias))

    # Buscar registros do mês para este funcionário
    all_records = _fetch_records_for_employee(company_id, employee_id, competencia)

    # Filtrar apenas registros ATIVOS e do mês correto
    records_validos = [
        r for r in all_records
        if str(r.get('status') or 'ATIVO').upper() not in ('INVALIDADO', 'AJUSTADO')
        and _data_hora_to_date(r.get('data_hora_calculo') or r.get('data_hora', '')).startswith(competencia)
    ]

    # Agrupar por data
    by_date: Dict[str, List[Dict]] = {}
    for r in records_validos:
        dt_str = _data_hora_to_date(r.get('data_hora_calculo') or r.get('data_hora', ''))
        if dt_str and len(dt_str) == 10:
            by_date.setdefault(dt_str, []).append(r)

    # Agregar por dia
    horas_trab    = Decimal('0')
    horas_extra   = Decimal('0')
    horas_feriado = Decimal('0')
    horas_domingo = Decimal('0')
    atraso_min    = Decimal('0')
    dias_reg: Set[str] = set()

    for dt_str, day_records in by_date.items():
        try:
            dt = date.fromisoformat(dt_str)
        except ValueError:
            continue

        dias_reg.add(dt_str)

        worked_min, first_punch, _ = calculate_worked_minutes(
            day_records, intervalo_automatico, duracao_intervalo
        )

        wh = Decimal(str(round(worked_min / 60, 4)))
        horas_trab += wh

        # Horas extras CLT (Art. 59 + Art. 58 §1): conta tudo além da jornada
        # se ultrapassar a tolerância; dentro da tolerância, ignora (de minimis)
        if dt.weekday() < 5 and dt_str not in feriados:
            raw_extra_min = worked_min - int(horas_diarias * 60)
            if raw_extra_min > tolerancia_atraso_min:
                horas_extra += Decimal(str(round(raw_extra_min / 60, 4)))
            # Se raw_extra_min <= tolerancia → de minimis, não conta

        # Atraso em dias úteis
        if dt.weekday() < 5 and dt_str not in feriados and first_punch:
            horario_entrada = emp_info.get('horario_entrada') or horario_entrada_padrao
            delay = calculate_delay_minutes(first_punch, horario_entrada, tolerancia_atraso_min)
            atraso_min += Decimal(str(delay))

        # Feriado ou domingo trabalhado
        if wh > 0:
            if dt_str in feriados:
                horas_feriado += wh
            elif dt.weekday() == 6:
                horas_domingo += wh

    # Faltas: dias úteis passados sem nenhum registro
    horas_falta = Decimal('0')
    for dt in dias_passados:
        if dt.weekday() >= 5:
            continue
        if dt.isoformat() in feriados:
            continue
        if dt.isoformat() not in dias_reg:
            horas_falta += Decimal(str(horas_diarias))

    banco_horas = horas_extra - horas_falta

    return {
        'horas_previstas':   float(horas_previstas),
        'horas_trabalhadas': float(horas_trab),
        'horas_extras':      float(horas_extra),
        'horas_falta':       float(horas_falta),
        'horas_feriado':     float(horas_feriado),
        'horas_domingo':     float(horas_domingo),
        'horas_abonadas':    0.0,
        'atraso_minutos':    float(atraso_min),
        'banco_horas':       float(banco_horas),
        'dias_uteis':        dias_uteis,
        'dias_trabalhados':  len(dias_reg),
    }
