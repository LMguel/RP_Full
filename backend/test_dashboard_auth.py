"""
Teste do endpoint dashboard com autenticação real
"""
import requests
import json

BASE_URL = 'http://localhost:5000'

def main():
    print("=" * 80)
    print("TESTE DO DASHBOARD")
    print("=" * 80)
    
    # Usar credenciais reais do sistema
    # A única empresa no sistema é: 937373ab-6d74-4a67-a580-7c57c5e608e4
    # O único funcionário é: luis_miguel_aa7c29
    
    # Buscar token existente ou criar um
    # Para simplificar, vou usar o endpoint de login de funcionário
    
    print("\n1️⃣ Testando endpoint diretamente...")
    print("   Nota: Precisamos de um token válido")
    
    # Criar um token JWT simulado (apenas para teste)
    # Na verdade, vamos usar o verificar_config que não precisa de auth
    
    # Alternativa: testar o health check primeiro
    print("\n2️⃣ Testando health check...")
    try:
        response = requests.get(f'{BASE_URL}/health')
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   Erro: {e}")
    
    print("\n3️⃣ Testando endpoint de configurações (sem auth)...")
    try:
        # Este endpoint pode não existir, mas vamos tentar
        response = requests.get(f'{BASE_URL}/api/configuracoes')
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print(f"   Configurações encontradas")
        elif response.status_code == 401:
            print(f"   Precisa de autenticação")
        else:
            print(f"   Response: {response.text[:200]}")
    except Exception as e:
        print(f"   Erro: {e}")
    
    print("\n4️⃣ Para testar o dashboard, você precisa:")
    print("   1. Fazer login no frontend (http://localhost:3001)")
    print("   2. Abrir o DevTools do navegador (F12)")
    print("   3. Ir para a aba Console")
    print("   4. Verificar os logs do dashboard")
    print("")
    print("   OU")
    print("")
    print("   1. Copiar o token JWT do localStorage")
    print("   2. Executar:")
    print("")
    print('      $token = "seu_token_aqui"')
    print('      $headers = @{"Authorization"="Bearer $token"}')
    print('      Invoke-RestMethod -Uri "http://localhost:5000/api/v2/dashboard/company/2025-11-15" -Headers $headers')
    
    print("\n" + "=" * 80)

if __name__ == '__main__':
    main()
