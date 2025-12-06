from flask import Flask, jsonify, make_response, request
from flask_cors import CORS
from routes import routes
from routes_v2 import routes_v2
from routes_daily import daily_routes
from routes_dashboard import dashboard_routes
from routes_admin_auth import auth_admin_routes
from routes_admin import admin_routes
import os
import os
import json
from dotenv import load_dotenv
from lambda_adapter import lambda_response

load_dotenv()

# Configurar SECRET_KEY do stage variables do API Gateway, se existir
if 'AWS_LAMBDA_STAGE_VARIABLES' in os.environ:
    stage_vars = json.loads(os.environ['AWS_LAMBDA_STAGE_VARIABLES'])
    os.environ['SECRET_KEY'] = stage_vars.get('SECRET_KEY', 'frichimibu')


app = Flask(__name__)

# Configurações
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'fallback-secret-key-for-development')

# Enable CORS globally for all routes
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",
            "http://localhost:3001",  # Vite porta alternativa
            "http://localhost:3002",  # Vite porta alternativa 2
            "http://localhost:5173", 
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
            "http://192.168.0.39:3000"  # Network access
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": False,
        "expose_headers": ["Content-Type", "Authorization"]
    }
})

# Registra as rotas do blueprint com prefixo /api
app.register_blueprint(routes, url_prefix='/api')
# Registra rotas V2 (nova arquitetura)
app.register_blueprint(routes_v2)
# Registra rotas de registros diários
app.register_blueprint(daily_routes)
# Registra rotas do novo dashboard
app.register_blueprint(dashboard_routes)
# Registra rotas de autenticação admin
app.register_blueprint(auth_admin_routes)
# Registra rotas de admin portal
app.register_blueprint(admin_routes)

# Handler global para OPTIONS (preflight)
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        return response

# Debug: listar todas as rotas registradas
@app.route('/debug/routes', methods=['GET'])
def list_routes():
    routes_list = []
    for rule in app.url_map.iter_rules():
        routes_list.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'path': str(rule)
        })
    return jsonify(routes_list)

# Rota de health check global
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'OK', 
        'message': 'API funcionando',
        'service': 'Ponto Inteligente API'
    }), 200

# Rota de health check da API
@app.route('/api/health', methods=['GET'])
def api_health_check():
    return jsonify({
        'status': 'OK', 
        'message': 'API endpoints funcionando',
        'service': 'Ponto Inteligente API'
    }), 200

# Teste: rota simples no app.py com prefixo /api
@app.route('/api/teste-app', methods=['GET'])
def teste_app():
    return jsonify({'message': 'Rota direta do app.py funcionando!'}), 200

# Tratamento de erros 404
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint não encontrado'}), 404

# Tratamento de erros 500
@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Erro interno do servidor'}), 500

def lambda_handler(event, context):
    """
    Handler melhorado para debug detalhado do API Gateway
    """
    print("=== LAMBDA HANDLER DEBUG COMPLETO ===")
    print(f"Event completo: {json.dumps(event, indent=2, default=str)}")
    print(f"Context: {context}")
    print("=====================================")
    
    # Debug específico dos campos importantes
    http_method = event.get('httpMethod', 'UNKNOWN')
    path = event.get('path', 'UNKNOWN')
    resource = event.get('resource', 'UNKNOWN')
    path_parameters = event.get('pathParameters', {})
    query_parameters = event.get('queryStringParameters', {})
    headers = event.get('headers', {})
    
    print(f"HTTP Method: {http_method}")
    print(f"Path: {path}")
    print(f"Resource: {resource}")
    print(f"Path Parameters: {path_parameters}")
    print(f"Query Parameters: {query_parameters}")
    print(f"Headers: {headers}")
    
    # Teste de rota direta para bypass do Flask (debug)
    if path in ['/api/debug-lambda', '/debug-lambda']:
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            'body': json.dumps({
                "message": "Lambda está recebendo requisições!",
                "debug_info": {
                    "path": path,
                    "method": http_method,
                    "resource": resource,
                    "path_params": path_parameters,
                    "query_params": query_parameters,
                    "headers_count": len(headers),
                    "event_keys": list(event.keys())
                }
            }),
            'isBase64Encoded': False
        }
    
    # Rota de debug para listar todas as rotas Flask disponíveis
    if path in ['/debug/routes-lambda', '/api/debug/routes-lambda']:
        flask_routes = []
        with app.app_context():
            for rule in app.url_map.iter_rules():
                flask_routes.append({
                    'endpoint': rule.endpoint,
                    'methods': list(rule.methods),
                    'path': str(rule)
                })
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                "message": "Rotas Flask registradas:",
                "routes": flask_routes,
                "current_path": path,
                "current_method": http_method
            }),
            'isBase64Encoded': False
        }
    
    # Usar o adapter para processar via Flask
    try:
        print("Tentando processar via lambda_response...")
        result = lambda_response(app, event, context)
        print(f"Resultado lambda_response: Status={result.get('statusCode')}")
        return result
    except Exception as e:
        print(f"ERRO no lambda_response: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Retornar erro detalhado
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Erro no lambda_handler',
                'message': str(e),
                'path_received': path,
                'method_received': http_method,
                'traceback': traceback.format_exc()
            }),
            'isBase64Encoded': False
        }

# Modo local (dev)
if __name__ == '__main__':
    print("Iniciando Flask em modo desenvolvimento...")
    print(f"Secret Key configurada: {'✓' if app.config.get('SECRET_KEY') else '✗'}")
    print("\nRotas registradas:")
    for rule in app.url_map.iter_rules():
        print(f"  {rule.methods} {rule}")
    app.run(host='0.0.0.0', port=5000, debug=True)