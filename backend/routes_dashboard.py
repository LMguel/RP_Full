"""
Rotas específicas para o novo Dashboard
Endpoints automáticos sem filtros manuais
"""
from flask import Blueprint, jsonify, request
from datetime import datetime, date, timedelta
from boto3.dynamodb.conditions import Key, Attr
import boto3
from auth import verify_token
from decimal import Decimal, InvalidOperation
import calendar
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

from aws_utils import tabela_configuracoes as table_config
from overtime_calculator import calculate_overtime

dashboard_routes = Blueprint('dashboard_routes', __name__)

# Configuração AWS
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table_employees = dynamodb.Table('Employees')
table_records = dynamodb.Table('TimeRecords')
table_daily_summary = dynamodb.Table('DailySummary')
table_monthly_summary = dynamodb.Table('MonthlySummary')
DEFAULT_TOLERANCE_MINUTES = 10
ENTRY_TYPES = {'entrada', 'in', 'retorno', 'return'}
EXIT_TYPES = {'saida', 'saída', 'out'}

STATUS_LABELS = {
    'entrada_antecipada': 'Entrada antecipada',
    'normal': 'Normal',
    'atraso': 'Atraso',
    'atrasado': 'Atraso',
    'saida_antecipada': 'Saída antecipada',
    'saida_atrasada': 'Saída atrasada'
}


def _normalize_status(value: Any, default: str = 'normal') -> str:
    if value is None:
        return default

    text = str(value).strip().lower()
    if not text:
        return default

    normalized = unicodedata.normalize('NFKD', text)
    ascii_text = ''.join(ch for ch in normalized if not unicodedata.combining(ch))
    sanitized = ''.join('_' if not ch.isalnum() else ch for ch in ascii_text)
    sanitized = sanitized.replace('__', '_').strip('_')
    if not sanitized:
        return default

    mapping = {
        'atrasado': 'atraso',
        'late': 'atraso',
        'entradaadiantada': 'entrada_antecipada',
        'entrada_adiantada': 'entrada_antecipada',
        'adiantado': 'entrada_antecipada',
        'entradaantecipada': 'entrada_antecipada',
        'saidaadiantada': 'saida_antecipada',
        'saidaantecipada': 'saida_antecipada',
        'presente': 'normal',
        'registrado': 'normal'
    }

    normalized_value = sanitized.replace('-', '_').replace(' ', '_')
    normalized_value = normalized_value.replace('__', '_').strip('_')
    if not normalized_value:
        return default

    return mapping.get(normalized_value, normalized_value)


def _get_status_label(status_key: Optional[str]) -> str:
    key = status_key or 'normal'
    label = STATUS_LABELS.get(key)
    if label:
        return label
    cleaned = key.replace('_', ' ').strip()
    if not cleaned:
        return 'Normal'
    return ' '.join(part.capitalize() for part in cleaned.split())


def _derive_entry_status(
    arrival_dt: Optional[datetime],
    scheduled_time,
    tolerance_minutes: int
) -> str:
    if not arrival_dt or not scheduled_time:
        return 'normal'

    scheduled_dt = datetime.combine(arrival_dt.date(), scheduled_time)
    tolerance_delta = timedelta(minutes=tolerance_minutes)
    late_threshold = scheduled_dt + tolerance_delta
    early_threshold = scheduled_dt - tolerance_delta

    if arrival_dt > late_threshold:
        return 'atraso'

    if arrival_dt < early_threshold:
        return 'entrada_antecipada'

    return 'normal'


def _paginate_query(table, **kwargs) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    start_key: Optional[Dict[str, Any]] = None

    while True:
        query_kwargs = dict(kwargs)
        query_kwargs.setdefault('ConsistentRead', True)
        if start_key:
            query_kwargs['ExclusiveStartKey'] = start_key

        response = table.query(**query_kwargs)
        items.extend(response.get('Items', []))

        start_key = response.get('LastEvaluatedKey')
        if not start_key:
            break

    return items


