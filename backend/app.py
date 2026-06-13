from flask import Flask, jsonify, request, g
from flask_cors import CORS
from routes import (
    routes,
    routes_v2,
    daily_routes,
    dashboard_routes,
    auth_admin_routes,
    admin_routes,
    routes_facial,
    feriados_routes,
    chatbot_rh_routes,
    admin_aws_routes,
    payroll_routes,
    users_routes,
    audit_routes,
)
import os
import json
import time
import uuid
from collections import defaultdict
from dotenv import load_dotenv
import logging

load_dotenv()

if 'AWS_LAMBDA_STAGE_VARIABLES' in os.environ:
    stage_vars = json.loads(os.environ['AWS_LAMBDA_STAGE_VARIABLES'])
    if 'SECRET_KEY' in stage_vars:
        os.environ['SECRET_KEY'] = stage_vars.get('SECRET_KEY')

# ─── Logging estruturado ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(name)s %(message)s',
)
logger = logging.getLogger('app')

app = Flask(__name__)

# ─── SECRET_KEY ───────────────────────────────────────────────────────────────
secret_key = os.getenv('SECRET_KEY')
if not secret_key:
    raise ValueError("SECRET_KEY não encontrada! Configure a variável de ambiente SECRET_KEY.")
app.config['SECRET_KEY'] = secret_key
# Limite de upload: 10 MB — protege contra ataques de esgotamento de disco/memória
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_UPLOAD_MB', '10')) * 1024 * 1024

# ─── CORS — Whitelist de origens permitidas ───────────────────────────────────
_raw_origins = os.getenv('ALLOWED_ORIGINS', '')
if _raw_origins.strip():
    # rstrip('/') evita que trailing slashes em ALLOWED_ORIGINS quebrem o match CORS
    # (browser envia Origin sem barra final; ex: "http://localhost:3002/" → "http://localhost:3002")
    allowed_origins = [o.strip().rstrip('/') for o in _raw_origins.split(',') if o.strip()]
else:
    allowed_origins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:4173',
        'https://registra-ponto.duckdns.org',
        'https://pwa.registra-ponto.duckdns.org',
    ]

CORS(
    app,
    resources={r"/*": {"origins": allowed_origins}},
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=False,
)

# ─── Rate limiting (token bucket in-memory) ───────────────────────────────────
_rate_store: dict[str, list[float]] = defaultdict(list)
_RATE_CONFIG: dict[str, tuple[int, int]] = {
    '/api/login':                  (5, 60),
    '/api/funcionario/login':      (5, 60),
    '/api/auth/admin-login':       (5, 60),
    '/api/reconhecer_rosto':       (30, 60),
    '/api/registrar_ponto_facial': (30, 60),
}

# ─── Blueprints ───────────────────────────────────────────────────────────────
app.register_blueprint(routes, url_prefix='/api')
app.register_blueprint(routes_v2)
app.register_blueprint(daily_routes)
app.register_blueprint(dashboard_routes)
app.register_blueprint(auth_admin_routes)
app.register_blueprint(admin_routes)
app.register_blueprint(routes_facial)
app.register_blueprint(feriados_routes)
app.register_blueprint(chatbot_rh_routes)
app.register_blueprint(admin_aws_routes)
app.register_blueprint(payroll_routes)
app.register_blueprint(users_routes)
app.register_blueprint(audit_routes)


@app.before_request
def attach_request_id():
    """Gera ou herda X-Request-ID para rastreamento de cada request."""
    g.request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())
    g.request_start = time.monotonic()


@app.before_request
def enforce_rate_limit():
    if request.method == 'OPTIONS':
        return None
    cfg = _RATE_CONFIG.get(request.path)
    if not cfg:
        return None
    max_req, window = cfg
    ip = request.remote_addr or 'unknown'
    key = f"{ip}:{request.path}"
    now = time.monotonic()
    _rate_store[key] = [t for t in _rate_store[key] if now - t < window]
    if len(_rate_store[key]) >= max_req:
        logger.warning(f"Rate limit atingido: {request.path} ip={ip}")
        return jsonify({'error': 'Muitas tentativas. Aguarde alguns minutos.'}), 429
    _rate_store[key].append(now)
    return None


@app.after_request
def add_security_headers(response):
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(self), microphone=()'
    if os.getenv('ENABLE_HSTS', '0') == '1':
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    # Propagar Request-ID na resposta para facilitar debug
    if hasattr(g, 'request_id'):
        response.headers['X-Request-ID'] = g.request_id
    return response


# ─── Health / version endpoints ───────────────────────────────────────────────
@app.route('/health', methods=['GET'])
@app.route('/api/health', methods=['GET'])
def health_check():
    """Healthcheck robusto que verifica DynamoDB, S3 e Rekognition."""
    services: dict[str, str] = {}
    overall = 'ok'

    # DynamoDB
    try:
        from utils.aws import tabela_funcionarios
        tabela_funcionarios.load()
        services['dynamodb'] = 'ok'
    except Exception:
        services['dynamodb'] = 'error'
        overall = 'degraded'

    # S3
    try:
        from utils.aws import s3, BUCKET
        s3.head_bucket(Bucket=BUCKET)
        services['s3'] = 'ok'
    except Exception:
        services['s3'] = 'error'
        overall = 'degraded'

    # Rekognition
    try:
        from utils.aws import rekognition, COLLECTION
        if rekognition:
            rekognition.describe_collection(CollectionId=COLLECTION)
            services['rekognition'] = 'ok'
        else:
            services['rekognition'] = 'disabled'
    except Exception:
        services['rekognition'] = 'error'
        overall = 'degraded'

    status_code = 200 if overall == 'ok' else 503
    return jsonify({
        'status': overall,
        'service': 'Ponto Inteligente API',
        'services': services,
    }), status_code


@app.route('/api/version', methods=['GET'])
def api_version():
    version = os.getenv('BACKEND_VERSION') or os.getenv('APP_VERSION') or 'unknown'
    commit = os.getenv('GIT_SHA') or os.getenv('GIT_COMMIT') or ''
    return jsonify({'service': 'Ponto Inteligente API', 'version': version, 'commit': commit}), 200


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint não encontrado'}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"500 Internal Error: {request.path} request_id={getattr(g, 'request_id', '-')}")
    return jsonify({'error': 'Erro interno do servidor'}), 500


@app.errorhandler(429)
def ratelimit_handler(error):
    return jsonify({'error': 'Muitas tentativas. Aguarde alguns minutos.'}), 429


if __name__ == '__main__':
    cert_file = 'cert.pem'
    key_file = 'key.pem'
    disable_ssl = os.getenv('DISABLE_SSL_DEV', '0') == '1'

    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', '5000'))

    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    env = os.getenv('FLASK_ENV', 'production').lower().strip()
    if env == 'production' and debug:
        raise RuntimeError(
            "FLASK_DEBUG=True não é permitido com FLASK_ENV=production."
        )

    if not disable_ssl and os.path.exists(cert_file) and os.path.exists(key_file):
        app.run(host=host, port=port, debug=debug, ssl_context=(cert_file, key_file))
    else:
        app.run(host=host, port=port, debug=debug)
