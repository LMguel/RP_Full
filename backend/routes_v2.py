"""
ROTAS V2 - Nova Arquitetura com DailySummary e MonthlySummary
Endpoints modernos para registro de ponto e dashboards
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, date, timedelta
from decimal import Decimal
import boto3
from boto3.dynamodb.conditions import Key
from auth import verify_token
from functools import wraps
from models import DailySummary, MonthlySummary, TimeRecord
from summary_calculator import (
    calculate_daily_summary,
    save_daily_summary,
    calculate_monthly_summary,
    save_monthly_summary,
    rebuild_daily_summary,
    rebuild_monthly_summary
)
from s3_manager import upload_photo_to_s3, generate_s3_key, get_photo_url
from aws_utils import (
    tabela_funcionarios as table_employees,
    tabela_registros as table_records,
    tabela_configuracoes as table_config,
    dynamodb
)
import uuid
import json

routes_v2 = Blueprint('routes_v2', __name__, url_prefix='/api/v2')

# CORS configurado globalmente no app.py

# DynamoDB - usar as tabelas summary diretamente
table_daily = dynamodb.Table('DailySummary')
table_monthly = dynamodb.Table('MonthlySummary')

def token_required_v2(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return ('', 200)
        
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Token ausente'}), 401
        
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401
        
        return f(payload, *args, **kwargs)
    return decorated

@routes_v2.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'ok',
        'version': '2.0',
        'message': 'API V2 funcionando'
    }), 200

@routes_v2.route('/registrar-ponto', methods=['POST'])
@token_required_v2
def registrar_ponto_v2(payload):
    """
    Registra ponto e atualiza resumos automaticamente
    """
    try:
        company_id = payload.get('company_id')
        # O JWT tem usuario_id, não id
        funcionario_id = payload.get('id') or payload.get('usuario_id')
        
        if not company_id or not funcionario_id:
            return jsonify({
                'error': 'Dados de autenticação inválidos',
                'debug': {
                    'payload_keys': list(payload.keys()),
                    'company_id': company_id,
                    'funcionario_id': funcionario_id
                }
            }), 400
        
        # Obter dados do request
        data = request.form if request.form else request.json
        tipo_registro = data.get('tipo_registro', 'entrada')
        
        # Localização
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        # Work mode
        work_mode = data.get('work_mode', 'onsite')
        
        # Timestamp
        agora = datetime.now()
        data_hora = agora.isoformat()
        data_hora_str = agora.strftime('%Y-%m-%d %H:%M:%S')
        data_hora_calculo = data_hora_str  # Por padrão igual ao real
        
        # Se for entrada, verificar se deve arredondar para cálculo
        if tipo_registro == 'entrada':
            try:
                # Buscar dados do funcionário e configurações
                emp_response = table_employees.get_item(Key={'company_id': company_id, 'id': funcionario_id})
                funcionario = emp_response.get('Item', {})
                
                config_response = table_config.get_item(Key={'company_id': company_id})
                config = config_response.get('Item', {})
                
                tolerancia_atraso = int(config.get('tolerancia_atraso', 5))
                horario_entrada_esperado = funcionario.get('horario_entrada')
                
                if horario_entrada_esperado:
                    data_str = agora.strftime('%Y-%m-%d')
                    
                    # Parse horário esperado
                    try:
                        entrada_esperada = datetime.strptime(f"{data_str} {horario_entrada_esperado}", '%Y-%m-%d %H:%M')
                    except:
                        entrada_esperada = datetime.strptime(f"{data_str} {horario_entrada_esperado}", '%Y-%m-%d %H:%M:%S')
                    
                    diff_min = int((agora - entrada_esperada).total_seconds() // 60)
                    
                    if diff_min <= tolerancia_atraso:
                        # Dentro da tolerância: arredondar horário de CÁLCULO para o esperado
                        data_hora_calculo = f"{data_str} {horario_entrada_esperado}"
                        print(f"[V2] Entrada dentro da tolerância ({diff_min}min). Arredondando cálculo para {horario_entrada_esperado}")
            except Exception as e:
                print(f"[V2] Aviso ao calcular arredondamento: {e}")
        
        # Processar foto se houver
        foto_s3_key = None
        foto_url = None
        
        if 'foto' in request.files:
            foto = request.files['foto']
            foto_bytes = foto.read()
            
            # Upload com nova estrutura
            foto_s3_key, foto_url = upload_photo_to_s3(
                foto_bytes,
                company_id,
                funcionario_id,
                agora
            )
        
        # Salvar registro
        registro = {
            'company_id': company_id,
            'employee_id#date_time': f"{funcionario_id}#{data_hora_str}",
            'employee_id': funcionario_id,
            'funcionario_id': funcionario_id,
            'data_hora': data_hora_str,              # Horário REAL para exibição
            'data_hora_calculo': data_hora_calculo,  # Horário arredondado para cálculos
            'type': tipo_registro,
            'tipo_registro': tipo_registro,
            'method': 'LOCATION',
            'funcionario_nome': funcionario.get('nome', ''),
            'latitude': latitude,
            'longitude': longitude,
            'work_mode_at_time': work_mode,
            'foto_s3_key': foto_s3_key,
            'foto_url': foto_url,
            'valid_location': True,  # TODO: validar localização
            'created_at': agora.isoformat()
        }
        
        table_records.put_item(Item=registro)
        
        # Atualizar DailySummary
        target_date = agora.date()
        daily_summary = rebuild_daily_summary(company_id, funcionario_id, target_date)
        
        # Atualizar MonthlySummary
        monthly_summary = rebuild_monthly_summary(company_id, funcionario_id, agora.year, agora.month)
        
        return jsonify({
            'message': 'Ponto registrado com sucesso',
            'registro': {
                'data_hora': data_hora,
                'tipo_registro': tipo_registro,
                'foto_url': foto_url
            },
            'daily_summary': {
                'date': daily_summary.date,
                'hora_entrada': daily_summary.actual_start,
                'hora_saida': daily_summary.actual_end,
                'horas_trabalhadas': float(daily_summary.worked_hours),
                'horas_extras': float(daily_summary.extra_hours)
            }
        }), 200
        
    except Exception as e:
        print(f"[ERRO] Registrar ponto V2: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Erro ao registrar ponto: {str(e)}'}), 500

@routes_v2.route('/daily-summary/<employee_id>/<date_str>', methods=['GET'])
@token_required_v2
def get_daily_summary(payload, employee_id, date_str):
    """
    Retorna resumo diário de um funcionário
    """
    try:
        company_id = payload.get('company_id')
        
        # Buscar resumo
        response = table_daily.get_item(
            Key={
                'company_id': company_id,
                'employee_id#date': f"{employee_id}#{date_str}"
            }
        )
        
        if 'Item' not in response:
            # Calcular se não existir
            target_date = date.fromisoformat(date_str)
            summary = calculate_daily_summary(company_id, employee_id, target_date)
            save_daily_summary(summary)
            item = summary.to_dynamodb()
        else:
            item = response['Item']
        
        # Mapear apenas campos objetivos (sem atraso/penalização)
        mapped = {
            'date': item.get('date'),
            'employee_id': item.get('employee_id'),
            'hora_entrada': item.get('actual_start'),
            'hora_saida': item.get('actual_end'),
            'horas_trabalhadas': float(item.get('worked_hours', 0)),
            'horas_extras': float(item.get('extra_hours', 0))
        }

        return jsonify(mapped), 200
        
    except Exception as e:
        print(f"[ERRO] Get daily summary: {e}")
        return jsonify({'error': str(e)}), 500

@routes_v2.route('/monthly-summary/<employee_id>/<year>/<month>', methods=['GET'])
@token_required_v2
def get_monthly_summary(payload, employee_id, year, month):
    """
    Retorna resumo mensal de um funcionário
    """
    try:
        company_id = payload.get('company_id')
        month_str = f"{year}-{month:02d}" if isinstance(month, int) else f"{year}-{month}"
        
        response = table_monthly.get_item(
            Key={
                'company_id': company_id,
                'employee_id#month': f"{employee_id}#{month_str}"
            }
        )
        
        if 'Item' not in response:
            # Calcular se não existir
            summary = calculate_monthly_summary(company_id, employee_id, int(year), int(month))
            save_monthly_summary(summary)
            item = summary.to_dynamodb()
        else:
            item = response['Item']
        
        # Retornar apenas os três campos solicitados
        total_horas_trabalhadas = float(item.get('worked_hours', 0))
        total_horas_extras = float(item.get('extra_hours', 0))
        dias_trabalhados = int(item.get('days_worked', item.get('days_worked', 0)))

        return jsonify({
            'total_horas_trabalhadas': total_horas_trabalhadas,
            'total_horas_extras': total_horas_extras,
            'dias_trabalhados': dias_trabalhados
        }), 200
        
    except Exception as e:
        print(f"[ERRO] Get monthly summary: {e}")
        return jsonify({'error': str(e)}), 500

@routes_v2.route('/daily-summary', methods=['GET'])
@token_required_v2
def list_daily_summaries(payload):
    """
    Lista resumos diários de todos os funcionários para um intervalo de datas
    Query params:
        - date_from: data início (YYYY-MM-DD)
        - date_to: data fim (YYYY-MM-DD)
        - employee_id: ID do funcionário (opcional)
    """
    try:
        company_id = payload.get('company_id')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        employee_id_filter = request.args.get('employee_id')
        
        if not date_from or not date_to:
            return jsonify({'error': 'date_from e date_to são obrigatórios'}), 400
        
        print(f"[DEBUG] List daily summaries - company: {company_id}, range: {date_from} to {date_to}")
        
        # Buscar todos os funcionários
        emp_response = table_employees.query(
            KeyConditionExpression=Key('company_id').eq(company_id)
        )
        all_employees = emp_response.get('Items', [])
        
        # Filtrar por employee_id se fornecido
        if employee_id_filter:
            all_employees = [e for e in all_employees if e.get('id') == employee_id_filter]
        
        print(f"[DEBUG] Funcionários a processar: {len(all_employees)}")
        
        # Gerar lista de datas no intervalo
        from datetime import datetime, timedelta
        start = datetime.strptime(date_from, '%Y-%m-%d').date()
        end = datetime.strptime(date_to, '%Y-%m-%d').date()
        date_list = []
        current = start
        while current <= end:
            date_list.append(current)
            current += timedelta(days=1)
        
        print(f"[DEBUG] Datas no intervalo: {len(date_list)}")
        
        # Buscar ou calcular resumos para cada funcionário e data
        items = []
        for employee in all_employees:
            emp_id = employee.get('id')
            emp_name = employee.get('nome', emp_id)
            
            for target_date in date_list:
                date_str = target_date.strftime('%Y-%m-%d')
                
                # Tentar buscar do cache
                try:
                    response = table_daily.get_item(
                        Key={
                            'company_id': company_id,
                            'employee_id#date': f"{emp_id}#{date_str}"
                        }
                    )
                    
                    if 'Item' in response:
                        item = response['Item']
                    else:
                        # Calcular on-the-fly
                        summary = calculate_daily_summary(company_id, emp_id, target_date)
                        if summary and summary.records_count > 0:
                            # Salvar no cache
                            save_daily_summary(summary)
                            item = summary.to_dynamodb()
                        else:
                            # Sem registros neste dia, pular
                            continue
                    
                    # Converter Decimal para float
                    for key, value in item.items():
                        if isinstance(value, Decimal):
                            item[key] = float(value)
                    
                    # Adicionar nome do funcionário
                    item['employee_name'] = emp_name
                    items.append(item)
                    
                except Exception as e:
                    print(f"[WARNING] Erro ao processar {emp_id} em {date_str}: {e}")
                    continue
        
        print(f"[DEBUG] Total de resumos retornados: {len(items)}")

        # Mapear itens para formato objetivo e remover campos de atraso
        mapped_items = []
        for it in items:
            mapped_items.append({
                'date': it.get('date'),
                'employee_id': it.get('employee_id'),
                'employee_name': it.get('employee_name'),
                'hora_entrada': it.get('actual_start'),
                'hora_saida': it.get('actual_end'),
                'horas_trabalhadas': float(it.get('worked_hours', 0)),
                'horas_extras': float(it.get('extra_hours', 0))
            })

        return jsonify({
            'date_from': date_from,
            'date_to': date_to,
            'total': len(mapped_items),
            'items': mapped_items
        }), 200
        
    except Exception as e:
        print(f"[ERRO] List daily summaries: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@routes_v2.route('/dashboard/company/<date_str>', methods=['GET'])
@token_required_v2
def get_company_dashboard(payload, date_str):
    """
    Dashboard da empresa: resumos diários de todos os funcionários
    """
    try:
        company_id = payload.get('company_id')
        
        print(f"[DEBUG] Dashboard company - company_id: {company_id}, date: {date_str}")
        
        # Buscar todos os resumos do dia
        response = table_daily.query(
            IndexName='DateIndex',
            KeyConditionExpression=Key('company_id').eq(company_id) & Key('date').eq(date_str)
        )
        
        items = response.get('Items', [])
        print(f"[DEBUG] Itens encontrados no cache DailySummary: {len(items)}")
        
        # Se não houver itens no cache, calcular on-the-fly
        if not items:
            print(f"[INFO] Cache vazio, calculando resumos diários on-the-fly...")
            from datetime import datetime as dt
            
            # Buscar todos os funcionários da empresa
            try:
                emp_response = table_employees.query(
                    KeyConditionExpression=Key('company_id').eq(company_id)
                )
                all_employees = emp_response.get('Items', [])
                print(f"[DEBUG] Total de funcionários: {len(all_employees)}")
                
                # Calcular resumo para cada funcionário
                target_date = dt.strptime(date_str, '%Y-%m-%d').date()
                for employee in all_employees:
                    emp_id = employee.get('id')
                    if emp_id:
                        try:
                            summary = calculate_daily_summary(company_id, emp_id, target_date)
                            if summary:
                                # Converter DailySummary object para dict (apenas campos objetivos)
                                summary_dict = {
                                    'company_id': summary.company_id,
                                    'employee_id': summary.employee_id,
                                    'date': summary.date,
                                    'actual_start': summary.actual_start,
                                    'actual_end': summary.actual_end,
                                    'expected_start': summary.expected_start,
                                    'expected_end': summary.expected_end,
                                    'worked_hours': float(summary.worked_hours) if summary.worked_hours else 0,
                                    'expected_hours': float(summary.expected_hours) if summary.expected_hours else 0,
                                    'extra_hours': float(summary.extra_hours) if summary.extra_hours else 0,
                                    'records_count': summary.records_count
                                }
                                items.append(summary_dict)
                                
                                # Opcional: salvar no cache para próximas consultas
                                save_daily_summary(summary)
                        except Exception as calc_error:
                            print(f"[WARNING] Erro ao calcular resumo para {emp_id}: {calc_error}")
                
                print(f"[INFO] Resumos calculados: {len(items)}")
            except Exception as emp_error:
                print(f"[ERROR] Erro ao buscar funcionários: {emp_error}")
                items = []
        
        # Buscar nomes dos funcionários
        employee_names = {}
        if items:
            try:
                # Buscar todos os funcionários da empresa
                emp_response = table_employees.query(
                    KeyConditionExpression=Key('company_id').eq(company_id)
                )
                for emp in emp_response.get('Items', []):
                    employee_names[emp.get('id')] = emp.get('nome', emp.get('id'))
            except Exception as e:
                print(f"[AVISO] Erro ao buscar nomes: {e}")
        
        # Converter Decimal e adicionar nomes
        for item in items:
            for key, value in item.items():
                if isinstance(value, Decimal):
                    item[key] = float(value)
            
            # Adicionar nome do funcionário
            emp_id = item.get('employee_id')
            item['employee_name'] = employee_names.get(emp_id, emp_id)
        
        # Calcular totais (sem métricas de atraso)
        total_employees = len(items)
        total_present = len([i for i in items if i.get('worked_hours', 0) > 0])
        total_extra = len([i for i in items if i.get('extra_hours', 0) > 0])

        # Somar horas
        total_worked = sum(i.get('worked_hours', 0) for i in items)
        total_expected = sum(i.get('expected_hours', 0) for i in items)

        return jsonify({
            'date': date_str,
            'summary': {
                'total_employees': total_employees,
                'present': total_present,
                'extra_time': total_extra,
                'total_worked_hours': float(total_worked),
                'total_expected_hours': float(total_expected)
            },
            'employees': items
        }), 200
        
    except Exception as e:
        print(f"[ERRO] Company dashboard: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@routes_v2.route('/dashboard/employee', methods=['GET'])
@token_required_v2
def get_employee_dashboard(payload):
    """
    Dashboard do funcionário: seus próprios resumos
    """
    try:
        company_id = payload.get('company_id')
        funcionario_id = payload.get('id')
        
        # Últimos 7 dias
        hoje = date.today()
        summaries = []
        
        for i in range(7):
            target_date = hoje - timedelta(days=i)
            date_str = target_date.isoformat()
            
            response = table_daily.get_item(
                Key={
                    'company_id': company_id,
                    'employee_id#date': f"{funcionario_id}#{date_str}"
                }
            )
            
            if 'Item' in response:
                item = response['Item']
                # Mapear para campos objetivos
                mapped = {
                    'date': item.get('date'),
                    'hora_entrada': item.get('actual_start'),
                    'hora_saida': item.get('actual_end'),
                    'horas_trabalhadas': float(item.get('worked_hours', 0)),
                    'horas_extras': float(item.get('extra_hours', 0))
                }
                summaries.append(mapped)
        
        # Resumo do mês atual
        month_str = f"{hoje.year}-{hoje.month:02d}"
        response_month = table_monthly.get_item(
            Key={
                'company_id': company_id,
                'employee_id#month': f"{funcionario_id}#{month_str}"
            }
        )
        
        monthly_mapped = None
        if 'Item' in response_month:
            item = response_month['Item']
            monthly_mapped = {
                'total_horas_trabalhadas': float(item.get('worked_hours', 0)),
                'total_horas_extras': float(item.get('extra_hours', 0)),
                'dias_trabalhados': int(item.get('days_worked', 0))
            }

        return jsonify({
            'last_7_days': summaries,
            'current_month': monthly_mapped
        }), 200
        
    except Exception as e:
        print(f"[ERRO] Employee dashboard: {e}")
        return jsonify({'error': str(e)}), 500

@routes_v2.route('/records/<employee_id>/<date_str>', methods=['GET'])
@token_required_v2
def get_records_by_date(payload, employee_id, date_str):
    """
    Retorna todos os registros de um dia específico
    """
    try:
        response = table_records.query(
            KeyConditionExpression=Key('funcionario_id').eq(employee_id) &
                                  Key('data_hora').begins_with(date_str)
        )
        
        records = response.get('Items', [])
        
        return jsonify({
            'date': date_str,
            'records': records
        }), 200
        
    except Exception as e:
        print(f"[ERRO] Get records: {e}")
        return jsonify({'error': str(e)}), 500
