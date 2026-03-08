# Script de teste automatizado para todas as rotas principais do backend
import requests
import json
import random
import string

BASE_URL = "http://localhost:5000"

def random_str(n=6):
	return ''.join(random.choices(string.ascii_lowercase, k=n))

def print_result(desc, resp):
	print(f"\n[TEST] {desc}")
	print(f"Status: {resp.status_code}")
	try:
		print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
	except Exception:
		print(resp.text)

# 1. Health check
resp = requests.get(f"{BASE_URL}/")
print_result("Health check", resp)

# 2. Autenticação (ajuste conforme seu endpoint de login)
LOGIN_URL = f"{BASE_URL}/auth/login"
login_data = {"login": "teste", "senha": "123123"}
resp = requests.post(LOGIN_URL, json=login_data)
print_result("Login", resp)
token = resp.json().get("token")
headers = {"Authorization": f"Bearer {token}"} if token else {}

# 3. Cadastrar funcionário
funcionario_nome = f"Teste{random_str()}"
funcionario_data = {
	"nome": funcionario_nome,
	"cargo": "Analista",
	"login": f"{funcionario_nome.lower()}@mail.com",
	"senha": "123456",
	"horario_entrada": "08:00",
	"horario_saida": "17:00"
}
resp = requests.post(f"{BASE_URL}/cadastrar_funcionario", headers=headers, json=funcionario_data)
print_result("Cadastrar funcionário", resp)
funcionario_id = resp.json().get("id") or resp.json().get("funcionario", {}).get("id")

# 4. Listar funcionários
resp = requests.get(f"{BASE_URL}/funcionarios", headers=headers)
print_result("Listar funcionários", resp)

# 5. Atualizar funcionário
if funcionario_id:
	update_data = {"nome": funcionario_nome+"_edit", "cargo": "Gerente"}
	resp = requests.put(f"{BASE_URL}/funcionarios/{funcionario_id}", headers=headers, data=update_data)
	print_result("Atualizar funcionário", resp)

# 6. Upload de foto (simulado)
# (Descomente se quiser testar upload real)
# files = {"foto": open("/caminho/para/foto.jpg", "rb")}
# resp = requests.put(f"{BASE_URL}/funcionarios/{funcionario_id}/foto", headers=headers, files=files)
# print_result("Upload foto funcionário", resp)

# 7. Registrar ponto manual
registro_data = {
	"employee_id": funcionario_id,
	"data_hora": "2026-02-19 08:05",
	"tipo": "entrada",
	"justificativa": "Teste registro manual"
}
resp = requests.post(f"{BASE_URL}/registrar_ponto_manual", headers=headers, json=registro_data)
print_result("Registrar ponto manual", resp)

# 8. Listar registros
resp = requests.get(f"{BASE_URL}/registros", headers=headers)
print_result("Listar registros", resp)

# 9. Resumo de registros
resp = requests.get(f"{BASE_URL}/registros/resumo", headers=headers)
print_result("Resumo de registros", resp)

# 10. Ajustar registro (pega o primeiro registro listado)
registros = resp.json() if isinstance(resp.json(), list) else []
registro_id = None
if registros:
	registro_id = registros[0].get("registro_id")
if registro_id:
	ajuste_data = {"justificativa": "Ajuste teste", "data_hora": "2026-02-19 08:10", "tipo": "entrada"}
	resp = requests.post(f"{BASE_URL}/registros/{registro_id}/ajustar", headers=headers, json=ajuste_data)
	print_result("Ajustar registro", resp)

# 11. Invalidar registro (pega o primeiro registro listado)
if registro_id:
	invalida_data = {"justificativa": "Teste invalidação"}
	resp = requests.put(f"{BASE_URL}/registros/{registro_id}/invalidar", headers=headers, json=invalida_data)
	print_result("Invalidar registro", resp)

# 12. Buscar nomes
resp = requests.get(f"{BASE_URL}/buscar_nomes?nome={funcionario_nome}", headers=headers)
print_result("Buscar nomes", resp)

# 13. Enviar email de registros (simulado)
email_data = {
	"funcionario": funcionario_nome,
	"periodo": "02/2026",
	"registros": [],
	"email": "teste@mail.com"
}
resp = requests.post(f"{BASE_URL}/enviar-email-registros", headers=headers, json=email_data)
print_result("Enviar email de registros", resp)

# 14. Excluir funcionário
if funcionario_id:
	resp = requests.delete(f"{BASE_URL}/funcionarios/{funcionario_id}", headers=headers)
	print_result("Excluir funcionário", resp)
