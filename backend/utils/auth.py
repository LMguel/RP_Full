import jwt
import hashlib
from flask import current_app
import os
import bcrypt

# Obter SECRET_KEY de forma mais robusta
def get_secret_key():
    """Obtém o SECRET_KEY de forma segura e garante que seja string"""
    
    # Tentar várias fontes para o SECRET_KEY
    secret_key = None
    
    # 1. Variável de ambiente
    secret_key = os.environ.get('SECRET_KEY')
    if secret_key:
        print(f"[DEBUG] SECRET_KEY obtido via os.environ: {type(secret_key)}")
    
    # 2. Flask app config
    if not secret_key:
        try:
            secret_key = current_app.config.get('SECRET_KEY')
            if secret_key:
                print(f"[DEBUG] SECRET_KEY obtido via Flask config: {type(secret_key)}")
        except RuntimeError:
            pass  # Fora do contexto da aplicação
    
    # 3. Stage variables (para AWS Lambda)
    if not secret_key:
        try:
            import json
            context = os.environ.get('AWS_LAMBDA_STAGE_VARIABLES')
            if context:
                stage_vars = json.loads(context)
                secret_key = stage_vars.get('SECRET_KEY')
                if secret_key:
                    print(f"[DEBUG] SECRET_KEY obtido via stage variables: {type(secret_key)}")
        except:
            pass
    
    # 4. Não usar fallback hardcoded por segurança
    # SECRET_KEY deve estar sempre configurada via variável de ambiente
    if not secret_key:
        raise ValueError(
            "SECRET_KEY não encontrada! "
            "Configure a variável de ambiente SECRET_KEY ou crie um arquivo .env com SECRET_KEY"
        )
    
    # Garantir que é string
    if secret_key is not None:
        secret_key = str(secret_key)
        print(f"[DEBUG] SECRET_KEY final: tipo={type(secret_key)}, tamanho={len(secret_key)}")
    else:
        raise ValueError("SECRET_KEY não encontrado em nenhuma fonte")
    
    return secret_key

def verify_token(token):
    """Verifica e decodifica o token JWT"""
    try:
        print(f"[DEBUG] Verificando token: {token[:20]}...")
        
        # Obter SECRET_KEY de forma segura
        secret_key = get_secret_key()
        
        # Decodificar o token
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        print(f"[DEBUG] Token decodificado com sucesso: {payload}")
        return payload
        
    except jwt.ExpiredSignatureError:
        print("[DEBUG] Token expirado")
        return None
    except jwt.InvalidTokenError as e:
        print(f"[DEBUG] Token inválido: {str(e)}")
        return None
    except Exception as e:
        print(f"[DEBUG] Erro geral ao verificar token: {str(e)}")
        return None

def hash_password(password):
    """Cria hash da senha usando bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, password_hash):
    """Verifica se a senha corresponde ao hash bcrypt"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    except Exception as e:
        print(f"[ERROR] Erro ao verificar password: {e}")
        return False

# Função auxiliar para debug no Lambda
def debug_environment():
    """Função para debugar o ambiente Lambda"""
    print("=== DEBUG ENVIRONMENT ===")
    print(f"AWS_LAMBDA_STAGE_VARIABLES: {os.environ.get('AWS_LAMBDA_STAGE_VARIABLES')}")
    print(f"SECRET_KEY (env): {os.environ.get('SECRET_KEY')}")
    
    # Listar todas as variáveis de ambiente que contenham 'SECRET'
    for key, value in os.environ.items():
        if 'SECRET' in key.upper():
            print(f"{key}: {value}")
    
    print("=========================")
    return True