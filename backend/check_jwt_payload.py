"""
Script para verificar o payload do JWT
"""
import requests
import jwt

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
    print(f"❌ Erro no login")
    exit(1)

token = login_response.json().get('token')
print(f"✅ Login OK\n")

# 2. Decodificar token (sem verificar assinatura)
print("🔍 Payload do JWT:")
payload = jwt.decode(token, options={"verify_signature": False})
print(f"  - usuario_id: {payload.get('usuario_id')}")
print(f"  - company_id: {payload.get('company_id')}")
print(f"  - id: {payload.get('id')}")
print(f"  - empresa_id: {payload.get('empresa_id')}")
print(f"\nPayload completo:")
import json
print(json.dumps(payload, indent=2, ensure_ascii=False))