def _paginate_scan(table, **kwargs) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    start_key: Optional[Dict[str, Any]] = None

    while True:
        scan_kwargs = dict(kwargs)
        scan_kwargs.setdefault('ConsistentRead', True)
        if start_key:
            scan_kwargs['ExclusiveStartKey'] = start_key

        response = table.scan(**scan_kwargs)
        items.extend(response.get('Items', []))

        start_key = response.get('LastEvaluatedKey')
        if not start_key:
            break

    return items


def _safe_int(value: Any, default: int) -> int:
    if value is None:
        return default

    if isinstance(value, Decimal):
        return int(value)

    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_decimal(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value

    if value is None:
        return Decimal('0')

    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal('0')


def _parse_time(value: Optional[str]):
    if not value:
        return None

    for fmt in ('%H:%M', '%H:%M:%S'):
        try:
            return datetime.strptime(value, fmt).time()
        except ValueError:
            continue
    return None


def _extract_datetime(record: Dict[str, Any]) -> Optional[datetime]:
    candidate = record.get('employee_id#date_time')
    if candidate and '#' in candidate:
        candidate = candidate.split('#', 1)[1]

    if not candidate:
        candidate = record.get('data_hora') or record.get('hora') or record.get('timestamp')

    if not candidate:
        return None

    normalized = candidate.replace('T', ' ').replace('Z', '')

    for parser in (datetime.fromisoformat,):
        try:
            return parser(normalized)
        except ValueError:
            pass

    for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S'):
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue

    return None


def _record_sort_key(record: Dict[str, Any]) -> datetime:
    dt_value = _extract_datetime(record)
    return dt_value if dt_value else datetime.min


def _record_type(record: Dict[str, Any]) -> str:
    tipo = record.get('type') or record.get('tipo') or record.get('record_type') or record.get('tipo_registro')
    if isinstance(tipo, str):
        return tipo.lower()
    return ''


def _candidate_employee_ids(employee: Dict[str, Any]) -> List[str]:
    """Deriva possíveis identificadores que podem ter sido usados nos registros."""
    base_keys = (
        'employee_id',
        'funcionario_id',
        'id',
        'usuario_id',
        'matricula',
        'matricula_funcionario'
    )

    candidates: List[str] = []

    def _push(raw_value: Any) -> None:
        if raw_value is None:
            return

        if isinstance(raw_value, Decimal):
            value = str(int(raw_value))
        else:
            value = str(raw_value).strip()

        if not value:
            return

        hash_tail = value.split('#')[-1]
        underscore_parts = hash_tail.split('_') if hash_tail else []
        last_two = '_'.join(underscore_parts[-2:]) if len(underscore_parts) >= 2 else hash_tail

        variants = {
            value,
            hash_tail,
            value.split('_')[-1],
            last_two
        }

        for variant in variants:
            cleaned = variant.strip()
            if cleaned and cleaned not in candidates:
                candidates.append(cleaned)

    for key in base_keys:
        _push(employee.get(key))

    return candidates


def _normalize_type(value: str) -> str:
    return value.replace('á', 'a').replace('ã', 'a').replace('â', 'a')


def _is_entry_event(record_type: str) -> bool:
    if not record_type:
        return False

    normalized = record_type.strip().lower()
    ascii_normalized = _normalize_type(normalized)

    return (
        normalized in ENTRY_TYPES or
        ascii_normalized in ENTRY_TYPES or
        ascii_normalized.startswith('entrada') or
        ascii_normalized.startswith('retorno') or
        ascii_normalized.startswith('return')
    )


def _is_exit_event(record_type: str) -> bool:
    if not record_type:
        return False

    normalized = record_type.strip().lower()
    ascii_normalized = _normalize_type(normalized)

    return (
        normalized in EXIT_TYPES or
        ascii_normalized in EXIT_TYPES or
        ascii_normalized.startswith('saida')
    )


def _get_company_settings(company_id: str) -> Dict[str, Any]:
    try:
        response = table_config.get_item(Key={'company_id': company_id})
        return response.get('Item', {})
    except Exception as error:  # pragma: no cover
        print(f"Erro ao buscar configuracoes da empresa {company_id}: {error}")
        return {}


def _get_active_employees(company_id: str) -> List[Dict[str, Any]]:
    employees: List[Dict[str, Any]] = []
    try:
        employees = _paginate_query(
            table_employees,
            KeyConditionExpression=Key('company_id').eq(company_id)
        )
    except Exception as error:
        print(f"Erro ao consultar funcionarios via query: {error}")
        employees = _paginate_scan(
            table_employees,
            FilterExpression=Attr('company_id').eq(company_id)
        )

    active_employees: List[Dict[str, Any]] = []
    for employee in employees:
        is_active = employee.get('is_active')
        if is_active is None:
            is_active = employee.get('ativo', True)

        if is_active:
            active_employees.append(employee)

    return active_employees


def _fetch_employee_records(company_id: str, employee_id: str, date_str: str) -> List[Dict[str, Any]]:
    key_condition = Key('company_id').eq(company_id) & Key('employee_id#date_time').begins_with(f"{employee_id}#{date_str}")

    try:
        records = _paginate_query(
            table_records,
            KeyConditionExpression=key_condition
        )
    except Exception as error:
        print(f"Erro ao consultar registros para funcionario {employee_id}: {error}")
        records = _paginate_scan(
            table_records,
            FilterExpression=Attr('company_id').eq(company_id) &
                             Attr('employee_id#date_time').begins_with(f"{employee_id}#{date_str}")
        )
    
    # Filtrar registros INVALIDADOS e AJUSTADOS - apenas ATIVO deve ser considerado
    return [r for r in records if (r.get('status') or 'ATIVO').upper() not in ('INVALIDADO', 'AJUSTADO')]


def _fetch_employee_month_records(company_id: str, employee_id: str, month_str: str) -> List[Dict[str, Any]]:
    key_condition = Key('company_id').eq(company_id) & Key('employee_id#date_time').begins_with(f"{employee_id}#{month_str}")

    try:
        records = _paginate_query(
            table_records,
            KeyConditionExpression=key_condition
        )
    except Exception as error:
        print(f"Erro ao consultar registros do mês para funcionario {employee_id}: {error}")
        records = _paginate_scan(
            table_records,
            FilterExpression=Attr('company_id').eq(company_id) &
                             Attr('employee_id#date_time').begins_with(f"{employee_id}#{month_str}")
        )
    
    # Filtrar registros INVALIDADOS e AJUSTADOS - apenas ATIVO deve ser considerado
    return [r for r in records if (r.get('status') or 'ATIVO').upper() not in ('INVALIDADO', 'AJUSTADO')]


def _build_attendance_summary(
    employee: Dict[str, Any],
    records: List[Dict[str, Any]],
    company_settings: Dict[str, Any],
    identifier_override: Optional[str] = None
) -> Dict[str, Any]:
    employee_identifier = (
        identifier_override or
        employee.get('employee_id') or
        employee.get('funcionario_id') or
        employee.get('id')
    )
    summary: Dict[str, Any] = {
        'employee_id': employee_identifier,
        'name': employee.get('nome', 'Funcionário'),
        'photo_url': employee.get('foto_url', ''),
        'present': False,
        'late': False,
        'arrival_dt': None,
        'arrival_str': None,
        'records': []
    }

    if not records:
        return summary

    sorted_records = sorted(records, key=_record_sort_key)

    arrival_record = next(
        (record for record in sorted_records if _is_entry_event(_record_type(record))),
        sorted_records[0]
    )

    arrival_dt = _extract_datetime(arrival_record)
    if arrival_dt:
        summary['arrival_dt'] = arrival_dt
        summary['arrival_str'] = arrival_dt.strftime('%H:%M')

    entry_events = sum(1 for record in sorted_records if _is_entry_event(_record_type(record)))
    exit_events = sum(1 for record in sorted_records if _is_exit_event(_record_type(record)))
    summary['present'] = entry_events > exit_events

    scheduled_start = employee.get('horario_entrada') or company_settings.get('horario_entrada_padrao')
    scheduled_time = _parse_time(scheduled_start)

    tolerance_minutes = _safe_int(
        employee.get('tolerancia_atraso') or company_settings.get('tolerancia_atraso') or company_settings.get('tolerance_after'),
        DEFAULT_TOLERANCE_MINUTES
    )

    is_late = False
    if arrival_dt and scheduled_time:
        scheduled_dt = datetime.combine(arrival_dt.date(), scheduled_time)
        tolerance_dt = scheduled_dt + timedelta(minutes=tolerance_minutes)
        is_late = arrival_dt > tolerance_dt

    summary['late'] = is_late

    arrival_status_raw = arrival_record.get('status') or arrival_record.get('record_status') if arrival_record else None
    entry_status_key = _normalize_status(arrival_status_raw, 'normal')

    if not arrival_status_raw:
        entry_status_key = _derive_entry_status(arrival_dt, scheduled_time, tolerance_minutes)

    if is_late:
        entry_status_key = 'atraso'

    summary['entry_status'] = entry_status_key
    summary['entry_status_label'] = _get_status_label(entry_status_key)

    record_infos: List[Dict[str, Any]] = []
    entry_event_index = 0
    for raw_record in sorted_records:
        record_dt = _extract_datetime(raw_record)
        if not record_dt:
            continue

        record_type = _record_type(raw_record) or 'entrada'
        record_status_raw = raw_record.get('status') or raw_record.get('record_status')
        record_status_key = _normalize_status(record_status_raw, 'normal')

        if _is_entry_event(record_type):
            entry_event_index += 1
            if entry_event_index == 1 and (not record_status_raw or record_status_key == 'normal'):
                record_status_key = entry_status_key or 'normal'
            elif not record_status_raw:
                record_status_key = record_status_key or 'normal'
        elif not record_status_raw:
            record_status_key = record_status_key or 'normal'

        record_infos.append({
            'datetime': record_dt,
            'tipo': record_type,
            'status': record_status_key,
            'status_label': _get_status_label(record_status_key),
            'method': raw_record.get('method') or raw_record.get('metodo') or 'manual'
        })

    summary['records'] = record_infos
    summary['attended_today'] = bool(record_infos)
    summary['entry_events'] = entry_events
    summary['exit_events'] = exit_events
    return summary


def _parse_duration_to_minutes(value: Any) -> Decimal:
    if value is None:
        return Decimal('0')

    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))

    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return Decimal('0')

        if ':' in cleaned:
            parts = cleaned.split(':')
            try:
                hours = int(parts[0])
                minutes = int(parts[1]) if len(parts) > 1 else 0
                return Decimal(hours * 60 + minutes)
            except (ValueError, IndexError):
                return Decimal('0')

        try:
            return Decimal(cleaned)
        except InvalidOperation:
            return Decimal('0')

    return Decimal('0')


