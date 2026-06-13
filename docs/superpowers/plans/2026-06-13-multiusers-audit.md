# Multi-usuários + Auditoria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar suporte a múltiplos usuários por empresa com roles/permissões e trilha completa de auditoria.

**Architecture:** Estende a tabela DynamoDB `UserCompany` (company_id HASH + user_id RANGE) com campos de role/permissions, cria um novo GSI `user_id-index` para substituir o scan do login por query, e uma nova tabela `AuditLogs`. JWT passa a incluir `role` e `permissions` calculadas; JWTs antigos (sem `role`) são tratados como OWNER.

**Tech Stack:** Python/Flask + DynamoDB (boto3) + bcrypt + PyJWT · React 19 + TypeScript + MUI 7 + Framer Motion

---

## Arquivos — mapa completo

**Criar:**
- `backend/services/permissions.py`
- `backend/services/audit_service.py`
- `backend/routes/users.py`
- `backend/routes/audit.py`
- `backend/migrations/migrate_users_roles.py`
- `front/src/components/PermissionGuard.tsx`
- `front/src/pages/AuditPage.tsx`
- `front/src/components/UsersSettings.tsx`

**Modificar:**
- `backend/utils/auth.py` — adicionar `require_permission`
- `backend/utils/aws.py` — constante `DYNAMODB_TABLE_AUDIT`
- `backend/routes/__init__.py` — registrar blueprints
- `backend/routes/api.py` — login JWT com role+permissions + audit LOGIN
- `front/src/types/index.ts` — `UserRole`, `CompanyUser`, `AuditLog`, `Permission`
- `front/src/contexts/AuthContext.tsx` — `role`, `permissions`, `hasPermission`
- `front/src/services/api.ts` — endpoints users + audit
- `front/src/components/Layout.tsx` — guards de menu + item Auditoria
- `front/src/pages/SettingsPage.tsx` — import + render `<UsersSettings>`
- `front/src/App.tsx` — rota `/auditoria`

---

## Task 1: Serviço de permissões

**Files:**
- Create: `backend/services/permissions.py`

- [ ] **Criar o arquivo**

```python
# backend/services/permissions.py
from __future__ import annotations

ALL_PERMISSIONS: list[str] = [
    "dashboard", "funcionarios", "registros", "correcoes",
    "rh_folha", "configuracoes", "exportacoes", "ajustes",
    "excluir", "criar_usuario", "editar_usuario",
    "fechar_competencia", "reconhecimento", "admin_aws",
]

ROLE_DEFAULTS: dict[str, list[str]] = {
    'OWNER': list(ALL_PERMISSIONS),
    'ADMIN': [
        "dashboard", "funcionarios", "registros", "correcoes", "rh_folha",
        "configuracoes", "exportacoes", "ajustes", "excluir",
        "editar_usuario", "fechar_competencia", "reconhecimento",
    ],
    'RH': [
        "dashboard", "funcionarios", "registros", "correcoes", "rh_folha",
        "exportacoes", "ajustes", "fechar_competencia",
    ],
    'MANAGER': ["dashboard", "funcionarios", "registros", "correcoes", "ajustes"],
    'VIEWER':  ["dashboard", "funcionarios", "registros"],
}

ALLOWED_ROLES_FOR_NEW: list[str] = ['ADMIN', 'RH', 'MANAGER', 'VIEWER']


def calculate_permissions(role: str, overrides: dict) -> list[str]:
    """Calcula lista final: ROLE_DEFAULTS[role] + overrides.add - overrides.remove."""
    base = set(ROLE_DEFAULTS.get(role, ROLE_DEFAULTS['VIEWER']))
    base.update(overrides.get('add', []))
    base.difference_update(overrides.get('remove', []))
    return sorted(base)


def check_permission(payload: dict, permission: str) -> bool:
    """True se o payload JWT tem a permissão solicitada."""
    role = payload.get('role', 'OWNER')
    if role == 'OWNER':
        return True
    return permission in payload.get('permissions', [])
```

- [ ] **Testar as funções puras**

```bash
cd backend && python -c "
from services.permissions import calculate_permissions, check_permission, ROLE_DEFAULTS

# OWNER tem tudo
assert check_permission({'role': 'OWNER'}, 'admin_aws') is True

# VIEWER não tem admin_aws
assert check_permission({'role': 'VIEWER', 'permissions': ROLE_DEFAULTS['VIEWER']}, 'admin_aws') is False

# Override: add admin_aws para VIEWER
perms = calculate_permissions('VIEWER', {'add': ['admin_aws'], 'remove': []})
assert 'admin_aws' in perms

# Override: remove dashboard de ADMIN
perms = calculate_permissions('ADMIN', {'add': [], 'remove': ['dashboard']})
assert 'dashboard' not in perms

# JWT sem role → OWNER
assert check_permission({}, 'configuracoes') is True

print('OK — permissions.py passando')
"
```

Expected: `OK — permissions.py passando`

- [ ] **Commit**

```bash
git add backend/services/permissions.py
git commit -m "feat: add permissions service with role defaults and override logic"
```

---

## Task 2: Serviço de auditoria

**Files:**
- Create: `backend/services/audit_service.py`
- Modify: `backend/utils/aws.py`

- [ ] **Adicionar constante em `backend/utils/aws.py`**

Localizar o bloco de variáveis (logo após `DYNAMODB_TABLE_CONFIG`) e adicionar:

```python
DYNAMODB_TABLE_AUDIT = os.environ.get('DYNAMODB_TABLE_AUDIT', 'AuditLogs')
```

- [ ] **Criar `backend/services/audit_service.py`**

```python
# backend/services/audit_service.py
from __future__ import annotations
import boto3
import os
import uuid
from datetime import datetime, timezone

_dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
_table_name = os.environ.get('DYNAMODB_TABLE_AUDIT', 'AuditLogs')
_table = None


def _get_table():
    global _table
    if _table is None:
        _table = _dynamodb.Table(_table_name)
    return _table


def log_event(
    company_id: str,
    user_id: str,
    user_name: str,
    entity: str,
    entity_id: str,
    action: str,
    before: dict | None,
    after: dict | None,
    request=None,
) -> None:
    """Registra evento na tabela AuditLogs. Fire-and-forget — nunca propaga exceção."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        log_id = str(uuid.uuid4())
        item: dict = {
            'company_id': company_id,
            'created_at_log_id': f"{now}#{log_id}",
            'log_id': log_id,
            'user_id': user_id or '',
            'user_name': user_name or '',
            'entity': entity,
            'entity_id': entity_id or '',
            'action': action,
            'created_at': now,
        }
        if before is not None:
            item['before'] = before
        if after is not None:
            item['after'] = after
        if request is not None:
            item['ip'] = request.headers.get('X-Forwarded-For', '') or (request.remote_addr or '')
            item['device'] = (request.headers.get('User-Agent') or '')[:200]
        _get_table().put_item(Item=item)
    except Exception as exc:
        print(f"[AUDIT] log_event falhou silenciosamente: {exc}")
```

- [ ] **Verificar importação**

```bash
cd backend && python -c "from services.audit_service import log_event; print('OK')"
```

Expected: `OK`

- [ ] **Commit**

```bash
git add backend/utils/aws.py backend/services/audit_service.py
git commit -m "feat: add audit_service and AuditLogs table constant"
```

---

## Task 3: Decorator `require_permission`

**Files:**
- Modify: `backend/utils/auth.py`

- [ ] **Adicionar ao final de `backend/utils/auth.py`**

