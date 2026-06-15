import jwt
import os
import time
import threading
import bcrypt
from functools import wraps
from flask import current_app, request as flask_request, jsonify
from utils.safe_logger import get_safe_logger

logger = get_safe_logger(__name__)

# ─── Token Blacklist (in-memory, TTL automático) ──────────────────────────────
# Chave: jti (str); Valor: exp (Unix timestamp float)
# Gunicorn multi-worker: cada worker tem memória própria — logout invalida apenas
# no worker que o atendeu. Para invalidação cross-worker usar Redis/DynamoDB TTL.
_bl_lock: threading.Lock = threading.Lock()
_token_blacklist: dict[str, float] = {}


def _cleanup_blacklist() -> None:
    now = time.time()
    with _bl_lock:
        expired = [k for k, v in _token_blacklist.items() if v < now]
        for k in expired:
            del _token_blacklist[k]


def blacklist_token(jti: str, exp: float) -> None:
    _cleanup_blacklist()
    with _bl_lock:
        _token_blacklist[jti] = exp


def is_token_blacklisted(jti: str) -> bool:
    with _bl_lock:
        return jti in _token_blacklist


# ─── Cookie helpers ───────────────────────────────────────────────────────────
_IS_SECURE = os.getenv('FLASK_ENV', 'production') != 'development'


def cookie_kwargs(max_age: int | None = None) -> dict:
    kwargs: dict = {
        'httponly': True,
        'secure': _IS_SECURE,
        'samesite': 'None' if _IS_SECURE else 'Lax',
        'path': '/',
    }
    if max_age is not None:
        kwargs['max_age'] = max_age
    return kwargs


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


def token_required(f):
    """Decorator que verifica se o request contém um token JWT válido.

    Lê o token do cookie httpOnly 'session_token' (preferência) ou do header
    Authorization: Bearer <token> (fallback — PWA offline e compatibilidade).

    Uso:
        @routes.route('/api/users', methods=['POST'])
        @token_required
        def create_user(payload):
            ...
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if flask_request.method == 'OPTIONS':
            return ('', 200)

        # Cookie httpOnly tem prioridade; Bearer header como fallback (PWA offline)
        token = flask_request.cookies.get('session_token')
        if not token:
            auth_header = flask_request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ', 1)[1]
        if not token:
            return jsonify({'error': 'Token ausente'}), 401

        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        jti = payload.get('jti')
        if jti and is_token_blacklisted(jti):
            return jsonify({'error': 'Token revogado'}), 401

        return f(payload, *args, **kwargs)
    return decorated


def require_company_scope(f):
    """Decorator aplicado após @token_required. Rejeita tokens sem company_id válido.

    Uso:
        @routes.route('/api/resource', methods=['GET'])
        @token_required
        @require_company_scope
        def handler(payload):
            company_id = payload['company_id']  # garantido não-vazio
    """
    @wraps(f)
    def decorated(payload, *args, **kwargs):
        if flask_request.method == 'OPTIONS':
            return ('', 200)
        company_id = payload.get('company_id') or ''
        if not company_id:
            return jsonify({'error': 'company_id ausente no token — acesso negado'}), 403
        return f(payload, *args, **kwargs)
    return decorated


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
