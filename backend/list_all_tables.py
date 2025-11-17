"""
Script simples para listar TODAS as tabelas e usuários
"""
import boto3
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

print("=" * 70)
print("  LISTANDO TODAS AS TABELAS DYNAMODB")
print("=" * 70)

client = boto3.client('dynamodb', region_name='us-east-1')
response = client.list_tables()
tables = response.get('TableNames', [])

print(f"\n✅ Total de tabelas: {len(tables)}")
for table_name in sorted(tables):
    print(f"   - {table_name}")

print("\n" + "=" * 70)
print("  BUSCANDO USUÁRIO 'aaa' EM TODAS AS TABELAS POSSÍVEIS")
print("=" * 70)

# Tentar em UserCompany
print("\n📋 Tentando UserCompany...")
try:
    table = dynamodb.Table('UserCompany')
    response = table.scan(Limit=10)
    items = response.get('Items', [])
    print(f"   ✅ Encontrados {len(items)} usuários")
    for item in items:
        print(f"      - usuario_id: {item.get('usuario_id', item.get('id', 'N/A'))}")
        print(f"        empresa_nome: {item.get('empresa_nome', 'N/A')}")
        print(f"        company_id: {item.get('company_id', 'N/A')}")
except Exception as e:
    print(f"   ❌ Erro: {e}")

# Tentar em UsuarioEmpresa
print("\n📋 Tentando UsuarioEmpresa...")
try:
    table = dynamodb.Table('UsuarioEmpresa')
    response = table.scan(Limit=10)
    items = response.get('Items', [])
    print(f"   ✅ Encontrados {len(items)} usuários")
    for item in items:
        print(f"      - usuario_id: {item.get('usuario_id', item.get('id', 'N/A'))}")
        print(f"        empresa_nome: {item.get('empresa_nome', 'N/A')}")
        print(f"        company_id: {item.get('empresa_id', item.get('company_id', 'N/A'))}")
except Exception as e:
    print(f"   ❌ Erro: {e}")

print("\n" + "=" * 70)
print("  BUSCANDO FUNCIONÁRIOS")
print("=" * 70)

# Listar funcionários em Employees
print("\n📋 Tentando Employees...")
try:
    table = dynamodb.Table('Employees')
    response = table.scan(Limit=10)
    items = response.get('Items', [])
    print(f"   ✅ Encontrados {len(items)} funcionários")
    for item in items:
        print(f"      - ID: {item.get('id', 'N/A')}")
        print(f"        Nome: {item.get('nome', 'N/A')}")
        print(f"        Company ID: {item.get('company_id', 'N/A')}")
except Exception as e:
    print(f"   ❌ Erro: {e}")

# Listar funcionários em Funcionarios
print("\n📋 Tentando Funcionarios...")
try:
    table = dynamodb.Table('Funcionarios')
    response = table.scan(Limit=10)
    items = response.get('Items', [])
    print(f"   ✅ Encontrados {len(items)} funcionários")
    for item in items:
        print(f"      - ID: {item.get('id', 'N/A')}")
        print(f"        Nome: {item.get('nome', 'N/A')}")
        print(f"        Company ID: {item.get('empresa_id', item.get('company_id', 'N/A'))}")
except Exception as e:
    print(f"   ❌ Erro: {e}")

print("\n" + "=" * 70)
print("  BUSCANDO REGISTROS DE PONTO")
print("=" * 70)

print("\n📋 Tentando TimeRecords...")
try:
    table = dynamodb.Table('TimeRecords')
    response = table.scan(Limit=5)
    items = response.get('Items', [])
    print(f"   ✅ Encontrados {len(items)} registros (primeiros 5)")
    for item in items:
        print(f"      - Data/Hora: {item.get('data_hora', 'N/A')}")
        print(f"        Funcionário: {item.get('funcionario_id', item.get('employee_id', 'N/A'))}")
        print(f"        Tipo: {item.get('tipo_registro', 'N/A')}")
        print(f"        Company ID: {item.get('company_id', 'N/A')}")
except Exception as e:
    print(f"   ❌ Erro: {e}")

print("\n📋 Tentando RegistrosPonto...")
try:
    table = dynamodb.Table('RegistrosPonto')
    response = table.scan(Limit=5)
    items = response.get('Items', [])
    print(f"   ✅ Encontrados {len(items)} registros (primeiros 5)")
    for item in items:
        print(f"      - Data/Hora: {item.get('data_hora', 'N/A')}")
        print(f"        Funcionário: {item.get('funcionario_id', 'N/A')}")
        print(f"        Tipo: {item.get('tipo', 'N/A')}")
except Exception as e:
    print(f"   ❌ Erro: {e}")
