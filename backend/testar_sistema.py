#!/usr/bin/env python3
"""
TESTE RÁPIDO DO SISTEMA DE RECONHECIMENTO FACIAL
Execute este script para validar se tudo está funcionando
"""

import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

# Cores para terminal
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_success(msg):
    print(f"{GREEN}✅ {msg}{RESET}")

def print_error(msg):
    print(f"{RED}❌ {msg}{RESET}")

def print_warning(msg):
    print(f"{YELLOW}⚠️  {msg}{RESET}")

def print_info(msg):
    print(f"{BLUE}ℹ️  {msg}{RESET}")

def test_backend_running():
    """Testa se o backend está rodando"""
    print("\n" + "="*60)
    print("1. Testando Backend...")
    print("="*60)
    
    try:
        response = requests.get('http://localhost:5000/health', timeout=5)
        if response.status_code == 200:
            print_success("Backend está rodando na porta 5000")
            return True
        else:
            print_error(f"Backend retornou status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print_error("Backend não está rodando!")
        print_info("Execute: cd backend && python app.py")
        return False
    except Exception as e:
        print_error(f"Erro ao conectar: {str(e)}")
        return False

def test_facial_endpoint():
    """Testa se o endpoint de reconhecimento está disponível"""
    print("\n" + "="*60)
    print("2. Testando Endpoint de Reconhecimento Facial...")
    print("="*60)
    
    try:
        response = requests.get('http://localhost:5000/api/facial/health', timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print_success("Endpoint /api/facial/health está disponível")
            
            if data.get('rekognition_enabled'):
                print_success(f"Rekognition está ATIVO")
                print_info(f"Collection: {data.get('collection')}")
            else:
                print_warning("Rekognition está DESABILITADO")
                print_info("Configure ENABLE_REKOGNITION=1 no .env")
            
            return True
        else:
            print_error(f"Endpoint retornou status {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Erro ao testar endpoint: {str(e)}")
        return False

def test_rekognition_config():
    """Testa configurações do Rekognition"""
    print("\n" + "="*60)
    print("3. Verificando Configurações AWS...")
    print("="*60)
    
    configs = {
        'AWS_REGION': os.getenv('AWS_REGION'),
        'S3_BUCKET': os.getenv('S3_BUCKET'),
        'REKOGNITION_COLLECTION': os.getenv('REKOGNITION_COLLECTION'),
        'ENABLE_REKOGNITION': os.getenv('ENABLE_REKOGNITION')
    }
    
    all_configured = True
    
    for key, value in configs.items():
        if value:
            print_success(f"{key}: {value}")
        else:
            print_warning(f"{key}: NÃO CONFIGURADO")
            all_configured = False
    
    if not all_configured:
        print_info("Configure as variáveis no arquivo .env")
    
    return all_configured

def test_aws_connection():
    """Testa conexão com AWS"""
    print("\n" + "="*60)
    print("4. Testando Conexão com AWS...")
    print("="*60)
    
    try:
        import boto3
        
        # Testar Rekognition
        rekognition = boto3.client('rekognition', region_name=os.getenv('AWS_REGION', 'us-east-1'))
        
        try:
            response = rekognition.list_collections()
            print_success("Conexão com Rekognition OK")
            
            collections = response.get('CollectionIds', [])
            if collections:
                print_info(f"Collections encontradas: {', '.join(collections)}")
                
                target = os.getenv('REKOGNITION_COLLECTION', 'registraponto-faces')
                if target in collections:
                    print_success(f"Collection '{target}' existe!")
                    
                    # Contar faces
                    desc = rekognition.describe_collection(CollectionId=target)
                    face_count = desc.get('FaceCount', 0)
                    print_info(f"Faces cadastradas: {face_count}")
                    
                else:
                    print_warning(f"Collection '{target}' NÃO encontrada")
                    print_info("Execute: python cadastrar_rekognition.py")
            else:
                print_warning("Nenhuma collection encontrada")
                print_info("Execute: python cadastrar_rekognition.py")
            
            return True
            
        except Exception as e:
            print_error(f"Erro no Rekognition: {str(e)}")
            return False
            
    except ImportError:
        print_error("boto3 não está instalado!")
        print_info("Execute: pip install boto3")
        return False
    except Exception as e:
        print_error(f"Erro ao conectar AWS: {str(e)}")
        return False

def test_frontend():
    """Testa se o frontend está rodando"""
    print("\n" + "="*60)
    print("5. Testando Frontend...")
    print("="*60)
    
    ports = [3000, 5173]
    
    for port in ports:
        try:
            response = requests.get(f'http://localhost:{port}', timeout=5)
            if response.status_code == 200:
                print_success(f"Frontend está rodando na porta {port}")
                return True
        except:
            continue
    
    print_warning("Frontend não está rodando")
    print_info("Execute: cd pwa-mobile && npm run dev")
    return False

def test_routes_registered():
    """Testa se as rotas estão registradas"""
    print("\n" + "="*60)
    print("6. Verificando Rotas Registradas...")
    print("="*60)
    
    try:
        response = requests.get('http://localhost:5000/debug/routes', timeout=5)
        
        if response.status_code == 200:
            routes = response.json()
            
            # Procurar rotas faciais
            facial_routes = [r for r in routes if 'reconhecer' in r['path'] or 'facial' in r['path']]
            
            if facial_routes:
                print_success("Rotas de reconhecimento facial encontradas:")
                for route in facial_routes:
                    methods = ', '.join([m for m in route['methods'] if m != 'HEAD' and m != 'OPTIONS'])
                    print(f"   • {methods} {route['path']}")
                return True
            else:
                print_error("Rotas de reconhecimento facial NÃO encontradas")
                print_info("Verifique se routes_facial está importado no app.py")
                return False
        else:
            print_warning("Não foi possível acessar /debug/routes")
            return False
            
    except Exception as e:
        print_error(f"Erro ao verificar rotas: {str(e)}")
        return False

def main():
    print("""
╔════════════════════════════════════════════════════════════╗
║     TESTE RÁPIDO - RECONHECIMENTO FACIAL                  ║
╚════════════════════════════════════════════════════════════╝
    """)
    
    results = {
        'Backend Rodando': test_backend_running(),
        'Endpoint Facial': test_facial_endpoint(),
        'Configurações': test_rekognition_config(),
        'Conexão AWS': test_aws_connection(),
        'Frontend': test_frontend(),
        'Rotas Registradas': test_routes_registered()
    }
    
    print("\n" + "="*60)
    print("RESUMO DOS TESTES")
    print("="*60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results.items():
        if result:
            print_success(f"{test_name}: PASSOU")
            passed += 1
        else:
            print_error(f"{test_name}: FALHOU")
    
    print("\n" + "="*60)
    
    percentage = (passed / total) * 100
    
    if percentage == 100:
        print_success(f"TODOS OS TESTES PASSARAM! ({passed}/{total})")
        print_success("Sistema pronto para uso! 🎉")
    elif percentage >= 70:
        print_warning(f"MAIORIA DOS TESTES PASSOU ({passed}/{total})")
        print_info("Configure os itens que falharam para uso completo")
    else:
        print_error(f"VÁRIOS TESTES FALHARAM ({passed}/{total})")
        print_info("Verifique a configuração do sistema")
    
    print("="*60)
    
    print("\n📝 Próximos Passos:")
    if not results['Backend Rodando']:
        print("   1. Iniciar backend: cd backend && python app.py")
    if not results['Frontend']:
        print("   2. Iniciar frontend: cd pwa-mobile && npm run dev")
    if not results['Configurações']:
        print("   3. Configurar variáveis no .env")
    if not results['Conexão AWS']:
        print("   4. Configurar AWS credentials")
        print("   5. Criar collection: python cadastrar_rekognition.py")
    
    print("\n📚 Documentação:")
    print("   • Backend: INTEGRACAO_REKOGNITION.md")
    print("   • Frontend: SISTEMA_COMPLETO.md")
    print("   • Resumo: RESUMO_REKOGNITION.md")
    print()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Teste cancelado pelo usuário")
        sys.exit(0)
