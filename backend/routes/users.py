# backend/routes/users.py
"""
Gerenciamento de usuários da empresa.

GET    /api/users                           — listar usuários (autenticado)
POST   /api/users                           — criar usuário (criar_usuario)
PUT    /api/users/<user_id>                 — editar usuário (editar_usuario)
DELETE /api/users/<user_id>                 — excluir usuário (criar_usuario)
POST   /api/users/<user_id>/toggle-active   — ativar/desativar (editar_usuario)
"""
from __future__ import annotations
from flask import Blueprint, request, jsonify
import boto3
import os
import bcrypt
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key
from utils.auth import token_required, require_permission
from services.permissions import ALLOWED_ROLES_FOR_NEW, calculate_permissions
from services.audit_service import log_event

users_routes = Blueprint('users_routes', __name__)

_dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
_table_users = _dynamodb.Table(os.environ.get('DYNAMODB_TABLE_USERS', 'UserCompany'))


def _get_company_users(company_id: str) -> list:
    resp = _table_users.query(
        KeyConditionExpression=Key('company_id').eq(company_id)
    )
    return resp.get('Items', [])


def _sanitize(u: dict) -> dict:
    """Remove campos sensíveis antes de retornar para o frontend."""
    u = dict(u)
    u.pop('senha_hash', None)
    u.pop('senha', None)
    return u


# ── GET /api/users ──────────────────────────────────────────────────────────

@users_routes.route('/api/users', methods=['GET', 'OPTIONS'])
@token_required
def list_users(payload):
    if request.method == 'OPTIONS':
        return '', 200
    company_id = payload.get('company_id')
    if not company_id:
        return jsonify({'error': 'company_id ausente no token'}), 400
    users = [_sanitize(u) for u in _get_company_users(company_id)]
    return jsonify({'users': users}), 200


# ── POST /api/users ─────────────────────────────────────────────────────────

@users_routes.route('/api/users', methods=['POST', 'OPTIONS'])
@token_required
@require_permission('criar_usuario')
def create_user(payload):
    if request.method == 'OPTIONS':
        return '', 200

    company_id = payload.get('company_id')
    data = request.get_json() or {}

    name      = (data.get('name') or '').strip()
    user_id   = (data.get('user_id') or '').strip()
    senha     = (data.get('senha') or '')
    role      = (data.get('role') or 'VIEWER')
    email     = (data.get('email') or '').strip()
    overrides = data.get('permissions', {'add': [], 'remove': []})

    if not name or not user_id or not senha:
        return jsonify({'error': 'name, user_id e senha são obrigatórios'}), 400
    if len(user_id) < 3:
        return jsonify({'error': 'user_id deve ter ao menos 3 caracteres'}), 400
    if len(senha) < 6:
        return jsonify({'error': 'senha deve ter ao menos 6 caracteres'}), 400
    if role not in ALLOWED_ROLES_FOR_NEW:
        return jsonify({'error': f'Role inválido. Permitidos: {ALLOWED_ROLES_FOR_NEW}'}), 400

    # Verificar unicidade do user_id via GSI
    try:
        existing = _table_users.query(
            IndexName='user_id-index',
            KeyConditionExpression=Key('user_id').eq(user_id),
        )
        if existing.get('Items'):
            return jsonify({'error': 'usuario_id já existe no sistema'}), 409
    except Exception as e:
        # GSI pode não existir ainda em dev — fallback permissivo
        print(f"[USERS] GSI user_id-index indisponível: {e}")

    now       = datetime.now(timezone.utc).isoformat()
    hash_pwd  = bcrypt.hashpw(senha.encode(), bcrypt.gensalt()).decode()
    caller_id = payload.get('usuario_id', payload.get('user_id', ''))

    item: dict = {
        'company_id':  company_id,
        'user_id':     user_id,
        'name':        name,
        'email':       email,
        'role':        role,
        'permissions': overrides,
        'active':      True,
        'senha_hash':  hash_pwd,
        'empresa_nome': payload.get('empresa_nome', ''),
        'created_by':  caller_id,
        'created_at':  now,
        'updated_at':  now,
        'updated_by':  caller_id,
    }
    _table_users.put_item(Item=item)

    log_event(
        company_id=company_id, user_id=caller_id,
        user_name=payload.get('empresa_nome', ''),
        entity='USER', entity_id=user_id, action='CREATE',
        before=None, after={'user_id': user_id, 'role': role, 'name': name},
        request=request,
    )

    return jsonify({'user': _sanitize(item)}), 201


# ── PUT /api/users/<user_id> ─────────────────────────────────────────────────