Adicionar o import de `wraps` no topo (se não existir) e a função no final do arquivo:

```python
from functools import wraps
from flask import request as flask_request, jsonify
```

E ao final do arquivo:

```python
def require_permission(permission: str):
    """Decorator aplicado após token_required. Verifica permissão específica.

    Uso:
        @routes.route('/api/users', methods=['POST'])
        @token_required
        @require_permission('criar_usuario')
        def create_user(payload):
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated(payload, *args, **kwargs):
            from services.permissions import check_permission
            if flask_request.method == 'OPTIONS':
                return ('', 200)
            if not check_permission(payload, permission):
                return jsonify({'error': f'Sem permissão: {permission}'}), 403
            return f(payload, *args, **kwargs)
        return decorated
    return decorator
```

- [ ] **Verificar importação**

```bash
cd backend && python -c "from utils.auth import require_permission; print('OK')"
```

Expected: `OK`

- [ ] **Commit**

```bash
git add backend/utils/auth.py
git commit -m "feat: add require_permission decorator to auth utils"
```

---

## Task 4: Rota de usuários — `backend/routes/users.py`

**Files:**
- Create: `backend/routes/users.py`

- [ ] **Criar o arquivo completo**

```python
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
```

- [ ] **Verificar sintaxe**

```bash
cd backend && python -c "from routes.users import users_routes; print('OK')"
```

Expected: `OK`

- [ ] **Commit**

```bash
git add backend/routes/users.py
git commit -m "feat: add users CRUD routes with role/permission guards"
```

---

## Task 5: Rota de auditoria — `backend/routes/audit.py`

**Files:**
- Create: `backend/routes/audit.py`

- [ ] **Criar o arquivo**

```python
# backend/routes/audit.py
"""
GET /api/audit — lista logs de auditoria da empresa.
Params: user_id, action, entity, date_from, date_to, limit (max 500)
"""
from __future__ import annotations
from flask import Blueprint, request, jsonify
import boto3
import os
from boto3.dynamodb.conditions import Key, Attr
from utils.auth import token_required

audit_routes = Blueprint('audit_routes', __name__)

_dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
_table_audit = _dynamodb.Table(os.environ.get('DYNAMODB_TABLE_AUDIT', 'AuditLogs'))


@audit_routes.route('/api/audit', methods=['GET', 'OPTIONS'])
@token_required
def get_audit_logs(payload):
    if request.method == 'OPTIONS':
        return '', 200

    company_id = payload.get('company_id')
    if not company_id:
        return jsonify({'error': 'company_id ausente no token'}), 400

    date_from      = (request.args.get('date_from') or '').strip()
    date_to        = (request.args.get('date_to') or '').strip()
    filter_user    = (request.args.get('user_id') or '').strip()
    filter_action  = (request.args.get('action') or '').strip()
    filter_entity  = (request.args.get('entity') or '').strip()
    limit          = min(int(request.args.get('limit', 100)), 500)

    key_cond = Key('company_id').eq(company_id)
    if date_from and date_to:
        key_cond = key_cond & Key('created_at_log_id').between(date_from, date_to + '\xff')
    elif date_from:
        key_cond = key_cond & Key('created_at_log_id').gte(date_from)

    filter_expr = None
    if filter_user:
        filter_expr = Attr('user_id').eq(filter_user)
    if filter_action:
        cond = Attr('action').eq(filter_action)
        filter_expr = cond if filter_expr is None else (filter_expr & cond)
    if filter_entity:
        cond = Attr('entity').eq(filter_entity)
        filter_expr = cond if filter_expr is None else (filter_expr & cond)

    kwargs: dict = {
        'KeyConditionExpression': key_cond,
        'Limit': limit,
        'ScanIndexForward': False,  # mais recentes primeiro
    }
    if filter_expr is not None:
        kwargs['FilterExpression'] = filter_expr

    resp = _table_audit.query(**kwargs)
    logs = resp.get('Items', [])

    return jsonify({'logs': logs, 'count': len(logs)}), 200
```

- [ ] **Verificar sintaxe**

```bash
cd backend && python -c "from routes.audit import audit_routes; print('OK')"
```

Expected: `OK`

- [ ] **Commit**

```bash
git add backend/routes/audit.py
git commit -m "feat: add audit logs GET route with filters"
```

---

## Task 6: Registrar blueprints em `__init__.py`

**Files:**
- Modify: `backend/routes/__init__.py`

- [ ] **Adicionar imports e exports**

Substituir o conteúdo de `backend/routes/__init__.py` por:

```python
"""
Rotas da API - Blueprints organizados por funcionalidade
"""
from .api import routes
from .v2 import routes_v2
from .daily import daily_routes
from .dashboard import dashboard_routes
from .facial import routes_facial
from .admin import admin_routes
from .admin_auth import auth_admin_routes
from .feriados import feriados_routes
from .chatbot_rh import chatbot_rh_routes
from .admin_aws import admin_aws_routes
from .payroll import payroll_routes
from .users import users_routes
from .audit import audit_routes

__all__ = [
    'routes',
    'routes_v2',
    'daily_routes',
    'dashboard_routes',
    'routes_facial',
    'admin_routes',
    'auth_admin_routes',
    'feriados_routes',
    'chatbot_rh_routes',
    'admin_aws_routes',
    'payroll_routes',
    'users_routes',
    'audit_routes',
]
```

- [ ] **Registrar no `backend/app.py`**

Localizar onde os blueprints são registrados (procurar `app.register_blueprint`) e adicionar:

```python
from routes import users_routes, audit_routes
app.register_blueprint(users_routes)
app.register_blueprint(audit_routes)
```

- [ ] **Verificar que o app inicia**

```bash
cd backend && python -c "from app import app; print('OK')"
```

Expected: `OK`

- [ ] **Commit**

```bash
git add backend/routes/__init__.py backend/app.py
git commit -m "feat: register users and audit blueprints in app"
```

---

## Task 7: Atualizar login — JWT com role + permissions

**Files:**
- Modify: `backend/routes/api.py` — função `login()` (linha ~2427)

- [ ] **Adicionar import no topo da função `login()`**

Dentro da função `login()`, logo após `from utils.auth import verify_password, get_secret_key`, adicionar:

```python
from services.permissions import calculate_permissions, ROLE_DEFAULTS
from services.audit_service import log_event as _audit_log
```

- [ ] **Substituir o bloco de scan por query via GSI**

Localizar (linha ~2448):
```python
response = tabela_usuarioempresa.scan(
    FilterExpression=Attr('user_id').eq(usuario_id)
)
items = response.get('Items', [])
```

Substituir por:
```python
try:
    response = tabela_usuarioempresa.query(
        IndexName='user_id-index',
        KeyConditionExpression=Key('user_id').eq(usuario_id),
    )
    items = response.get('Items', [])
except Exception:
    # Fallback para scan caso o GSI ainda não exista
    response = tabela_usuarioempresa.scan(
        FilterExpression=Attr('user_id').eq(usuario_id)
    )
    items = response.get('Items', [])
```

- [ ] **Substituir o bloco de geração do JWT**

Localizar (linha ~2471):
```python
secret_key = get_secret_key()
token = jwt.encode({
    'usuario_id': usuario['user_id'],
    'empresa_nome': usuario.get('empresa_nome', ''),
    'company_id': usuario.get('company_id', ''),
    'tipo': 'empresa',
    'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=12)
}, secret_key, algorithm="HS256")
```