def _compute_worked_minutes(records: List[Dict[str, Any]]) -> Decimal:
    total_minutes = Decimal('0')

    for record in records:
        explicit_minutes = (
            record.get('horas_trabalhadas_minutos') or
            record.get('worked_minutes') or
            record.get('total_worked_minutes')
        )
        total_minutes += _parse_duration_to_minutes(explicit_minutes)

    if total_minutes > 0:
        return total_minutes

    sorted_records = sorted(records, key=_record_sort_key)
    current_entry: Optional[datetime] = None

    for record in sorted_records:
        record_type = _record_type(record)
        if _is_entry_event(record_type):
            current_entry = _extract_datetime(record)
            continue

        if _is_exit_event(record_type) and current_entry:
            exit_dt = _extract_datetime(record)
            if exit_dt and exit_dt > current_entry:
                diff_minutes = (exit_dt - current_entry).total_seconds() / 60
                if diff_minutes > 0:
                    total_minutes += Decimal(str(diff_minutes))
            current_entry = None

    return total_minutes


def _compute_attendance(company_id: str, today: date) -> Tuple[List[Dict[str, Any]], int]:
    today_str = today.isoformat()
    company_settings = _get_company_settings(company_id)
    employees = _get_active_employees(company_id)

    summaries: List[Dict[str, Any]] = []
    for employee in employees:
        candidate_ids = _candidate_employee_ids(employee)
        records: List[Dict[str, Any]] = []
        resolved_identifier: Optional[str] = None

        for candidate_id in candidate_ids:
            records = _fetch_employee_records(company_id, candidate_id, today_str)
            if records:
                resolved_identifier = candidate_id
                break

        summary = _build_attendance_summary(
            employee,
            records,
            company_settings,
            identifier_override=resolved_identifier
        )
        summary['employee'] = employee
        summary['resolved_employee_id'] = resolved_identifier or summary.get('employee_id')
        summary['records_count'] = len(records)
        summaries.append(summary)

    return summaries, len(employees)

