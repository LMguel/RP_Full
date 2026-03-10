"""
ChatBot RH - Assistente de RH para consultas de ponto
Endpoint: POST /api/chat/rh

Segurança:
- O company_id NUNCA vem do frontend, apenas do JWT autenticado
- A IA apenas interpreta intenção e extrai parâmetros textuais
- Todas as queries são executadas por funções internas controladas
- Apenas leitura (sem escrita, aprovação ou exclusão)
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Optional
import os
import json
import requests
from functools import wraps
from boto3.dynamodb.conditions import Key, Attr
from utils.auth import verify_token
from utils.aws import dynamodb
import unicodedata
import re

chatbot_rh_routes = Blueprint('chatbot_rh_routes', __name__)

# Tabelas DynamoDB
table_daily = dynamodb.Table('DailySummary')
table_monthly = dynamodb.Table('MonthlySummary')
table_employees = dynamodb.Table('Employees')
table_records = dynamodb.Table('TimeRecords')
table_config = dynamodb.Table('ConfigCompany')

# ---------------------------------------------------------------------------
# Decorator de autenticação
# ---------------------------------------------------------------------------

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return ('', 200)

        token = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'error': 'Token ausente'}), 401

        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido ou expirado'}), 401

        return f(payload, *args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

def _normalizar(texto: str) -> str:
    """Remove acentos e converte para minúsculas para comparação fuzzy."""
    if not texto:
        return ''
    nfkd = unicodedata.normalize('NFKD', texto)
    sem_acento = ''.join(c for c in nfkd if not unicodedata.combining(c))
    return sem_acento.lower().strip()


def _nome_contem(nome_emp: str, nome_busca: str) -> bool:
    """Verifica se o nome do funcionário contém o nome buscado (busca parcial, sem acentos)."""
    return _normalizar(nome_busca) in _normalizar(nome_emp)


def _get_mes_atual():
    today = date.today()
    return today.year, today.month


def _get_data_hoje():
    return date.today().isoformat()


def _format_date_br(date_str: str) -> str:
    """Converte YYYY-MM-DD para DD/MM/YYYY."""
    try:
        dt = datetime.strptime(date_str[:10], '%Y-%m-%d')
        return dt.strftime('%d/%m/%Y')
    except Exception:
        return date_str


def _minutes_to_hhmm(minutes) -> str:
    """Converte minutos para formato HH:MM."""
    try:
        m = int(minutes)
        h = m // 60
        r = m % 60
        return f"{h}h{r:02d}min"
    except Exception:
        return str(minutes)


def _decimal_to_float(val):
    if isinstance(val, Decimal):
        return float(val)
    return val


def _buscar_funcionarios_empresa(company_id: str):
    """Retorna todos os funcionários ativos da empresa."""
    try:
        resp = table_employees.query(
            KeyConditionExpression=Key('company_id').eq(company_id)
        )
        items = resp.get('Items', [])
        # Paginar se necessário
        while 'LastEvaluatedKey' in resp:
            resp = table_employees.query(
                KeyConditionExpression=Key('company_id').eq(company_id),
                ExclusiveStartKey=resp['LastEvaluatedKey']
            )
            items.extend(resp.get('Items', []))
        return [e for e in items if e.get('ativo', True) is not False]
    except Exception as e:
        print(f"[CHATBOT] Erro ao buscar funcionários: {e}")
        return []


def _buscar_daily_summary_mes(company_id: str, year: int, month: int):
    """
    Escaneia DailySummary para o mês inteiro da empresa.
    Retorna lista de itens.
    """
    start = f"{year:04d}-{month:02d}-01"
    if month == 12:
        end = f"{year:04d}-{month:02d}-31"
    else:
        last_day = (date(year, month + 1, 1) - timedelta(days=1)).day
        end = f"{year:04d}-{month:02d}-{last_day:02d}"

    try:
        # DailySummary: PK=company_id, SK=employee_id#date
        resp = table_daily.query(
            KeyConditionExpression=Key('company_id').eq(company_id)
        )
        items = resp.get('Items', [])
        while 'LastEvaluatedKey' in resp:
            resp = table_daily.query(
                KeyConditionExpression=Key('company_id').eq(company_id),
                ExclusiveStartKey=resp['LastEvaluatedKey']
            )
            items.extend(resp.get('Items', []))
    except Exception as e:
        print(f"[CHATBOT] Erro ao buscar DailySummary: {e}")
        return []

    # Filtrar pelo mês
    filtered = []
    for item in items:
        d = item.get('date', '')
        if start <= d <= end:
            filtered.append(item)
    return filtered


def _buscar_daily_summary_data(company_id: str, target_date: str):
    """Busca resumos diários para uma data específica."""
    try:
        resp = table_daily.query(
            KeyConditionExpression=Key('company_id').eq(company_id)
        )
        items = resp.get('Items', [])
        while 'LastEvaluatedKey' in resp:
            resp = table_daily.query(
                KeyConditionExpression=Key('company_id').eq(company_id),
                ExclusiveStartKey=resp['LastEvaluatedKey']
            )
            items.extend(resp.get('Items', []))
    except Exception as e:
        print(f"[CHATBOT] Erro ao buscar DailySummary por data: {e}")
        return []

    return [item for item in items if item.get('date', '') == target_date]


def _buscar_monthly_summary(company_id: str, year: int, month: int):
    """Busca MonthlySummary para o mês da empresa."""
    month_str = f"{year:04d}-{month:02d}"
    try:
        resp = table_monthly.query(
            KeyConditionExpression=Key('company_id').eq(company_id)
        )
        items = resp.get('Items', [])
        while 'LastEvaluatedKey' in resp:
            resp = table_monthly.query(
                KeyConditionExpression=Key('company_id').eq(company_id),
                ExclusiveStartKey=resp['LastEvaluatedKey']
            )
            items.extend(resp.get('Items', []))
    except Exception as e:
        print(f"[CHATBOT] Erro ao buscar MonthlySummary: {e}")
        return []

    return [item for item in items if item.get('month', '') == month_str]


def _get_employee_name(item):
    """Extrai nome do funcionário de um item de DailySummary ou do dict de employees."""
    return (
        item.get('employee_name')
        or item.get('funcionario_nome')
        or item.get('nome')
        or item.get('employee_id', 'Desconhecido')
    )


def _build_employee_map(company_id: str):
    """Retorna dict {employee_id: nome} para a empresa."""
    employees = _buscar_funcionarios_empresa(company_id)
    return {e.get('id', e.get('employee_id', '')): e.get('nome', 'Funcionário') for e in employees}


# ---------------------------------------------------------------------------
# Funções de consulta internas (leitura apenas)
# ---------------------------------------------------------------------------

def faltas_do_mes(company_id: str, employee_name: Optional[str], month: int, year: int) -> dict:
    """
    Retorna os dias de falta no mês calculados diretamente de TimeRecords.
    Para cada dia útil passado do mês, verifica quem não tem nenhum registro.
    Não depende de DailySummary para funcionar, assim funciona mesmo quando
    nenhum registro foi feito no mês.
    """
    today = date.today()
    primeiro_dia = date(year, month, 1)

    # Fim do período: último dia do mês ou ontem, o que vier primeiro
    # incluímos até o dia de hoje para que o mês atual tbm reflita hoje
    if month == 12:
        ultimo_dia = date(year, 12, 31)
    else:
        ultimo_dia = date(year, month + 1, 1) - timedelta(days=1)
    fim = min(ultimo_dia, today)

    # Mês ainda não começou
    if primeiro_dia > today:
        return {
            'intent': 'faltas_do_mes',
            'month': month,
            'year': year,
            'employee_name_filter': employee_name,
            'resultados': [],
        }

    employees = _buscar_funcionarios_empresa(company_id)
    if employee_name:
        employees = [e for e in employees if _nome_contem(e.get('nome', ''), employee_name)]

    if not employees:
        return {
            'intent': 'faltas_do_mes',
            'month': month,
            'year': year,
            'employee_name_filter': employee_name,
            'resultados': [],
        }

    start_str = primeiro_dia.isoformat()
    end_str = fim.isoformat()

    # Buscar todos os TimeRecords do mês para a empresa
    try:
        resp = table_records.scan(
            FilterExpression=Attr('company_id').eq(company_id),
            ProjectionExpression='employee_id, data_hora',
        )
        todos_registros = resp.get('Items', [])
        while 'LastEvaluatedKey' in resp:
            resp = table_records.scan(
                FilterExpression=Attr('company_id').eq(company_id),
                ExclusiveStartKey=resp['LastEvaluatedKey'],
                ProjectionExpression='employee_id, data_hora',
            )
            todos_registros.extend(resp.get('Items', []))
    except Exception as e:
        print(f'[CHATBOT] Erro ao buscar TimeRecords para faltas do mês: {e}')
        todos_registros = []

    # Conjunto de (employee_id, date) que TÊM registro no período
    pares_com_registro: set = set()
    for r in todos_registros:
        dh = r.get('data_hora', '')
        if dh:
            d = dh[:10]
            if start_str <= d <= end_str:
                emp_id = r.get('employee_id', '')
                if emp_id:
                    pares_com_registro.add((emp_id, d))

    # Gerar lista de dias úteis (seg-sex) no período
    dias_uteis = []
    current = primeiro_dia
    while current <= fim:
        if current.weekday() < 5:  # 0=seg, 4=sex
            dias_uteis.append(current.isoformat())
        current += timedelta(days=1)

    # Para cada funcionário, coletar dias úteis sem registro
    emp_faltas: dict = {
        e.get('id', e.get('employee_id', '')): {
            'emp': e,
            'dias': [],
        }
        for e in employees
    }

    for emp_id in emp_faltas:
        for dia_str in dias_uteis:
            if (emp_id, dia_str) not in pares_com_registro:
                emp_faltas[emp_id]['dias'].append(dia_str)

    resultados = []
    for emp_id, dado in emp_faltas.items():
        if dado['dias']:
            nome = dado['emp'].get('nome', 'Desconhecido')
            resultados.append({
                'funcionario': nome,
                'employee_id': emp_id,
                'dias_falta': sorted(dado['dias']),
                'total': len(dado['dias']),
            })

    resultados.sort(key=lambda x: x['funcionario'])

    return {
        'intent': 'faltas_do_mes',
        'month': month,
        'year': year,
        'employee_name_filter': employee_name,
        'resultados': resultados,
    }


def atrasos_hoje(company_id: str, employee_name: Optional[str]) -> dict:
    """
    Retorna funcionários com atraso hoje, calculado diretamente de TimeRecords.
    Compara o horário da primeira entrada com o horário esperado + tolerância do funcionário
    (ou da empresa como fallback).
    """
    hoje = _get_data_hoje()
    employees = _buscar_funcionarios_empresa(company_id)
    if employee_name:
        employees = [e for e in employees if _nome_contem(e.get('nome', ''), employee_name)]

    # Tolerância padrão da empresa
    tolerancia_empresa = 5
    try:
        cfg_resp = table_config.get_item(Key={'company_id': company_id})
        cfg = cfg_resp.get('Item', {})
        tolerancia_empresa = int(_decimal_to_float(cfg.get('tolerancia_atraso', 5)) or 5)
    except Exception as e:
        print(f'[CHATBOT] Erro ao buscar config (tolerância): {e}')

    # Buscar todos os registros da empresa de hoje
    try:
        resp = table_records.scan(
            FilterExpression=Attr('company_id').eq(company_id),
        )
        todos_registros = resp.get('Items', [])
        while 'LastEvaluatedKey' in resp:
            resp = table_records.scan(
                FilterExpression=Attr('company_id').eq(company_id),
                ExclusiveStartKey=resp['LastEvaluatedKey'],
            )
            todos_registros.extend(resp.get('Items', []))
    except Exception as e:
        print(f'[CHATBOT] Erro ao buscar TimeRecords para atrasos: {e}')
        todos_registros = []

    # Primeira entrada de cada funcionário hoje
    primeiras_entradas: dict = {}  # employee_id -> data_hora
    for r in todos_registros:
        dh = r.get('data_hora', '')
        if not dh or dh[:10] != hoje:
            continue
        rtype = str(r.get('type') or r.get('tipo') or r.get('tipo_registro', '')).lower()
        rtype = rtype.replace('\u00ed', 'i').replace('\u00e1', 'a')
        if rtype not in ('entrada', 'in', 'entry', 'checkin', 'check-in'):
            continue
        emp_id = r.get('employee_id', '')
        if emp_id:
            if emp_id not in primeiras_entradas or dh < primeiras_entradas[emp_id]:
                primeiras_entradas[emp_id] = dh

    resultados = []
    for emp in employees:
        emp_id = emp.get('id', emp.get('employee_id', ''))
        if emp_id not in primeiras_entradas:
            continue  # não registrou entrada hoje

        horario_esperado = emp.get('horario_entrada')
        if not horario_esperado:
            continue  # sem horário definido, impossível calcular atraso

        tolerancia = int(
            _decimal_to_float(emp.get('tolerancia_atraso', tolerancia_empresa)) or tolerancia_empresa
        )

        dh = primeiras_entradas[emp_id]
        try:
            hora_real = dh[11:16]  # 'HH:MM'
            h_real, m_real = map(int, hora_real.split(':'))
            h_esp, m_esp = map(int, horario_esperado[:5].split(':'))
            real_min = h_real * 60 + m_real
            esp_min = h_esp * 60 + m_esp
            desvio = real_min - esp_min
            if desvio > tolerancia:
                resultados.append({
                    'funcionario': emp.get('nome', 'Desconhecido'),
                    'employee_id': emp_id,
                    'minutos_atraso': desvio,
                    'horario_entrada': hora_real,
                    'horario_esperado': horario_esperado[:5],
                })
        except Exception as e:
            print(f'[CHATBOT] Erro ao calcular atraso de {emp_id}: {e}')

    resultados.sort(key=lambda x: (-x['minutos_atraso'], x['funcionario']))

    return {
        'intent': 'atrasos_hoje',
        'data': hoje,
        'employee_name_filter': employee_name,
        'resultados': resultados,
    }


def horas_extras_periodo(
    company_id: str,
    employee_name: Optional[str],
    start_date: str,
    end_date: str,
) -> dict:
    """Retorna horas extras no período. Se employee_name fornecido, filtra."""
    # Buscar todos os itens do intervalo de datas (pode cruzar meses)
    start_dt = datetime.strptime(start_date[:10], '%Y-%m-%d').date()
    end_dt = datetime.strptime(end_date[:10], '%Y-%m-%d').date()

    all_items = []
    current = date(start_dt.year, start_dt.month, 1)
    while current <= end_dt:
        month_items = _buscar_daily_summary_mes(company_id, current.year, current.month)
        for item in month_items:
            d = item.get('date', '')
            if start_date <= d <= end_date:
                all_items.append(item)
        # Avançar para próximo mês
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)

    # Remover duplicatas
    seen = set()
    unique_items = []
    for item in all_items:
        key = (item.get('employee_id', ''), item.get('date', ''))
        if key not in seen:
            seen.add(key)
            unique_items.append(item)

    employee_map = _build_employee_map(company_id)

    com_extras = [
        i for i in unique_items
        if int(_decimal_to_float(i.get('extra_hours', 0) or i.get('overtime_minutes', 0)) or 0) > 0
    ]

    if employee_name:
        com_extras = [
            i for i in com_extras
            if _nome_contem(
                employee_map.get(i.get('employee_id', ''), _get_employee_name(i)),
                employee_name
            )
        ]

    # Agrupar por funcionário, somando horas extras
    agrupado = {}
    for item in com_extras:
        emp_id = item.get('employee_id', '')
        nome = employee_map.get(emp_id, _get_employee_name(item))
        # extra_hours pode estar em horas (Decimal) ou em minutos
        extra_h = _decimal_to_float(item.get('extra_hours', 0) or 0)
        extra_m = int(_decimal_to_float(item.get('overtime_minutes', 0) or 0))
        # Normalizar para minutos
        total_min = extra_m if extra_m > 0 else int(extra_h * 60)
        if emp_id not in agrupado:
            agrupado[emp_id] = {'nome': nome, 'employee_id': emp_id, 'total_minutos': 0, 'dias': []}
        agrupado[emp_id]['total_minutos'] += total_min
        agrupado[emp_id]['dias'].append(item.get('date', ''))

    resultados = [
        {
            'funcionario': v['nome'],
            'employee_id': v['employee_id'],
            'total_horas_extras': _minutes_to_hhmm(v['total_minutos']),
            'dias_com_extra': sorted(v['dias']),
        }
        for v in agrupado.values()
    ]
    resultados.sort(key=lambda x: x['funcionario'])

    return {
        'intent': 'horas_extras_periodo',
        'start_date': start_date,
        'end_date': end_date,
        'employee_name_filter': employee_name,
        'resultados': resultados,
    }


def dias_trabalhados_funcionario(
    company_id: str,
    employee_name: Optional[str],
    month: int,
    year: int,
) -> dict:
    """Retorna dias trabalhados no mês por funcionário."""
    items = _buscar_daily_summary_mes(company_id, year, month)
    employee_map = _build_employee_map(company_id)

    trabalhados = [i for i in items if i.get('status') != 'absent']

    if employee_name:
        trabalhados = [
            i for i in trabalhados
            if _nome_contem(
                employee_map.get(i.get('employee_id', ''), _get_employee_name(i)),
                employee_name
            )
        ]

    agrupado = {}
    for item in trabalhados:
        emp_id = item.get('employee_id', '')
        nome = employee_map.get(emp_id, _get_employee_name(item))
        agrupado.setdefault(emp_id, {'nome': nome, 'employee_id': emp_id, 'dias': []})
        agrupado[emp_id]['dias'].append(item.get('date', ''))

    resultados = [
        {
            'funcionario': v['nome'],
            'employee_id': v['employee_id'],
            'dias_trabalhados': len(v['dias']),
            'datas': sorted(v['dias']),
        }
        for v in agrupado.values()
    ]
    resultados.sort(key=lambda x: x['funcionario'])

    return {
        'intent': 'dias_trabalhados_funcionario',
        'month': month,
        'year': year,
        'employee_name_filter': employee_name,
        'resultados': resultados,
    }


def resumo_mensal_funcionario(
    company_id: str,
    employee_name: Optional[str],
    month: int,
    year: int,
) -> dict:
    """Retorna o resumo mensal do(s) funcionário(s)."""
    month_summaries = _buscar_monthly_summary(company_id, year, month)
    employee_map = _build_employee_map(company_id)

    if employee_name:
        month_summaries = [
            i for i in month_summaries
            if _nome_contem(
                employee_map.get(i.get('employee_id', ''), _get_employee_name(i)),
                employee_name
            )
        ]

    resultados = []
    for item in month_summaries:
        emp_id = item.get('employee_id', '')
        nome = employee_map.get(emp_id, _get_employee_name(item))
        resultados.append({
            'funcionario': nome,
            'employee_id': emp_id,
            'dias_trabalhados': int(item.get('days_worked', 0) or 0),
            'dias_falta': int(item.get('absences', 0) or 0),
            'dias_atraso': int(item.get('days_late', 0) or 0),
            'horas_trabalhadas': _minutes_to_hhmm(
                int(_decimal_to_float(item.get('worked_hours', 0) or 0) * 60)
            ),
            'horas_extras': _minutes_to_hhmm(
                int(_decimal_to_float(item.get('extra_hours', 0) or 0) * 60)
            ),
            'saldo_final': _minutes_to_hhmm(
                int(_decimal_to_float(item.get('final_balance', 0) or 0) * 60)
            ),
            'status': item.get('status', 'balanced'),
        })

    resultados.sort(key=lambda x: x['funcionario'])

    return {
        'intent': 'resumo_mensal_funcionario',
        'month': month,
        'year': year,
        'employee_name_filter': employee_name,
        'resultados': resultados,
    }


def saldo_negativo(company_id: str, month: int, year: int) -> dict:
    """Retorna funcionários com saldo negativo no mês."""
    month_summaries = _buscar_monthly_summary(company_id, year, month)
    employee_map = _build_employee_map(company_id)

    negativos = [
        i for i in month_summaries
        if i.get('status') == 'negative'
        or _decimal_to_float(i.get('final_balance', 0) or 0) < 0
    ]

    resultados = []
    for item in negativos:
        emp_id = item.get('employee_id', '')
        nome = employee_map.get(emp_id, _get_employee_name(item))
        saldo_min = int(_decimal_to_float(item.get('final_balance', 0) or 0) * 60)
        resultados.append({
            'funcionario': nome,
            'employee_id': emp_id,
            'saldo': _minutes_to_hhmm(abs(saldo_min)) + ' negativos',
            'dias_falta': int(item.get('absences', 0) or 0),
        })

    resultados.sort(key=lambda x: x['funcionario'])

    return {
        'intent': 'saldo_negativo',
        'month': month,
        'year': year,
        'resultados': resultados,
    }


def listar_funcionarios(company_id: str) -> dict:
    """Retorna todos os funcionários ativos da empresa."""
    employees = _buscar_funcionarios_empresa(company_id)
    resultados = [
        {
            'funcionario': e.get('nome', 'Desconhecido'),
            'employee_id': e.get('id', e.get('employee_id', '')),
            'cargo': e.get('cargo', ''),
        }
        for e in sorted(employees, key=lambda x: x.get('nome', ''))
    ]
    return {
        'intent': 'listar_funcionarios',
        'total': len(resultados),
        'resultados': resultados,
    }


def ausentes_hoje(company_id: str, employee_name: Optional[str]) -> dict:
    """
    Retorna funcionários que NÃO registraram ponto hoje.
    Compara lista de funcionários ativos com quem de fato registrou hoje em TimeRecords.
    """
    hoje = _get_data_hoje()

    employees = _buscar_funcionarios_empresa(company_id)
    if not employees:
        return {
            'intent': 'ausentes_hoje',
            'data': hoje,
            'total_empresa': 0,
            'com_registro': 0,
            'employee_name_filter': employee_name,
            'resultados': [],
        }

    # Buscar todos os registros de hoje na tabela TimeRecords
    try:
        resp = table_records.scan(
            FilterExpression=Attr('company_id').eq(company_id),
            ProjectionExpression='employee_id, data_hora',
        )
        todos_registros = resp.get('Items', [])
        while 'LastEvaluatedKey' in resp:
            resp = table_records.scan(
                FilterExpression=Attr('company_id').eq(company_id),
                ExclusiveStartKey=resp['LastEvaluatedKey'],
                ProjectionExpression='employee_id, data_hora',
            )
            todos_registros.extend(resp.get('Items', []))
    except Exception as e:
        print(f'[CHATBOT] Erro ao buscar TimeRecords: {e}')
        todos_registros = []

    # IDs que já registraram hoje
    ids_com_registro = set()
    for r in todos_registros:
        dh = r.get('data_hora', '')
        if dh and dh[:10] == hoje:
            emp_id = r.get('employee_id', '')
            if emp_id:
                ids_com_registro.add(emp_id)

    # Funcionários sem registro hoje
    ausentes = [
        e for e in employees
        if e.get('id', e.get('employee_id', '')) not in ids_com_registro
    ]

    if employee_name:
        ausentes = [e for e in ausentes if _nome_contem(e.get('nome', ''), employee_name)]

    resultados = [
        {
            'funcionario': e.get('nome', 'Desconhecido'),
            'employee_id': e.get('id', e.get('employee_id', '')),
            'cargo': e.get('cargo', ''),
        }
        for e in ausentes
    ]
    resultados.sort(key=lambda x: x['funcionario'])

    return {
        'intent': 'ausentes_hoje',
        'data': hoje,
        'total_empresa': len(employees),
        'com_registro': len(ids_com_registro),
        'employee_name_filter': employee_name,
        'resultados': resultados,
    }


# ---------------------------------------------------------------------------
# Chamada ao Groq para interpretar a intenção
# ---------------------------------------------------------------------------

GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
GROQ_MODEL = 'llama-3.1-8b-instant'


def _parse_intent_groq(question: str) -> dict:
    """
    Envia a pergunta ao Groq e retorna JSON estruturado com:
    {
      "intent": ver lista de intenções no system_prompt,
      "employee_name": str | null,
      "period_type": "today" | "this_month" | "specific_month" | "none",
      "month": int | null,
      "year": int | null,
      "date": "YYYY-MM-DD" | null,
      "needs_clarification": bool,
      "clarification_question": str | null
    }
    """
    groq_key = os.environ.get('GROQ_API_KEY')
    if not groq_key:
        raise ValueError('GROQ_API_KEY não configurada')

    today = date.today()
    current_month = today.month
    current_year = today.year

    system_prompt = (
        """Você é um assistente de RH do sistema RegistraPonto.

