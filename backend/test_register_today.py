"""
Script para registrar um ponto hoje e verificar o dashboard
"""
import requests
import json
from datetime import datetime

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
    exit(1)

token = login_response.json().get('token')
print(f"✅ Login OK")

headers = {"Authorization": f"Bearer {token}"}

# 2. Registrar entrada hoje
print("\n⏰ Registrando entrada...")
hoje = datetime.now().strftime('%Y-%m-%d')
entrada_response = requests.post(
    f"{BASE_URL}/api/v2/registrar-ponto",
    headers=headers,
    json={
        "tipo_registro": "entrada",
        "latitude": -23.550520,
        "longitude": -46.633308,
        "work_mode": "onsite"
    }
)

print(f"Status: {entrada_response.status_code}")
if entrada_response.status_code == 200:
    print("✅ Entrada registrada!")
    print(json.dumps(entrada_response.json(), indent=2, ensure_ascii=False))
else:
    print(f"❌ Erro: {entrada_response.json()}")

# 3. Verificar dashboard de hoje
print(f"\n📊 Verificando dashboard de hoje ({hoje})...")
dashboard_response = requests.get(
    f"{BASE_URL}/api/v2/dashboard/company/{hoje}",
    headers=headers
)

print(f"Status: {dashboard_response.status_code}")
if dashboard_response.status_code == 200:
    data = dashboard_response.json()
    print("\n✅ Dashboard atualizado:")
    print(f"- Total funcionários: {data['summary']['total_employees']}")
    print(f"- Presentes: {data['summary']['present']}")
    print(f"- Horas trabalhadas: {data['summary'].get('total_worked_minutes', 0) / 60:.1f}h")
    print(f"- Horas esperadas: {data['summary'].get('total_expected_minutes', 0) / 60:.1f}h")
    print(f"\n👥 Funcionários:")
    for emp in data.get('employees', []):
        print(f"  - {emp.get('employee_name', emp.get('employee_id'))}: {emp.get('status')}")
else:
    print(f"❌ Erro: {dashboard_response.json()}")
