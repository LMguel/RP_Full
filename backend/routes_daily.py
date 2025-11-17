from flask import Blueprint, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta, date
from decimal import Decimal
from zoneinfo import ZoneInfo
from boto3.dynamodb.conditions import Key, Attr
from auth import verify_token
from functools import wraps
from aws_utils import dynamodb
import boto3

# Tabelas DynamoDB
table_daily_summary = dynamodb.Table('DailySummary')
table_records = dynamodb.Table('TimeRecords')
table_employees = dynamodb.Table('Employees')

daily_routes = Blueprint('daily_routes', __name__)

# Enable CORS
CORS(daily_routes, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:5173",
            "http://127.0.0.1:5173"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False,
        "expose_headers": ["Content-Type", "Authorization"]
    }
})

# Decorator para autenticação
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Token inválido'}), 401
        
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        
        try:
            data = verify_token(token)
            request.user_data = data
        except Exception as e:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        
        return f(*args, **kwargs)
    
    return decorated


def calculate_daily_summary(company_id, employee_id, date, records):
    """
    Calcula o resumo diário a partir dos registros individuais
    
    Args:
        company_id: ID da empresa
        employee_id: ID do funcionário
        date: Data no formato YYYY-MM-DD
        records: Lista de registros do dia
    
    Returns:
        dict: Resumo calculado
    """
    # Obter nome do funcionário do primeiro registro
    employee_name = ''
    if records:
        employee_name = records[0].get('funcionario_nome', records[0].get('employee_name', 'Funcionário'))
    
    if not records:
        return {
            'company_id': company_id,
            'employee_id': employee_id,
            'employee_name': employee_name or 'Funcionário',
            'date': date,
            'status': 'absent',
            'worked_hours': 0.0,
            'expected_hours': 8.0,
            'difference_minutes': -480,
            'overtime_minutes': 0,
            'delay_minutes': 0,
            'balance_minutes': -480,
            'missing_exit': False,
            'has_location_issues': False,
            'total_records': 0,
            'first_entry_time': None,
            'last_exit_time': None
        }
    
    # Ordenar registros por data_hora
    try:
        sorted_records = sorted(records, key=lambda r: r.get('data_hora', ''))
    except Exception as sort_error:
        print(f"[ERROR] Erro ao ordenar registros: {str(sort_error)}")
        print(f"[ERROR] Primeiro registro: {records[0] if records else 'Nenhum'}")
        sorted_records = records
    
    # Extrair horários de entrada e saída
    # Debug: verificar estrutura dos registros
    if sorted_records:
        print(f"[DEBUG] Exemplo de registro: {sorted_records[0]}")
    
    entradas = [r for r in sorted_records if r.get('tipo') == 'entrada']
    saidas = [r for r in sorted_records if r.get('tipo') == 'saída']
    
    print(f"[DEBUG] Entradas encontradas: {len(entradas)}, Saídas: {len(saidas)}")
    
    first_entry = entradas[0].get('data_hora') if entradas else None
    last_exit = saidas[-1].get('data_hora') if saidas else None
    
    # Verificar se tem saída faltando
    missing_exit = len(entradas) > len(saidas)
    
    # Verificar problemas de localização
    has_location_issues = any(
        not r.get('location', {}).get('inside_radius', True) 
        for r in sorted_records 
        if r.get('location')
    )
    
    # Calcular horas trabalhadas (simplificado - somar pares entrada/saída)
    worked_minutes = 0
    for i in range(min(len(entradas), len(saidas))):
        entrada_dt = datetime.fromisoformat(entradas[i]['data_hora'].replace('Z', '+00:00'))
        saida_dt = datetime.fromisoformat(saidas[i]['data_hora'].replace('Z', '+00:00'))
        worked_minutes += (saida_dt - entrada_dt).total_seconds() / 60
    
    worked_hours = worked_minutes / 60
    expected_hours = 8.0  # TODO: Buscar das configurações
    
    # Calcular diferença
    difference_minutes = int(worked_minutes - (expected_hours * 60))
    
    # Calcular horas extras (apenas se positivo)
    overtime_minutes = max(0, difference_minutes)
    
    # Calcular atraso (TODO: verificar horário previsto de entrada)
    delay_minutes = 0
    if first_entry:
        entrada_dt = datetime.fromisoformat(first_entry.replace('Z', '+00:00'))
        # Assumir entrada prevista às 08:00
        expected_entry = entrada_dt.replace(hour=8, minute=0, second=0, microsecond=0)
        if entrada_dt > expected_entry:
            delay_minutes = int((entrada_dt - expected_entry).total_seconds() / 60)
    
    # Determinar status
    if worked_hours == 0:
        status = 'absent'
    elif missing_exit:
        status = 'missing_exit'
    elif delay_minutes > 15:
        status = 'late'
    elif overtime_minutes > 30:
        status = 'extra'
    else:
        status = 'normal'
    
    return {
        'company_id': company_id,
        'employee_id': employee_id,
        'date': date,
        'employee_name': records[0].get('funcionario_nome', records[0].get('employee_name', '')),
        'first_entry_time': first_entry.split('T')[1][:8] if first_entry else None,
        'last_exit_time': last_exit.split('T')[1][:8] if last_exit else None,
        'worked_hours': round(worked_hours, 2),
        'expected_hours': expected_hours,
        'difference_minutes': difference_minutes,
        'status': status,
        'overtime_minutes': overtime_minutes,
        'delay_minutes': delay_minutes,
        'balance_minutes': difference_minutes,
        'missing_exit': missing_exit,
        'has_location_issues': has_location_issues,
        'total_records': len(sorted_records)
    }


