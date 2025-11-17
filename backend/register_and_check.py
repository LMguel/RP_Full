"""
Registrar ponto usando API V1 (que funciona) e depois verificar no V2
"""
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:5000"

# 1. Login
print("🔐 Login...")
login = requests.post(f"{BASE_URL}/api/login", json={"usuario_id": "aaa", "senha": "aaaaaa"})
token = login.json().get('token')
headers = {"Authorization": f"Bearer {token}"}
print("✅ Login OK")

# 2. Registrar entrada usando V1
print("\n⏰ Registrando ENTRADA (V1)...")
entrada = requests.post(
    f"{BASE_URL}/api/registrar_ponto",
    headers=headers,
    json={
        "tipo_registro": "entrada",
        "latitude": -23.550520,
        "longitude": -46.633308
    }
)
print(f"Status: {entrada.status_code}")
if entrada.status_code == 200:
    print("✅ Entrada registrada!")
else:
    print(f"❌ Erro: {entrada.json()}")
    exit(1)

# 3. Aguardar um pouco
print("\n⏳ Aguardando 2 segundos...")
import time
time.sleep(2)

# 4. Registrar saída usando V1
print("\n⏰ Registrando SAÍDA (V1)...")
saida = requests.post(
    f"{BASE_URL}/api/registrar_ponto",
    headers=headers,
    json={
        "tipo_registro": "saida",
        "latitude": -23.550520,
        "longitude": -46.633308
    }
)
print(f"Status: {saida.status_code}")
if saida.status_code == 200:
    print("✅ Saída registrada!")
else:
    print(f"❌ Erro: {saida.json()}")

# 5. Verificar dashboard hoje
hoje = datetime.now().strftime('%Y-%m-%d')
print(f"\n📊 Dashboard de hoje ({hoje})...")
dashboard = requests.get(f"{BASE_URL}/api/v2/dashboard/company/{hoje}", headers=headers)

if dashboard.status_code == 200:
    data = dashboard.json()
    print(f"✅ Dados do dashboard:")
    print(f"  - Funcionários: {data['summary']['total_employees']}")
    print(f"  - Presentes: {data['summary']['present']}")
    print(f"  - Trabalhadas: {data['summary'].get('total_worked_minutes', 0) / 60:.1f}h")
    print(f"  - Esperadas: {data['summary'].get('total_expected_minutes', 0) / 60:.1f}h")
    if data.get('employees'):
        for emp in data['employees']:
            print(f"\n  👤 {emp.get('employee_name', emp.get('employee_id'))}")
            print(f"     Status: {emp.get('status')}")
            print(f"     Entrada: {emp.get('actual_start')}")
            print(f"     Saída: {emp.get('actual_end')}")
            print(f"     Trabalhadas: {emp.get('worked_hours', 0) / 60:.1f}h")
            print(f"     Esperadas: {emp.get('expected_hours', 0) / 60:.1f}h")
            print(f"     Saldo: {emp.get('daily_balance', 0) / 60:.1f}h")
else:
    print(f"❌ Erro: {dashboard.json()}")
