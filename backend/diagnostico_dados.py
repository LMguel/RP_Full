"""
Script diagnóstico para verificar dados no DynamoDB
"""
import boto3
from boto3.dynamodb.conditions import Key, Attr
from datetime import datetime, date
import json
from decimal import Decimal

# Converter Decimal para JSON
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

def check_time_records():
    """Verifica registros na tabela TimeRecords"""
    print("\n" + "="*80)
    print("VERIFICANDO TIMERECORDS")
    print("="*80)
    
    table = dynamodb.Table('TimeRecords')
    
    # Buscar todos os registros
    response = table.scan()
    all_records = response.get('Items', [])
    
    print(f"\n📊 Total de registros: {len(all_records)}")
    
    # Filtrar por data 15/11/2025
    records_1511 = [r for r in all_records if r.get('data_hora', '')[:10] == '2025-11-15']
    
    print(f"📅 Registros do dia 15/11/2025: {len(records_1511)}")
    
    if records_1511:
        print("\n🔍 Primeiros 5 registros:")
        for r in records_1511[:5]:
            print(f"  - {r.get('funcionario_nome', 'N/A')}: {r.get('tipo')} às {r.get('data_hora')}")
            print(f"    Company: {r.get('company_id')}, Employee: {r.get('funcionario_id')}")
    
    # Agrupar por data
    from collections import defaultdict
    by_date = defaultdict(int)
    for r in all_records:
        data_hora = r.get('data_hora', '')
        if data_hora:
            record_date = data_hora[:10]
            by_date[record_date] += 1
    
    print(f"\n📈 Registros por data:")
    for date_str in sorted(by_date.keys(), reverse=True)[:10]:
        print(f"  - {date_str}: {by_date[date_str]} registros")
    
    return all_records, records_1511

def check_daily_summary():
    """Verifica tabela DailySummary"""
    print("\n" + "="*80)
    print("VERIFICANDO DAILYSUMMARY")
    print("="*80)
    
    table = dynamodb.Table('DailySummary')
    
    try:
        response = table.scan()
        items = response.get('Items', [])
        
        print(f"\n📊 Total de resumos diários: {len(items)}")
        
        # Filtrar por data 15/11/2025
        summaries_1511 = [s for s in items if s.get('date') == '2025-11-15']
        
        print(f"📅 Resumos do dia 15/11/2025: {len(summaries_1511)}")
        
        if summaries_1511:
            print("\n🔍 Resumos encontrados:")
            for s in summaries_1511:
                print(f"  - {s.get('employee_id')}: {s.get('status')}")
                print(f"    Entrada: {s.get('actual_start')}, Saída: {s.get('actual_end')}")
                print(f"    Horas: {s.get('worked_hours')}h de {s.get('expected_hours')}h")
        
        # Agrupar por data
        from collections import defaultdict
        by_date = defaultdict(int)
        for s in items:
            date_str = s.get('date')
            if date_str:
                by_date[date_str] += 1
        
        print(f"\n📈 Resumos por data:")
        for date_str in sorted(by_date.keys(), reverse=True)[:10]:
            print(f"  - {date_str}: {by_date[date_str]} resumos")
        
        return items, summaries_1511
    except Exception as e:
        print(f"❌ Erro ao acessar DailySummary: {e}")
        print("   (Tabela pode não existir ainda)")
        return [], []

def check_employees():
    """Verifica tabela de funcionários"""
    print("\n" + "="*80)
    print("VERIFICANDO EMPLOYEES")
    print("="*80)
    
    table = dynamodb.Table('Employees')
    
    try:
        response = table.scan()
        employees = response.get('Items', [])
        
        print(f"\n👥 Total de funcionários: {len(employees)}")
        
        # Mostrar alguns funcionários
        print("\n🔍 Funcionários cadastrados:")
        for emp in employees[:5]:
            print(f"  - {emp.get('nome', 'N/A')} (ID: {emp.get('id')})")
            print(f"    Company: {emp.get('company_id')}")
        
        return employees
    except Exception as e:
        print(f"❌ Erro ao acessar Employees: {e}")
        return []

def main():
    print("\n🔬 DIAGNÓSTICO DO SISTEMA")
    print("="*80)
    
    # 1. TimeRecords
    all_records, records_1511 = check_time_records()
    
    # 2. DailySummary
    all_summaries, summaries_1511 = check_daily_summary()
    
    # 3. Employees
    employees = check_employees()
    
    # Resumo final
    print("\n" + "="*80)
    print("📋 RESUMO")
    print("="*80)
    print(f"✅ TimeRecords: {len(all_records)} registros")
    print(f"   - 15/11/2025: {len(records_1511)} registros")
    print(f"✅ DailySummary: {len(all_summaries)} resumos")
    print(f"   - 15/11/2025: {len(summaries_1511)} resumos")
    print(f"✅ Employees: {len(employees)} funcionários")
    
    if records_1511 and not summaries_1511:
        print("\n⚠️  PROBLEMA IDENTIFICADO:")
        print("   Existem registros para 15/11/2025 mas nenhum resumo diário.")
        print("   O cache DailySummary precisa ser populado.")
        print("\n💡 SOLUÇÃO:")
        print("   1. O endpoint do dashboard agora calculará on-the-fly")
        print("   2. Ou use o endpoint /api/v2/rebuild/daily para popular o cache")
    
    print("\n" + "="*80)

if __name__ == '__main__':
    main()
