import requests
import json

# Login
url_login = 'http://localhost:5000/api/login'
credentials = {
    'usuario_id': 'aaa',
    'senha': 'aaaaaa'
}

print("🔐 Fazendo login...")
response = requests.post(url_login, json=credentials)
print(f"Status: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    token = data.get('token')
    print(f"\n✅ Login realizado com sucesso!")
    print(f"Token: {token[:50]}...")
    
    # Testar endpoint V2
    print(f"\n📊 Testando endpoint V2 dashboard...")
    url_dashboard = 'http://localhost:5000/api/v2/dashboard/company/2025-11-13'
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    response_v2 = requests.get(url_dashboard, headers=headers)
    print(f"Status: {response_v2.status_code}")
    
    if response_v2.status_code == 200:
        print(f"\n✅ Endpoint V2 funcionando!")
        print(json.dumps(response_v2.json(), indent=2))
    else:
        print(f"\n❌ Erro no endpoint V2:")
        print(response_v2.text)
else:
    print(f"\n❌ Erro no login:")
    print(response.text)
