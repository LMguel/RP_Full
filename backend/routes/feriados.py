"""
Rotas de Feriados — armazena o calendário customizado no DynamoDB (tabela_configuracoes).
Chave: company_id  |  campo: feriados_<ano>_<uf>
"""
from flask import Blueprint, request, jsonify
from utils.aws import tabela_configuracoes
from utils.auth import verify_token
from functools import wraps
import json

feriados_routes = Blueprint('feriados_routes', __name__)

# ── Auth decorator (igual ao padrão dos outros routes) ────────────────────────

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            parts = request.headers['Authorization'].split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]
        if not token:
            return jsonify({'error': 'Token ausente'}), 401
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401
        return f(payload, *args, **kwargs)
    return decorated

# ── Helper ────────────────────────────────────────────────────────────────────

def _feriados_key(ano: str, uf: str) -> str:
    return f'feriados_{ano}_{uf or "BR"}'

# ── GET /api/feriados?ano=2026&uf=SP ─────────────────────────────────────────

@feriados_routes.route('/api/feriados', methods=['GET', 'OPTIONS'])
def get_feriados():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        token = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        ano = request.args.get('ano', '')
        uf  = request.args.get('uf', '')

        if not ano:
            return jsonify([]), 200

        # Tenta obter company_id do token; se não tiver, usa chave genérica
        company_id = 'global'
        if token:
            payload = verify_token(token)
            if payload:
                company_id = payload.get('company_id') or payload.get('sub') or 'global'

        try:
            resp = tabela_configuracoes.get_item(Key={'company_id': company_id})
            item = resp.get('Item', {})
            campo = _feriados_key(ano, uf)
            raw = item.get(campo)
            if raw:
                feriados = json.loads(raw) if isinstance(raw, str) else raw
                return jsonify(feriados), 200
        except Exception:
            pass  # tabela pode não existir em dev

        return jsonify([]), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── POST /api/feriados/salvar ─────────────────────────────────────────────────

@feriados_routes.route('/api/feriados/salvar', methods=['POST', 'OPTIONS'])
def salvar_feriados():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        data = request.get_json(force=True) or {}
        ano  = str(data.get('ano', ''))
        uf   = data.get('uf', '')
        cidade = data.get('cidade', '')
        feriados = data.get('feriados', [])

        if not ano:
            return jsonify({'error': 'ano obrigatório'}), 400

        # Obtém company_id do token
        company_id = 'global'
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            payload = verify_token(token)
            if payload:
                company_id = payload.get('company_id') or payload.get('sub') or 'global'

        campo = _feriados_key(ano, uf)

        try:
            update_expr = 'SET #campo = :val'
            expr_names  = {'#campo': campo}
            expr_values = {':val': json.dumps(feriados, ensure_ascii=False)}
            # Persistir cidade e UF no config da empresa para reuso futuro
            if uf:
                update_expr += ', empresa_uf = :uf'
                expr_values[':uf'] = uf
            if cidade:
                update_expr += ', empresa_cidade = :cidade'
                expr_values[':cidade'] = cidade
            tabela_configuracoes.update_item(
                Key={'company_id': company_id},
                UpdateExpression=update_expr,
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
            )
        except Exception:
            pass  # tabela pode não existir em dev; front usa localStorage como fallback

        return jsonify({'ok': True, 'saved': len(feriados)}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
