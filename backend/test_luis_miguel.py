"""
Teste específico para o company_id conhecido
"""
import boto3
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

COMPANY_ID = '937373ab-6d74-4a67-a580-7c57c5e608e4'
EMPLOYEE_ID = 'luis_miguel_aa7c29'

print("="*70)
print(f"  TESTANDO REGISTROS DO LUIS MIGUEL")
print("="*70)
print(f"Company ID: {COMPANY_ID}")
print(f"Employee ID: {EMPLOYEE_ID}")

# Buscar registros
table_records = dynamodb.Table('TimeRecords')

print("\n1. Buscando TODOS os registros da empresa...")
response = table_records.scan(
    FilterExpression=Attr('company_id').eq(COMPANY_ID)
)
all_records = response.get('Items', [])
print(f"   Total de registros: {len(all_records)}")

print("\n2. Filtrando por funcionário...")
emp_records = []
for record in all_records:
    func_id = record.get('funcionario_id') or record.get('employee_id')
    if func_id == EMPLOYEE_ID:
        emp_records.append(record)

print(f"   Registros do Luis Miguel: {len(emp_records)}")

print("\n3. Detalhes de CADA registro:")
for i, record in enumerate(emp_records, 1):
    print(f"\n   Registro {i}:")
    print(f"   Chaves do objeto: {list(record.keys())}")
    for key, value in sorted(record.items()):
        print(f"      {key}: {value}")

print("\n4. Agrupando por data...")
from collections import defaultdict
grouped = defaultdict(list)

for record in emp_records:
    data_hora = record.get('data_hora', '')
    if data_hora:
        date_str = data_hora[:10]
        grouped[date_str].append(record)

print(f"   Total de dias: {len(grouped)}")
for date_str, day_records in sorted(grouped.items(), reverse=True):
    print(f"   - {date_str}: {len(day_records)} registro(s)")

print("\n5. Tentando calcular sumário para hoje (2025-11-15)...")
today = '2025-11-15'
if today in grouped:
    from summary_calculator import calculate_daily_summary
    
    print(f"   Registros de hoje: {len(grouped[today])}")
    for rec in grouped[today]:
        print(f"      - {rec.get('data_hora')} | tipo_registro: {rec.get('tipo_registro', 'N/A')}")
    
    try:
        summary = calculate_daily_summary(COMPANY_ID, EMPLOYEE_ID, today, grouped[today])
        
        if summary:
            print(f"\n   ✅ SUMÁRIO CALCULADO:")
            print(f"      - actual_start: {summary.actual_start}")
            print(f"      - actual_end: {summary.actual_end}")
            print(f"      - worked_hours: {float(summary.worked_hours):.2f}")
            print(f"      - expected_hours: {float(summary.expected_hours):.2f}")
            print(f"      - status: {summary.status}")
        else:
            print(f"\n   ❌ Sumário retornou None")
    except Exception as e:
        print(f"\n   ❌ Erro ao calcular: {e}")
        import traceback
        traceback.print_exc()
else:
    print(f"   ⚠️  Nenhum registro encontrado para {today}")

print("\n" + "="*70)
print("  CONCLUSÃO")
print("="*70)

if emp_records:
    print("✅ Registros existem no banco")
    print(f"✅ Total: {len(emp_records)} registro(s)")
    
    # Verificar se tem tipo_registro
    has_tipo = any(rec.get('tipo_registro') for rec in emp_records)
    if not has_tipo:
        print("⚠️  PROBLEMA: Campo 'tipo_registro' está vazio!")
        print("   Isso impede o cálculo correto do sumário")
        print("   Valores esperados: 'entrada', 'saida', 'in', 'out'")
else:
    print("❌ Nenhum registro encontrado")
