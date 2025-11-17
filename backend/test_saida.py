"""
Teste: Verificar se o horário de saída está sendo registrado e retornado
"""
import boto3
from boto3.dynamodb.conditions import Attr
from datetime import date
from summary_calculator import calculate_daily_summary

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table_records = dynamodb.Table('TimeRecords')

COMPANY_ID = '937373ab-6d74-4a67-a580-7c57c5e608e4'
EMPLOYEE_ID = 'luis_miguel_aa7c29'

print("="*70)
print("  VERIFICANDO REGISTROS E HORÁRIO DE SAÍDA")
print("="*70)

# 1. Buscar TODOS os registros do Luis Miguel
print("\n1. Buscando todos os registros...")
response = table_records.scan(
    FilterExpression=Attr('company_id').eq(COMPANY_ID)
)
all_records = response.get('Items', [])

emp_records = [r for r in all_records 
               if (r.get('employee_id') == EMPLOYEE_ID or r.get('funcionario_id') == EMPLOYEE_ID)]

print(f"   Total de registros: {len(emp_records)}")

# 2. Agrupar por data
from collections import defaultdict
grouped = defaultdict(list)
for record in emp_records:
    data_hora = record.get('data_hora', '')
    if data_hora:
        date_str = data_hora[:10]
        grouped[date_str].append(record)

print(f"\n2. Dias com registros: {len(grouped)}")

# 3. Ver detalhes de hoje
today = '2025-11-15'
if today in grouped:
    print(f"\n3. Registros de HOJE ({today}):")
    for i, rec in enumerate(grouped[today], 1):
        print(f"   Registro {i}:")
        print(f"      - Data/Hora: {rec.get('data_hora')}")
        print(f"      - Tipo: {rec.get('tipo', rec.get('tipo_registro', 'N/A'))}")
        print(f"      - Método: {rec.get('metodo', 'N/A')}")
    
    # 4. Calcular sumário
    print(f"\n4. Calculando sumário...")
    try:
        target_date = date(2025, 11, 15)
        summary = calculate_daily_summary(COMPANY_ID, EMPLOYEE_ID, target_date)
        
        if summary:
            print(f"   ✅ Sumário calculado:")
            print(f"      - actual_start: {summary.actual_start}")
            print(f"      - actual_end: {summary.actual_end}")
            print(f"      - worked_hours: {float(summary.worked_hours):.2f}h")
            
            # 5. Verificar o que seria enviado ao frontend
            print(f"\n5. Campos que o frontend recebe:")
            print(f"      - first_entry_time: {summary.actual_start}")
            print(f"      - last_exit_time: {summary.actual_end}")
            
            if not summary.actual_end:
                print(f"\n   ⚠️  PROBLEMA: actual_end está None!")
                print(f"   Isso significa que não há registro de SAÍDA")
                print(f"\n   💡 SOLUÇÃO:")
                print(f"      1. Registre uma SAÍDA no sistema")
                print(f"      2. Ou verifique se o tipo está correto ('saida' ou 'out')")
        else:
            print(f"   ❌ Sumário retornou None")
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        import traceback
        traceback.print_exc()
else:
    print(f"\n   ⚠️  Nenhum registro encontrado para {today}")

print("\n" + "="*70)
print("  DIAGNÓSTICO")
print("="*70)

entrada_count = sum(1 for rec in emp_records if rec.get('tipo') == 'entrada')
saida_count = sum(1 for rec in emp_records if rec.get('tipo') == 'saida')

print(f"Total de ENTRADAS: {entrada_count}")
print(f"Total de SAÍDAS: {saida_count}")

if saida_count == 0:
    print(f"\n❌ PROBLEMA: Não há registros de SAÍDA!")
    print(f"   A tabela não pode mostrar horário de saída sem registro")
    print(f"\n💡 PRÓXIMOS PASSOS:")
    print(f"   1. Registre uma SAÍDA através da interface")
    print(f"   2. Verifique se o botão de saída está funcionando")
    print(f"   3. Recarregue a página de registros diários")
elif saida_count < entrada_count:
    print(f"\n⚠️  ATENÇÃO: Há mais entradas que saídas!")
    print(f"   Algumas entradas não foram finalizadas")
else:
    print(f"\n✅ OK: Há registros de entrada E saída")
