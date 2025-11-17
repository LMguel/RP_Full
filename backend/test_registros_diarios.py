"""
Script de teste para verificar dados de Registros Diários
Testa com login: aaa / senha: aaaaaa
Funcionário: luis miguel
"""
import boto3
from boto3.dynamodb.conditions import Key, Attr
from datetime import datetime, date
from decimal import Decimal

# Configuração
REGIAO = 'us-east-1'
dynamodb = boto3.resource('dynamodb', region_name=REGIAO)

# Tabelas
table_users = dynamodb.Table('UserCompany')
table_employees = dynamodb.Table('Employees')
table_records = dynamodb.Table('TimeRecords')
table_daily = dynamodb.Table('DailySummary')

def print_separator(title):
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)

def test_usuario():
    """Verifica se o usuário existe"""
    print_separator("1. VERIFICANDO USUÁRIO")
    
    try:
        response = table_users.scan(
            FilterExpression=Attr('usuario_id').eq('aaa')
        )
        items = response.get('Items', [])
        
        if items:
            user = items[0]
            print(f"✅ Usuário encontrado!")
            print(f"   - usuario_id: {user.get('usuario_id')}")
            print(f"   - empresa_nome: {user.get('empresa_nome')}")
            print(f"   - company_id: {user.get('company_id')}")
            return user.get('company_id')
        else:
            print("❌ Usuário 'aaa' não encontrado!")
            return None
    except Exception as e:
        print(f"❌ Erro ao buscar usuário: {e}")
        return None

def test_funcionarios(company_id):
    """Verifica funcionários da empresa"""
    print_separator("2. VERIFICANDO FUNCIONÁRIOS")
    
    if not company_id:
        print("❌ company_id não fornecido")
        return None
    
    try:
        response = table_employees.query(
            KeyConditionExpression=Key('company_id').eq(company_id)
        )
        items = response.get('Items', [])
        
        print(f"✅ Funcionários encontrados: {len(items)}")
        
        luis_miguel = None
        for emp in items:
            nome = emp.get('nome', emp.get('id', 'Sem nome'))
            print(f"   - ID: {emp.get('id')}")
            print(f"     Nome: {nome}")
            print(f"     Email: {emp.get('email', 'N/A')}")
            
            if 'luis' in nome.lower() and 'miguel' in nome.lower():
                luis_miguel = emp
                print(f"     ⭐ ESTE É O LUIS MIGUEL!")
        
        return luis_miguel
    except Exception as e:
        print(f"❌ Erro ao buscar funcionários: {e}")
        print(f"   Detalhes: {str(e)}")
        return None

def test_registros(company_id, employee_id):
    """Verifica registros de ponto"""
    print_separator("3. VERIFICANDO REGISTROS DE PONTO (TimeRecords)")
    
    if not company_id or not employee_id:
        print("❌ company_id ou employee_id não fornecido")
        return []
    
    try:
        # Buscar todos os registros da empresa
        response = table_records.scan(
            FilterExpression=Attr('company_id').eq(company_id)
        )
        all_records = response.get('Items', [])
        
        print(f"📊 Total de registros da empresa: {len(all_records)}")
        
        # Filtrar por funcionário
        emp_records = [r for r in all_records if r.get('funcionario_id') == employee_id or r.get('employee_id') == employee_id]
        
        print(f"✅ Registros do Luis Miguel: {len(emp_records)}")
        
        if emp_records:
            # Ordenar por data
            emp_records.sort(key=lambda x: x.get('data_hora', ''), reverse=True)
            
            print(f"\n📝 Últimos 5 registros:")
            for i, record in enumerate(emp_records[:5], 1):
                print(f"\n   Registro {i}:")
                print(f"   - ID: {record.get('id')}")
                print(f"   - Data/Hora: {record.get('data_hora')}")
                print(f"   - Tipo: {record.get('tipo_registro', 'N/A')}")
                print(f"   - Método: {record.get('metodo', 'N/A')}")
                print(f"   - Localização: {record.get('location', 'N/A')}")
                print(f"   - Foto: {record.get('foto', 'N/A')}")
        else:
            print("⚠️  Nenhum registro encontrado para este funcionário!")
        
        return emp_records
    except Exception as e:
        print(f"❌ Erro ao buscar registros: {e}")
        return []

def test_agrupamento(records):
    """Testa agrupamento por data"""
    print_separator("4. TESTANDO AGRUPAMENTO POR DATA")
    
    if not records:
        print("⚠️  Nenhum registro para agrupar")
        return {}
    
    from collections import defaultdict
    grouped = defaultdict(list)
    
    for record in records:
        data_hora = record.get('data_hora', '')
        if data_hora:
            record_date = data_hora[:10]  # YYYY-MM-DD
            grouped[record_date].append(record)
    
    print(f"✅ Dias com registros: {len(grouped)}")
    
    for date_str, day_records in sorted(grouped.items(), reverse=True):
        print(f"\n   📅 {date_str}: {len(day_records)} registro(s)")
        for record in day_records:
            print(f"      - {record.get('data_hora', 'N/A')} ({record.get('tipo_registro', 'N/A')})")
    
    return grouped