Substituir por:
```python
secret_key = get_secret_key()
role      = usuario.get('role', 'OWNER')
overrides = usuario.get('permissions', {'add': [], 'remove': []})
if not isinstance(overrides, dict):
    overrides = {'add': [], 'remove': []}
perms = calculate_permissions(role, overrides)

token = jwt.encode({
    'usuario_id':  usuario['user_id'],
    'user_id':     usuario['user_id'],
    'empresa_nome': usuario.get('empresa_nome', ''),
    'company_id':  usuario.get('company_id', ''),
    'role':        role,
    'permissions': perms,
    'user_name':   usuario.get('name', usuario.get('empresa_nome', '')),
    'tipo':        'empresa',
    'exp':         datetime.datetime.utcnow() + datetime.timedelta(hours=12)
}, secret_key, algorithm="HS256")
```

- [ ] **Adicionar log de auditoria após login bem-sucedido**

Logo antes do `return jsonify({...})` da rota `/login`, adicionar:

```python
try:
    _audit_log(
        company_id=usuario.get('company_id', ''),
        user_id=usuario['user_id'],
        user_name=usuario.get('name', usuario.get('empresa_nome', '')),
        entity='USER',
        entity_id=usuario['user_id'],
        action='LOGIN',
        before=None,
        after=None,
        request=request,
    )
except Exception:
    pass
```

- [ ] **Atualizar o `return jsonify` para incluir role**

Localizar (linha ~2480):
```python
return jsonify({
    'token': token,
    'tipo': 'empresa',
    'usuario_id': usuario['user_id'],
    'empresa_nome': usuario.get('empresa_nome', ''),
    'company_id': usuario.get('company_id', ''),
})
```

Substituir por:
```python
return jsonify({
    'token':       token,
    'tipo':        'empresa',
    'usuario_id':  usuario['user_id'],
    'user_id':     usuario['user_id'],
    'empresa_nome': usuario.get('empresa_nome', ''),
    'company_id':  usuario.get('company_id', ''),
    'role':        role,
    'user_name':   usuario.get('name', usuario.get('empresa_nome', '')),
})
```

- [ ] **Atualizar last_login no DynamoDB após login bem-sucedido**

Logo antes do `return`, adicionar (pode ser fire-and-forget):

```python
try:
    import datetime as _dt
    tabela_usuarioempresa.update_item(
        Key={'company_id': usuario.get('company_id', ''), 'user_id': usuario['user_id']},
        UpdateExpression='SET last_login = :ll',
        ExpressionAttributeValues={':ll': _dt.datetime.utcnow().isoformat()},
    )
except Exception:
    pass
```

- [ ] **Verificar sintaxe do arquivo inteiro**

```bash
cd backend && python -c "import routes.api; print('OK')"
```

Expected: `OK`

- [ ] **Commit**

```bash
git add backend/routes/api.py
git commit -m "feat: login JWT now includes role+permissions; query via GSI; audit LOGIN"
```

---

## Task 8: Script de migração

**Files:**
- Create: `backend/migrations/migrate_users_roles.py`

- [ ] **Criar o diretório e o script**

```bash
mkdir -p backend/migrations
touch backend/migrations/__init__.py
```

- [ ] **Criar `backend/migrations/migrate_users_roles.py`**

```python
#!/usr/bin/env python3
"""
Migração: adiciona role=OWNER e campos de auditoria a todos os itens
existentes em UserCompany, e preenche criado_por nos TimeRecords sem esse campo.

Executar UMA VEZ após o deploy desta feature:
    cd backend && python migrations/migrate_users_roles.py

Requer variáveis de ambiente: AWS_REGION, DYNAMODB_TABLE_USERS, DYNAMODB_TABLE_RECORDS
"""
from __future__ import annotations
import boto3
import os
import sys
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key, Attr

AWS_REGION     = os.environ.get('AWS_REGION', 'us-east-1')
TABLE_USERS    = os.environ.get('DYNAMODB_TABLE_USERS', 'UserCompany')
TABLE_RECORDS  = os.environ.get('DYNAMODB_TABLE_RECORDS', 'TimeRecords')

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
tbl_users   = dynamodb.Table(TABLE_USERS)
tbl_records = dynamodb.Table(TABLE_RECORDS)


def paginate(table, **kwargs) -> list:
    items = []
    resp  = table.scan(**kwargs)
    items.extend(resp.get('Items', []))
    while resp.get('LastEvaluatedKey'):
        resp = table.scan(ExclusiveStartKey=resp['LastEvaluatedKey'], **kwargs)
        items.extend(resp.get('Items', []))
    return items


def migrate_users(now: str) -> dict[str, str]:
    """Adiciona role=OWNER nos itens sem role. Retorna mapa company_id → user_id."""
    print(f"[1/2] Varrendo tabela {TABLE_USERS}...")
    items = paginate(tbl_users)
    owner_map: dict[str, str] = {}
    updated = 0

    for item in items:
        company_id = item.get('company_id') or ''
        user_id    = item.get('user_id') or ''
        if not company_id or not user_id:
            continue

        if company_id not in owner_map:
            owner_map[company_id] = user_id

        if 'role' not in item:
            tbl_users.update_item(
                Key={'company_id': company_id, 'user_id': user_id},
                UpdateExpression=(
                    'SET #role = :role, #name = :name, active = :active, '
                    'created_at = :ca, created_by = :cb, '
                    'updated_at = :ua, updated_by = :ub, '
                    'permissions = :perms'
                ),
                ExpressionAttributeNames={'#role': 'role', '#name': 'name'},
                ExpressionAttributeValues={
                    ':role':   'OWNER',
                    ':name':   item.get('name') or item.get('empresa_nome') or 'Admin',
                    ':active': True,
                    ':ca':     now,
                    ':cb':     'system',
                    ':ua':     now,
                    ':ub':     'system',
                    ':perms':  {'add': [], 'remove': []},
                },
            )
            updated += 1
            print(f"  OWNER → company={company_id} user={user_id}")

    print(f"  {updated} itens atualizados, {len(owner_map)} empresas mapeadas.")
    return owner_map


def migrate_records(owner_map: dict[str, str]) -> None:
    """Preenche criado_por nos TimeRecords sem esse campo."""
    print(f"\n[2/2] Varrendo tabela {TABLE_RECORDS}...")
    total_updated = 0

    for company_id, owner_user_id in owner_map.items():
        # Buscar registros da empresa sem criado_por
        items = []
        resp = tbl_records.query(
            KeyConditionExpression=Key('company_id').eq(company_id),
            FilterExpression=Attr('criado_por').not_exists(),
            ProjectionExpression='company_id, #edt',
            ExpressionAttributeNames={'#edt': 'employee_id#date_time'},
        )
        items.extend(resp.get('Items', []))
        while resp.get('LastEvaluatedKey'):
            resp = tbl_records.query(
                KeyConditionExpression=Key('company_id').eq(company_id),
                FilterExpression=Attr('criado_por').not_exists(),
                ProjectionExpression='company_id, #edt',
                ExpressionAttributeNames={'#edt': 'employee_id#date_time'},
                ExclusiveStartKey=resp['LastEvaluatedKey'],
            )
            items.extend(resp.get('Items', []))

        count = 0
        for rec in items:
            composite = rec.get('employee_id#date_time')
            if not composite:
                continue
            try:
                tbl_records.update_item(
                    Key={'company_id': company_id, 'employee_id#date_time': composite},
                    UpdateExpression='SET criado_por = :cp',
                    ConditionExpression=Attr('criado_por').not_exists(),
                    ExpressionAttributeValues={':cp': owner_user_id},
                )
                count += 1
            except Exception:
                pass  # ConditionalCheckFailed = já foi preenchido

        total_updated += count
        if count:
            print(f"  company={company_id}: {count} registros atualizados")

    print(f"  Total registros atualizados: {total_updated}")


def main() -> None:
    now = datetime.now(timezone.utc).isoformat()
    print(f"=== Migração multi-usuários {now} ===\n")

    owner_map = migrate_users(now)
    migrate_records(owner_map)

    print("\n=== Migração concluída com sucesso! ===")


if __name__ == '__main__':
    main()
```

