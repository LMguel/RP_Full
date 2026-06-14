"""
Módulo RH / Pré-Folha — RegistraPonto (Plano Plus)
Gestão de competências, cálculo de pré-folha e exportação.
NÃO implementa INSS, FGTS, IRRF, eSocial, férias, rescisão ou obrigações legais.
"""
from flask import Blueprint, jsonify, request
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional
from boto3.dynamodb.conditions import Key, Attr
from concurrent.futures import ThreadPoolExecutor
import boto3
import calendar
import os

from utils.auth import verify_token
from services.payroll_engine import compute_worked_data
from services.payroll_rules import calcular_prefolha

payroll_routes = Blueprint('payroll_routes', __name__)

dynamodb             = boto3.resource('dynamodb', region_name='us-east-1')
table_employees      = dynamodb.Table('Employees')
table_payroll_config = dynamodb.Table('PayrollConfig')
table_competencia    = dynamodb.Table('PayrollCompetencia')
table_emp_config     = dynamodb.Table('PayrollEmployeeConfig')
table_pre_folha      = dynamodb.Table('PayrollPreFolha')
table_config         = dynamodb.Table(os.environ.get('DYNAMODB_TABLE_CONFIG', 'ConfigCompany'))


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _auth(req) -> Optional[Dict[str, Any]]:
    token = req.headers.get('Authorization', '').replace('Bearer ', '')
    return verify_token(token)


def _pq(table, **kw) -> List[Dict]:
    items, last = [], None
    while True:
        p = dict(kw)
        if last:
            p['ExclusiveStartKey'] = last
        r = table.query(**p)
        items.extend(r.get('Items', []))
        last = r.get('LastEvaluatedKey')
        if not last:
            break
    return items


def _ps(table, **kw) -> List[Dict]:
    items, last = [], None
    while True:
        p = dict(kw)
        if last:
            p['ExclusiveStartKey'] = last
        r = table.scan(**p)
        items.extend(r.get('Items', []))
        last = r.get('LastEvaluatedKey')
        if not last:
            break
    return items


