"""
Test script to check dashboard endpoint
"""
import requests
import json

BASE_URL = 'http://localhost:5000'

# Test credentials
LOGIN_DATA = {
    'username': 'aaa',
    'password': 'aaaaaa'
}

def test_dashboard():
    print("=" * 80)
    print("TESTANDO ENDPOINT DO DASHBOARD")
    print("=" * 80)
    
    # 1. Login para obter token
    print("\n1️⃣ Fazendo login...")
    try:
        response = requests.post(f'{BASE_URL}/api/login', json=LOGIN_DATA)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ Erro no login: {response.text}")
            return
        
        data = response.json()
        token = data.get('token')
        print(f"✅ Login bem-sucedido")
        print(f"Token: {token[:50]}..." if token else "Token não encontrado")
        
    except Exception as e:
        print(f"❌ Erro ao fazer login: {e}")
        return
    
    # 2. Testar endpoint do dashboard para 15/11/2025
    print("\n2️⃣ Testando dashboard para 2025-11-15...")
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        response = requests.get(f'{BASE_URL}/api/v2/dashboard/company/2025-11-15', headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Dashboard carregado com sucesso")
            print(f"\n📊 Resumo:")
            summary = data.get('summary', {})
            print(f"  - Total funcionários: {summary.get('total_employees', 0)}")
            print(f"  - Presentes: {summary.get('present', 0)}")
            print(f"  - Atrasados: {summary.get('late', 0)}")
            print(f"  - Horas trabalhadas: {summary.get('total_worked_minutes', 0) / 60:.1f}h")
            
            employees = data.get('employees', [])
            print(f"\n👥 Funcionários ({len(employees)}):")
            for emp in employees[:5]:  # Mostrar apenas os primeiros 5
                print(f"  - {emp.get('employee_name', emp.get('employee_id'))}: {emp.get('status')}")
            
            print(f"\n📄 Resposta completa:")
            print(json.dumps(data, indent=2, ensure_ascii=False)[:1000])
        else:
            print(f"❌ Erro ao buscar dashboard: {response.text}")
    except Exception as e:
        print(f"❌ Erro na requisição: {e}")
    
    # 3. Testar endpoint do dashboard para hoje
    from datetime import date
    today = date.today().strftime('%Y-%m-%d')
    print(f"\n3️⃣ Testando dashboard para hoje ({today})...")
    
    try:
        response = requests.get(f'{BASE_URL}/api/v2/dashboard/company/{today}', headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            summary = data.get('summary', {})
            print(f"✅ Dashboard hoje - {summary.get('total_employees', 0)} funcionários, {summary.get('present', 0)} presentes")
        else:
            print(f"❌ Erro: {response.text}")
    except Exception as e:
        print(f"❌ Erro na requisição: {e}")
    
    print("\n" + "=" * 80)

if __name__ == '__main__':
    test_dashboard()