Sua função NÃO é conversar livremente.
Sua função é interpretar perguntas do usuário e retornar UMA intenção estruturada para que o backend execute uma consulta segura.

REGRAS GERAIS
- Responda sempre em JSON válido.
- Nunca escreva texto fora do JSON.
- Nunca invente dados.
- Nunca responda diretamente com resultados do banco.
- Você apenas classifica a intenção e extrai parâmetros.
- Nunca peça informações desnecessárias.
- Só peça esclarecimento quando faltar um dado realmente obrigatório.
- Se a pergunta já estiver completa, não peça mais nada.
- Se a pergunta contiver "hoje", use a data atual.
- Se a pergunta contiver "este mês", use o mês e ano atuais.
- Se a pergunta for listar funcionários, nunca peça período.
- Se a pergunta for geral da empresa, não exija nome de funcionário.
- Se a pergunta mencionar funcionário pelo nome, extraia esse nome.
- O backend irá consultar apenas os dados da empresa logada. Não tente inferir empresa.

DATA ATUAL
{{CURRENT_DATE}}

INTENÇÕES PERMITIDAS
Você deve escolher apenas UMA destas intenções:
- listar_funcionarios
- faltas_hoje
- faltas_mes
- atrasos_hoje
- saldo_negativo
- dias_falta_funcionario_mes
- horas_extras_funcionario_mes
- resumo_funcionario_mes
- dias_trabalhados_funcionario_mes
- desconhecida

