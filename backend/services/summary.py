"""
Módulo de cálculo de resumos diários e mensais
Gera DailySummary e MonthlySummary a partir de TimeRecords
"""
import boto3
from datetime import datetime, date, time, timedelta
from decimal import Decimal
from typing import List, Dict, Optional, Tuple
from boto3.dynamodb.conditions import Key, Attr
from models import DailySummary, MonthlySummary, WorkMode, DayStatus
from utils.schedule import get_schedule_for_date
from services.calculation_engine import (
    calculate_worked_minutes as eng_worked,
    calculate_expected_minutes as eng_expected,
    calculate_delay_minutes as eng_delay,
    calculate_early_departure_minutes as eng_early_dep,
    apply_bank_tolerance,
)

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table_records = dynamodb.Table('TimeRecords')
table_daily = dynamodb.Table('DailySummary')
table_monthly = dynamodb.Table('MonthlySummary')
table_config = dynamodb.Table('ConfigCompany')
table_employees = dynamodb.Table('Employees')

def parse_time(time_str: str) -> time:
    """Converte string HH:MM para objeto time"""
    if not time_str:
        return None
    h, m = map(int, time_str.split(':'))
    return time(hour=h, minute=m)

def time_diff_minutes(start: time, end: time) -> int:
    """Calcula diferença em minutos entre dois horários"""
    if not start or not end:
        return 0
    
    start_minutes = start.hour * 60 + start.minute
    end_minutes = end.hour * 60 + end.minute
    
    # Se end < start, passou da meia-noite
    if end_minutes < start_minutes:
        end_minutes += 24 * 60
    
    return end_minutes - start_minutes

def get_employee_schedule(company_id: str, employee_id: str, target_date: date) -> Tuple[Optional[str], Optional[str]]:
    """
    Obtém horário de trabalho do funcionário para um dia específico
    Prioridade: custom_schedule do employee > weekly_schedule da company
    """
    # Buscar funcionário (tabela Employees usa company_id + id como chave composta)
    emp_response = table_employees.get_item(
        Key={
            'company_id': company_id,
            'id': employee_id
        }
    )
    employee = emp_response.get('Item')
    
    config_response = table_config.get_item(Key={'company_id': company_id})
    config = config_response.get('Item', {})

    return get_schedule_for_date(employee or {}, target_date, config)