def test_calculo_sumario(company_id, employee_id, date_str, records):
    """Testa cálculo de sumário"""
    print_separator(f"5. TESTANDO CÁLCULO DE SUMÁRIO - {date_str}")
    
    try:
        from summary_calculator import calculate_daily_summary
        
        print(f"📊 Calculando sumário com {len(records)} registros...")
        
        summary = calculate_daily_summary(company_id, employee_id, date_str, records)
        
        if summary:
            print(f"✅ Sumário calculado com sucesso!")
            print(f"\n   Dados do Sumário:")
            print(f"   - Data: {summary.date}")
            print(f"   - Entrada (actual_start): {summary.actual_start}")
            print(f"   - Saída (actual_end): {summary.actual_end}")
            print(f"   - Horas Trabalhadas: {float(summary.worked_hours):.2f}h")
            print(f"   - Horas Previstas: {float(summary.expected_hours):.2f}h")
            print(f"   - Balanço: {float(summary.daily_balance):.2f}h")
            print(f"   - Status: {summary.status}")
            print(f"   - Atraso: {float(summary.delay_minutes):.0f} min")
            print(f"   - Total de registros: {summary.records_count}")
            return summary
        else:
            print("❌ Sumário retornou None!")
            return None
    except Exception as e:
        print(f"❌ Erro ao calcular sumário: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_daily_summary_table(company_id):
    """Verifica tabela DailySummary (cache)"""
    print_separator("6. VERIFICANDO TABELA DailySummary (CACHE)")
    
    try:
        response = table_daily.query(
            KeyConditionExpression=Key('company_id').eq(company_id)
        )
        items = response.get('Items', [])
        
        print(f"📊 Registros em cache: {len(items)}")
        
        if items:
            print(f"\n   Cache encontrado:")
            for item in items[:5]:
                print(f"   - {item.get('date')}: {item.get('employee_id')}")
                print(f"     worked_hours: {item.get('worked_hours')}")
                print(f"     actual_start: {item.get('actual_start')}")
                print(f"     actual_end: {item.get('actual_end')}")
        else:
            print("⚠️  Nenhum cache encontrado (normal - agora usa dados reais)")
        
        return items
    except Exception as e:
        print(f"❌ Erro ao buscar DailySummary: {e}")
        return []

def main():
    print("\n" + "🔍 TESTE COMPLETO - REGISTROS DIÁRIOS" + "\n")
    print("Login: aaa / Senha: aaaaaa")
    print("Funcionário: Luis Miguel")
    
    # 1. Verificar usuário
    company_id = test_usuario()
    if not company_id:
        print("\n❌ Teste abortado: Usuário não encontrado")
        return
    
    # 2. Verificar funcionários
    luis_miguel = test_funcionarios(company_id)
    if not luis_miguel:
        print("\n⚠️  Luis Miguel não encontrado! Listando todos os funcionários acima.")
        return
    
    employee_id = luis_miguel.get('id')
    print(f"\n✅ Employee ID do Luis Miguel: {employee_id}")
    
    # 3. Verificar registros
    records = test_registros(company_id, employee_id)
    if not records:
        print("\n❌ Teste abortado: Nenhum registro encontrado")
        print("   💡 Dica: Faça um registro de ponto primeiro!")
        return
    
    # 4. Agrupar por data
    grouped = test_agrupamento(records)
    
    # 5. Calcular sumário para cada dia
    if grouped:
        print_separator("5. CALCULANDO SUMÁRIOS PARA TODOS OS DIAS")
        for date_str, day_records in sorted(grouped.items(), reverse=True)[:3]:
            test_calculo_sumario(company_id, employee_id, date_str, day_records)
    
    # 6. Verificar cache
    test_daily_summary_table(company_id)
    
    # RESUMO FINAL
    print_separator("📋 RESUMO FINAL")
    print(f"✅ Empresa ID: {company_id}")
    print(f"✅ Funcionário ID: {employee_id}")
    print(f"✅ Total de registros: {len(records)}")
    print(f"✅ Dias com registros: {len(grouped)}")
    print(f"\n💡 CONCLUSÃO:")
    if records and grouped:
        print("   ✅ Dados estão no banco!")
        print("   ✅ Endpoint /api/registros-diarios deve funcionar")
        print("   📝 Se não aparece na tela, verificar:")
        print("      1. Token JWT está correto?")
        print("      2. Filtro de mês está correto?")
        print("      3. Frontend está fazendo a requisição?")
    else:
        print("   ❌ Sem dados suficientes para exibir")
        print("   💡 Registre um ponto de entrada primeiro!")

if __name__ == "__main__":
    main()