@daily_routes.route('/api/registros-diarios', methods=['GET'])
@token_required
def get_daily_summaries():
    """
    Lista registros diários consolidados da tabela DailySummary
    
    Query Parameters:
        - month: YYYY-MM (opcional)
        - employee_id: ID do funcionário (opcional)
        - status: Status do registro (opcional)
        - date: YYYY-MM-DD data específica (opcional)
        - page: Número da página (default: 1)
        - page_size: Tamanho da página (default: 50)
    """
    try:
        company_id = request.user_data.get('company_id')
        
        print(f"[DEBUG] GET /api/registros-diarios - company_id: {company_id}")
        
        if not company_id:
            return jsonify({'error': 'company_id não encontrado no token'}), 400
        
        # Parâmetros de filtro
        month = request.args.get('month')  # YYYY-MM
        employee_id_filter = request.args.get('employee_id')
        status_filter = request.args.get('status')
        date_filter = request.args.get('date')  # YYYY-MM-DD
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 50))
        
        # Determinar intervalo de datas
        if date_filter:
            start_date = date_filter
            end_date = date_filter
        elif month:
            year, month_num = map(int, month.split('-'))
            start_date = f"{year:04d}-{month_num:02d}-01"
            # Último dia do mês
            if month_num == 12:
                end_date = f"{year:04d}-{month_num:02d}-31"
            else:
                next_month_date = date(year, month_num + 1, 1) - timedelta(days=1)
                end_date = next_month_date.strftime('%Y-%m-%d')
        else:
            # Mês atual por padrão
            now = datetime.now()
            start_date = now.strftime('%Y-%m-01')
            end_date = now.strftime('%Y-%m-%d')
        
        print(f"[DEBUG] Buscando TimeRecords REAIS - start_date: {start_date}, end_date: {end_date}")
        
        # MUDANÇA: Buscar registros REAIS da tabela TimeRecords ao invés de DailySummary cache
        try:
            # Buscar todos os registros do período
            response = table_records.scan(
                FilterExpression=Attr('company_id').eq(company_id)
            )
            all_records = response.get('Items', [])
            
            # Filtrar por data
            records_in_range = []
            for record in all_records:
                data_hora = record.get('data_hora', '')
                if data_hora:
                    record_date = data_hora[:10]  # YYYY-MM-DD
                    if start_date <= record_date <= end_date:
                        records_in_range.append(record)
            
            print(f"[DEBUG] TimeRecords encontrados no período: {len(records_in_range)}")
            
            # Agrupar registros por funcionário e data
            from collections import defaultdict
            grouped = defaultdict(list)
            for record in records_in_range:
                emp_id = record.get('funcionario_id') or record.get('employee_id')
                data_hora = record.get('data_hora', '')
                if emp_id and data_hora:
                    record_date = data_hora[:10]
                    key = f"{emp_id}#{record_date}"
                    grouped[key].append(record)
            
            print(f"[DEBUG] Grupos de funcionário+data: {len(grouped)}")
            
            # Calcular sumário para cada grupo usando summary_calculator
            from summary_calculator import calculate_daily_summary
            from datetime import datetime
            items = []
            for key, records in grouped.items():
                emp_id, date_str = key.split('#')
                try:
                    # Converter string YYYY-MM-DD para objeto date
                    target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    summary = calculate_daily_summary(company_id, emp_id, target_date)
                    if summary:
                        # Converter para dict
                        summary_dict = {
                            'company_id': summary.company_id,
                            'employee_id': summary.employee_id,
                            'date': summary.date,
                            'actual_start': summary.actual_start,
                            'actual_end': summary.actual_end,
                            'worked_hours': summary.worked_hours,
                            'expected_hours': summary.expected_hours,
                            'status': summary.status,
                            'delay_minutes': summary.delay_minutes,
                            'extra_hours': summary.extra_hours,
                            'daily_balance': summary.daily_balance,
                            'records_count': summary.records_count
                        }
                        items.append(summary_dict)
                except Exception as calc_error:
                    print(f"[ERRO] Erro ao calcular sumário para {key}: {calc_error}")
            
            print(f"[DEBUG] Sumários calculados: {len(items)}")
            if items:
                print(f"[DEBUG] Exemplo de item calculado:")
                example_item = items[0]
                print(f"  - actual_start: {example_item.get('actual_start')}")
                print(f"  - actual_end: {example_item.get('actual_end')}")
                print(f"  - worked_hours: {example_item.get('worked_hours')}")
        except Exception as query_error:
            print(f"[WARNING] Erro ao buscar DailySummary: {str(query_error)}")
            print(f"[INFO] Tabela DailySummary pode não existir, retornando lista vazia")
            items = []
        
        # Buscar nomes dos funcionários
        employee_names = {}
        if items:
            try:
                emp_response = table_employees.query(
                    KeyConditionExpression=Key('company_id').eq(company_id)
                )
                for emp in emp_response.get('Items', []):
                    employee_names[emp.get('id')] = emp.get('nome', emp.get('id'))
                print(f"[DEBUG] Nomes de funcionários carregados: {len(employee_names)}")
            except Exception as e:
                print(f"[AVISO] Erro ao buscar nomes: {e}")
        
        # Aplicar filtros adicionais
        summaries = []
        for item in items:
            # Filtro por funcionário
            if employee_id_filter and item.get('employee_id') != employee_id_filter:
                continue
            
            # Filtro por status
            if status_filter and item.get('status') != status_filter:
                continue
            
            # Converter Decimal para float e adicionar nome
            summary = {}
            for key, value in item.items():
                if isinstance(value, Decimal):
                    summary[key] = float(value)
                else:
                    summary[key] = value
            
            # Adicionar nome do funcionário
            emp_id = summary.get('employee_id')
            summary['employee_name'] = employee_names.get(emp_id, emp_id)
            
            # Mapear e formatar campos do DailySummary
            # Extrair apenas HH:MM dos horários
            def extract_time_only(dt_str):
                """Extrai HH:MM de datetime string"""
                if not dt_str:
                    return None
                dt_str = str(dt_str)
                # Formato: "2025-11-13 07:30:00" -> "07:30"
                if ' ' in dt_str:
                    time_part = dt_str.split(' ')[1]
                    return time_part[:5]  # HH:MM
                # Formato: "2025-11-13T07:30:00" -> "07:30"
                elif 'T' in dt_str:
                    time_part = dt_str.split('T')[1]
                    return time_part[:5]
                # Já está no formato HH:MM
                return dt_str[:5] if len(dt_str) >= 5 else dt_str
            
            # Mapear horários formatados
            actual_start = summary.get('actual_start')
            actual_end = summary.get('actual_end')
            summary['first_entry_time'] = extract_time_only(actual_start) if actual_start else None
            summary['last_exit_time'] = extract_time_only(actual_end) if actual_end else None
            
            # calculate_daily_summary já retorna worked_hours e expected_hours em HORAS (Decimal)
            # Apenas garantir que temos difference_minutes calculado
            if summary.get('daily_balance') is not None:
                # daily_balance já está em horas (Decimal), converter para minutos
                summary['difference_minutes'] = float(summary['daily_balance']) * 60
            elif summary.get('worked_hours') is not None and summary.get('expected_hours') is not None:
                diff_hours = float(summary['worked_hours']) - float(summary['expected_hours'])
                summary['difference_minutes'] = diff_hours * 60
            
            summaries.append(summary)
        
        # Ordenar por data descendente
        summaries.sort(key=lambda s: s.get('date', ''), reverse=True)
        
        # Paginação
        total = len(summaries)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated = summaries[start_idx:end_idx]
        
        print(f"[DEBUG] Retornando {len(paginated)} sumários de {total} total")
        if paginated:
            example = paginated[0]
            print(f"[DEBUG] Exemplo de sumário retornado:")
            print(f"  - employee_name: {example.get('employee_name')}")
            print(f"  - first_entry_time: {example.get('first_entry_time')}")
            print(f"  - last_exit_time: {example.get('last_exit_time')}")
            print(f"  - worked_hours: {example.get('worked_hours')}")
            print(f"  - expected_hours: {example.get('expected_hours')}")
            print(f"  - difference_minutes: {example.get('difference_minutes')}")
        
        return jsonify({
            'summaries': paginated,
            'total': total,
            'page': page,
            'page_size': page_size
        }), 200
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] Erro ao buscar registros diários: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        return jsonify({'error': str(e)}), 500