def decimal_to_float(obj):
    """Converte Decimal para float para JSON"""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [decimal_to_float(v) for v in obj]
    return obj

@dashboard_routes.route('/api/dashboard/present-employees', methods=['GET'])
def get_present_employees():
    """Funcionários presentes hoje"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Token inválido'}), 401
    
    company_id = payload.get('company_id')
    today = date.today()

    try:
        attendance_summaries, total_employees = _compute_attendance(company_id, today)

        present_count = sum(1 for summary in attendance_summaries if summary.get('present'))
        attended_count = sum(1 for summary in attendance_summaries if summary.get('attended_today'))
        late_count = sum(1 for summary in attendance_summaries if summary.get('attended_today') and summary.get('late'))
        on_time_count = max(attended_count - late_count, 0)

        attendance_rate = (attended_count / total_employees * 100) if total_employees > 0 else 0

        return jsonify({
            'presentEmployeesCount': attended_count,
            'attendedEmployeesCount': attended_count,
            'currentlyOnSiteCount': present_count,
            'totalEmployees': total_employees,
            'onTimeCount': on_time_count,
            'attendanceRate': round(attendance_rate, 1)
        })

    except Exception as e:
        print(f"Erro em present-employees: {str(e)}")
        return jsonify({'error': str(e)}), 500

@dashboard_routes.route('/api/dashboard/hours-month', methods=['GET'])
def get_hours_month():
    """Horas trabalhadas do mês atual"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Token inválido'}), 401
    
    company_id = payload.get('company_id')
    now = datetime.now()
    current_month = f"{now.year}-{now.month:02d}"
    
    try:
        month_filter = Attr('company_id').eq(company_id) & Attr('month').eq(current_month)
        monthly_items = _paginate_scan(
            table_monthly_summary,
            FilterExpression=month_filter
        )

        total_worked_hours = Decimal('0')
        for summary in monthly_items:
            worked_value = (
                summary.get('worked_hours') or
                summary.get('total_worked_hours') or
                summary.get('hours_worked') or
                0
            )
            total_worked_hours += _to_decimal(worked_value)

        if not monthly_items or total_worked_hours == 0:
            daily_items = _paginate_scan(
                table_daily_summary,
                FilterExpression=Attr('company_id').eq(company_id) &
                                   Attr('date').begins_with(current_month)
            )
            for summary in daily_items:
                worked_value = summary.get('worked_hours') or summary.get('total_worked_hours') or 0
                total_worked_hours += _to_decimal(worked_value)

        active_employees = _get_active_employees(company_id)
        total_employees = len(active_employees)

        if total_worked_hours == 0 and active_employees:
            total_minutes = Decimal('0')
            for employee in active_employees:
                for candidate_id in _candidate_employee_ids(employee):
                    month_records = _fetch_employee_month_records(company_id, candidate_id, current_month)
                    if not month_records:
                        continue

                    total_minutes += _compute_worked_minutes(month_records)
                    break

            if total_minutes > 0:
                total_worked_hours = total_minutes / Decimal('60')
        
        # Dias úteis do mês atual
        _, last_day = calendar.monthrange(now.year, now.month)
        working_days = 22  # Aproximação de dias úteis
        monthly_target_hours = total_employees * working_days * 8
        
        # Status baseado na porcentagem da meta
        worked_hours_float = float(total_worked_hours)

        if worked_hours_float >= monthly_target_hours:
            status_indicator = 'acima'
        elif worked_hours_float >= monthly_target_hours * 0.9:
            status_indicator = 'na_meta'
        else:
            status_indicator = 'abaixo'
        
        return jsonify({
            'totalWorkedHoursMonth': round(worked_hours_float, 1),
            'monthlyTargetHours': monthly_target_hours,
            'statusIndicator': status_indicator
        })
        
    except Exception as e:
        print(f"Erro em hours-month: {str(e)}")
        return jsonify({'error': str(e)}), 500

