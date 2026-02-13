from flask import Flask, jsonify, make_response, request
from flask_cors import CORS
from routes import (
    routes,
    routes_v2,
    daily_routes,
    dashboard_routes,
    auth_admin_routes,
    admin_routes,
    routes_facial
)
import os
import json
from dotenv import load_dotenv

load_dotenv()

if 'AWS_LAMBDA_STAGE_VARIABLES' in os.environ:
    stage_vars = json.loads(os.environ['AWS_LAMBDA_STAGE_VARIABLES'])
    if 'SECRET_KEY' in stage_vars:
        os.environ['SECRET_KEY'] = stage_vars.get('SECRET_KEY')

app = Flask(__name__)
# SECRET_KEY deve estar definida em variável de ambiente
# Em desenvolvimento, use .env file
# Em produção, configure via variável de ambiente ou AWS Lambda stage variables
secret_key = os.getenv('SECRET_KEY')
if not secret_key:
    raise ValueError(
        "SECRET_KEY não encontrada! "
        "Configure a variável de ambiente SECRET_KEY ou crie um arquivo .env"
    )
app.config['SECRET_KEY'] = secret_key

CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.register_blueprint(routes, url_prefix='/api')
app.register_blueprint(routes_v2)
app.register_blueprint(daily_routes)
app.register_blueprint(dashboard_routes)
app.register_blueprint(auth_admin_routes)
app.register_blueprint(admin_routes)
app.register_blueprint(routes_facial)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'OK', 'message': 'API funcionando', 'service': 'Ponto Inteligente API'}), 200

@app.route('/api/health', methods=['GET'])
def api_health_check():
    return jsonify({'status': 'OK', 'message': 'API endpoints funcionando', 'service': 'Ponto Inteligente API'}), 200

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint não encontrado'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Erro interno do servidor'}), 500

if __name__ == '__main__':
    cert_file = 'cert.pem'
    key_file = 'key.pem'
    disable_ssl = os.getenv('DISABLE_SSL_DEV', '0') == '1'
    
    # Configurações do servidor via variáveis de ambiente
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', '5000'))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    if not disable_ssl and os.path.exists(cert_file) and os.path.exists(key_file):
        app.run(host=host, port=port, debug=debug, ssl_context=(cert_file, key_file))
    else:
        app.run(host=host, port=port, debug=debug)