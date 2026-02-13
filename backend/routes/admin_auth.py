"""Admin authentication routes.

Routes:
  POST /api/auth/admin-login - Admin login (login + password)
  POST /api/auth/admin-logout - Admin logout
"""
from flask import Blueprint, request, jsonify
import boto3
from botocore.exceptions import ClientError
import jwt
from datetime import datetime, timedelta
import os

auth_admin_routes = Blueprint('auth_admin_routes', __name__)

# AWS
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table_admin_users = dynamodb.Table('AdminUsers')

# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24


def _query_admin_by_login(login: str) -> dict | None:
    """Query admin by login (login é a partition key)."""
    try:
        response = table_admin_users.get_item(Key={'login': login})
        return response.get('Item')
    except ClientError as e:
        print(f"Error querying admin by login: {e}")
        return None


def _generate_token(login: str) -> str:
    """Generate JWT token for admin."""
    payload = {
        'login': login,
        'role': 'super_admin',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_admin_token(token: str) -> dict | None:
    """Verify and decode JWT token."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        print("Token expired")
        return None
    except jwt.InvalidTokenError as e:
        print(f"Invalid token: {e}")
        return None


@auth_admin_routes.route('/api/auth/admin-login', methods=['POST'])
def admin_login():
    """Admin login endpoint.
    
    Expected payload:
    {
        "login": "admin",
        "password": "password123"
    }
    """
    try:
        data = request.get_json() or {}
        login = data.get('login', '').strip()
        password = data.get('password', '')

        print(f"[DEBUG] Login attempt - login: '{login}', password: '{password}'")

        # Validate input
        if not login or not password:
            return jsonify({'error': 'Login e senha são obrigatórios'}), 400

        if len(login) < 3:
            return jsonify({'error': 'Login inválido'}), 400

        # Query admin by login
        admin = _query_admin_by_login(login)
        print(f"[DEBUG] Admin found: {admin}")
        if not admin:
            return jsonify({'error': 'Login ou senha incorretos'}), 401

        # Verify password (texto plano)
        admin_password = admin.get('password', '')
        print(f"[DEBUG] Comparing passwords - db: '{admin_password}', input: '{password}'")
        if not admin_password or admin_password != password:
            return jsonify({'error': 'Login ou senha incorretos'}), 401

        # Generate token
        token = _generate_token(login)

        return jsonify({
            'token': token,
            'admin': {
                'login': login,
                'role': 'super_admin'
            }
        }), 200

    except Exception as e:
        print(f"Error in admin_login: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


@auth_admin_routes.route('/api/auth/admin-logout', methods=['POST'])
def admin_logout():
    """Admin logout endpoint.
    
    Note: Logout is typically handled on the client side by removing the token.
    This endpoint can be used for server-side cleanup if needed.
    """
    try:
        # Extract token from Authorization header
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '')

        if not token:
            return jsonify({'error': 'Token não fornecido'}), 400

        # Verify token is valid
        payload = verify_admin_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido ou expirado'}), 401

        # Token invalidation could be implemented here using a blacklist
        # For now, just return success (client will remove token)

        return jsonify({'message': 'Logout realizado com sucesso'}), 200

    except Exception as e:
        print(f"Error in admin_logout: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


@auth_admin_routes.route('/api/auth/admin-verify', methods=['GET'])
def admin_verify():
    """Verify admin token and return admin info."""
    try:
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '')

        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401

        payload = verify_admin_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido ou expirado'}), 401

        return jsonify({
            'admin': {
                'login': payload.get('login'),
                'role': payload.get('role')
            }
        }), 200

    except Exception as e:
        print(f"Error in admin_verify: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