@dashboard_routes.route('/api/dashboard/balance-month', methods=['GET'])
def get_balance_month():
    """Saldo acumulado do mês atual"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Token inválido'}), 401
    
    company_id = payload.get('company_id')
    now = datetime.now()
    current_month = f"{now.year}-{now.month:02d}"
    
    try:
        # Buscar resumos mensais
        monthly_response = table_monthly_summary.scan(
            FilterExpression=Attr('company_id').eq(company_id) & 
                           Attr('month').eq(current_month)
        )
        
        total_balance = 0
        positive_count = 0
        negative_count = 0
        
        for summary in monthly_response['Items']:
            balance = float(summary.get('balance_hours', 0))
            total_balance += balance
            
            if balance > 0:
                positive_count += 1
            elif balance < 0:
                negative_count += 1
        
        return jsonify({
            'totalBalanceMonth': round(total_balance, 1),
            'positiveEmployeesCount': positive_count,
            'negativeEmployeesCount': negative_count
        })
        
    except Exception as e:
        print(f"Erro em balance-month: {str(e)}")
        return jsonify({'error': str(e)}), 500

@dashboard_routes.route('/api/alerts/today', methods=['GET'])
def get_alerts_today():
    """Alertas do dia atual"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Token inválido'}), 401
    
    company_id = payload.get('company_id')
    today = date.today()

    try:
        attendance_summaries, _ = _compute_attendance(company_id, today)

        alerts: List[Dict[str, Any]] = []

        for summary in attendance_summaries:
            employee_name = summary.get('name', 'Funcionário')

            if not summary.get('records'):
                alerts.append({
                    'type': 'ausencia',
                    'message': f"{employee_name} ainda não registrou ponto hoje",
                    'severity': 'info'
                })

        return jsonify({'alerts': alerts})

    except Exception as e:
        print(f"Erro em alerts-today: {str(e)}")
        return jsonify({'error': str(e)}), 500