@daily_routes.route('/api/registros-diarios/<employee_id>/<date>', methods=['GET'])
@token_required
def get_day_details(employee_id, date):
    """
    Busca detalhes de um dia específico (resumo da DailySummary + registros individuais)
    
    Args:
        employee_id: ID do funcionário
        date: Data no formato YYYY-MM-DD
    """
    try:
        company_id = request.user_data.get('company_id')
        
        if not company_id:
            return jsonify({'error': 'company_id não encontrado no token'}), 400
        
        # Buscar resumo da DailySummary
        try:
            summary_response = table_daily_summary.get_item(
                Key={
                    'company_id': company_id,
                    'employee_id#date': f"{employee_id}#{date}"
                }
            )
            
            if 'Item' in summary_response:
                summary = summary_response['Item']
                # Converter Decimal para float
                for key, value in summary.items():
                    if isinstance(value, Decimal):
                        summary[key] = float(value)
            else:
                summary = None
        except Exception as summary_error:
            print(f"[WARNING] Erro ao buscar DailySummary: {str(summary_error)}")
            summary = None
        
        # Buscar registros individuais do dia
        response = table_records.scan(
            FilterExpression=Attr('company_id').eq(company_id) & 
                           Attr('funcionario_id').eq(employee_id)
        )
        
        records = response.get('Items', [])
        
        # Filtrar por data
        day_records = [
            r for r in records 
            if r.get('data_hora', '')[:10] == date
        ]
        
        # Ordenar por data_hora
        day_records.sort(key=lambda r: r.get('data_hora', ''))
        
        return jsonify({
            'summary': summary,
            'records': day_records
        }), 200
        
    except Exception as e:
        print(f"Erro ao buscar detalhes do dia: {str(e)}")
        return jsonify({'error': str(e)}), 500


@daily_routes.route('/api/registros-diarios/<employee_id>/<date>/recalcular', methods=['POST'])
@token_required
def recalculate_day_summary(employee_id, date):
    """
    Força recalculo do resumo diário
    """
    try:
        company_id = request.user_data.get('company_id')
        
        if not company_id:
            return jsonify({'error': 'company_id não encontrado no token'}), 400
        
        # Buscar registros do dia usando table_records
        response = table_records.scan(
            FilterExpression=Attr('company_id').eq(company_id) & 
                           Attr('funcionario_id').eq(employee_id)
        )
        
        records = response.get('Items', [])
        day_records = [r for r in records if r.get('data_hora', '')[:10] == date]
        
        # Recalcular usando o calculate_daily_summary do summary_calculator
        from summary_calculator import calculate_daily_summary, save_daily_summary
        
        summary = calculate_daily_summary(company_id, employee_id, date, day_records)
        
        # Salvar na tabela DailySummary
        if summary:
            save_daily_summary(summary)
            print(f"[INFO] Resumo recalculado e salvo para {employee_id} em {date}")
        
        return jsonify(summary if summary else {}), 200
        
    except Exception as e:
        print(f"Erro ao recalcular: {str(e)}")
        return jsonify({'error': str(e)}), 500
