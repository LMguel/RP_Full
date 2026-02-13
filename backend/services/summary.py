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
    
    # Filtrar registros INVALIDADOS e AJUSTADOS - apenas ATIVO deve ser considerado
    records = [r for r in records if (r.get('status') or 'ATIVO').upper() not in ('INVALIDADO', 'AJUSTADO')]
    
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
    
    # Extrair entrada/saída e intervalos
    # Separar horário REAL (exibição) do horário de CÁLCULO (arredondado pela tolerância)
    entrada = None         # Horário de cálculo (arredondado)
    entrada_real = None    # Horário real (para exibição)
    saida = None           # Horário de cálculo (arredondado)
    saida_real = None      # Horário real (para exibição)
    breaks: List[Dict[str, str]] = []
    has_location_issues = False
    
    print(f"[DEBUG] Processando {len(records)} registros para {employee_id} em {date_str}")
    
    for record in records:
        # Suportar todos os nomes de campo: 'type' (novo), 'tipo' (português), 'tipo_registro' (legado)
        record_type_raw = record.get('type') or record.get('tipo') or record.get('tipo_registro', 'entrada')
        normalized_type = str(record_type_raw).lower()
        normalized_type = normalized_type.replace('í', 'i').replace('á', 'a').replace('ã', 'a')
        normalized_type = normalized_type.replace('-', '_')
        # Usar data_hora_calculo (arredondado pela tolerância) para cálculos, se disponível
        dt_str_real = record.get('data_hora', '')
        dt_str = record.get('data_hora_calculo', '') or dt_str_real
        
        print(f"[DEBUG] Registro: tipo={record_type_raw}, data_hora={dt_str[:16] if dt_str else 'N/A'}")
        
        if not has_location_issues:
            location_info = record.get('location') or {}
            inside_radius = location_info.get('inside_radius')
            inside_radius_flag = str(inside_radius).lower() if inside_radius is not None else None
            record_inside = record.get('inside_radius')
            record_inside_flag = str(record_inside).lower() if record_inside is not None else None
            if (
                inside_radius is False or inside_radius_flag == 'false' or
                record_inside is False or record_inside_flag == 'false' or
                record.get('location_valid') is False or record.get('localizacao_valida') is False
            ):
                has_location_issues = True

        if normalized_type in ['entrada', 'in']:
            if not entrada:
                entrada = dt_str          # Horário arredondado para cálculo
                entrada_real = dt_str_real # Horário real para exibição
                print(f"[DEBUG] Entrada definida: calc={entrada}, real={entrada_real}")
        elif normalized_type in ['saida', 'saida', 'out']:
            saida = dt_str          # Horário arredondado para cálculo
            saida_real = dt_str_real # Horário real para exibição
            print(f"[DEBUG] Saída definida: calc={saida}, real={saida_real}")
        elif normalized_type in ['break_start', 'intervalo_inicio', 'pausa_inicio', 'almoco_inicio', 'start_break']:
            breaks.append({'start': dt_str})
        elif normalized_type in ['break_end', 'intervalo_fim', 'pausa_fim', 'almoco_fim', 'end_break'] and breaks:
            for br in reversed(breaks):
                if 'end' not in br:
                    br['end'] = dt_str
                    break
    
    print(f"[DEBUG] Resultado final - Entrada calc: {entrada[:16] if entrada else 'None'}, real: {(entrada_real or '')[:16] or 'None'}, Saída calc: {saida[:16] if saida else 'None'}, real: {(saida_real or '')[:16] or 'None'}")
    
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
        worked_minutes_float = (saida_time - entrada_time).total_seconds() / 60
        if worked_minutes_float > 0:
            worked_hours = Decimal(str(worked_minutes_float)) / Decimal('60')
    
    # Buscar configurações
    config_response = table_config.get_item(Key={'company_id': company_id})
    config = config_response.get('Item', {})
    
    # Descontar intervalo automático
    break_auto = config.get('break_auto', True) or config.get('intervalo_automatico', True)
    break_duration = config.get('break_duration', 60) or config.get('duracao_intervalo', 60)
    
    # Intervalos registrados manualmente
    break_minutes = Decimal('0')
    for br in breaks:
        start_str = br.get('start')
        end_str = br.get('end')
        if not start_str or not end_str:
            continue
        try:
            start_dt = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
            minutes_float = (end_dt - start_dt).total_seconds() / 60
            if minutes_float > 0:
                break_minutes += Decimal(str(minutes_float))
        except Exception as interval_error:
            print(f"[WARN] Erro ao calcular intervalo: {interval_error}")

    breaks_total_hours = Decimal('0')
    if worked_hours > 0:
        if break_minutes > 0:
            breaks_total_hours = break_minutes / Decimal('60')
            if breaks_total_hours > worked_hours:
                breaks_total_hours = worked_hours
            worked_hours -= breaks_total_hours
        elif break_auto:
            auto_break_hours = Decimal(break_duration) / Decimal('60')
            breaks_total_hours = auto_break_hours if auto_break_hours < worked_hours else worked_hours
            worked_hours -= breaks_total_hours

    if worked_hours < 0:
        worked_hours = Decimal('0')
    
    # Calcular horas extras (remover lógica de atraso/tolerância)
    delay_minutes = Decimal('0')
    extra_hours = Decimal('0')
    
    # Horas extras (considerando intervalos)
    if worked_hours > expected_hours:
        extra_hours = worked_hours - expected_hours
    else:
        extra_hours = Decimal('0')
    
    # Não aplicar compensação automática de atraso; campo compensado permanece 0
    compensated_minutes = Decimal('0')
    
    # Saldo diário
    daily_balance = worked_hours - expected_hours
    
    # Determinar status simples (sem interpretação de atraso)
    status: DayStatus = "normal"
    missing_exit = saida is None
    if missing_exit and scheduled_end:
        status = "missing_exit"
        daily_balance = Decimal('0')
    else:
        if extra_hours > 0:
            status = "extra"
    
    # Criar resumo
    # Extrair horários de entrada/saída REAIS (para exibição, não arredondados)
    def extract_time(dt_str):
        if not dt_str:
            return None
        if 'T' in dt_str:
            return dt_str.split('T')[1][:5]
        elif ' ' in dt_str:
            return dt_str.split(' ')[1][:5]
        return None
    
    # Usar horários REAIS para exibição (não os arredondados)
    actual_start_time = extract_time(entrada_real or entrada)
    actual_end_time = extract_time(saida_real or saida)
    
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
        delay_minutes=Decimal('0'),
        compensated_minutes=Decimal('0'),
        daily_balance=daily_balance,
        status=status,
        breaks_total=breaks_total_hours,
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