def _j(obj: Any) -> Any:
    """Converte Decimal para float recursivamente (serialização JSON)."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _j(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_j(v) for v in obj]
    return obj


def _to_dec(v: Any) -> Decimal:
    if isinstance(v, Decimal):
        return v
    try:
        return Decimal(str(v or 0))
    except Exception:
        return Decimal('0')


# ─── Feature guard ────────────────────────────────────────────────────────────

@payroll_routes.before_request
def _guard_rh_feature():
    if request.method == 'OPTIONS':
        return None
    if (request.endpoint or '').endswith('get_company_features'):
        return None
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid = payload.get('company_id')
    try:
        cfg = table_config.get_item(Key={'company_id': cid}).get('Item', {})
        if not cfg.get('rh_enabled', False):
            return jsonify({'error': 'FEATURE_NOT_ENABLED', 'message': 'RH/Folha disponível apenas no plano Plus. Entre em contato para solicitar upgrade.'}), 403
    except Exception:
        pass  # fail-open: não bloquear se ConfigCompany inacessível


@payroll_routes.route('/api/company/features', methods=['GET', 'OPTIONS'])
def get_company_features():
    if request.method == 'OPTIONS':
        return '', 200
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid = payload.get('company_id')
    try:
        cfg = table_config.get_item(Key={'company_id': cid}).get('Item', {})
        return jsonify({'rh_enabled': bool(cfg.get('rh_enabled', False))})
    except Exception:
        return jsonify({'rh_enabled': False})


# ─── Configuração da empresa ───────────────────────────────────────────────────

@payroll_routes.route('/api/rh/config', methods=['GET'])
def get_payroll_config():
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid = payload.get('company_id')
    try:
        item = _j(table_payroll_config.get_item(Key={'company_id': cid}).get('Item', {}))
        defaults = {
            'company_id': cid,
            'mode': 'simulacao',
            'banco_horas_mode': 'pagar',
            'percentual_extra_util': 50,
            'percentual_domingo': 100,
            'percentual_feriado': 100,
            'percentual_noturno': 22,
            'arredondamento': 0,
            'descontar_atraso': True,
            'descontar_saida_antecipada': True,
            'considerar_tolerancia': True,
        }
        defaults.update(item)
        return jsonify(defaults)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payroll_routes.route('/api/rh/config', methods=['PUT'])
def save_payroll_config():
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid  = payload.get('company_id')
    data = request.json or {}
    data['company_id']    = cid
    data['atualizado_em'] = datetime.utcnow().isoformat()
    for k in ('percentual_extra_util', 'percentual_domingo', 'percentual_feriado',
              'percentual_noturno', 'arredondamento'):
        if k in data:
            data[k] = _to_dec(data[k])
    try:
        table_payroll_config.put_item(Item=data)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Configuração salarial do funcionário ────────────────────────────────────

@payroll_routes.route('/api/rh/funcionario/<eid>/config', methods=['GET'])
def get_emp_payroll_config(eid: str):
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid = payload.get('company_id')
    try:
        item = _j(table_emp_config.get_item(Key={'company_id': cid, 'employee_id': eid}).get('Item', {}))
        defaults = {
            'company_id': cid, 'employee_id': eid,
            'tipo_remuneracao': 'mensalista', 'salario_base': 0, 'valor_hora': 0,
            'banco_horas_mode': 'pagar', 'recebe_hora_extra': True,
            'recebe_adicional_feriado': True, 'recebe_adicional_domingo': True,
            'observacoes_rh': '',
        }
        defaults.update(item)
        return jsonify(defaults)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payroll_routes.route('/api/rh/funcionario/<eid>/config', methods=['PUT'])
def save_emp_payroll_config(eid: str):
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid  = payload.get('company_id')
    data = request.json or {}
    data['company_id']    = cid
    data['employee_id']   = eid
    data['atualizado_em'] = datetime.utcnow().isoformat()
    for k in ('salario_base', 'valor_hora'):
        if k in data and data[k] is not None:
            data[k] = _to_dec(data[k])
    try:
        table_emp_config.put_item(Item=data)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Configuração em lote (todos os funcionários) ────────────────────────────

@payroll_routes.route('/api/rh/funcionarios/configs', methods=['GET'])
def list_emp_configs():
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid = payload.get('company_id')
    try:
        items = _ps(table_emp_config, FilterExpression=Attr('company_id').eq(cid))
        return jsonify({'configs': _j(items)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Competências ─────────────────────────────────────────────────────────────

@payroll_routes.route('/api/rh/competencias', methods=['GET'])
def list_competencias():
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid = payload.get('company_id')
    try:
        items = _pq(table_competencia, KeyConditionExpression=Key('company_id').eq(cid))
        items.sort(key=lambda x: x.get('competencia', ''), reverse=True)
        return jsonify({'competencias': _j(items)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payroll_routes.route('/api/rh/competencias', methods=['POST'])
def create_competencia():
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid  = payload.get('company_id')
    data = request.json or {}
    now  = datetime.now()
    comp = data.get('competencia') or f"{now.year}-{now.month:02d}"
    try:
        if table_competencia.get_item(Key={'company_id': cid, 'competencia': comp}).get('Item'):
            return jsonify({'error': 'Competência já existe'}), 400
        item = {
            'company_id': cid, 'competencia': comp,
            'status': 'ABERTA', 'criada_em': datetime.utcnow().isoformat(),
            'total_salarios': Decimal('0'), 'total_extras': Decimal('0'),
            'total_faltas': Decimal('0'), 'total_folha': Decimal('0'),
        }
        table_competencia.put_item(Item=item)
        return jsonify({'success': True, 'competencia': _j(item)}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payroll_routes.route('/api/rh/competencias/<comp>', methods=['GET'])
def get_competencia(comp: str):
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid = payload.get('company_id')
    try:
        item = table_competencia.get_item(Key={'company_id': cid, 'competencia': comp}).get('Item')
        if not item:
            return jsonify({'error': 'Competência não encontrada'}), 404
        return jsonify(_j(item))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Cálculo da pré-folha ─────────────────────────────────────────────────────

@payroll_routes.route('/api/rh/pre-folha/<comp>', methods=['GET'])
def get_pre_folha(comp: str):
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid = payload.get('company_id')
    try:
        items = _ps(table_pre_folha,
                    FilterExpression=Attr('company_id').eq(cid) & Attr('competencia').eq(comp))
        items.sort(key=lambda x: x.get('nome', ''))
        return jsonify({'pre_folha': _j(items)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payroll_routes.route('/api/rh/calcular/<comp>', methods=['POST'])
def calcular_pre_folha(comp: str):
    """Calcula (ou recalcula) pré-folha para todos os funcionários da competência."""
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid = payload.get('company_id')
    try:
        comp_item = table_competencia.get_item(Key={'company_id': cid, 'competencia': comp}).get('Item')
        if not comp_item:
            # Auto-cria competência ao calcular pela primeira vez
            now = datetime.utcnow().isoformat()
            table_competencia.put_item(Item={
                'company_id': cid, 'competencia': comp,
                'status': 'ABERTA', 'criado_em': now,
                'total_folha': Decimal('0'), 'total_extras': Decimal('0'),
                'total_faltas': Decimal('0'), 'total_salarios': Decimal('0'),
            })
            comp_item = {'status': 'ABERTA'}
        if str(comp_item.get('status', '')).upper() == 'FECHADA':
            return jsonify({'error': 'Competência fechada não pode ser recalculada'}), 400

        table_competencia.update_item(
            Key={'company_id': cid, 'competencia': comp},
            UpdateExpression='SET #s = :s',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={':s': 'PROCESSANDO'},
        )

        # Config da empresa
        cfg = _j(table_payroll_config.get_item(Key={'company_id': cid}).get('Item', {}))
        cfg.setdefault('percentual_extra_util', 50)
        cfg.setdefault('percentual_feriado', 100)
        cfg.setdefault('percentual_domingo', 100)
        cfg.setdefault('descontar_atraso', True)
        cfg.setdefault('banco_horas_mode', 'pagar')

        # Funcionários ativos
        employees = _pq(table_employees, KeyConditionExpression=Key('company_id').eq(cid))
        employees = [e for e in employees if e.get('is_active', e.get('ativo', True))]

        def process(emp):
            eid = str(emp.get('employee_id') or emp.get('funcionario_id') or emp.get('id') or '')
            try:
                ec = _j(table_emp_config.get_item(Key={'company_id': cid, 'employee_id': eid}).get('Item', {}))
            except Exception:
                ec = {}
            ec.setdefault('tipo_remuneracao', 'mensalista')
            ec.setdefault('salario_base', 0)
            ec.setdefault('recebe_hora_extra', True)
            ec.setdefault('recebe_adicional_feriado', True)
            ec.setdefault('recebe_adicional_domingo', True)

            try:
                worked = compute_worked_data(cid, eid, comp, emp)
            except Exception:
                worked = {
                    'horas_previstas': 176, 'horas_trabalhadas': 0,
                    'horas_extras': 0, 'horas_falta': 0,
                    'horas_feriado': 0, 'horas_domingo': 0,
                    'horas_abonadas': 0, 'atraso_minutos': 0, 'banco_horas': 0,
                    'dias_uteis': 22, 'dias_trabalhados': 0,
                }

            r = calcular_prefolha(ec, worked, cfg)
            r['company_id']       = cid
            r['employee_id']      = eid
            r['nome']             = emp.get('nome', 'N/A')
            r['competencia']      = comp
            r['status']           = 'CALCULADO'
            r['calculado_em']     = datetime.utcnow().isoformat()
            r['dias_uteis']       = worked.get('dias_uteis', 22)
            r['dias_trabalhados'] = worked.get('dias_trabalhados', 0)
            return r

        max_w = min(30, max(1, len(employees)))
        with ThreadPoolExecutor(max_workers=max_w) as pool:
            resultados = list(pool.map(process, employees))

        ts = te = tf = tfo = Decimal('0')
        with table_pre_folha.batch_writer() as bw:
            for r in resultados:
                item = {k: _to_dec(v) if isinstance(v, float) else v for k, v in r.items()}
                bw.put_item(Item=item)
                ts  += _to_dec(r.get('salario_base', 0))
                te  += _to_dec(r.get('valor_extras', 0))
                tf  += _to_dec(r.get('desconto_falta', 0))
                tfo += _to_dec(r.get('total', 0))

        table_competencia.update_item(
            Key={'company_id': cid, 'competencia': comp},
            UpdateExpression='SET #s=:s, total_salarios=:ts, total_extras=:te, total_faltas=:tf, total_folha=:tfo, calculado_em=:ce',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':s': 'ABERTA',
                ':ts': ts.quantize(Decimal('0.01')),
                ':te': te.quantize(Decimal('0.01')),
                ':tf': tf.quantize(Decimal('0.01')),
                ':tfo': tfo.quantize(Decimal('0.01')),
                ':ce': datetime.utcnow().isoformat(),
            },
        )

        return jsonify({
            'success': True,
            'total_funcionarios': len(resultados),
            'total_folha': float(tfo),
            'pre_folha': _j(resultados),
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ─── Fechamento ───────────────────────────────────────────────────────────────

@payroll_routes.route('/api/rh/fechar/<comp>', methods=['POST'])
def fechar_competencia(comp: str):
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid = payload.get('company_id')
    try:
        table_competencia.update_item(
            Key={'company_id': cid, 'competencia': comp},
            UpdateExpression='SET #s=:s, fechada_em=:fe',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={':s': 'FECHADA', ':fe': datetime.utcnow().isoformat()},
        )
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payroll_routes.route('/api/rh/reabrir/<comp>', methods=['POST'])
def reabrir_competencia(comp: str):
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid = payload.get('company_id')
    try:
        table_competencia.update_item(
            Key={'company_id': cid, 'competencia': comp},
            UpdateExpression='SET #s=:s',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={':s': 'ABERTA'},
        )
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Exportação ───────────────────────────────────────────────────────────────

@payroll_routes.route('/api/rh/exportar/<comp>', methods=['GET'])
def exportar_pre_folha(comp: str):
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid = payload.get('company_id')
    try:
        items = _ps(table_pre_folha,
                    FilterExpression=Attr('company_id').eq(cid) & Attr('competencia').eq(comp))
        rows = []
        for i in items:
            rows.append({
                'Funcionário':         i.get('nome', ''),
                'Tipo':                'Mensalista' if i.get('tipo_remuneracao') == 'mensalista' else 'Horista',
                'Salário Base':        float(_to_dec(i.get('salario_base', 0))),
                'Horas Previstas':     float(_to_dec(i.get('horas_previstas', 0))),
                'Horas Trabalhadas':   float(_to_dec(i.get('horas_trabalhadas', 0))),
                'Horas Extras':        float(_to_dec(i.get('horas_extras', 0))),
                'Banco de Horas':      float(_to_dec(i.get('banco_horas', 0))),
                'Faltas (h)':          float(_to_dec(i.get('horas_falta', 0))),
                'Valor Extras':        float(_to_dec(i.get('valor_extras', 0))),
                'Adicional Feriado':   float(_to_dec(i.get('valor_feriado', 0))),
                'Adicional Domingo':   float(_to_dec(i.get('valor_domingo', 0))),
                'Desconto Falta':      float(_to_dec(i.get('desconto_falta', 0))),
                'Desconto Atraso':     float(_to_dec(i.get('desconto_atraso', 0))),
                'Total Estimado':      float(_to_dec(i.get('total', 0))),
            })
        rows.sort(key=lambda x: x['Funcionário'])
        return jsonify({'rows': rows, 'competencia': comp, 'total': len(rows)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Dashboard RH ─────────────────────────────────────────────────────────────

@payroll_routes.route('/api/rh/dashboard', methods=['GET'])
def get_rh_dashboard():
    payload = _auth(request)
    if not payload:
        return jsonify({'error': 'Não autorizado'}), 401
    cid = payload.get('company_id')
    now  = datetime.now()
    comp = f"{now.year}-{now.month:02d}"

    comp_item: Dict[str, Any] = {}
    try:
        comp_item = _j(table_competencia.get_item(
            Key={'company_id': cid, 'competencia': comp}
        ).get('Item', {}))
    except Exception:
        pass

    items: List[Dict] = []
    try:
        items = _ps(table_pre_folha,
                    FilterExpression=Attr('company_id').eq(cid) & Attr('competencia').eq(comp))
    except Exception:
        pass

    total_func = len(items)
    fechados   = sum(1 for i in items if str(i.get('status', '')).upper() == 'APROVADO')
    com_extra  = sum(1 for i in items if float(_to_dec(i.get('horas_extras', 0))) > 0)
    com_falta  = sum(1 for i in items if float(_to_dec(i.get('horas_falta', 0))) > 0)

    return jsonify({
        'competencia':           comp,
        'total_salarios':        comp_item.get('total_salarios', 0),
        'total_extras':          comp_item.get('total_extras', 0),
        'total_faltas':          comp_item.get('total_faltas', 0),
        'total_folha':           comp_item.get('total_folha', 0),
        'total_funcionarios':    total_func,
        'funcionarios_fechados': fechados,
        'com_extra':             com_extra,
        'com_falta':             com_falta,
        'status_competencia':    comp_item.get('status'),
    })
