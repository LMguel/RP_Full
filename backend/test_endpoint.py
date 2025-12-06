#!/usr/bin/env python
import sys
import requests
import json

try:
    url = 'http://localhost:5000/api/admin/companies'
    print(f"Testando {url}...")
    response = requests.get(url, timeout=5)
    print(f'Status: {response.status_code}')
    
    if response.status_code == 200:
        data = response.json()
        print(json.dumps(data, indent=2, default=str))
    else:
        print(f'Erro {response.status_code}: {response.text}')
        
except requests.exceptions.ConnectionError as e:
    print(f'Erro de conexão: {e}')
    print('O servidor não está respondendo em localhost:5000')
except Exception as e:
    print(f'Erro: {type(e).__name__}: {e}')
    sys.exit(1)

