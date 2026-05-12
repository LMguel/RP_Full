from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, date
from decimal import Decimal
from zoneinfo import ZoneInfo
from boto3.dynamodb.conditions import Key, Attr
from utils.auth import verify_token
from functools import wraps
from utils.aws import dynamodb
from utils.schedule import get_schedule_for_date
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
        if target_date:
            h_entry, h_exit = get_schedule_for_date(emp_item, target_date)
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
            
            response = table_records.scan(
                FilterExpression=filter_expr,
                Limit=3000,
                Select='ALL_ATTRIBUTES'
            )
            all_records = response.get('Items', [])
            
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

            # ── CLASSIFICAÇÃO PURAMENTE POSICIONAL ──────────────────────────────
            # Independente do tipo salvo no banco, a posição cronológica determina:
            #   intervalo_automatico=True  → 1ª=entrada, última=saída (2 batidas)
            #   intervalo_automatico=False → 1ª=entrada, 2ª=saída intervalo,
            #                               3ª=volta intervalo, 4ª=saída final (4 batidas)
            #                               OU 1ª=entrada, 2ª=saída (2 batidas sem almoço)
            grouped_items = sorted(grouped.items(), key=lambda kv: kv[0].split('#')[1], reverse=True)
            for key, records in grouped_items:
                emp_id, date_str = key.split('#')

                # IMPORTANTE: Ordenar registros cronologicamente antes de processar
                records = sorted(records, key=lambda r: r.get('data_hora', '') or r.get('timestamp', ''))

                # Filtrar atestados e ordenar cronologicamente
                punch_records = []
                for rec in records:
                    tipo_r = str(rec.get('tipo', '') or rec.get('type', '') or '').lower().strip()
                    if tipo_r == 'dia_inteiro':
                        continue
                    dt = rec.get('data_hora', '') or rec.get('timestamp', '')
                    dt_calc = rec.get('data_hora_calculo', '') or dt
                    hora = _extract_time(dt)
                    hora_calc = _extract_time(dt_calc) or hora
                    if hora:
                        punch_records.append((hora, hora_calc))

                n = len(punch_records)
                first_entry = punch_records[0][0] if n >= 1 else None
                first_entry_calc = punch_records[0][1] if n >= 1 else None

                if intervalo_automatico:
                    # Fluxo 2 batidas: 1ª=entrada, última=saída (sem registrar intervalo)
                    last_exit = punch_records[-1][0] if n >= 2 else None
                    last_exit_calc = punch_records[-1][1] if n >= 2 else None
                    first_break_start = None
                    first_break_start_calc = None
                    first_break_end = None
                    first_break_end_calc = None
                else:
                    # Fluxo 4 batidas: pos0=entrada, pos1=saída intervalo,
                    # pos2=volta intervalo, pos3=saída final
                    # Batidas incompletas (1,2,3) = dia em andamento
                    first_break_start = punch_records[1][0] if n >= 2 else None
                    first_break_start_calc = punch_records[1][1] if n >= 2 else None
                    first_break_end = punch_records[2][0] if n >= 3 else None
                    first_break_end_calc = punch_records[2][1] if n >= 3 else None
                    last_exit = punch_records[3][0] if n >= 4 else None
                    last_exit_calc = punch_records[3][1] if n >= 4 else None

                # Calcular horas totais brutas (entrada→saída, sem descontar intervalo aqui)
                worked_hours = 0
                if first_entry_calc and last_exit_calc:
                    try:
                        h1, m1 = map(int, first_entry_calc.split(':'))
                        h2, m2 = map(int, last_exit_calc.split(':'))
                        minutes_worked = (h2 * 60 + m2) - (h1 * 60 + m1)
                        worked_hours = round(minutes_worked / 60, 2)
                    except Exception:
                        pass

                print(f"[DEBUG FIRST PASS] emp={emp_id} date={date_str} punches={n} ia={intervalo_automatico} "
                      f"entry={first_entry} break_start={first_break_start} break_end={first_break_end} exit={last_exit}")
                
                summary_dict = {
                    'company_id': company_id,
                    'employee_id': emp_id,
                    'date': date_str,
                    'actual_start': first_entry,
                    'actual_end': last_exit,
                    'actual_start_calc': first_entry_calc,
                    'actual_end_calc': last_exit_calc,
                    'break_start': first_break_start,
                    'break_start_calc': first_break_start_calc,
                    'break_end': first_break_end,
                    'break_end_calc': first_break_end_calc,
                    'worked_hours': worked_hours,
                    'expected_hours': 8,
                    'status': 'presente' if first_entry else 'ausente',
                    'delay_minutes': 0,
                    'extra_hours': 0,
                    'overtime_minutes': 0,
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
        
        # Aplicar filtros adicionais
        summaries = []
        for item in items:
            # Filtro por funcionário
            if employee_id_filter and item.get('employee_id') != employee_id_filter:
                continue
            emp_id = item.get('employee_id')
            actual_start = item.get('actual_start')
            actual_end = item.get('actual_end')
            actual_start_calc = item.get('actual_start_calc')
            actual_end_calc = item.get('actual_end_calc')
            
            # Obter dados do funcionário
            emp_info = employee_data.get(emp_id, {})
            emp_nome = emp_info.get('nome', emp_id)
            try:
                target_date = datetime.strptime(item.get('date'), '%Y-%m-%d').date()
            except Exception:
                target_date = None

            if target_date:
                emp_horario_entrada, emp_horario_saida = get_schedule_for_date(emp_info, target_date)
            else:
                emp_horario_entrada = emp_info.get('horario_entrada')
                emp_horario_saida = emp_info.get('horario_saida')
            emp_intervalo_raw = emp_info.get('intervalo')  # None = sem intervalo pré-definido
            
            # Verificar se funcionário tem intervalo pré-definido
            funcionario_tem_intervalo = emp_intervalo_raw is not None
            emp_intervalo = emp_intervalo_raw if funcionario_tem_intervalo else 0

            def extract_time_only(dt_str):
                if not dt_str:
                    return None
                dt_str = str(dt_str)
                if ' ' in dt_str:
                    return dt_str.split(' ')[1][:5]
                if 'T' in dt_str:
                    return dt_str.split('T')[1][:5]
                return dt_str[:5] if len(dt_str) >= 5 else dt_str

            def time_to_minutes(t_str):
                """Converte HH:MM para minutos"""
                if not t_str:
                    return None
                try:
                    h, m = map(int, t_str.split(':'))
                    return h * 60 + m
                except:
                    return None

            def minutes_to_hhmm(mins):
                """Converte minutos para formato XhYYmin"""
                if mins is None or mins < 0:
                    return None
                if mins == 0:
                    return "0h"
                horas = mins // 60
                minutos = mins % 60
                if minutos > 0:
                    return f"{horas}h{minutos:02d}min"
                return f"{horas}h"

            # Horários REAIS para exibição
            hora_entrada = extract_time_only(actual_start) if actual_start else None
            hora_saida = extract_time_only(actual_end) if actual_end else None
            
            # Horários de cálculo (já arredondados pelo registro)
            hora_entrada_calc = extract_time_only(actual_start_calc) if actual_start_calc else hora_entrada
            hora_saida_calc = extract_time_only(actual_end_calc) if actual_end_calc else hora_saida
            
            # Recuperar dados de intervalo do summary_dict
            item_break_start = item.get('break_start')  # 1ª saída (saída para intervalo)
            item_break_end = item.get('break_end')      # 2ª entrada (volta do intervalo)
            
            # ============================================================
            # CÁLCULO DE HORAS TOTAIS E HORAS EXTRAS COM TOLERÂNCIA
            # ============================================================
            # Regra:
            # - Entrada dentro da tolerância → arredonda para horario_entrada
            # - Entrada além da tolerância → usa horário real (horas totais começa do real)
            # - Saída dentro da tolerância → arredonda para horario_saida
            # - Saída além da tolerância → horas totais até horario_saida,
            #   excedente = hora extra
            # ============================================================
            
            horas_trabalhadas = None
            horas_trabalhadas_str = None
            horas_extras_min = 0
            horas_extras_str = None
            atraso_min = 0
            saida_antecipada_min = 0
            
            if hora_entrada_calc and hora_saida_calc:
                entrada_min = time_to_minutes(hora_entrada_calc)
                saida_min = time_to_minutes(hora_saida_calc)
                entrada_padrao_min = time_to_minutes(emp_horario_entrada) if emp_horario_entrada else None
                saida_padrao_min = time_to_minutes(emp_horario_saida) if emp_horario_saida else None
                
                if entrada_min is not None and saida_min is not None:
                    # Determinar horário de início efetivo para cálculo
                    inicio_efetivo = entrada_min
                    if entrada_padrao_min is not None:
                        diff_entrada = entrada_min - entrada_padrao_min  # positivo = atrasado
                        if abs(diff_entrada) <= tolerancia_atraso:
                            # Dentro da tolerância: arredondar para horário padrão
                            inicio_efetivo = entrada_padrao_min
                        # Se além da tolerância (atrasado): usa entrada_min real
                        # Se antecipado além da tolerância: usa entrada_min real (conta como adiantado)
                    
                    # Determinar horário de fim efetivo para cálculo
                    fim_efetivo = saida_min
                    if saida_padrao_min is not None:
                        diff_saida = saida_min - saida_padrao_min  # positivo = saiu depois
                        if abs(diff_saida) <= tolerancia_atraso:
                            # Dentro da tolerância: arredondar para horário padrão
                            fim_efetivo = saida_padrao_min
                        # else: usa saida_min real (independente de ser cedo ou tarde)
                    
                    # Calcular minutos totais trabalhados
                    minutos_totais = fim_efetivo - inicio_efetivo
                    
                    # Descontar intervalo
                    # intervalo_automatico=True  → desconta duracao_intervalo_padrao fixo da empresa
                    # intervalo_automatico=False → calcula gap REAL da 2ª→3ª batida (posição)
                    #   funcionario_tem_intervalo é IGNORADO quando intervalo_automatico=False
                    intervalo_descontado_min = 0
                    if intervalo_automatico:
                        if duracao_intervalo_padrao > 0 and minutos_totais > duracao_intervalo_padrao:
                            intervalo_descontado_min = duracao_intervalo_padrao
                            minutos_trabalhados = minutos_totais - duracao_intervalo_padrao
                        else:
                            minutos_trabalhados = minutos_totais
                    elif item_break_start and item_break_end:
                        # Almoço manual: desconta gap real entre 2ª e 3ª batida
                        try:
                            bs_h, bs_m = map(int, item_break_start.split(':'))
                            be_h, be_m = map(int, item_break_end.split(':'))
                            break_real_min = (be_h * 60 + be_m) - (bs_h * 60 + bs_m)
                            if break_real_min > 0 and break_real_min < minutos_totais:
                                intervalo_descontado_min = break_real_min
                                minutos_trabalhados = minutos_totais - break_real_min
                            else:
                                minutos_trabalhados = minutos_totais
                        except Exception as break_err:
                            print(f"[WARN] Erro ao calcular intervalo real: {break_err}")
                            minutos_trabalhados = minutos_totais
                    else:
                        minutos_trabalhados = minutos_totais
                    
                    if minutos_trabalhados < 0:
                        minutos_trabalhados = 0
                    
                    # Hora extra = total trabalhado ACIMA do total previsto
                    if entrada_padrao_min is not None and saida_padrao_min is not None:
                        previsto_bruto_dia = saida_padrao_min - entrada_padrao_min
                        # Deduzir intervalo previsto do dia (usa o mesmo lógica do cálculo real)
                        if intervalo_automatico and duracao_intervalo_padrao > 0:
                            previsto_min_dia = max(0, previsto_bruto_dia - duracao_intervalo_padrao)
                        elif not intervalo_automatico and intervalo_descontado_min > 0:
                            previsto_min_dia = max(0, previsto_bruto_dia - intervalo_descontado_min)
                        elif funcionario_tem_intervalo and emp_intervalo and emp_intervalo > 0:
                            previsto_min_dia = max(0, previsto_bruto_dia - emp_intervalo)
                        else:
                            previsto_min_dia = previsto_bruto_dia
                        horas_extras_min = max(0, minutos_trabalhados - previsto_min_dia)
                    else:
                        horas_extras_min = 0
                    
                    horas_trabalhadas = round(minutos_trabalhados / 60, 2)
                    horas_trabalhadas_str = minutes_to_hhmm(minutos_trabalhados)

                    if horas_extras_min > 0:
                        horas_extras_str = minutes_to_hhmm(horas_extras_min)

                    # Atraso: APENAS para a primeira entrada do dia vs horário previsto
                    if entrada_padrao_min is not None:
                        diff_atraso = entrada_min - entrada_padrao_min
                        if diff_atraso > tolerancia_atraso:
                            atraso_min = diff_atraso

                    # Saída antecipada: APENAS para a última saída do dia vs horário previsto
                    if saida_padrao_min is not None:
                        diff_saida_ant = saida_padrao_min - saida_min  # positivo = saiu antes do previsto
                        if diff_saida_ant > tolerancia_atraso:
                            saida_antecipada_min = diff_saida_ant

                    print(f"[DEBUG DAILY] {emp_nome}: entrada_real={hora_entrada}, saida_real={hora_saida}, "
                          f"entrada_calc={hora_entrada_calc}, saida_calc={hora_saida_calc}, "
                          f"padrao={emp_horario_entrada}-{emp_horario_saida}, tol={tolerancia_atraso}, "
                          f"inicio_efetivo={inicio_efetivo}, fim_efetivo={fim_efetivo}, "
                          f"total={minutos_trabalhados}min, extras={horas_extras_min}min, "
                          f"atraso={atraso_min}min, saida_ant={saida_antecipada_min}min")

            # Dia da semana em português abreviado
            try:
                wd = datetime.strptime(item.get('date'), '%Y-%m-%d').weekday()
                dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
                dia_semana = dias[wd]
            except Exception:
                dia_semana = None

            # Quando intervalo_automatico=True a empresa não registra batidas de almoço;
            # ocultar intervalo_saida/intervalo_volta para não exibir marcações intermediárias indevidas.
            intervalo_saida_exib = None if intervalo_automatico else item.get('break_start')
            intervalo_volta_exib = None if intervalo_automatico else item.get('break_end')

            summary_obj = {
                'nome': emp_nome,
                'employee_id': emp_id,
                'dia_semana': dia_semana,
                'data': item.get('date'),
                'hora_entrada': hora_entrada,
                'intervalo_saida': intervalo_saida_exib,
                'intervalo_volta': intervalo_volta_exib,
                'hora_saida': hora_saida,
                'horas_trabalhadas': horas_trabalhadas,
                'horas_trabalhadas_str': horas_trabalhadas_str,
                'intervalo_descontado': intervalo_descontado_min if (hora_entrada_calc and hora_saida_calc) else (emp_intervalo if funcionario_tem_intervalo else 0),
                'intervalo_automatico': intervalo_automatico,  # True = almoço automático (empresa), False = batidas manuais
                'horas_extras': horas_extras_min,
                'horas_extras_str': horas_extras_str,
                'atraso_minutos': atraso_min,
                'saida_antecipada_minutos': saida_antecipada_min,
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