def calculate_daily_summary(company_id: str, employee_id: str, target_date: date) -> DailySummary:
    """
    Calcula resumo diário completo para um funcionário em uma data
    """
    date_str = target_date.isoformat()
    
    # Buscar todos os registros do dia
    # A tabela TimeRecords usa employee_id#date_time como chave
    try:
        # Tentar query pela chave composta
        response = table_records.query(
            KeyConditionExpression=Key('employee_id#date_time').begins_with(f"{employee_id}#{date_str}")
        )
        records = response.get('Items', [])
    except:
        # Fallback: scan com filtro (menos eficiente mas funciona)
        response = table_records.scan(
            FilterExpression=Attr('company_id').eq(company_id) &
                           (Attr('employee_id').eq(employee_id) | Attr('funcionario_id').eq(employee_id)) &
                           Attr('data_hora').begins_with(date_str)
        )
        records = response.get('Items', [])
    
    # Filtrar registros INVALIDADOS e AJUSTADOS - apenas ATIVO deve ser considerado
    records = [r for r in records if (r.get('status') or 'ATIVO').upper() not in ('INVALIDADO', 'AJUSTADO')]
    
    if not records:
        scheduled_start, scheduled_end = get_employee_schedule(company_id, employee_id, target_date)

        # Verificar se funcionário tem horário variável
        emp_r_abs = table_employees.get_item(Key={'company_id': company_id, 'id': employee_id})
        emp_abs = emp_r_abs.get('Item', {})
        variavel_abs = (
            not emp_abs.get('horario_entrada')
            or not emp_abs.get('horario_saida')
        )

        if variavel_abs:
            # Horário variável: sem registro = sem falta, sem previsto
            return DailySummary(
                company_id=company_id,
                employee_id=employee_id,
                date=date_str,
                work_mode="onsite",
                scheduled_start=None,
                scheduled_end=None,
                expected_hours=Decimal('0'),
                status="normal"
            )

        # Horário fixo sem registros = ausência
        expected_hours = Decimal('0')
        if scheduled_start and scheduled_end:
            config_r = table_config.get_item(Key={'company_id': company_id})
            cfg_absent = config_r.get('Item', {})
            raw_dur = cfg_absent.get('duracao_intervalo') or cfg_absent.get('break_duration')
            try:
                comp_break = int(raw_dur) if raw_dur is not None else 0
            except (ValueError, TypeError):
                comp_break = 0
            emp_int = emp_abs.get('intervalo_emp')
            try:
                eff_break = int(emp_int) if emp_int is not None and int(emp_int) > 0 else comp_break
            except (ValueError, TypeError):
                eff_break = comp_break
            exp_min = eng_expected(scheduled_start, scheduled_end, False, eff_break)
            expected_hours = Decimal(str(exp_min)) / Decimal('60')

        return DailySummary(
            company_id=company_id,
            employee_id=employee_id,
            date=date_str,
            work_mode="onsite",
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            expected_hours=expected_hours,
            status="absent"
        )
    
    # Ordenar registros por horário
    records.sort(key=lambda x: x.get('data_hora', ''))
    
    # Verificar problemas de localização
    has_location_issues = False
    for record in records:
        loc = record.get('location') or {}
        ir = loc.get('inside_radius')
        ri = record.get('inside_radius')
        if (
            ir is False or str(ir).lower() == 'false' or
            ri is False or str(ri).lower() == 'false' or
            record.get('location_valid') is False or
            record.get('localizacao_valida') is False
        ):
            has_location_issues = True
            break

    # Entrada sem saída → verificar se último registro não tem par
    # (detecção simplificada: número ímpar de batidas não-dia_inteiro)
    active_punches = [
        r for r in records
        if str(r.get('type') or r.get('tipo') or '').lower().strip() != 'dia_inteiro'
    ]
    missing_exit = len(active_punches) % 2 != 0

    # Obter horários previstos
    scheduled_start, scheduled_end = get_employee_schedule(company_id, employee_id, target_date)

    # Buscar config da empresa e dados do funcionário
    config_response = table_config.get_item(Key={'company_id': company_id})
    config = config_response.get('Item', {})
    emp_response = table_employees.get_item(Key={'company_id': company_id, 'id': employee_id})
    employee = emp_response.get('Item', {})

    # Funcionário de horário variável: sem previsto, banco, atraso, extra
    variavel = (
        not employee.get('horario_entrada')
        or not employee.get('horario_saida')
    )

    if 'intervalo_automatico' in config:
        break_auto = bool(config['intervalo_automatico'])
    elif 'break_auto' in config:
        break_auto = bool(config['break_auto'])
    else:
        break_auto = False

    raw_duration = config.get('duracao_intervalo') if config.get('duracao_intervalo') is not None else config.get('break_duration')
    try:
        company_break = int(raw_duration) if raw_duration is not None else 0
    except (ValueError, TypeError):
        company_break = 0

    # Intervalo do funcionário sobrepõe o da empresa quando configurado
    emp_intervalo = employee.get('intervalo_emp')
    try:
        break_duration = int(emp_intervalo) if emp_intervalo is not None and int(emp_intervalo) > 0 else company_break
    except (ValueError, TypeError):
        break_duration = company_break

    tolerancia = int(config.get('tolerancia_atraso', 0) or 0)

    # ── Motor canônico ──
    worked_min, first_iso, last_iso = eng_worked(records, break_auto, break_duration)
    worked_hours = Decimal(str(worked_min)) / Decimal('60')

    if variavel:
        # Horário variável: só registra horas trabalhadas, sem cálculos de jornada
        expected_hours = Decimal('0')
        daily_balance = Decimal('0')
        extra_hours = Decimal('0')
        delay_min = 0
        status: DayStatus = "normal"
    else:
        expected_min = eng_expected(scheduled_start, scheduled_end, break_auto, break_duration)
        delay_min = eng_delay(first_iso, scheduled_start, tolerancia)
        _early_dep = eng_early_dep(last_iso, scheduled_end, tolerancia)

        expected_hours = Decimal(str(expected_min)) / Decimal('60')
        balance_min = apply_bank_tolerance(worked_min - expected_min, tolerancia)
        daily_balance = Decimal(str(balance_min)) / Decimal('60')
        extra_hours = max(Decimal('0'), daily_balance)

        # Status
        status: DayStatus = "normal"
        if missing_exit and scheduled_end:
            status = "missing_exit"
            daily_balance = Decimal('0')
        elif delay_min > 0:
            status = "late"
        elif extra_hours > 0:
            status = "extra"

    def _extract_time_display(iso_str):
        if not iso_str:
            return None
        if 'T' in iso_str:
            return iso_str.split('T')[1][:5]
        if ' ' in iso_str:
            return iso_str.split(' ')[1][:5]
        return None

    summary = DailySummary(
        company_id=company_id,
        employee_id=employee_id,
        date=date_str,
        work_mode=records[0].get('work_mode_at_time', 'onsite'),
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        actual_start=_extract_time_display(first_iso),
        actual_end=_extract_time_display(last_iso),
        expected_hours=expected_hours,
        worked_hours=worked_hours,
        extra_hours=extra_hours,
        delay_minutes=Decimal(str(delay_min)),
        compensated_minutes=Decimal('0'),
        daily_balance=daily_balance,
        status=status,
        breaks_total=Decimal('0'),
        records_count=len(records),
        missing_exit=missing_exit,
        has_location_issues=has_location_issues
    )

    return summary