- [ ] **Verificar sintaxe**

```bash
cd backend && python -c "import migrations.migrate_users_roles; print('OK')"
```

Expected: `OK`

- [ ] **Commit**

```bash
git add backend/migrations/ 
git commit -m "feat: add migration script for user roles and criado_por backfill"
```

---

## Task 9: Tipos TypeScript

**Files:**
- Modify: `front/src/types/index.ts`

- [ ] **Adicionar novos tipos ao final do arquivo `front/src/types/index.ts`**

```typescript
// ── Multi-usuários ──────────────────────────────────────────────────────────

export type UserRole = 'OWNER' | 'ADMIN' | 'RH' | 'MANAGER' | 'VIEWER';

export type Permission =
  | 'dashboard' | 'funcionarios' | 'registros' | 'correcoes'
  | 'rh_folha' | 'configuracoes' | 'exportacoes' | 'ajustes'
  | 'excluir' | 'criar_usuario' | 'editar_usuario'
  | 'fechar_competencia' | 'reconhecimento' | 'admin_aws';

export interface PermissionOverride {
  add: Permission[];
  remove: Permission[];
}

export interface CompanyUser {
  user_id: string;
  company_id: string;
  name: string;
  email?: string;
  role: UserRole;
  permissions: PermissionOverride;
  active: boolean;
  last_login?: string;
  created_at: string;
  created_by: string;
  updated_at?: string;
  empresa_nome?: string;
}

// ── Auditoria ───────────────────────────────────────────────────────────────

export type AuditEntity = 'EMPLOYEE' | 'RECORD' | 'USER' | 'CONFIG' | 'RH';

export type AuditAction =
  | 'CREATE' | 'EDIT' | 'DELETE' | 'ADJUST' | 'INVALIDATE'
  | 'LOGIN' | 'EXPORT' | 'CLOSE' | 'PERMISSION';

export interface AuditLog {
  log_id: string;
  company_id: string;
  created_at_log_id: string;
  user_id: string;
  user_name: string;
  entity: AuditEntity;
  entity_id: string;
  action: AuditAction;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  device?: string;
  created_at: string;
}
```

- [ ] **Também atualizar a interface `User` existente para incluir role e permissions**

Localizar a interface `User` (linha 1-6) e adicionar os campos:

```typescript
export interface User {
  usuario_id: string;
  email: string;
  empresa_nome: string;
  empresa_id: string;
  role?: UserRole;
  permissions?: string[];
  user_name?: string;
}
```

- [ ] **Verificar que o TypeScript compila**

```bash
cd front && npx tsc --noEmit 2>&1 | head -20
```

Expected: sem erros (ou apenas erros preexistentes não relacionados)

- [ ] **Commit**

```bash
git add front/src/types/index.ts
git commit -m "feat: add UserRole, CompanyUser, AuditLog types"
```

---

## Task 10: Atualizar `AuthContext`

**Files:**
- Modify: `front/src/contexts/AuthContext.tsx`

- [ ] **Adicionar novos campos ao tipo `AuthContextType`**

Localizar `interface AuthContextType` e adicionar:

```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isFirstAccess: boolean;
  role: string;
  permissions: string[];
  userName: string;
  hasPermission: (permission: string) => boolean;
  login: (credentials: LoginRequest) => Promise<boolean>;
  register: (userData: RegisterRequest) => Promise<boolean>;
  logout: () => void;
  checkFirstAccess: () => Promise<void>;
  markConfigurationComplete: () => void;
  isAuthenticated: boolean;
}
```

- [ ] **Adicionar states no `AuthProvider`**

Após `const [isFirstAccess, setIsFirstAccess] = useState(false);`, adicionar:

```typescript
const [role, setRole]               = useState<string>('');
const [permissions, setPermissions] = useState<string[]>([]);
const [userName, setUserName]       = useState<string>('');
```

- [ ] **Criar helper para decodificar token**

Após as declarações de state, adicionar:

```typescript
const _applyTokenPayload = (tokenStr: string) => {
  try {
    const payload = JSON.parse(atob(tokenStr.split('.')[1]));
    setRole(payload.role || '');
    setPermissions(Array.isArray(payload.permissions) ? payload.permissions : []);
    setUserName(payload.user_name || payload.empresa_nome || '');
  } catch {
    setRole('');
    setPermissions([]);
    setUserName('');
  }
};
```

- [ ] **Chamar `_applyTokenPayload` no `initAuth`**

Localizar o bloco `if (storedToken && storedUser)` e adicionar após `setUser(JSON.parse(storedUser))`:

```typescript
_applyTokenPayload(storedToken);
```

- [ ] **Chamar `_applyTokenPayload` no login bem-sucedido**

Localizar `if (response.token)` e adicionar após `localStorage.setItem('token', response.token)`:

```typescript
_applyTokenPayload(response.token);
// Também atualizar role/userName no user object
if (response.role) {
  // userData já é construído do payload abaixo, vai pegar role
}
```

E ao construir o `userData`:

```typescript
const userData: User = {
  usuario_id:  payload.usuario_id,
  email:       '',
  empresa_nome: payload.empresa_nome,
  empresa_id:  payload.empresa_id || payload.company_id,
  role:        payload.role,
  permissions: payload.permissions,
  user_name:   payload.user_name,
};
```

- [ ] **Limpar no logout**

Dentro de `logout()`, adicionar:

```typescript
setRole('');
setPermissions([]);
setUserName('');
```

- [ ] **Criar `hasPermission`**

Após as funções de login/logout, adicionar:

```typescript
const hasPermission = (permission: string): boolean => {
  if (!isAuthenticated) return false;
  if (role === 'OWNER' || role === '') return true;  // '' = JWT legado
  return permissions.includes(permission);
};
```

- [ ] **Adicionar ao `value` do context**

```typescript
const value: AuthContextType = {
  user,
  token,
  isLoading,
  isFirstAccess,
  role,
  permissions,
  userName,
  hasPermission,
  login,
  register,
  logout,
  checkFirstAccess,
  markConfigurationComplete,
  isAuthenticated: !!user && !!token,
};
```

- [ ] **Verificar compilação**

```bash
cd front && npx tsc --noEmit 2>&1 | grep -i "AuthContext" | head -10
```

Expected: sem erros no AuthContext

- [ ] **Commit**

```bash
git add front/src/contexts/AuthContext.tsx
git commit -m "feat: AuthContext exposes role, permissions, userName, hasPermission"
```

---

## Task 11: Endpoints de API no frontend

**Files:**
- Modify: `front/src/services/api.ts`

- [ ] **Adicionar métodos ao final da classe `ApiService`**

Localizar o final da classe `ApiService` (antes do `}` final da classe) e adicionar:

