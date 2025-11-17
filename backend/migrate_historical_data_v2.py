"""
Script de Migração de Dados Históricos para V2.0
Adaptado para conta AWS 299000395480
Gera DailySummary e MonthlySummary usando o novo serviço
"""
import sys
import io
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import boto3
from datetime import datetime
from collections import defaultdict
from services.summaries import summary_service

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table_records = dynamodb.Table('TimeRecords')
table_employees = dynamodb.Table('Employees')
table_config = dynamodb.Table('ConfigCompany')

print("\n" + "="*70)
print("MIGRAÇÃO DE DADOS HISTÓRICOS PARA V2.0")
print("Conta AWS: 299000395480")
print("="*70 + "\n")

def get_all_companies():
    """Busca todas as empresas"""
    print("🏢 Buscando empresas...")
    response = table_config.scan()
    companies = response.get('Items', [])
    
    while 'LastEvaluatedKey' in response:
        response = table_config.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        companies.extend(response.get('Items', []))
    
    print(f"   Encontradas: {len(companies)} empresa(s)\n")
    return companies

def get_company_employees(company_id):
    """Busca todos os funcionários de uma empresa"""
    print(f"📋 Buscando funcionários da empresa {company_id}...")
    
    response = table_employees.query(
        KeyConditionExpression='company_id = :cid',
        ExpressionAttributeValues={':cid': company_id}
    )
    
    employees = response.get('Items', [])
    
    while 'LastEvaluatedKey' in response:
        response = table_employees.query(
            KeyConditionExpression='company_id = :cid',
            ExpressionAttributeValues={':cid': company_id},
            ExclusiveStartKey=response['LastEvaluatedKey']
        )
        employees.extend(response.get('Items', []))
    
    print(f"   Encontrados: {len(employees)} funcionários\n")
    return employees

def get_employee_records(company_id, employee_id):
    """Busca todos os registros de um funcionário"""
    response = table_records.query(
        KeyConditionExpression='company_id = :cid AND begins_with(#sk, :prefix)',
        ExpressionAttributeNames={'#sk': 'employee_id#date_time'},
        ExpressionAttributeValues={
            ':cid': company_id,
            ':prefix': employee_id
        }
    )
    
    records = response.get('Items', [])
    
    while 'LastEvaluatedKey' in response:
        response = table_records.query(
            KeyConditionExpression='company_id = :cid AND begins_with(#sk, :prefix)',
            ExpressionAttributeNames={'#sk': 'employee_id#date_time'},
            ExpressionAttributeValues={
                ':cid': company_id,
                ':prefix': employee_id
            },
            ExclusiveStartKey=response['LastEvaluatedKey']
        )
        records.extend(response.get('Items', []))
    
    return records

def extract_date_from_sk(sk):
    """Extrai data do sort key employee_id#date_time"""
    # Format: emp123#2025-11-13T14:30:00
    try:
        parts = sk.split('#')
        if len(parts) >= 2:
            date_time_str = parts[1]
            if 'T' in date_time_str:
                return date_time_str.split('T')[0]
            return date_time_str[:10]
    except:
        pass
    return None

def migrate_employee_data(company_id, employee, dry_run=False):
    """Migra dados de um funcionário usando o serviço de summaries"""
    employee_id = employee.get('id')  # Campo correto é 'id'
    nome = employee.get('nome', 'Desconhecido')  # Campo correto é 'nome'
    
    print(f"👤 {nome} ({employee_id})")
    
    # Buscar todos os registros
    records = get_employee_records(company_id, employee_id)
    
    if not records:
        print(f"   ⚠️  Nenhum registro encontrado\n")
        return 0, 0
    
    print(f"   📊 {len(records)} registros encontrados")
    
    # Agrupar por data
    dates = set()
    for record in records:
        sk = record.get('employee_id#date_time', '')
        date_str = extract_date_from_sk(sk)
        if date_str:
            dates.add(date_str)
    
    if not dates:
        print(f"   ⚠️  Nenhuma data válida encontrada\n")
        return 0, 0
    
    dates_list = sorted(dates)
    print(f"   📅 {len(dates_list)} dias com registros")
    print(f"   📆 Período: {dates_list[0]} até {dates_list[-1]}")
    
    # Gerar DailySummary para cada dia
    daily_count = 0
    for date_str in dates_list:
        try:
            if not dry_run:
                summary_service.recalc_daily_summary(company_id, employee_id, date_str)
            daily_count += 1
        except Exception as e:
            print(f"   ❌ Erro em {date_str}: {e}")
            if '--debug' in sys.argv:
                import traceback
                traceback.print_exc()
    
    # Agrupar por mês
    months = set()
    for date_str in dates_list:
        month_str = date_str[:7]  # YYYY-MM
        months.add(month_str)
    
    # Gerar MonthlySummary para cada mês
    monthly_count = 0
    for month_str in sorted(months):
        try:
            year, month = map(int, month_str.split('-'))
            if not dry_run:
                summary_service.recalc_monthly_summary(company_id, employee_id, year, month)
            monthly_count += 1
        except Exception as e:
            print(f"   ❌ Erro em {month_str}: {e}")
    
    print(f"   ✅ {daily_count} resumos diários gerados")
    print(f"   ✅ {monthly_count} resumos mensais gerados\n")
    
    return daily_count, monthly_count

def main(dry_run=True):
    """Executa migração completa"""
    
    if dry_run:
        print("🔍 MODO DRY RUN - Nada será salvo no banco")
        print("   Para salvar de verdade, execute: python migrate_historical_data_v2.py --execute\n")
    else:
        print("⚠️  MODO REAL - Dados serão salvos no DynamoDB!\n")
        confirm = input("Confirma migração? (sim/não): ")
        if confirm.lower() not in ['sim', 's', 'yes', 'y']:
            print("❌ Migração cancelada")
            return
    
    # Buscar todas as empresas
    companies = get_all_companies()
    
    if not companies:
        print("❌ Nenhuma empresa encontrada")
        return
    
    total_daily = 0
    total_monthly = 0
    total_employees = 0
    
    # Migrar cada empresa
    for company in companies:
        company_id = company.get('company_id')
        print(f"\n{'='*70}")
        print(f"🏢 Empresa: {company_id}")
        print(f"{'='*70}\n")
        
        # Buscar funcionários
        employees = get_company_employees(company_id)
        
        if not employees:
            print("⚠️  Nenhum funcionário encontrado para esta empresa\n")
            continue
        
        # Migrar cada funcionário
        for employee in employees:
            daily, monthly = migrate_employee_data(company_id, employee, dry_run)
            total_daily += daily
            total_monthly += monthly
            if daily > 0 or monthly > 0:
                total_employees += 1
    
    # Resumo final
    print("\n" + "="*70)
    print("RESUMO DA MIGRAÇÃO")
    print("="*70)
    print(f"✅ Funcionários migrados: {total_employees}")
    print(f"✅ DailySummary criados: {total_daily}")
    print(f"✅ MonthlySummary criados: {total_monthly}")
    print("="*70 + "\n")

if __name__ == '__main__':
    dry_run = '--execute' not in sys.argv
    
    try:
        main(dry_run=dry_run)
    except KeyboardInterrupt:
        print("\n\n❌ Migração interrompida pelo usuário")
    except Exception as e:
        print(f"\n\n❌ Erro fatal: {e}")
        if '--debug' in sys.argv:
            import traceback
            traceback.print_exc()
