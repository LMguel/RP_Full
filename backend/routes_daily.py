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
            if not data:
                return jsonify({'error': 'Token inválido ou expirado'}), 401
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
    
    entradas = [r for r in sorted_records if r.get('type', r.get('tipo')) == 'entrada']
    saidas = [r for r in sorted_records if r.get('type', r.get('tipo')) in ('saída', 'saida')]
    
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
        start_date_param = request.args.get('start_date')
        end_date_param = request.args.get('end_date')
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 50))
        
        # Determinar intervalo de datas
        if date_filter:
            start_date = date_filter
            end_date = date_filter
        elif start_date_param or end_date_param:
            start_date = start_date_param or end_date_param
            end_date = end_date_param or start_date_param or start_date
            if start_date > end_date:
                start_date, end_date = end_date, start_date
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
        
        # OTIMIZAÇÃO: Processar registros diretamente sem chamar calculate_daily_summary
        try:
            print(f"[DEBUG] Iniciando busca de registros - company_id: {company_id}")
            
            # Buscar registros com scan (necessário pois não temos índice por data)
            filter_expr = Attr('company_id').eq(company_id)
            
            response = table_records.scan(
                FilterExpression=filter_expr,
                Limit=3000,
                Select='ALL_ATTRIBUTES'
            )
            all_records = response.get('Items', [])
            
            print(f"[DEBUG] Registros encontrados (bruto): {len(all_records)}")
            
            # Filtrar por data de forma eficiente
            records_in_range = []
            for record in all_records:
                data_hora = record.get('data_hora', '')
                if data_hora and len(data_hora) >= 10:
                    record_date = data_hora[:10]  # YYYY-MM-DD
                    if start_date <= record_date <= end_date:
                        if employee_id_filter:
                            rec_emp = record.get('funcionario_id') or record.get('employee_id')
                            if rec_emp != employee_id_filter:
                                continue
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
            
            # OTIMIZAÇÃO: Calcular sumários diretamente dos registros agrupados
            # sem fazer consultas adicionais ao DynamoDB
            items = []
            
            grouped_items = sorted(grouped.items(), key=lambda kv: kv[0].split('#')[1], reverse=True)
            for key, records in grouped_items:
                emp_id, date_str = key.split('#')
                
                # Extrair horários de entrada e saída dos registros
                entradas = []
                saidas = []
                
                for rec in records:
                    tipo = str(rec.get('tipo', '') or rec.get('type', '') or '').lower().strip()
                    data_hora = rec.get('data_hora', '') or rec.get('timestamp', '')
                    
                    # Extrair apenas o horário (HH:MM)
                    hora = None
                    if data_hora:
                        data_hora_str = str(data_hora)
                        if 'T' in data_hora_str:
                            hora = data_hora_str.split('T')[1][:5]
                        elif ' ' in data_hora_str:
                            parts = data_hora_str.split(' ')
                            if len(parts) > 1:
                                hora = parts[1][:5]
                        elif len(data_hora_str) > 16:
                            hora = data_hora_str[11:16]
                    
                    if hora:
                        # Aceitar várias variações de entrada/saída
                        if tipo in ['entrada', 'entry', 'in', 'check-in', 'checkin', 'e']:
                            entradas.append(hora)
                        elif tipo in ['saída', 'saida', 'exit', 'out', 'check-out', 'checkout', 's']:
                            saidas.append(hora)
                        else:
                            # Se não tem tipo definido, usar ordem dos registros
                            # Primeiro registro = entrada, último = saída
                            pass
                
                # Se não conseguiu determinar pelo tipo, usar primeiro e último registro
                if not entradas and not saidas and records:
                    sorted_records = sorted(records, key=lambda r: r.get('data_hora', '') or r.get('timestamp', ''))
                    if sorted_records:
                        first_rec = sorted_records[0]
                        last_rec = sorted_records[-1]
                        
                        first_dt = first_rec.get('data_hora', '') or first_rec.get('timestamp', '')
                        last_dt = last_rec.get('data_hora', '') or last_rec.get('timestamp', '')
                        
                        if first_dt:
                            first_dt_str = str(first_dt)
                            if 'T' in first_dt_str:
                                entradas.append(first_dt_str.split('T')[1][:5])
                            elif ' ' in first_dt_str:
                                entradas.append(first_dt_str.split(' ')[1][:5])
                        
                        if last_dt and len(sorted_records) > 1:
                            last_dt_str = str(last_dt)
                            if 'T' in last_dt_str:
                                saidas.append(last_dt_str.split('T')[1][:5])
                            elif ' ' in last_dt_str:
                                saidas.append(last_dt_str.split(' ')[1][:5])
                
                # Pegar primeira entrada e última saída
                first_entry = min(entradas) if entradas else None
                last_exit = max(saidas) if saidas else None
                
                # Calcular horas trabalhadas de forma simples
                worked_hours = 0
                if first_entry and last_exit:
                    try:
                        h1, m1 = map(int, first_entry.split(':'))
                        h2, m2 = map(int, last_exit.split(':'))
                        minutes_worked = (h2 * 60 + m2) - (h1 * 60 + m1)
                        worked_hours = round(minutes_worked / 60, 2)
                    except:
                        pass
                
                summary_dict = {
                    'company_id': company_id,
                    'employee_id': emp_id,
                    'date': date_str,
                    'actual_start': first_entry,
                    'actual_end': last_exit,
                    'worked_hours': worked_hours,
                    'expected_hours': 8,
                    'status': 'presente' if first_entry else 'ausente',
                    'delay_minutes': 0,
                    'extra_hours': 0,
                    'daily_balance': 0,
                    'records_count': len(records)
                }
                items.append(summary_dict)
            
            print(f"[DEBUG] Sumários processados: {len(items)}")
        except Exception as query_error:
            print(f"[WARNING] Erro ao buscar registros: {str(query_error)}")
            import traceback
            traceback.print_exc()
            items = []
        
        # Buscar nomes dos funcionários e seus dados (otimizado)
        employee_data = {}
        if items:
            try:
                print(f"[DEBUG] Buscando dados de funcionários para {len(items)} items")
                
                # Otimização: usar scan com limite
                emp_response = table_employees.scan(
                    FilterExpression=Attr('company_id').eq(company_id),
                    Limit=100  # Limitar para evitar timeout
                )
                for emp in emp_response.get('Items', []):
                    # Pegar intervalo do funcionário (intervalo_emp) ou usar padrão 60 min
                    intervalo = emp.get('intervalo_emp') or emp.get('intervalo') or 60
                    try:
                        intervalo = int(intervalo)
                    except:
                        intervalo = 60
                    
                    employee_data[emp.get('id')] = {
                        'nome': emp.get('nome', emp.get('id')),
                        'horario_entrada': emp.get('horario_entrada'),
                        'horario_saida': emp.get('horario_saida'),
                        'intervalo': intervalo
                    }
                print(f"[DEBUG] Dados de funcionários carregados: {len(employee_data)}")
            except Exception as e:
                print(f"[AVISO] Erro ao buscar dados funcionários: {e}")
        
        # Aplicar filtros adicionais
        summaries = []
        for item in items:
            # Filtro por funcionário
            if employee_id_filter and item.get('employee_id') != employee_id_filter:
                continue
            
            # Converter Decimal e mapear apenas campos objetivos (sem atraso/penalização)
            emp_id = item.get('employee_id')
            actual_start = item.get('actual_start')
            actual_end = item.get('actual_end')
            
            # Obter dados do funcionário
            emp_info = employee_data.get(emp_id, {})
            emp_nome = emp_info.get('nome', emp_id)
            emp_horario_saida = emp_info.get('horario_saida')
            emp_intervalo = emp_info.get('intervalo', 60)  # Intervalo em minutos
            
            # Garantir que intervalo seja número
            try:
                emp_intervalo = int(emp_intervalo) if emp_intervalo else 60
            except:
                emp_intervalo = 60

            def extract_time_only(dt_str):
                if not dt_str:
                    return None
                dt_str = str(dt_str)
                if ' ' in dt_str:
                    return dt_str.split(' ')[1][:5]
                if 'T' in dt_str:
                    return dt_str.split('T')[1][:5]
                return dt_str[:5] if len(dt_str) >= 5 else dt_str

            hora_entrada = extract_time_only(actual_start) if actual_start else None
            hora_saida = extract_time_only(actual_end) if actual_end else None
            
            # Se não tem saída registrada mas tem entrada, usar horário padrão do funcionário
            saida_automatica = False
            if hora_entrada and not hora_saida and emp_horario_saida:
                hora_saida = extract_time_only(emp_horario_saida)
                saida_automatica = True
            
            # Calcular horas trabalhadas descontando intervalo
            horas_trabalhadas = None
            horas_trabalhadas_str = None
            if hora_entrada and hora_saida:
                try:
                    h1, m1 = map(int, hora_entrada.split(':'))
                    h2, m2 = map(int, hora_saida.split(':'))
                    minutos_totais = (h2 * 60 + m2) - (h1 * 60 + m1)
                    
                    # Descontar intervalo apenas se trabalhou mais que o intervalo
                    if minutos_totais > emp_intervalo:
                        minutos_trabalhados = minutos_totais - emp_intervalo
                    else:
                        minutos_trabalhados = minutos_totais
                    
                    horas = minutos_trabalhados // 60
                    minutos = minutos_trabalhados % 60
                    horas_trabalhadas = round(minutos_trabalhados / 60, 2)
                    
                    # Formatar como "XhYYmin" ou "Xh"
                    if minutos > 0:
                        horas_trabalhadas_str = f"{horas}h{minutos:02d}min"
                    else:
                        horas_trabalhadas_str = f"{horas}h"
                except Exception as e:
                    print(f"[AVISO] Erro ao calcular horas: {e}")
                    horas_trabalhadas = 0
                    horas_trabalhadas_str = None

            # Dia da semana em português abreviado
            try:
                wd = datetime.strptime(item.get('date'), '%Y-%m-%d').weekday()
                dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
                dia_semana = dias[wd]
            except Exception:
                dia_semana = None

            summary_obj = {
                'nome': emp_nome,
                'employee_id': emp_id,
                'dia_semana': dia_semana,
                'data': item.get('date'),
                'hora_entrada': hora_entrada,
                'hora_saida': hora_saida,
                'saida_automatica': saida_automatica,
                'horas_trabalhadas': horas_trabalhadas,
                'horas_trabalhadas_str': horas_trabalhadas_str,
                'intervalo_descontado': emp_intervalo,
                'horas_extras': float(item.get('extra_hours', 0))
            }

            summaries.append(summary_obj)
        
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
        
        # Mapear summary para retornar apenas campos objetivos
        mapped_summary = None
        if summary:
            mapped_summary = {
                'data': summary.get('date') if isinstance(summary, dict) else summary.date,
                'hora_entrada': (summary.get('first_entry_time') if isinstance(summary, dict) else summary.actual_start),
                'hora_saida': (summary.get('last_exit_time') if isinstance(summary, dict) else summary.actual_end),
                'horas_trabalhadas': float(summary.get('worked_hours', 0)) if isinstance(summary, dict) else float(summary.worked_hours),
                'horas_extras': float(summary.get('extra_hours', 0)) if isinstance(summary, dict) else float(summary.extra_hours)
            }

        return jsonify({
            'summary': mapped_summary,
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
