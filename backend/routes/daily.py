from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, date
from decimal import Decimal
from zoneinfo import ZoneInfo
from boto3.dynamodb.conditions import Key, Attr
from utils.auth import verify_token
from functools import wraps
from utils.aws import dynamodb
from utils.schedule import get_schedule_for_date
from services.calculation_engine import (
    calculate_worked_minutes as eng_worked,
    get_display_times as eng_display,
    calculate_expected_minutes as eng_expected,
    calculate_delay_minutes as eng_delay,
    calculate_early_departure_minutes as eng_early_dep,
    apply_bank_tolerance,
    minutes_to_hhmm,
    count_valid_punches,
    get_actual_break_minutes,
)
import boto3

# Tabelas DynamoDB
table_daily_summary = dynamodb.Table('DailySummary')
table_records = dynamodb.Table('TimeRecords')
table_employees = dynamodb.Table('Employees')
table_config = dynamodb.Table('ConfigCompany')

daily_routes = Blueprint('daily_routes', __name__)

# CORS configurado globalmente no app.py

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
    
    _TIPOS_ENTRADA = ('entrada', 'retorno_almoco')
    _TIPOS_SAIDA = ('saída', 'saida', 'saida_almoco', 'saida_antecipada')
    entradas = [r for r in sorted_records if (r.get('type') or r.get('tipo') or '').lower() in _TIPOS_ENTRADA]
    saidas = [r for r in sorted_records if (r.get('type') or r.get('tipo') or '').lower() in _TIPOS_SAIDA]
    
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
    # Buscar horas previstas do horário cadastrado do funcionário
    expected_entry_str = None
    try:
        emp_resp = table_employees.get_item(Key={'company_id': company_id, 'id': employee_id})
        emp_item = emp_resp.get('Item', {})
        try:
            target_date = datetime.strptime(date, '%Y-%m-%d').date()
        except Exception:
            target_date = None
        cfg_r = table_config.get_item(Key={'company_id': company_id})
        emp_cfg = cfg_r.get('Item', {})
        if target_date:
            h_entry, h_exit = get_schedule_for_date(emp_item, target_date, emp_cfg)
        else:
            h_entry = emp_item.get('horario_entrada')
            h_exit = emp_item.get('horario_saida')
        expected_entry_str = h_entry
        if h_entry and h_exit:
            def _hhmm_to_min(s): h, m = map(int, s.split(':')); return h * 60 + m
            expected_hours = (_hhmm_to_min(h_exit) - _hhmm_to_min(h_entry)) / 60.0
        else:
            expected_hours = 0.0
    except Exception:
        expected_hours = 0.0
    
    # Calcular diferença
    difference_minutes = int(worked_minutes - (expected_hours * 60))
    
    # Calcular horas extras (apenas se positivo)
    overtime_minutes = max(0, difference_minutes)
    
    # Calcular atraso (TODO: verificar horário previsto de entrada)
    delay_minutes = 0
    if first_entry and expected_entry_str:
        entrada_dt = datetime.fromisoformat(first_entry.replace('Z', '+00:00'))
        try:
            hh, mm = map(int, expected_entry_str.split(':'))
            expected_entry = entrada_dt.replace(hour=hh, minute=mm, second=0, microsecond=0)
        except Exception:
            expected_entry = entrada_dt
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
            
            # Buscar configurações da empresa (tolerância, etc.)
            config_data = {}
            try:
                config_resp = table_config.get_item(Key={'company_id': company_id})
                config_data = config_resp.get('Item', {})
            except Exception as cfg_err:
                print(f"[AVISO] Erro ao buscar config da empresa: {cfg_err}")
            
            tolerancia_atraso = int(config_data.get('tolerancia_atraso', 10))
            _ia_raw = config_data.get('intervalo_automatico', False)
            if isinstance(_ia_raw, bool):
                intervalo_automatico = _ia_raw
            elif isinstance(_ia_raw, str):
                intervalo_automatico = _ia_raw.strip().lower() in ('true', '1', 'yes')
            else:
                try:
                    intervalo_automatico = bool(int(_ia_raw))
                except Exception:
                    intervalo_automatico = False
            duracao_intervalo_padrao = int(config_data.get('duracao_intervalo', 60) or 60)
            
            print(f"[DEBUG] Config empresa - tolerancia_atraso: {tolerancia_atraso}min, intervalo_automatico: {intervalo_automatico}")
            
            # Buscar registros com scan (necessário pois não temos índice por data)
            filter_expr = Attr('company_id').eq(company_id)
            
            all_records = []
            scan_kwargs = {'FilterExpression': filter_expr, 'Select': 'ALL_ATTRIBUTES'}
            while True:
                response = table_records.scan(**scan_kwargs)
                all_records.extend(response.get('Items', []))
                last_key = response.get('LastEvaluatedKey')
                if not last_key:
                    break
                scan_kwargs['ExclusiveStartKey'] = last_key
            
            print(f"[DEBUG] Registros encontrados (bruto): {len(all_records)}")
            
            # Filtrar por data de forma eficiente
            # IMPORTANTE: Ignorar registros INVALIDADOS e AJUSTADOS
            # Apenas registros ATIVO (ou sem status, para retrocompatibilidade) devem ser considerados
            records_in_range = []
            for record in all_records:
                # Ignorar registros invalidados ou ajustados
                record_status = (record.get('status') or 'ATIVO').upper()
                if record_status in ('INVALIDADO', 'AJUSTADO'):
                    continue
                
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
            
            def _extract_time(dt_str):
                """Retorna HH:MM de uma string data_hora (ISO, espaço, ou timestamp)."""
                s = str(dt_str or '').strip()
                if not s:
                    return None
                if 'T' in s:
                    return s.split('T')[1][:5]
                if ' ' in s:
                    parts = s.split(' ')
                    return parts[1][:5] if len(parts) > 1 else None
                if len(s) > 16:
                    return s[11:16]
                return None

            # Classificação posicional via motor canônico
            grouped_items = sorted(grouped.items(), key=lambda kv: kv[0].split('#')[1], reverse=True)
            for key, records in grouped_items:
                emp_id, date_str = key.split('#')
                records = sorted(records, key=lambda r: r.get('data_hora', '') or r.get('timestamp', ''))

                hora_entrada_disp, break_start_disp, break_end_disp, hora_saida_disp = eng_display(
                    records, intervalo_automatico
                )

                items.append({
                    'company_id': company_id,
                    'employee_id': emp_id,
                    'date': date_str,
                    'actual_start': hora_entrada_disp,
                    'actual_end': hora_saida_disp,
                    'break_start': break_start_disp,
                    'break_end': break_end_disp,
                    'records': records,
                    'records_count': len(records),
                })
            
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
                
                emp_kwargs = {'FilterExpression': Attr('company_id').eq(company_id)}
                all_emps = []
                while True:
                    emp_response = table_employees.scan(**emp_kwargs)
                    all_emps.extend(emp_response.get('Items', []))
                    emp_last = emp_response.get('LastEvaluatedKey')
                    if not emp_last:
                        break
                    emp_kwargs['ExclusiveStartKey'] = emp_last
                for emp in all_emps:
                    # Pegar intervalo do funcionário (intervalo_emp)
                    # IMPORTANTE: preservar None quando não tem intervalo definido
                    intervalo_raw = emp.get('intervalo_emp')
                    if intervalo_raw is None or str(intervalo_raw).strip() in ('', '0', 'None', 'null', 'false', 'False') or intervalo_raw == 0:
                        intervalo_raw = emp.get('intervalo')
                    
                    intervalo = None
                    if intervalo_raw is not None and str(intervalo_raw).strip() not in ('', '0', 'None', 'null', 'false', 'False') and intervalo_raw != 0:
                        try:
                            v = int(intervalo_raw)
                            intervalo = v if v > 0 else None
                        except:
                            intervalo = None
                    
                    employee_data[emp.get('id')] = {
                        'nome': emp.get('nome', emp.get('id')),
                        'horario_entrada': emp.get('horario_entrada'),
                        'horario_saida': emp.get('horario_saida'),
                        'custom_schedule': emp.get('custom_schedule'),
                        'intervalo': intervalo  # None = sem intervalo pré-definido
                    }
                print(f"[DEBUG] Dados de funcionários carregados: {len(employee_data)}")
            except Exception as e:
                print(f"[AVISO] Erro ao buscar dados funcionários: {e}")
        
        # Enriquecer com dados dos funcionários e calcular via motor canônico
        summaries = []
        for item in items:
            if employee_id_filter and item.get('employee_id') != employee_id_filter:
                continue

            emp_id = item.get('employee_id')
            date_str = item.get('date')
            records = item.get('records', [])

            if emp_id not in employee_data:
                print(f"[SECURITY] Rejecting record for unknown employee '{emp_id}' in company {company_id} — possible cross-tenant leak")
                continue

            emp_info = employee_data.get(emp_id, {})
            emp_nome = emp_info.get('nome', emp_id)

            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except Exception:
                target_date = None

            if target_date:
                scheduled_start, scheduled_end = get_schedule_for_date(emp_info, target_date, config_data)
            else:
                scheduled_start = emp_info.get('horario_entrada')
                scheduled_end = emp_info.get('horario_saida')

            # Funcionário de horário variável: sem horario_entrada ou horario_saida definidos.
            # Não gera previsto, banco, atraso, extra nem falta.
            variavel = (
                not emp_info.get('horario_entrada')
                or not emp_info.get('horario_saida')
            )

            # Intervalo efetivo: funcionário sobrepõe empresa quando configurado
            emp_break = emp_info.get('intervalo')
            break_duration = int(emp_break) if emp_break is not None else duracao_intervalo_padrao

            # ── Motor canônico: todos os cálculos passam por aqui ──
            worked_min, first_iso, last_iso = eng_worked(
                records, intervalo_automatico, break_duration
            )

            # Regra de break por quantidade de batidas (intervalo_automatico=False):
            #   n=2  → sem desconto (funcionário não registrou intervalo)
            #   n=3  → desconta break configurado (estimativa: foi ao intervalo sem volta)
            #   n>=4 → desconta break real (gap entre batida[1] e batida[2])
            #   auto → sempre desconta break configurado
            if intervalo_automatico:
                effective_break = break_duration
            else:
                n_punches = count_valid_punches(records)
                if n_punches <= 2:
                    effective_break = 0
                elif n_punches == 3:
                    effective_break = break_duration
                else:
                    actual_gap = get_actual_break_minutes(records)
                    effective_break = actual_gap if actual_gap is not None else break_duration

            if variavel:
                expected_min = None
                atraso_min = None
                saida_antecipada_min = None
                banco_horas_dia = None
                horas_extras_min = None
            else:
                expected_min = eng_expected(
                    scheduled_start, scheduled_end,
                    intervalo_automatico, effective_break
                )
                atraso_min = eng_delay(first_iso, scheduled_start, tolerancia_atraso)
                saida_antecipada_min = eng_early_dep(last_iso, scheduled_end, tolerancia_atraso)
                banco_horas_dia = apply_bank_tolerance(worked_min - expected_min, tolerancia_atraso)
                horas_extras_min = max(0, banco_horas_dia) if expected_min > 0 else 0

            try:
                wd = datetime.strptime(date_str, '%Y-%m-%d').weekday()
                dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
                dia_semana = dias[wd]
            except Exception:
                dia_semana = None

            summary_obj = {
                'nome': emp_nome,
                'employee_id': emp_id,
                'dia_semana': dia_semana,
                'data': date_str,
                'hora_entrada': item.get('actual_start'),
                'intervalo_saida': None if intervalo_automatico else item.get('break_start'),
                'intervalo_volta': None if intervalo_automatico else item.get('break_end'),
                'hora_saida': item.get('actual_end'),
                'horas_trabalhadas': round(worked_min / 60, 2),
                'horas_trabalhadas_min': worked_min,
                'horas_trabalhadas_str': minutes_to_hhmm(worked_min),
                'horas_previstas': round(expected_min / 60, 2) if expected_min is not None else None,
                'horas_previstas_min': expected_min,
                'horas_previstas_str': minutes_to_hhmm(expected_min) if expected_min is not None else None,
                'horas_extras': horas_extras_min,
                'horas_extras_str': minutes_to_hhmm(horas_extras_min) if horas_extras_min is not None and horas_extras_min > 0 else None,
                'banco_horas_dia': banco_horas_dia,
                'banco_horas_dia_str': minutes_to_hhmm(banco_horas_dia) if banco_horas_dia is not None else None,
                'atraso_minutos': atraso_min,
                'saida_antecipada_minutos': saida_antecipada_min,
                'intervalo_automatico': intervalo_automatico,
                'horario_variavel': variavel,
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
        
        # Filtrar por data e ignorar registros INVALIDADOS/AJUSTADOS
        day_records = [
            r for r in records 
            if r.get('data_hora', '')[:10] == date
            and (r.get('status') or 'ATIVO').upper() not in ('INVALIDADO', 'AJUSTADO')
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
        # Filtrar por data e ignorar registros INVALIDADOS/AJUSTADOS
        day_records = [
            r for r in records 
            if r.get('data_hora', '')[:10] == date
            and (r.get('status') or 'ATIVO').upper() not in ('INVALIDADO', 'AJUSTADO')
        ]
        
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