```typescript
// ── Users ──────────────────────────────────────────────────────────────────

async getUsers(): Promise<{ users: import('../types').CompanyUser[] }> {
  const resp = await this.api.get('/api/users');
  return resp.data;
}

async createUser(data: {
  name: string;
  user_id: string;
  senha: string;
  role: string;
  email?: string;
  permissions?: { add: string[]; remove: string[] };
}): Promise<{ user: import('../types').CompanyUser }> {
  const resp = await this.api.post('/api/users', data);
  return resp.data;
}

async updateUser(
  userId: string,
  data: Partial<{
    name: string;
    email: string;
    role: string;
    active: boolean;
    permissions: { add: string[]; remove: string[] };
  }>
): Promise<{ user: import('../types').CompanyUser }> {
  const resp = await this.api.put(`/api/users/${userId}`, data);
  return resp.data;
}

async deleteUser(userId: string): Promise<{ message: string }> {
  const resp = await this.api.delete(`/api/users/${userId}`);
  return resp.data;
}

async toggleUserActive(userId: string): Promise<{ active: boolean; user_id: string }> {
  const resp = await this.api.post(`/api/users/${userId}/toggle-active`);
  return resp.data;
}

// ── Audit ──────────────────────────────────────────────────────────────────

async getAuditLogs(filters?: {
  user_id?: string;
  action?: string;
  entity?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<{ logs: import('../types').AuditLog[]; count: number }> {
  const resp = await this.api.get('/api/audit', { params: filters });
  return resp.data;
}
```

- [ ] **Verificar compilação**

```bash
cd front && npx tsc --noEmit 2>&1 | grep -i "api.ts" | head -10
```

- [ ] **Commit**

```bash
git add front/src/services/api.ts
git commit -m "feat: add users and audit API methods"
```

---

## Task 12: Componente `PermissionGuard`

**Files:**
- Create: `front/src/components/PermissionGuard.tsx`

- [ ] **Criar o arquivo**

```tsx
// front/src/components/PermissionGuard.tsx
import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PermissionGuardProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback = <Navigate to="/dashboard" replace />,
}) => {
  const { hasPermission, isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
};

export default PermissionGuard;
```

- [ ] **Commit**

```bash
git add front/src/components/PermissionGuard.tsx
git commit -m "feat: add PermissionGuard component"
```

---

## Task 13: Atualizar Layout com guards de menu

**Files:**
- Modify: `front/src/components/Layout.tsx`

- [ ] **Adicionar import de `useAuth` para `hasPermission`**

`useAuth` já está importado. Adicionar `HistoryEduIcon` nos imports do MUI Icons:

```tsx
import { HistoryEdu as HistoryEduIcon } from '@mui/icons-material';
```

- [ ] **Adicionar campo `permission` às interfaces de rota**

Localizar `interface RouteConfig` e adicionar `permission?`:

```tsx
interface RouteConfig {
  text: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  permission?: string;
}
```

- [ ] **Adicionar item "Auditoria" em `toolRoutes` e permissões nas rotas**

Substituir as arrays `mainRoutes` e `toolRoutes`:

```tsx
const mainRoutes: RouteConfig[] = [
  { text: 'Dashboard',    icon: <DashboardIcon  sx={{ fontSize: 19 }} />, path: '/dashboard',  color: '#10b981', permission: 'dashboard'    },
  { text: 'Funcionários', icon: <PeopleIcon      sx={{ fontSize: 19 }} />, path: '/employees',  color: '#3b82f6', permission: 'funcionarios' },
  { text: 'Registros',    icon: <AccessTimeIcon  sx={{ fontSize: 19 }} />, path: '/records',    color: '#8b5cf6', permission: 'registros'    },
  { text: 'Correções',    icon: <BuildCircleIcon sx={{ fontSize: 19 }} />, path: '/correcoes',  color: '#f59e0b', permission: 'correcoes'    },
  { text: 'RH / Folha',   icon: <RHIcon          sx={{ fontSize: 19 }} />, path: '/rh',         color: '#f472b6', permission: 'rh_folha'    },
];

const toolRoutes: RouteConfig[] = [
  { text: 'Assistente RH', icon: <SmartToyIcon     sx={{ fontSize: 19 }} />, path: '/chatbot-rh', color: '#06b6d4' },
  { text: 'Auditoria',     icon: <HistoryEduIcon   sx={{ fontSize: 19 }} />, path: '/auditoria',  color: '#a78bfa', permission: 'configuracoes' },
  { text: 'Ajuda',          icon: <HelpIcon          sx={{ fontSize: 19 }} />, path: '/help',       color: '#6366f1' },
  { text: 'Configurações',  icon: <SettingsIcon      sx={{ fontSize: 19 }} />, path: '/settings',   color: '#f59e0b', permission: 'configuracoes' },
];
```

- [ ] **Extrair `hasPermission` do contexto**

Na linha onde usa `const { user, logout } = useAuth();`, adicionar `hasPermission`:

```tsx
const { user, logout, hasPermission } = useAuth();
```

- [ ] **Filtrar rotas por permissão antes de renderizar**

Antes do return, adicionar:

```tsx
const visibleMainRoutes  = mainRoutes.filter(r => !r.permission || hasPermission(r.permission));
const visibleToolRoutes  = toolRoutes.filter(r => !r.permission || hasPermission(r.permission));
```

- [ ] **Substituir `mainRoutes` e `toolRoutes` por versões filtradas nos renders**

Procurar todos os lugares onde `mainRoutes` e `toolRoutes` são iterados (dentro do `NavItem` map) e substituir por `visibleMainRoutes` e `visibleToolRoutes`.

Também atualizar a linha `const allRoutes = [...mainRoutes, ...toolRoutes];` para:

```tsx
const allRoutes = [...mainRoutes, ...toolRoutes];  // manter para getActiveRoute
```

E criar a variável derivada para uso no sidebar:

```tsx
const visibleAllRoutes = [...visibleMainRoutes, ...visibleToolRoutes];
```

E substituir iterações do sidebar para usar `visibleAllRoutes` ou os arrays visíveis.

- [ ] **Verificar compilação**

```bash
cd front && npx tsc --noEmit 2>&1 | grep -i "Layout" | head -10
```

- [ ] **Commit**

```bash
git add front/src/components/Layout.tsx
git commit -m "feat: Layout filters menu items by permission; add Auditoria route"
```

---

## Task 14: Componente `UsersSettings`

**Files:**
- Create: `front/src/components/UsersSettings.tsx`

- [ ] **Criar o arquivo completo**

