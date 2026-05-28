"""Admin authentication routes.

Routes:
  POST /api/auth/admin-login - Admin login (login + password)
  POST /api/auth/admin-logout - Admin logout
  POST /api/auth/admin-verify - Verify admin token
"""
from flask import Blueprint, request, jsonify
import boto3
from botocore.exceptions import ClientError
import jwt
import bcrypt
from datetime import datetime, timedelta
import os

auth_admin_routes = Blueprint('auth_admin_routes', __name__)

# AWS
dynamodb = boto3.resource('dynamodb', region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1'))
table_admin_users = dynamodb.Table('AdminUsers')

# JWT Configuration — sem fallback hardcoded; falha explicitamente se ausente
_JWT_SECRET = os.getenv('JWT_SECRET_KEY')
if not _JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET_KEY não encontrada! Configure a variável de ambiente JWT_SECRET_KEY. "
        "Use: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )
JWT_SECRET: str = _JWT_SECRET
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 8  # Reduzido de 24h para 8h


# ─── Password helpers ─────────────────────────────────────────────────────────

def hash_admin_password(password: str) -> str:
    """Gera hash bcrypt para senha admin."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_admin_password(password: str, stored: str) -> bool:
    """Verifica senha admin contra hash bcrypt.
    Aceita tanto hash bcrypt ($2b$) quanto plaintext legado para migração gradual.
    """
    if stored.startswith('$2b$') or stored.startswith('$2a$'):
        try:
            return bcrypt.checkpw(password.encode('utf-8'), stored.encode('utf-8'))
        except Exception:
            return False
    # Legado: plaintext — aceita mas deve migrar
    return stored == password


# ─── Token helpers ────────────────────────────────────────────────────────────

def _query_admin_by_login(login: str) -> dict | None:
    """Busca admin pelo login (chave primária)."""
    try:
        response = table_admin_users.get_item(Key={'login': login})
        return response.get('Item')
    except ClientError:
        return None


def _generate_token(login: str) -> str:
    """Gera JWT para admin com expiração de 8h."""
    payload = {
        'login': login,
        'role': 'super_admin',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_admin_token(token: str) -> dict | None:
    """Verifica e decodifica JWT admin."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def _upgrade_to_bcrypt(login: str, password: str) -> None:
    """Migra conta admin de plaintext para bcrypt na próxima autenticação."""
    try:
        table_admin_users.update_item(
            Key={'login': login},
            UpdateExpression='SET password_hash = :h REMOVE #pw',
            ExpressionAttributeNames={'#pw': 'password'},
            ExpressionAttributeValues={':h': hash_admin_password(password)},
        )
    except Exception:
        pass  # Migração é best-effort; próxima tentativa irá converter


# ─── Endpoints ────────────────────────────────────────────────────────────────

@auth_admin_routes.route('/api/auth/admin-login', methods=['POST'])
def admin_login():
    try:
        data = request.get_json() or {}
        login = data.get('login', '').strip()
        password = data.get('password', '')

        if not login or not password:
            return jsonify({'error': 'Login e senha são obrigatórios'}), 400
        if len(login) < 3:
            return jsonify({'error': 'Login inválido'}), 400

        admin = _query_admin_by_login(login)
        if not admin:
            return jsonify({'error': 'Login ou senha incorretos'}), 401

        # Suporte a bcrypt (password_hash) e legado plaintext (password)
        stored_hash = admin.get('password_hash', '')
        stored_plain = admin.get('password', '')
        stored = stored_hash or stored_plain

        if not stored or not verify_admin_password(password, stored):
            return jsonify({'error': 'Login ou senha incorretos'}), 401

        # Migração gradual: se ainda está em plaintext, converter agora
        if stored_plain and not stored_hash:
            _upgrade_to_bcrypt(login, password)

        token = _generate_token(login)
        return jsonify({
            'token': token,
            'admin': {'login': login, 'role': 'super_admin'},
        }), 200

    except Exception:
        return jsonify({'error': 'Erro interno do servidor'}), 500


@auth_admin_routes.route('/api/auth/admin-logout', methods=['POST'])
def admin_logout():
    try:
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 400
        payload = verify_admin_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        return jsonify({'message': 'Logout realizado com sucesso'}), 200
    except Exception:
        return jsonify({'error': 'Erro interno do servidor'}), 500


@auth_admin_routes.route('/api/auth/admin-verify', methods=['GET'])
def admin_verify():
    try:
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        payload = verify_admin_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        return jsonify({
            'admin': {'login': payload.get('login'), 'role': payload.get('role')},
        }), 200
    except Exception:
        return jsonify({'error': 'Erro interno do servidor'}), 500