@users_routes.route('/api/users/<target_user_id>', methods=['PUT', 'OPTIONS'])
@token_required
@require_permission('editar_usuario')
def update_user(payload, target_user_id):
    if request.method == 'OPTIONS':
        return '', 200

    company_id = payload.get('company_id')
    resp = _table_users.get_item(Key={'company_id': company_id, 'user_id': target_user_id})
    existing = resp.get('Item')
    if not existing:
        return jsonify({'error': 'Usuário não encontrado'}), 404

    caller_role = payload.get('role', 'OWNER')
    # Somente OWNER pode alterar outro OWNER
    if existing.get('role') == 'OWNER' and caller_role != 'OWNER':
        return jsonify({'error': 'Somente o OWNER pode editar o OWNER'}), 403

    data   = request.get_json() or {}
    now    = datetime.now(timezone.utc).isoformat()
    caller = payload.get('usuario_id', payload.get('user_id', ''))

    before = {k: existing.get(k) for k in ['name', 'email', 'role', 'permissions', 'active']}

    expr_parts: list[str] = ['updated_at = :ua', 'updated_by = :ub']
    vals: dict = {':ua': now, ':ub': caller}
    names: dict = {}

    if 'name' in data:
        expr_parts.append('#nm = :name')
        vals[':name'] = data['name']
        names['#nm'] = 'name'

    if 'email' in data:
        expr_parts.append('email = :email')
        vals[':email'] = data['email']

    if 'role' in data and existing.get('role') != 'OWNER':
        new_role = data['role']
        if new_role not in ALLOWED_ROLES_FOR_NEW:
            return jsonify({'error': f'Role inválido. Permitidos: {ALLOWED_ROLES_FOR_NEW}'}), 400
        expr_parts.append('#role = :role')
        vals[':role'] = new_role
        names['#role'] = 'role'

    if 'permissions' in data:
        expr_parts.append('permissions = :perms')
        vals[':perms'] = data['permissions']

    if 'active' in data and existing.get('role') != 'OWNER':
        expr_parts.append('active = :active')
        vals[':active'] = bool(data['active'])

    kwargs: dict = {
        'Key': {'company_id': company_id, 'user_id': target_user_id},
        'UpdateExpression': 'SET ' + ', '.join(expr_parts),
        'ExpressionAttributeValues': vals,
        'ReturnValues': 'ALL_NEW',
    }
    if names:
        kwargs['ExpressionAttributeNames'] = names

    result    = _table_users.update_item(**kwargs)
    after_item = result.get('Attributes', {})
    after = {k: after_item.get(k) for k in ['name', 'email', 'role', 'permissions', 'active']}

    log_event(
        company_id=company_id, user_id=caller,
        user_name=payload.get('empresa_nome', ''),
        entity='USER', entity_id=target_user_id, action='EDIT',
        before=before, after=after, request=request,
    )

    return jsonify({'user': _sanitize(after_item)}), 200


# ── DELETE /api/users/<user_id> ──────────────────────────────────────────────

@users_routes.route('/api/users/<target_user_id>', methods=['DELETE', 'OPTIONS'])
@token_required
@require_permission('criar_usuario')
def delete_user(payload, target_user_id):
    if request.method == 'OPTIONS':
        return '', 200

    company_id = payload.get('company_id')
    resp = _table_users.get_item(Key={'company_id': company_id, 'user_id': target_user_id})
    existing = resp.get('Item')
    if not existing:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    if existing.get('role') == 'OWNER':
        return jsonify({'error': 'Não é possível excluir o OWNER'}), 403

    caller = payload.get('usuario_id', payload.get('user_id', ''))
    if target_user_id == caller:
        return jsonify({'error': 'Não é possível excluir o próprio usuário'}), 403

    _table_users.delete_item(Key={'company_id': company_id, 'user_id': target_user_id})

    log_event(
        company_id=company_id, user_id=caller,
        user_name=payload.get('empresa_nome', ''),
        entity='USER', entity_id=target_user_id, action='DELETE',
        before={'user_id': target_user_id, 'role': existing.get('role'), 'name': existing.get('name')},
        after=None, request=request,
    )

    return jsonify({'message': 'Usuário excluído com sucesso'}), 200


# ── POST /api/users/<user_id>/toggle-active ───────────────────────────────────

@users_routes.route('/api/users/<target_user_id>/toggle-active', methods=['POST', 'OPTIONS'])
@token_required
@require_permission('editar_usuario')
def toggle_user_active(payload, target_user_id):
    if request.method == 'OPTIONS':
        return '', 200

    company_id = payload.get('company_id')
    resp = _table_users.get_item(Key={'company_id': company_id, 'user_id': target_user_id})
    existing = resp.get('Item')
    if not existing:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    if existing.get('role') == 'OWNER':
        return jsonify({'error': 'Não é possível desativar o OWNER'}), 403

    new_active = not bool(existing.get('active', True))
    now    = datetime.now(timezone.utc).isoformat()
    caller = payload.get('usuario_id', payload.get('user_id', ''))

    _table_users.update_item(
        Key={'company_id': company_id, 'user_id': target_user_id},
        UpdateExpression='SET active = :a, updated_at = :now, updated_by = :by',
        ExpressionAttributeValues={':a': new_active, ':now': now, ':by': caller},
    )

    log_event(
        company_id=company_id, user_id=caller,
        user_name=payload.get('empresa_nome', ''),
        entity='USER', entity_id=target_user_id, action='EDIT',
        before={'active': not new_active}, after={'active': new_active},
        request=request,
    )

    return jsonify({'active': new_active, 'user_id': target_user_id}), 200
