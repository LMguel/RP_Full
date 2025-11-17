"""
Script para testar a API do Dashboard
"""
import requests
import json

BASE_URL = "http://localhost:5000"

# 1. Fazer login
print("🔐 Fazendo login...")
login_response = requests.post(
    f"{BASE_URL}/api/login",
    json={
        "usuario_id": "aaa",
        "senha": "aaaaaa"
    }
)

if login_response.status_code != 200:
    print(f"❌ Erro no login: {login_response.status_code}")
    print(login_response.json())
    exit(1)

login_data = login_response.json()
token = login_data.get('token')
print(f"✅ Login bem-sucedido! Token: {token[:50]}...")

# 2. Testar endpoint do dashboard
print("\n📊 Buscando dados do dashboard...")
headers = {
    "Authorization": f"Bearer {token}"
}

dashboard_response = requests.get(
    f"{BASE_URL}/api/v2/dashboard/company/2025-11-13",
    headers=headers
)

print(f"Status: {dashboard_response.status_code}")

if dashboard_response.status_code == 200:
    data = dashboard_response.json()
    print("\n✅ Dados recebidos:")
    print(json.dumps(data, indent=2, ensure_ascii=False))
    
    # Análise dos dados
    print("\n📈 Análise:")
    print(f"- Data: {data.get('date')}")
    summary = data.get('summary', {})
    print(f"- Total funcionários: {summary.get('total_employees')}")
    print(f"- Presentes: {summary.get('present')}")
    print(f"- Atrasados: {summary.get('late')}")
    print(f"- Horas extras: {summary.get('extra_time')}")
    
    employees = data.get('employees', [])
    print(f"- Funcionários com dados: {len(employees)}")
    
    if employees:
        print("\n👥 Funcionários:")
        for emp in employees:
            print(f"  - ID: {emp.get('employee_id')}")
            print(f"    Nome: {emp.get('employee_name')}")
            print(f"    Status: {emp.get('status')}")
            print(f"    Horas trabalhadas: {emp.get('worked_hours')}min")
            print(f"    Horas previstas: {emp.get('expected_hours')}min")
            print(f"    Entrada: {emp.get('actual_start')}")
            print(f"    Saída: {emp.get('actual_end')}")
            print()
else:
    print(f"❌ Erro: {dashboard_response.status_code}")
    print(dashboard_response.json())
