import jwt
import os
import bcrypt
from functools import wraps
from flask import current_app, request as flask_request, jsonify
from utils.safe_logger import get_safe_logger

logger = get_safe_logger(__name__)


def get_secret_key() -> str:
    """Obtém SECRET_KEY de forma segura. Falha explicitamente se ausente."""
    secret_key = (
        os.environ.get('SECRET_KEY')
        or _get_from_flask_config()
        or _get_from_lambda_stage()
    )
    if not secret_key:
        raise ValueError(
            "SECRET_KEY não encontrada! "
            "Configure a variável de ambiente SECRET_KEY."
        )
    return str(secret_key)


def _get_from_flask_config() -> str | None:
    try:
        return current_app.config.get('SECRET_KEY')
    except RuntimeError:
        return None


def _get_from_lambda_stage() -> str | None:
    try:
        import json
        context = os.environ.get('AWS_LAMBDA_STAGE_VARIABLES')
        if context:
            return json.loads(context).get('SECRET_KEY')
    except Exception:
        pass
    return None


def verify_token(token: str) -> dict | None:
    """Verifica e decodifica o token JWT. Retorna payload ou None."""
    try:
        secret_key = get_secret_key()
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token expirado recebido")
        return None
    except jwt.InvalidTokenError:
        logger.warning("Token inválido recebido")
        return None
    except Exception as e:
        logger.error(f"Erro ao verificar token: {type(e).__name__}")
        return None


def hash_password(password: str) -> str:
    """Cria hash bcrypt da senha."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verifica senha contra hash bcrypt."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    except Exception:
        return False


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
