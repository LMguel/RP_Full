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

            # Leitura robusta: procura TODAS as chaves feriados_{ano}* no item
            # (independente do UF), fazendo merge por data. Isso torna a leitura
            # tolerante a divergências de UF entre o salvamento e a leitura.
            prefixo = f'feriados_{ano}'
            merged = {}
            for k, raw in item.items():
                if not k.startswith(prefixo):
                    continue
                try:
                    lista = json.loads(raw) if isinstance(raw, str) else raw
                except Exception:
                    continue
                if not isinstance(lista, list):
                    continue
                for h in lista:
                    data = h.get('date') or h.get('data')
                    if data:
                        merged[str(data)] = h  # chave mais recente sobrescreve

            feriados = sorted(merged.values(), key=lambda h: str(h.get('date') or h.get('data') or ''))
            print(f"[FERIADOS] GET ano={ano} uf={uf!r} company={company_id} -> {len(feriados)} feriados (chaves: {[k for k in item.keys() if k.startswith(prefixo)]})")
            return jsonify(feriados), 200
        except Exception as e:
            print(f"[FERIADOS] Erro na leitura: {e}")

        return jsonify([]), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── POST /api/feriados/salvar-localizacao ────────────────────────────────────

@feriados_routes.route('/api/feriados/salvar-localizacao', methods=['POST', 'OPTIONS'])
def salvar_localizacao():
    """Salva apenas a UF e cidade da empresa como padrão para feriados."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    try:
        data = request.get_json(force=True) or {}
        uf     = data.get('uf', '')
        cidade = data.get('cidade', '')

        company_id = 'global'
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            payload = verify_token(token)
            if payload:
                company_id = payload.get('company_id') or 'global'

        if not uf:
            return jsonify({'error': 'uf obrigatório'}), 400

        update_expr = 'SET empresa_uf = :uf'
        expr_values = {':uf': uf}
        if cidade:
            update_expr += ', empresa_cidade = :cidade'
            expr_values[':cidade'] = cidade

        tabela_configuracoes.update_item(
            Key={'company_id': company_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
        )
        return jsonify({'ok': True, 'uf': uf, 'cidade': cidade}), 200

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

        # Salvar apenas feriados ATIVOS reduz ruído; o front controla active/inactive,
        # mas para crédito no espelho só importam os ativos. Persistimos todos para
        # preservar o estado de edição, e a leitura filtra por active.
        try:
            update_expr = 'SET #campo = :val'
            expr_names  = {'#campo': campo}
            expr_values = {':val': json.dumps(feriados, ensure_ascii=False)}
            # Sempre persistir UF/cidade quando informados (chave de localização da empresa)
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
            print(f"[FERIADOS] SALVO company={company_id} campo={campo} uf={uf!r} -> {len(feriados)} feriados")
        except Exception as e:
            # NÃO silenciar: o gestor precisa saber se a gravação falhou
            print(f"[FERIADOS] ERRO ao salvar: {e}")
            return jsonify({'error': f'Falha ao salvar feriados: {str(e)}'}), 500

        return jsonify({'ok': True, 'saved': len(feriados)}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
