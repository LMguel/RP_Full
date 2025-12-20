from flask import Flask, jsonify, make_response, request
from flask_cors import CORS
from routes import routes
from routes_v2 import routes_v2
from routes_daily import daily_routes
from routes_dashboard import dashboard_routes
from routes_admin_auth import auth_admin_routes
from routes_admin import admin_routes
from routes_facial import routes_facial
import os
import json
from dotenv import load_dotenv

load_dotenv()

if 'AWS_LAMBDA_STAGE_VARIABLES' in os.environ:
    stage_vars = json.loads(os.environ['AWS_LAMBDA_STAGE_VARIABLES'])
    os.environ['SECRET_KEY'] = stage_vars.get('SECRET_KEY', 'frichimibu')

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'fallback-secret-key-for-development')

CORS(app, resources={r"/*": {"origins": "*"}})

app.register_blueprint(routes, url_prefix='/api')
app.register_blueprint(routes_v2)
app.register_blueprint(daily_routes)
app.register_blueprint(dashboard_routes)
app.register_blueprint(auth_admin_routes)
app.register_blueprint(admin_routes)
app.register_blueprint(routes_facial)

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        return response

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
    if not disable_ssl and os.path.exists(cert_file) and os.path.exists(key_file):
        app.run(host='0.0.0.0', port=5000, debug=True, ssl_context=(cert_file, key_file))
    else:
        app.run(host='0.0.0.0', port=5000, debug=True)