def save_daily_summary(summary: DailySummary):
    """Salva resumo diário no DynamoDB"""
    table_daily.put_item(Item=summary.to_dynamodb())

def calculate_monthly_summary(company_id: str, employee_id: str, year: int, month: int) -> MonthlySummary:
    """
    Calcula resumo mensal agregando todos os DailySummary do mês
    """
    month_str = f"{year:04d}-{month:02d}"
    
    # Buscar todos os resumos diários do mês
    response = table_daily.query(
        KeyConditionExpression=Key('company_id').eq(company_id) & 
                              Key('employee_id#date').begins_with(f"{employee_id}#{month_str}")
    )
    daily_summaries = response.get('Items', [])
    
    # Agregar
    expected_hours = Decimal('0')
    worked_hours = Decimal('0')
    extra_hours = Decimal('0')
    delay_minutes = Decimal('0')
    compensated_minutes = Decimal('0')
    absences = 0
    worked_holidays = 0
    days_worked = 0
    days_late = 0
    days_extra = 0
    
    for day in daily_summaries:
        expected_hours += Decimal(str(day.get('expected_hours', 0)))
        worked_hours += Decimal(str(day.get('worked_hours', 0)))
        extra_hours += Decimal(str(day.get('extra_hours', 0)))
        delay_minutes += Decimal(str(day.get('delay_minutes', 0)))
        compensated_minutes += Decimal(str(day.get('compensated_minutes', 0)))
        
        if day.get('status') == 'absent':
            absences += 1
        else:
            days_worked += 1
        
        if day.get('status') == 'late':
            days_late += 1
        elif day.get('status') == 'extra':
            days_extra += 1
    
    # Saldo final
    final_balance = worked_hours - expected_hours
    
    # Status
    status = "balanced"
    if final_balance > 0:
        status = "positive"
    elif final_balance < 0:
        status = "negative"
    
    summary = MonthlySummary(
        company_id=company_id,
        employee_id=employee_id,
        month=month_str,
        expected_hours=expected_hours,
        worked_hours=worked_hours,
        extra_hours=extra_hours,
        delay_minutes=delay_minutes,
        compensated_minutes=compensated_minutes,
        final_balance=final_balance,
        absences=absences,
        worked_holidays=worked_holidays,
        days_worked=days_worked,
        days_late=days_late,
        days_extra=days_extra,
        status=status
    )
    
    return summary

def save_monthly_summary(summary: MonthlySummary):
    """Salva resumo mensal no DynamoDB"""
    table_monthly.put_item(Item=summary.to_dynamodb())

def rebuild_daily_summary(company_id: str, employee_id: str, target_date: date):
    """
    Reconstrói resumo diário após adicionar/remover registro
    """
    summary = calculate_daily_summary(company_id, employee_id, target_date)
    save_daily_summary(summary)
    return summary

def rebuild_monthly_summary(company_id: str, employee_id: str, year: int, month: int):
    """
    Reconstrói resumo mensal após mudanças em resumos diários
    """
    summary = calculate_monthly_summary(company_id, employee_id, year, month)
    save_monthly_summary(summary)
    return summary