QUANDO USAR CADA INTENÇÃO
1. listar_funcionarios — nomes, lista ou relação de funcionários
2. faltas_hoje — faltas no dia de hoje
3. faltas_mes — faltas gerais do mês sem citar um funcionário específico
4. atrasos_hoje — atrasos do dia atual
5. saldo_negativo — banco negativo, devendo horas
6. dias_falta_funcionario_mes — dias que UM funcionário específico faltou no mês
7. horas_extras_funcionario_mes — horas extras de um funcionário no mês
8. resumo_funcionario_mes — resumo mensal de um funcionário
9. dias_trabalhados_funcionario_mes — dias trabalhados por um funcionário
10. desconhecida — não se encaixa em nenhuma intenção acima

REGRAS IMPORTANTES
- "esse mês", "este mês", "mês atual" → month={{CURRENT_MONTH}}, year={{CURRENT_YEAR}}
- "hoje" → date={{TODAY_YYYY_MM_DD}}, period_type="today"
- Se mencionar mês pelo nome (ex: "março"), use o número correto
- "quem faltou hoje", "faltaram hoje", "ausentes hoje" → SEMPRE usar "faltas_hoje"
- "quem faltou este mês" (sem nome) → "faltas_mes"
- "que dia a Ana faltou" (com nome) → "dias_falta_funcionario_mes"
- Peça esclarecimento APENAS se faltar dado obrigatório (ex: nome para intent que exige funcionário)
- NÃO peça esclarecimento para: listar_funcionarios, faltas_hoje, faltas_mes, atrasos_hoje, saldo_negativo

