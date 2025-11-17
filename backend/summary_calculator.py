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
    
    # Dia da semana (mon, tue, wed, ...)
    weekday = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][target_date.weekday()]
    
    # 1. Tentar custom_schedule do employee
    if employee and employee.get('custom_schedule'):
        day_schedule = employee['custom_schedule'].get(weekday)
        if day_schedule:
            return day_schedule.get('start'), day_schedule.get('end')
    
    # 2. Fallback para weekly_schedule da company
    config_response = table_config.get_item(Key={'company_id': company_id})
    config = config_response.get('Item', {})
    
    weekly_schedule = config.get('weekly_schedule', {})
    day_schedule = weekly_schedule.get(weekday)
    
    if day_schedule:
        return day_schedule.get('start'), day_schedule.get('end')
    
    # 3. Fallback legado: horario_entrada/horario_saida
    if employee:
        return employee.get('horario_entrada'), employee.get('horario_saida')
    
    return None, None

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
    
    if not records:
        # Sem registros = ausência
        scheduled_start, scheduled_end = get_employee_schedule(company_id, employee_id, target_date)
        expected_hours = Decimal('0')
        
        if scheduled_start and scheduled_end:
            start_time = parse_time(scheduled_start)
            end_time = parse_time(scheduled_end)
            expected_minutes = time_diff_minutes(start_time, end_time)
            expected_hours = Decimal(expected_minutes) / Decimal('60')
        
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
    
    # Extrair entrada/saída
    entrada = None
    saida = None
    breaks = []
    
    print(f"[DEBUG] Processando {len(records)} registros para {employee_id} em {date_str}")
    
    for record in records:
        # Suportar ambos os nomes de campo: 'tipo' (novo) e 'tipo_registro' (legado)
        record_type = record.get('tipo') or record.get('tipo_registro', 'entrada')
        dt_str = record.get('data_hora', '')
        
        print(f"[DEBUG] Registro: tipo={record_type}, data_hora={dt_str[:16] if dt_str else 'N/A'}")
        
        if record_type in ['entrada', 'in']:
            if not entrada:
                entrada = dt_str
                print(f"[DEBUG] Entrada definida: {entrada}")
        elif record_type in ['saida', 'saída', 'out']:  # Aceitar COM e SEM acento
            saida = dt_str
            print(f"[DEBUG] Saída definida: {saida}")
        elif record_type == 'break_start':
            breaks.append({'start': dt_str})
        elif record_type == 'break_end' and breaks:
            breaks[-1]['end'] = dt_str
    
    print(f"[DEBUG] Resultado final - Entrada: {entrada[:16] if entrada else 'None'}, Saída: {saida[:16] if saida else 'None'}")
    
    # Obter horários esperados
    scheduled_start, scheduled_end = get_employee_schedule(company_id, employee_id, target_date)
    
    # Calcular horas esperadas
    expected_hours = Decimal('0')
    if scheduled_start and scheduled_end:
        start_time = parse_time(scheduled_start)
        end_time = parse_time(scheduled_end)
        expected_minutes = time_diff_minutes(start_time, end_time)
        expected_hours = Decimal(expected_minutes) / Decimal('60')
    
    # Calcular horas trabalhadas
    worked_hours = Decimal('0')
    if entrada and saida:
        entrada_time = datetime.fromisoformat(entrada.replace('Z', '+00:00'))
        saida_time = datetime.fromisoformat(saida.replace('Z', '+00:00'))
        worked_minutes = (saida_time - entrada_time).total_seconds() / 60
        worked_hours = Decimal(worked_minutes) / Decimal('60')
    
    # Buscar configurações
    config_response = table_config.get_item(Key={'company_id': company_id})
    config = config_response.get('Item', {})
    
    # Descontar intervalo automático
    break_auto = config.get('break_auto', True) or config.get('intervalo_automatico', True)
    break_duration = config.get('break_duration', 60) or config.get('duracao_intervalo', 60)
    
    if break_auto and worked_hours > 0:
        worked_hours -= Decimal(break_duration) / Decimal('60')
    
    # Calcular atraso e horas extras
    delay_minutes = Decimal('0')
    extra_hours = Decimal('0')
    
    if entrada and scheduled_start:
        entrada_time = datetime.fromisoformat(entrada.replace('Z', '+00:00')).time()
        scheduled_start_time = parse_time(scheduled_start)
        
        tolerance = config.get('tolerance_before', 10) or config.get('tolerancia_atraso', 10)
        
        diff = time_diff_minutes(scheduled_start_time, entrada_time)
        if diff > tolerance:
            delay_minutes = Decimal(diff - tolerance)
    
    # Horas extras
    if worked_hours > expected_hours:
        extra_minutes = (worked_hours - expected_hours) * Decimal('60')
        extra_hours = extra_minutes / Decimal('60')
    
    # Compensação
    compensated_minutes = Decimal('0')
    compensate = config.get('compensate_balance', False) or config.get('compensar_saldo_horas', False)
    
    if compensate and delay_minutes > 0 and extra_hours > 0:
        extra_minutes_total = extra_hours * Decimal('60')
        if extra_minutes_total >= delay_minutes:
            compensated_minutes = delay_minutes
            extra_hours = (extra_minutes_total - delay_minutes) / Decimal('60')
            delay_minutes = Decimal('0')
        else:
            compensated_minutes = extra_minutes_total
            delay_minutes -= extra_minutes_total
            extra_hours = Decimal('0')
    
    # Saldo diário
    daily_balance = worked_hours - expected_hours
    
    # Determinar status
    status: DayStatus = "normal"
    if delay_minutes > 0:
        status = "late"
    elif extra_hours > 0:
        status = "extra"
    if compensated_minutes > 0:
        status = "compensated"
    
    # Criar resumo
    # Extrair horários de entrada/saída (suportar vários formatos)
    def extract_time(dt_str):
        if not dt_str:
            return None
        if 'T' in dt_str:
            return dt_str.split('T')[1][:5]
        elif ' ' in dt_str:
            return dt_str.split(' ')[1][:5]
        return None
    
    actual_start_time = extract_time(entrada)
    actual_end_time = extract_time(saida)
    
    print(f"[DEBUG] Horários extraídos - actual_start: {actual_start_time}, actual_end: {actual_end_time}")
    
    summary = DailySummary(
        company_id=company_id,
        employee_id=employee_id,
        date=date_str,
        work_mode=records[0].get('work_mode_at_time', 'onsite'),
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        actual_start=actual_start_time,
        actual_end=actual_end_time,
        expected_hours=expected_hours,
        worked_hours=worked_hours,
        extra_hours=extra_hours,
        delay_minutes=delay_minutes,
        compensated_minutes=compensated_minutes,
        daily_balance=daily_balance,
        status=status,
        records_count=len(records)
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