```tsx
// front/src/components/UsersSettings.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Chip, IconButton, Tooltip,
  CircularProgress, Switch, FormControlLabel, TextField,
  Select, MenuItem, FormControl, InputLabel,
  Drawer, Divider,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  Close as CloseIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { CompanyUser, UserRole, Permission } from '../types';

const ROLE_LABELS: Record<UserRole, { label: string; color: string; bg: string }> = {
  OWNER:   { label: 'Owner',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  ADMIN:   { label: 'Admin',   color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  RH:      { label: 'RH',      color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  MANAGER: { label: 'Gestor',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  VIEWER:  { label: 'Viewer',  color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};

const ALL_PERMISSIONS: Permission[] = [
  'dashboard','funcionarios','registros','correcoes','rh_folha',
  'configuracoes','exportacoes','ajustes','excluir','criar_usuario',
  'editar_usuario','fechar_competencia','reconhecimento','admin_aws',
];

const PERM_LABELS: Record<Permission, string> = {
  dashboard:'Dashboard', funcionarios:'Funcionários', registros:'Registros',
  correcoes:'Correções', rh_folha:'RH / Folha', configuracoes:'Configurações',
  exportacoes:'Exportações', ajustes:'Ajustes', excluir:'Excluir',
  criar_usuario:'Criar usuário', editar_usuario:'Editar usuário',
  fechar_competencia:'Fechar competência', reconhecimento:'Reconhecimento',
  admin_aws:'Admin AWS',
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: 'rgba(255,255,255,0.9)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
};

interface DrawerState {
  open: boolean;
  mode: 'create' | 'edit';
  user: CompanyUser | null;
}

const ROLE_DEFAULTS_FE: Record<UserRole, Permission[]> = {
  OWNER:   ALL_PERMISSIONS,
  ADMIN:   ['dashboard','funcionarios','registros','correcoes','rh_folha','configuracoes','exportacoes','ajustes','excluir','editar_usuario','fechar_competencia','reconhecimento'],
  RH:      ['dashboard','funcionarios','registros','correcoes','rh_folha','exportacoes','ajustes','fechar_competencia'],
  MANAGER: ['dashboard','funcionarios','registros','correcoes','ajustes'],
  VIEWER:  ['dashboard','funcionarios','registros'],
};

const UsersSettings: React.FC = () => {
  const { hasPermission, role: myRole } = useAuth();
  const canCreate = hasPermission('criar_usuario');
  const canEdit   = hasPermission('editar_usuario');

  const [users,   setUsers]   = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer,  setDrawer]  = useState<DrawerState>({ open: false, mode: 'create', user: null });

  // Formulário do drawer
  const [form, setForm] = useState({
    name: '', user_id: '', senha: '', email: '', role: 'VIEWER' as UserRole,
  });
  const [permAdd,    setPermAdd]    = useState<Permission[]>([]);
  const [permRemove, setPermRemove] = useState<Permission[]>([]);
  const [saving,     setSaving]     = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { users: list } = await apiService.getUsers();
      setUsers(list.sort((a, b) => {
        if (a.role === 'OWNER') return -1;
        if (b.role === 'OWNER') return 1;
        return (a.name || '').localeCompare(b.name || '');
      }));
    } catch { toast.error('Erro ao carregar usuários'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openCreate = () => {
    setForm({ name: '', user_id: '', senha: '', email: '', role: 'VIEWER' });
    setPermAdd([]);
    setPermRemove([]);
    setDrawer({ open: true, mode: 'create', user: null });
  };

  const openEdit = (u: CompanyUser) => {
    setForm({ name: u.name, user_id: u.user_id, senha: '', email: u.email || '', role: u.role });
    setPermAdd(u.permissions?.add || []);
    setPermRemove(u.permissions?.remove || []);
    setDrawer({ open: true, mode: 'edit', user: u });
  };

  const closeDrawer = () => setDrawer(d => ({ ...d, open: false }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.user_id.trim()) {
      toast.error('Nome e ID são obrigatórios'); return;
    }
    if (drawer.mode === 'create' && !form.senha) {
      toast.error('Senha é obrigatória'); return;
    }
    setSaving(true);
    try {
      const permsPayload = { add: permAdd, remove: permRemove };
      if (drawer.mode === 'create') {
        await apiService.createUser({
          name: form.name, user_id: form.user_id, senha: form.senha,
          role: form.role, email: form.email || undefined, permissions: permsPayload,
        });
        toast.success('Usuário criado!');
      } else if (drawer.user) {
        const data: Record<string, unknown> = {
          name: form.name, email: form.email, role: form.role, permissions: permsPayload,
        };
        if (form.senha) data.senha = form.senha;
        await apiService.updateUser(drawer.user.user_id, data);
        toast.success('Usuário atualizado!');
      }
      closeDrawer();
      await loadUsers();
    } catch { /* erro tratado pelo interceptor */ }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (u: CompanyUser) => {
    try {
      await apiService.toggleUserActive(u.user_id);
      await loadUsers();
      toast.success(u.active ? 'Usuário desativado' : 'Usuário ativado');
    } catch {}
  };

  const handleDelete = async (u: CompanyUser) => {
    if (!window.confirm(`Excluir o usuário "${u.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await apiService.deleteUser(u.user_id);
      toast.success('Usuário excluído');
      await loadUsers();
    } catch {}
  };

  const togglePermAdd = (p: Permission) => {
    setPermAdd(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    setPermRemove(prev => prev.filter(x => x !== p));
  };

  const togglePermRemove = (p: Permission) => {
    setPermRemove(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    setPermAdd(prev => prev.filter(x => x !== p));
  };

  const defaultPerms = ROLE_DEFAULTS_FE[form.role] || [];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>Usuários da Empresa</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 0.25 }}>
            Gerencie quem tem acesso ao sistema e quais permissões cada um possui
          </Typography>
        </Box>
        {canCreate && (
          <Button
            variant="contained" startIcon={<PersonAddIcon />} onClick={openCreate}
            sx={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', textTransform: 'none', borderRadius: 2 }}
          >
            Adicionar
          </Button>
        )}
      </Box>

      {/* Lista */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: '#3b82f6' }} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {users.map(u => {
            const rc = ROLE_LABELS[u.role] || ROLE_LABELS.VIEWER;
            const isOwner = u.role === 'OWNER';
            return (
              <Box key={u.user_id} sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                p: 2, borderRadius: 2,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                opacity: u.active ? 1 : 0.5,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, color: 'white', fontSize: 14 }}>{u.name}</Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{u.user_id}</Typography>
                    {u.email && <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{u.email}</Typography>}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {u.last_login && (
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display: { xs: 'none', md: 'block' } }}>
                      último login: {new Date(u.last_login).toLocaleDateString('pt-BR')}
                    </Typography>
                  )}
                  <Chip size="small" label={rc.label}
                    sx={{ height: 20, fontSize: 10, fontWeight: 700, color: rc.color, background: rc.bg, border: `1px solid ${rc.color}40` }} />
                  <Chip size="small" label={u.active ? 'Ativo' : 'Inativo'}
                    sx={{ height: 20, fontSize: 10,
                      color: u.active ? '#10b981' : '#ef4444',
                      background: u.active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    }} />
                  {canEdit && !isOwner && (
                    <Tooltip title={u.active ? 'Desativar' : 'Ativar'}>
                      <IconButton size="small" onClick={() => handleToggleActive(u)} sx={{ color: u.active ? '#10b981' : '#ef4444' }}>
                        {u.active ? <ActiveIcon fontSize="small" /> : <InactiveIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  )}
                  {canEdit && (
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => openEdit(u)} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: 'white' } }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canCreate && !isOwner && (
                    <Tooltip title="Excluir">
                      <IconButton size="small" onClick={() => handleDelete(u)} sx={{ color: 'rgba(239,68,68,0.6)', '&:hover': { color: '#ef4444' } }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            );
          })}
          {users.length === 0 && (
            <Typography sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', py: 4 }}>
              Nenhum usuário encontrado
            </Typography>
          )}
        </Box>
      )}

      {/* Drawer Criar/Editar */}
      <Drawer
        anchor="right" open={drawer.open} onClose={closeDrawer}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, background: 'linear-gradient(160deg, #0a1535 0%, #0e2060 100%)', borderLeft: '1px solid rgba(255,255,255,0.1)', p: 3 } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>
            {drawer.mode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}
          </Typography>
          <IconButton onClick={closeDrawer} sx={{ color: 'rgba(255,255,255,0.5)' }}><CloseIcon /></IconButton>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField fullWidth label="Nome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} sx={inputSx} />
          <TextField fullWidth label="ID de Login (usuario_id)" value={form.user_id}
            disabled={drawer.mode === 'edit'}
            onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} sx={inputSx} />
          <TextField fullWidth label={drawer.mode === 'create' ? 'Senha' : 'Nova Senha (deixar vazio para manter)'}
            type="password" value={form.senha}
            onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} sx={inputSx} />
          <TextField fullWidth label="Email (opcional)" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} sx={inputSx} />

          <FormControl fullWidth sx={inputSx}>
            <InputLabel>Perfil (Role)</InputLabel>
            <Select value={form.role} label="Perfil (Role)"
              onChange={e => { setForm(f => ({ ...f, role: e.target.value as UserRole })); setPermAdd([]); setPermRemove([]); }}
              sx={{ color: 'rgba(255,255,255,0.9)' }}
            >
              {(['ADMIN','RH','MANAGER','VIEWER'] as UserRole[]).map(r => (
                <MenuItem key={r} value={r}>{ROLE_LABELS[r].label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 12 }}>
            AJUSTE FINO DE PERMISSÕES (opcional)
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)' }}>
            ✓ = incluído pelo role · +/− = adicionar/remover manualmente
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {ALL_PERMISSIONS.map(p => {
              const inDefault = defaultPerms.includes(p);
              const added     = permAdd.includes(p);
              const removed   = permRemove.includes(p);
              const effective = (inDefault || added) && !removed;
              return (
                <Box key={p} sx={{ display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1.5, py: 0.5, borderRadius: 1.5,
                  background: effective ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${effective ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  cursor: 'pointer', userSelect: 'none',
                }}>
                  <Typography sx={{ fontSize: 11, color: effective ? '#93c5fd' : 'rgba(255,255,255,0.4)' }}>
                    {inDefault && !removed ? '✓' : added ? '+' : ''} {PERM_LABELS[p]}
                  </Typography>
                  {!inDefault && (
                    <Typography onClick={() => togglePermAdd(p)} sx={{ fontSize: 10, color: added ? '#34d399' : 'rgba(255,255,255,0.3)', cursor: 'pointer', ml: 0.5 }}>
                      {added ? '−' : '+'}
                    </Typography>
                  )}
                  {inDefault && (
                    <Typography onClick={() => togglePermRemove(p)} sx={{ fontSize: 10, color: removed ? '#f87171' : 'rgba(255,255,255,0.3)', cursor: 'pointer', ml: 0.5 }}>
                      {removed ? '↩' : '−'}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
          <Button fullWidth variant="outlined" onClick={closeDrawer}
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button fullWidth variant="contained" startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave} disabled={saving}
            sx={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', textTransform: 'none' }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
};

export default UsersSettings;
```

- [ ] **Verificar compilação**

```bash
cd front && npx tsc --noEmit 2>&1 | grep -i "UsersSettings" | head -10
```

- [ ] **Commit**

```bash
git add front/src/components/UsersSettings.tsx
git commit -m "feat: add UsersSettings component with CRUD and fine-grained permissions UI"
```

---

## Task 15: Adicionar seção Usuários no SettingsPage

**Files:**
- Modify: `front/src/pages/SettingsPage.tsx`

- [ ] **Adicionar import de `UsersSettings`**

No topo de `SettingsPage.tsx`, adicionar após os imports existentes:

```tsx
import UsersSettings from '../components/UsersSettings';
import { useAuth } from '../contexts/AuthContext';
```

(se `useAuth` não estiver já importado)

- [ ] **Extrair `hasPermission` do contexto dentro de `SettingsPage`**

Dentro do componente `SettingsPage`, adicionar:

```tsx
const { hasPermission } = useAuth();
```

- [ ] **Adicionar o bloco de usuários no final do render, antes do `</PageLayout>`**

Localizar o final do componente SettingsPage (antes do `</PageLayout>`) e adicionar:

```tsx
{/* Usuários */}
{(hasPermission('criar_usuario') || hasPermission('editar_usuario')) && (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.4 }}
  >
    <Box sx={{
      background: 'rgba(255,255,255,0.06)',
      backdropFilter: 'blur(20px)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.1)',
      p: 3,
      mt: 3,
    }}>
      <UsersSettings />
    </Box>
  </motion.div>
)}
```

- [ ] **Verificar compilação**

```bash
cd front && npx tsc --noEmit 2>&1 | grep -i "SettingsPage" | head -10
```

- [ ] **Commit**

```bash
git add front/src/pages/SettingsPage.tsx
git commit -m "feat: add UsersSettings section to SettingsPage"
```

---

## Task 16: Página de Auditoria

**Files:**
- Create: `front/src/pages/AuditPage.tsx`

- [ ] **Criar o arquivo completo**

```tsx
// front/src/pages/AuditPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper,
  CircularProgress, Chip, Collapse, IconButton,
  TextField, MenuItem, Select, FormControl, InputLabel,
  Button,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import PageLayout from '../sections/PageLayout';
import { apiService } from '../services/api';
import type { AuditLog, AuditAction, AuditEntity } from '../types';
import { toast } from 'react-hot-toast';

const ACTION_LABELS: Record<AuditAction, { label: string; color: string }> = {
  CREATE:     { label: 'Criou',       color: '#34d399' },
  EDIT:       { label: 'Editou',      color: '#60a5fa' },
  DELETE:     { label: 'Excluiu',     color: '#f87171' },
  ADJUST:     { label: 'Ajustou',     color: '#fbbf24' },
  INVALIDATE: { label: 'Invalidou',   color: '#f87171' },
  LOGIN:      { label: 'Login',       color: '#94a3b8' },
  EXPORT:     { label: 'Exportou',    color: '#a78bfa' },
  CLOSE:      { label: 'Fechou',      color: '#f59e0b' },
  PERMISSION: { label: 'Permissão',   color: '#06b6d4' },
};

const ENTITY_LABELS: Record<AuditEntity, string> = {
  EMPLOYEE: 'Funcionário',
  RECORD:   'Registro',
  USER:     'Usuário',
  CONFIG:   'Configuração',
  RH:       'RH / Folha',
};

const formatDateTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
};

const DiffViewer: React.FC<{ before?: Record<string, unknown>; after?: Record<string, unknown> }> = ({ before, after }) => {
  if (!before && !after) return null;
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
      {before && (
        <Box sx={{ p: 1.5, borderRadius: 1.5, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <Typography sx={{ fontSize: 11, color: '#f87171', fontWeight: 700, mb: 1 }}>ANTES</Typography>
          {keys.map(k => (
            <Typography key={k} sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
              {k}: {JSON.stringify((before as Record<string, unknown>)[k])}
            </Typography>
          ))}
        </Box>
      )}
      {after && (
        <Box sx={{ p: 1.5, borderRadius: 1.5, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <Typography sx={{ fontSize: 11, color: '#34d399', fontWeight: 700, mb: 1 }}>DEPOIS</Typography>
          {keys.map(k => (
            <Typography key={k} sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
              {k}: {JSON.stringify((after as Record<string, unknown>)[k])}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
};

const AuditPage: React.FC = () => {
  const [logs,    setLogs]    = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    date_from: '', date_to: '', action: '', entity: '', user_id: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to)   params.date_to   = filters.date_to;
      if (filters.action)    params.action     = filters.action;
      if (filters.entity)    params.entity     = filters.entity;
      if (filters.user_id)   params.user_id    = filters.user_id;
      const { logs: result } = await apiService.getAuditLogs(params);
      setLogs(result);
    } catch {
      toast.error('Erro ao carregar auditoria');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const selectSx = {
    color: 'rgba(255,255,255,0.9)',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': { ...selectSx, '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
  };

  return (
    <PageLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>
          Auditoria
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, mt: 0.5 }}>
          Histórico completo de alterações no sistema
        </Typography>
      </Box>

      {/* Filtros */}
      <Paper sx={{ p: 2, mb: 3, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
          <TextField size="small" label="De" type="date" value={filters.date_from}
            onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
            InputLabelProps={{ shrink: true }} sx={{ ...inputSx, minWidth: 140 }} />
          <TextField size="small" label="Até" type="date" value={filters.date_to}
            onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
            InputLabelProps={{ shrink: true }} sx={{ ...inputSx, minWidth: 140 }} />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>Ação</InputLabel>
            <Select value={filters.action} label="Ação" onChange={e => setFilters(f => ({ ...f, action: e.target.value }))} sx={selectSx}>
              <MenuItem value="">Todas</MenuItem>
              {Object.keys(ACTION_LABELS).map(a => (
                <MenuItem key={a} value={a}>{ACTION_LABELS[a as AuditAction].label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>Entidade</InputLabel>
            <Select value={filters.entity} label="Entidade" onChange={e => setFilters(f => ({ ...f, entity: e.target.value }))} sx={selectSx}>
              <MenuItem value="">Todas</MenuItem>
              {Object.keys(ENTITY_LABELS).map(e => (
                <MenuItem key={e} value={e}>{ENTITY_LABELS[e as AuditEntity]}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField size="small" label="Usuário (ID)" value={filters.user_id}
            onChange={e => setFilters(f => ({ ...f, user_id: e.target.value }))}
            sx={{ ...inputSx, minWidth: 160 }} />
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={load}
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', textTransform: 'none', height: 40 }}>
            Atualizar
          </Button>
        </Box>
      </Paper>

      {/* Tabela */}
      <Paper sx={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Data/Hora', 'Usuário', 'Entidade', 'Ação', 'ID da Entidade', ''].map((h, i) => (
                  <TableCell key={i} sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)', py: 1.5 }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} sx={{ color: '#3b82f6' }} />
                  </TableCell>
                </TableRow>
              )}
              {!loading && logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'rgba(255,255,255,0.4)' }}>
                    Nenhum log encontrado para os filtros selecionados
                  </TableCell>
                </TableRow>
              )}
              {!loading && logs.map(log => {
                const ac = ACTION_LABELS[log.action] || { label: log.action, color: '#94a3b8' };
                const isOpen = expanded === log.log_id;
                const hasDiff = !!(log.before || log.after);
                return (
                  <React.Fragment key={log.log_id}>
                    <TableRow sx={{ '& td': { borderBottom: '1px solid rgba(255,255,255,0.06)' }, '&:hover': { background: 'rgba(255,255,255,0.03)' } }}>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {formatDateTime(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 12, color: 'white', fontWeight: 600 }}>{log.user_name || log.user_id}</Typography>
                        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{log.user_id}</Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                        {ENTITY_LABELS[log.entity] || log.entity}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={ac.label}
                          sx={{ height: 18, fontSize: 10, fontWeight: 700, color: ac.color, background: `${ac.color}1a`, border: `1px solid ${ac.color}40` }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                        {log.entity_id}
                      </TableCell>
                      <TableCell>
                        {hasDiff && (
                          <IconButton size="small" onClick={() => setExpanded(isOpen ? null : log.log_id)}
                            sx={{ color: 'rgba(255,255,255,0.4)' }}>
                            {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                    {hasDiff && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ p: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <Collapse in={isOpen}>
                            <Box sx={{ px: 3, py: 2, background: 'rgba(0,0,0,0.2)' }}>
                              <DiffViewer before={log.before} after={log.after} />
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </PageLayout>
  );
};

export default AuditPage;
```

- [ ] **Verificar compilação**

```bash
cd front && npx tsc --noEmit 2>&1 | grep -i "AuditPage" | head -10
```

- [ ] **Commit**

```bash
git add front/src/pages/AuditPage.tsx
git commit -m "feat: add AuditPage with filters and diff viewer"
```

---

## Task 17: Adicionar rota `/auditoria` no App.tsx

**Files:**
- Modify: `front/src/App.tsx`

- [ ] **Adicionar import de `AuditPage`**

No topo de `App.tsx`, adicionar junto aos outros imports de páginas:

```tsx
import AuditPage from './pages/AuditPage';
```

- [ ] **Adicionar rota dentro do `<Routes>` protegido**

Localizar onde ficam as `<Route>` de páginas protegidas (dentro de `<ProtectedRoute>` ou similar) e adicionar:

```tsx
<Route path="/auditoria" element={
  <PermissionGuard permission="configuracoes">
    <AuditPage />
  </PermissionGuard>
} />
```

Se `PermissionGuard` ainda não está importado em `App.tsx`, adicionar:

```tsx
import PermissionGuard from './components/PermissionGuard';
```

- [ ] **Verificar compilação final**

```bash
cd front && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero erros de tipo

- [ ] **Testar build completo**

```bash
cd front && npm run build 2>&1 | tail -20
```

Expected: `built in X.Xs` sem erros

- [ ] **Commit final**

```bash
git add front/src/App.tsx
git commit -m "feat: add /auditoria route with PermissionGuard"
```

---

## Verificação pós-implementação

- [ ] **Iniciar backend e verificar rotas**

```bash
cd backend && python app.py
# Testar em outro terminal:
curl -X GET http://localhost:5000/ 
```

Expected: `OK`

- [ ] **Executar migração (apenas em ambiente com dados reais)**

```bash
cd backend && python migrations/migrate_users_roles.py
```

Expected: `=== Migração concluída com sucesso! ===`

- [ ] **Commit de encerramento com resumo**

```bash
git add -A
git status
# Verificar que não há arquivos sensíveis (.env, credentials)
git commit -m "feat: multi-user + audit implementation complete

- Backend: permissions service, audit service, users CRUD, audit logs route
- Login JWT now includes role + permissions, logs audit:LOGIN
- Migration script backfills role=OWNER and criado_por
- Frontend: PermissionGuard, UsersSettings, AuditPage, Layout guards
- Backward-compat: JWTs without role treated as OWNER"
```

---

## Auto-review do spec vs. plano

| Req spec | Task que implementa |
|---|---|
| `UserCompany` estendida com role/permissions | Task 7 (login calcula), Task 8 (migração) |
| GSI `user_id-index` | Task 7 (login via query com fallback) + requer criação no console AWS |
| Nova tabela `AuditLogs` | Task 2 + requer criação no console AWS |
| Roles + defaults | Task 1 |
| Override fino de permissões | Task 1 (`calculate_permissions`) + Task 14 (UI) |
| JWT com role + permissions | Task 7 |
| Backward-compat JWT legado | Task 3 (`payload.get('role', 'OWNER')`) |
| CRUD usuários | Task 4 |
| GET /api/audit | Task 5 |
| Migração UserCompany + TimeRecords | Task 8 |
| PermissionGuard | Task 12 |
| Menu lateral com guards | Task 13 |
| SettingsPage → Usuários | Tasks 14, 15 |
| AuditPage | Task 16 |
| Rota /auditoria | Task 17 |
| OWNER único e imutável | Task 4 (guards no backend) |
| last_login atualizado | Task 7 |

> **Atenção DynamoDB:** O GSI `user_id-index` na tabela `UserCompany` e a nova tabela `AuditLogs` precisam ser criados no console AWS (ou via IaC/AWS CLI) antes de executar em produção. O código tem fallback para scan caso o GSI não exista ainda.