@dashboard_routes.route('/api/records/last-five', methods=['GET'])
def get_last_five_records():
    """Últimos 5 registros de hoje com status detalhado (atraso_minutos, horas_extras_minutos, etc.)"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Token inválido'}), 401
    
    company_id = payload.get('company_id')
    today = date.today()
    today_str = today.isoformat()

    try:
        # Buscar configurações da empresa para cálculos de status
        company_settings = _get_company_settings(company_id)
        tolerancia_atraso = _safe_int(company_settings.get('tolerancia_atraso'), 5)
        intervalo_automatico = company_settings.get('intervalo_automatico', False)
        duracao_intervalo = _safe_int(company_settings.get('duracao_intervalo'), 60)
        
        # Buscar funcionários da empresa
        employees = _get_active_employees(company_id)
        employees_map = {emp.get('id') or emp.get('employee_id') or emp.get('funcionario_id'): emp for emp in employees}
        
        attendance_summaries, _ = _compute_attendance(company_id, today)
        
        # Primeiro passo: calcular status para cada funcionário/data
        status_por_funcionario: Dict[str, Dict[str, Any]] = {}
        
        for summary in attendance_summaries:
            employee_id = summary.get('employee_id')
            employee = summary.get('employee', {})
            records = summary.get('records', [])
            
            if not employee_id or not records:
                continue
            
            # Obter horários esperados do funcionário
            horario_entrada_esperado = employee.get('horario_entrada') or company_settings.get('horario_entrada_padrao')
            horario_saida_esperado = employee.get('horario_saida') or company_settings.get('horario_saida_padrao')
            
            if not horario_entrada_esperado or not horario_saida_esperado:
                continue
            
            # Encontrar entrada e saída do dia
            entrada_record = None
            saida_record = None
            
            for rec in records:
                rec_dt = rec.get('datetime')
                if not rec_dt or rec_dt.date() != today:
                    continue
                rec_tipo = rec.get('tipo', 'entrada')
                if _is_entry_event(rec_tipo) and not entrada_record:
                    entrada_record = rec
                elif _is_exit_event(rec_tipo):
                    saida_record = rec
            
            # Calcular status se temos entrada e saída
            if entrada_record and saida_record:
                try:
                    entrada_dt = entrada_record.get('datetime')
                    saida_dt = saida_record.get('datetime')
                    
                    horario_entrada_real = entrada_dt.strftime('%H:%M') if entrada_dt else '00:00'
                    horario_saida_real = saida_dt.strftime('%H:%M') if saida_dt else '00:00'
                    
                    calculo = calculate_overtime(
                        horario_entrada_esperado,
                        horario_saida_esperado,
                        horario_entrada_real,
                        horario_saida_real,
                        company_settings,
                        intervalo_automatico,
                        duracao_intervalo
                    )
                    # Guardar apenas horas extras calculadas
                    status_por_funcionario[employee_id] = {
                        'horas_extras_minutos': calculo.get('horas_extras_minutos', 0)
                    }
                except Exception as calc_err:
                    print(f"[DEBUG last-five] Erro ao calcular status para {employee_id}: {calc_err}")

        # Segundo passo: criar registros com status detalhado
        daily_records: List[Dict[str, Any]] = []
        for summary in attendance_summaries:
            employee_name = summary.get('name', 'N/A')
            employee_id = summary.get('employee_id')
            
            for record in summary.get('records', []):
                record_dt: Optional[datetime] = record.get('datetime')
                if not record_dt or record_dt.date() != today:
                    continue

                record_type = record.get('tipo', 'entrada')
                if record_type in ('saída', 'out'):
                    record_type = 'saida'
                elif record_type not in ('entrada', 'saida'):
                    record_type = 'entrada'

                # Obter status calculado para este funcionário
                status_calculado = status_por_funcionario.get(employee_id, {})
                
                # Atribuir status ao registro correto:
                # - ENTRADA: atraso e entrada_antecipada
                # - SAÍDA: horas_extras e saida_antecipada
                horas_extras_minutos = 0
                if record_type == 'saida':
                    horas_extras_minutos = status_calculado.get('horas_extras_minutos', 0)

                daily_records.append({
                    'nome': employee_name,
                    'hora': record_dt.strftime('%H:%M:%S'),
                    'tipo': record_type,
                    'metodo': record.get('method', 'manual'),
                    'datetime': record_dt,
                    'horas_extras_minutos': horas_extras_minutos
                })

        daily_records.sort(key=lambda item: item['datetime'], reverse=True)
        last_five = daily_records[:5]

        for record in last_five:
            record.pop('datetime', None)

        return jsonify({'records': last_five})

    except Exception as e:
        print(f"Erro em last-five-records: {str(e)}")
        return jsonify({'error': str(e)}), 500

@dashboard_routes.route('/api/dashboard/hours-week', methods=['GET'])
def get_hours_week():
    """Horas trabalhadas da semana (segunda a hoje)"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Token inválido'}), 401
    
    company_id = payload.get('company_id')
    
    try:
        # Calcular início da semana (segunda-feira)
        today = date.today()
        days_since_monday = today.weekday()
        monday = today - timedelta(days=days_since_monday)
        
        hours_per_day = []
        daily_target_hours = 8  # Meta diária padrão
        
        for i in range(days_since_monday + 1):  # Segunda até hoje
            current_date = monday + timedelta(days=i)
            date_str = current_date.isoformat()
            
            # Buscar resumos diários
            daily_response = table_daily_summary.scan(
                FilterExpression=Attr('company_id').eq(company_id) & 
                               Attr('date').eq(date_str)
            )
            
            total_hours = 0
            for summary in daily_response['Items']:
                total_hours += float(summary.get('total_worked_hours', 0))
            
            # Determinar cor baseada na meta
            if total_hours >= daily_target_hours:
                color = '#4caf50'  # verde
            elif total_hours >= daily_target_hours * 0.9:
                color = '#ff9800'  # amarelo
            else:
                color = '#f44336'  # vermelho
            
            hours_per_day.append({
                'day': current_date.strftime('%a'),  # Seg, Ter, etc
                'date': date_str,
                'hours': round(total_hours, 1),
                'color': color
            })
        
        return jsonify({
            'hoursWorkedPerDay': hours_per_day,
            'dailyTargetHours': daily_target_hours
        })
        
    except Exception as e:
        print(f"Erro em hours-week: {str(e)}")
        return jsonify({'error': str(e)}), 500