FORMATO DE RESPOSTA (JSON puro, sem markdown):
{
  "intent": "<intent>",
  "employee_name": "<nome ou null>",
  "period_type": "<today|this_month|specific_month|none>",
  "month": <numero ou null>,
  "year": <numero ou null>,
  "date": "<YYYY-MM-DD ou null>",
  "needs_clarification": false,
  "clarification_question": null
}"""
        .replace('{{CURRENT_DATE}}', today.isoformat())
        .replace('{{TODAY_YYYY_MM_DD}}', today.isoformat())
        .replace('{{CURRENT_MONTH}}', str(current_month))
        .replace('{{CURRENT_YEAR}}', str(current_year))
    )

    headers = {
        'Authorization': f'Bearer {groq_key}',
        'Content-Type': 'application/json',
    }
    body = {
        'model': GROQ_MODEL,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': question},
        ],
        'temperature': 0.0,
        'max_tokens': 512,
    }

    resp = requests.post(GROQ_API_URL, headers=headers, json=body, timeout=20)

    if not resp.ok:
        print(f'[CHATBOT] Groq HTTP {resp.status_code}: {resp.text[:300]}')
        resp.raise_for_status()

    content = resp.json()['choices'][0]['message']['content'].strip()

    # Limpar possível markdown code block
    content = re.sub(r'^```json\s*', '', content)
    content = re.sub(r'^```\s*', '', content)
    content = re.sub(r'\s*```$', '', content)

    parsed = json.loads(content)
    return parsed


# ---------------------------------------------------------------------------
# Fallback: parser local por palavras-chave (sem IA)
# Usado quando o Groq está indisponível
# ---------------------------------------------------------------------------

_MESES_PT = {
    'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3,
    'abril': 4, 'maio': 5, 'junho': 6,
    'julho': 7, 'agosto': 8, 'setembro': 9,
    'outubro': 10, 'novembro': 11, 'dezembro': 12,
}


def _parse_intent_local(question: str) -> dict:
    """
    Parser simples baseado em palavras-chave.
    Fallback para quando o Groq estiver indisponível.
    """
    q = _normalizar(question)
    today = date.today()

    # Detectar mês e ano
    month = today.month
    year = today.year
    for nome, num in _MESES_PT.items():
        if nome in q:
            month = num
            break

    # Detectar ano explícito (ex: 2026)
    ano_match = re.search(r'\b(202\d)\b', q)
    if ano_match:
        year = int(ano_match.group(1))

    # Detectar nome de funcionário (heurística simples: palavra após "o|a|do|da|de" + maiúscula no original)
    employee_name = None
    nome_match = re.search(
        r'\b(?:o|a|do|da|de|funcionario|funcionária|colaborador[a]?)\s+([A-ZÁÉÍÓÚÀÃÕ][a-záéíóúàãõ]+)',
        question
    )
    if nome_match:
        employee_name = nome_match.group(1)

    # period_type e date
    if 'hoje' in q:
        period_type = 'today'
        current_date = today.isoformat()
    else:
        period_type = 'this_month'
        current_date = None

    # Determinar intent — verificar "hoje" ANTES das versões mensais
    if any(w in q for w in ['listar', 'lista', 'citar', 'cite', 'nomes', 'colaborador']):
        intent = 'listar_funcionarios'

    elif any(w in q for w in ['falt', 'ausent', 'nao veio', 'nao compareceu']) and 'hoje' in q:
        intent = 'faltas_hoje'

    elif any(w in q for w in ['falt', 'ausent', 'nao veio', 'nao compareceu']) and employee_name:
        intent = 'dias_falta_funcionario_mes'

    elif any(w in q for w in ['falt', 'ausent', 'nao veio', 'nao compareceu']):
        intent = 'faltas_mes'

    elif any(w in q for w in ['atras', 'chegou tarde', 'chegou atrasado', 'atraso']):
        intent = 'atrasos_hoje'

    elif any(w in q for w in ['hora extra', 'horas extras', 'banco de horas', 'hora a mais', 'overtime']):
        intent = 'horas_extras_funcionario_mes'

    elif any(w in q for w in ['dias trabalhado', 'quantos dias trabalh', 'presenca', 'presença']):
        intent = 'dias_trabalhados_funcionario_mes'

    elif any(w in q for w in ['saldo negativo', 'banco negativo', 'debito', 'devendo hora', 'horas negativ']):
        intent = 'saldo_negativo'

    elif any(w in q for w in ['resumo', 'relatorio', 'relatório', 'sumario', 'sumário', 'como foi o mes']):
        intent = 'resumo_funcionario_mes'

    else:
        return {
            'intent': 'desconhecida',
            'employee_name': None,
            'period_type': 'none',
            'month': month,
            'year': year,
            'date': None,
            'needs_clarification': True,
            'clarification_question': 'Você quer consultar faltas, atrasos, horas extras, saldo negativo ou resumo de um funcionário?',
        }

    needs_clarification = False
    clarification_question = None
    if intent in ('dias_falta_funcionario_mes', 'horas_extras_funcionario_mes',
                  'resumo_funcionario_mes', 'dias_trabalhados_funcionario_mes') and not employee_name:
        needs_clarification = True
        clarification_question = 'Qual funcionário você deseja consultar?'

    return {
        'intent': intent,
        'employee_name': employee_name,
        'period_type': period_type,
        'month': month,
        'year': year,
        'date': current_date,
        'needs_clarification': needs_clarification,
        'clarification_question': clarification_question,
    }


# ---------------------------------------------------------------------------
# Formatação da resposta em linguagem natural
# ---------------------------------------------------------------------------

def _formatar_resposta(data: dict) -> str:
    """Converte o resultado estruturado em texto amigável."""
    intent = data.get('intent')
    # Suportar nomes de intents novos e antigos
    _aliases = {
        'faltas_hoje': 'ausentes_hoje',
        'faltas_mes': 'faltas_do_mes',
        'dias_falta_funcionario_mes': 'faltas_do_mes',
        'horas_extras_funcionario_mes': 'horas_extras_periodo',
        'resumo_funcionario_mes': 'resumo_mensal_funcionario',
        'dias_trabalhados_funcionario_mes': 'dias_trabalhados_funcionario',
        'desconhecida': 'desconhecido',
    }
    intent = _aliases.get(intent, intent)
    resultados = data.get('resultados', [])
    month = data.get('month')
    year = data.get('year')
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    mes_label = ''
    if month and year:
        nomes_meses = [
            '', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
            'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
        ]
        mes_label = f"{nomes_meses[int(month)]} de {year}"

    if intent == 'listar_funcionarios':
        if not resultados:
            return 'Nenhum funcionário ativo encontrado.'
        linhas = [f'Funcionários cadastrados ({len(resultados)}):']
        for r in resultados:
            cargo = f' — {r["cargo"]}' if r.get('cargo') else ''
            linhas.append(f'• {r["funcionario"]}{cargo}')
        return '\n'.join(linhas)

    if intent == 'ausentes_hoje':
        data_br = _format_date_br(data.get('data', ''))
        total = data.get('total_empresa', 0)
        com_reg = data.get('com_registro', 0)
        if not resultados:
            return f'Todos os {total} funcionário(s) ativo(s) já registraram ponto hoje ({data_br}).'
        linhas = [f'Funcionários sem registro de ponto hoje ({data_br}) — {len(resultados)} de {total}:']
        for r in resultados:
            cargo = f' — {r["cargo"]}' if r.get('cargo') else ''
            linhas.append(f'• {r["funcionario"]}{cargo}')
        return '\n'.join(linhas)

    if not resultados:
        if intent == 'atrasos_hoje':
            return 'Nenhum funcionário registrou atraso hoje.'
        if intent == 'faltas_do_mes':
            return f'Nenhuma falta registrada em {mes_label}.' if mes_label else 'Nenhuma falta encontrada.'
        if intent == 'horas_extras_periodo':
            periodo = f"de {_format_date_br(start_date)} a {_format_date_br(end_date)}" if start_date else f"em {mes_label}"
            return f'Nenhuma hora extra registrada {periodo}.'
        if intent == 'saldo_negativo':
            return f'Nenhum funcionário com saldo negativo em {mes_label}.' if mes_label else 'Nenhum saldo negativo encontrado.'
        return 'Nenhum resultado encontrado para essa consulta.'

    linhas = []

    if intent == 'faltas_do_mes':
        filtro = data.get('employee_name_filter')
        if filtro and len(resultados) == 1:
            r = resultados[0]
            nome = r['funcionario']
            dias = [_format_date_br(d) for d in r['dias_falta']]
            if not dias:
                return f'{nome} não teve faltas em {mes_label}.'
            if len(dias) <= 5:
                dias_str = ', '.join(dias)
                linhas.append(f'{nome} faltou {r["total"]} vez(es) em {mes_label}: {dias_str}.')
            else:
                linhas.append(f'{nome} faltou {r["total"]} vez(es) em {mes_label}:')
                for d in dias:
                    linhas.append(f'  • {d}')
        else:
            linhas.append(f'Faltas em {mes_label}:')
            for r in resultados:
                dias = [_format_date_br(d) for d in r['dias_falta']]
                if len(dias) <= 3:
                    dias_str = ', '.join(dias)
                    linhas.append(f'• {r["funcionario"]}: {r["total"]} falta(s) — {dias_str}')
                else:
                    # Mostrar as 3 primeiras e indicar quantas no total
                    primeiras = ', '.join(dias[:3])
                    linhas.append(f'• {r["funcionario"]}: {r["total"]} falta(s) — {primeiras}...')

    elif intent == 'atrasos_hoje':
        linhas.append(f'Funcionários com atraso hoje ({_format_date_br(data.get("data", ""))}):')
        for r in resultados:
            hora_real = r.get('horario_entrada', '')
            hora_esp = r.get('horario_esperado', '')
            if hora_esp and hora_real:
                detalhe = f' (esperado: {hora_esp}, registrou: {hora_real[:5]})'
            elif hora_real:
                detalhe = f' (entrada: {hora_real[:5]})'
            else:
                detalhe = ''
            linhas.append(
                f'• {r["funcionario"]}: {r["minutos_atraso"]} min de atraso{detalhe}'
            )

    elif intent == 'horas_extras_periodo':
        periodo = f"de {_format_date_br(start_date)} a {_format_date_br(end_date)}" if start_date else f"em {mes_label}"
        linhas.append(f'Horas extras {periodo}:')
        for r in resultados:
            linhas.append(f'• {r["funcionario"]}: {r["total_horas_extras"]}')

    elif intent == 'dias_trabalhados_funcionario':
        filtro = data.get('employee_name_filter')
        if filtro and len(resultados) == 1:
            r = resultados[0]
            linhas.append(f'{r["funcionario"]} trabalhou {r["dias_trabalhados"]} dia(s) em {mes_label}.')
        else:
            linhas.append(f'Dias trabalhados em {mes_label}:')
            for r in resultados:
                linhas.append(f'• {r["funcionario"]}: {r["dias_trabalhados"]} dia(s)')

    elif intent == 'resumo_mensal_funcionario':
        filtro = data.get('employee_name_filter')
        if filtro and len(resultados) == 1:
            r = resultados[0]
            linhas.append(f'Resumo de {r["funcionario"]} em {mes_label}:')
            linhas.append(f'• Dias trabalhados: {r["dias_trabalhados"]}')
            linhas.append(f'• Faltas: {r["dias_falta"]}')
            linhas.append(f'• Atrasos: {r["dias_atraso"]}')
            linhas.append(f'• Horas trabalhadas: {r["horas_trabalhadas"]}')
            linhas.append(f'• Horas extras: {r["horas_extras"]}')
            linhas.append(f'• Saldo final: {r["saldo_final"]}')
        else:
            linhas.append(f'Resumo mensal — {mes_label}:')
            for r in resultados:
                status_emoji = '🔴' if r['status'] == 'negative' else '🟢' if r['status'] == 'positive' else '⚪'
                linhas.append(
                    f'• {r["funcionario"]} {status_emoji} — '
                    f'{r["dias_trabalhados"]}d trabalhados, '
                    f'{r["dias_falta"]}f faltas, '
                    f'extras: {r["horas_extras"]}, saldo: {r["saldo_final"]}'
                )

    elif intent == 'saldo_negativo':
        linhas.append(f'Funcionários com saldo negativo em {mes_label}:')
        for r in resultados:
            linhas.append(f'• {r["funcionario"]}: {r["saldo"]} ({r["dias_falta"]} falta(s))')

    return '\n'.join(linhas)


# ---------------------------------------------------------------------------
# Dispatcher: mapeia intent -> função de consulta
# ---------------------------------------------------------------------------

def _dispatch(intent_data: dict, company_id: str) -> dict:
    """Executa a função interna correspondente ao intent."""
    intent = intent_data.get('intent', 'desconhecida')
    employee_name = intent_data.get('employee_name') or None
    raw_month = intent_data.get('month')
    raw_year = intent_data.get('year')

    # Defaults temporais
    today = date.today()
    month = int(raw_month) if raw_month else today.month
    year = int(raw_year) if raw_year else today.year

    if intent == 'listar_funcionarios':
        return listar_funcionarios(company_id)

    elif intent == 'faltas_hoje':
        return ausentes_hoje(company_id, employee_name)

    elif intent in ('faltas_mes', 'dias_falta_funcionario_mes'):
        return faltas_do_mes(company_id, employee_name, month, year)

    elif intent == 'atrasos_hoje':
        return atrasos_hoje(company_id, employee_name)

    elif intent == 'saldo_negativo':
        return saldo_negativo(company_id, month, year)

    elif intent == 'horas_extras_funcionario_mes':
        start_date = f"{year:04d}-{month:02d}-01"
        if month == 12:
            end_date = f"{year:04d}-12-31"
        else:
            last_day = (date(year, month + 1, 1) - timedelta(days=1)).day
            end_date = f"{year:04d}-{month:02d}-{last_day:02d}"
        return horas_extras_periodo(company_id, employee_name, start_date, end_date)

    elif intent == 'resumo_funcionario_mes':
        return resumo_mensal_funcionario(company_id, employee_name, month, year)

    elif intent == 'dias_trabalhados_funcionario_mes':
        return dias_trabalhados_funcionario(company_id, employee_name, month, year)

    else:
        return {
            'intent': 'desconhecida',
            'resultados': [],
            'mensagem': (
                'Não entendi sua pergunta. Tente perguntar sobre: '
                'faltas, atrasos, horas extras, saldo negativo, '
                'resumo de um funcionário ou listar funcionários.'
            ),
        }


# ---------------------------------------------------------------------------
# Endpoint principal
# ---------------------------------------------------------------------------

@chatbot_rh_routes.route('/api/chat/rh', methods=['POST', 'OPTIONS'])
@token_required
def chat_rh(payload):
    """
    Endpoint do chatbot de RH.

    Body: { "question": "Que dia Andreia faltou esse mês?" }

    Fluxo:
    1. Extrai company_id do JWT (nunca do body)
    2. Envia a pergunta ao Groq para parsear a intenção
    3. Dispara a função de consulta interna correspondente
    4. Retorna resposta em linguagem natural + dados estruturados
    """
    # company_id SEMPRE do JWT — nunca do frontend
    company_id = payload.get('company_id')
    if not company_id:
        return jsonify({'error': 'Empresa não identificada no token'}), 400

    body = request.get_json(silent=True) or {}
    question = (body.get('question') or '').strip()

    if not question:
        return jsonify({'error': 'Pergunta não fornecida'}), 400

    if len(question) > 500:
        return jsonify({'error': 'Pergunta muito longa (máximo 500 caracteres)'}), 400

    try:
        # 1. Parsear intenção com IA
        intent_data = _parse_intent_groq(question)
        used_fallback = False
    except ValueError as e:
        print(f'[CHATBOT] Erro de configuração Groq: {e}')
        intent_data = _parse_intent_local(question)
        used_fallback = True
    except requests.exceptions.HTTPError as e:
        print(f'[CHATBOT] Groq HTTP Error: {e} — response: {getattr(e.response, "text", "")[:300]}')
        intent_data = _parse_intent_local(question)
        used_fallback = True
    except requests.exceptions.RequestException as e:
        print(f'[CHATBOT] Groq RequestException: {type(e).__name__}: {e}')
        intent_data = _parse_intent_local(question)
        used_fallback = True
    except json.JSONDecodeError as e:
        print(f'[CHATBOT] Groq JSON parse error: {e}')
        intent_data = _parse_intent_local(question)
        used_fallback = True
    except Exception as e:
        print(f'[CHATBOT] Erro inesperado ao chamar Groq: {type(e).__name__}: {e}')
        intent_data = _parse_intent_local(question)
        used_fallback = True

    # 2. Se precisar de complemento, retornar imediatamente
    if intent_data.get('needs_clarification'):
        return jsonify({
            'type': 'clarification',
            'message': intent_data.get('clarification_question', 'Preciso de mais informações. Pode detalhar?'),
            'intent_data': None,
            'data': None,
        }), 200

    try:
        # 3. Executar consulta interna com company_id do token
        result = _dispatch(intent_data, company_id)
    except Exception as e:
        print(f'[CHATBOT] Erro ao executar consulta: {e}')
        return jsonify({'error': 'Erro ao buscar os dados. Tente novamente.'}), 500

    # 4. Formatar resposta em linguagem natural
    if result.get('intent') in ('desconhecido', 'desconhecida'):
        message = result.get('mensagem', 'Não entendi sua pergunta.')
    else:
        try:
            # Mesclar start_date/end_date do intent no result para formatação
            if intent_data.get('start_date') and 'start_date' not in result:
                result['start_date'] = intent_data['start_date']
            if intent_data.get('end_date') and 'end_date' not in result:
                result['end_date'] = intent_data['end_date']
            message = _formatar_resposta(result)
        except Exception as e:
            print(f'[CHATBOT] Erro ao formatar resposta: {e}')
            message = 'Dados encontrados, mas houve um erro ao formatar a resposta.'

    # 5. Identificar employee_id para link opcional de espelho
    employee_id_link = None
    resultados = result.get('resultados', [])
    if len(resultados) == 1 and resultados[0].get('employee_id'):
        employee_id_link = resultados[0]['employee_id']
        employee_name_link = resultados[0].get('funcionario')
    else:
        employee_name_link = None

    return jsonify({
        'type': 'answer',
        'message': message,
        'intent': result.get('intent'),
        'data': result,
        'used_fallback': used_fallback,
        'employee_link': {
            'employee_id': employee_id_link,
            'employee_name': employee_name_link,
        } if employee_id_link else None,
    }), 200