@dashboard_routes.route('/api/employees/present', methods=['GET'])
def get_employees_present():
    """Funcionários que registraram ponto hoje (entrada ou saída)"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Token inválido'}), 401
    
    company_id = payload.get('company_id')
    today = date.today()

    try:
        attendance_summaries, _ = _compute_attendance(company_id, today)

        employees_with_records: List[Dict[str, Any]] = []
        for summary in attendance_summaries:
            # Incluir qualquer funcionário que tenha feito registro no dia
            if not summary.get('records'):
                continue

            arrival_record = next(
                (record for record in summary.get('records', []) if _is_entry_event(record.get('tipo'))),
                None
            )
            
            exit_record = next(
                (record for record in summary.get('records', []) if not _is_entry_event(record.get('tipo'))),
                None
            )

            # Determinar status: presente, saiu ou apenas entrada
            is_present = summary.get('present', False)
            if is_present:
                status_key = 'presente'
                status_label = 'Presente'
            elif exit_record:
                status_key = 'saiu'
                status_label = 'Saiu'
            else:
                status_key = 'entrada'
                status_label = 'Entrada registrada'
            
            entry_time = summary.get('arrival_str') or 'N/A'
            exit_time = None
            if exit_record:
                exit_time = exit_record.get('hora', 'N/A')
            
            arrival_method = arrival_record.get('method') if arrival_record else None

            employees_with_records.append({
                'foto': summary.get('photo_url', ''),
                'nome': summary.get('name', 'N/A'),
                'hora_entrada': entry_time,
                'hora_saida': exit_time,
                'status': status_label,
                'status_key': status_key,
                'status_label': status_label,
                'entry_status': status_key,
                'entry_status_label': status_label,
                'metodo': arrival_method or 'manual'
            })

        employees_with_records.sort(key=lambda item: item.get('hora_entrada') or '')

        return jsonify({'employees': employees_with_records})

        return jsonify({'employees': present_employees})

    except Exception as e:
        print(f"Erro em employees-present: {str(e)}")
        return jsonify({'error': str(e)}), 500