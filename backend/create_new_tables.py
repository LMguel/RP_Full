"""
Script para criar as NOVAS tabelas DynamoDB com estrutura escalável
Executa: python create_new_tables.py
"""
import boto3
import sys
import io

# Configurar encoding UTF-8 para Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

dynamodb = boto3.client('dynamodb', region_name='us-east-1')

def criar_tabela_daily_summary():
    """Cria tabela DailySummary para resumos diários"""
    try:
        response = dynamodb.create_table(
            TableName='DailySummary',
            KeySchema=[
                {'AttributeName': 'company_id', 'KeyType': 'HASH'},
                {'AttributeName': 'employee_id#date', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'company_id', 'AttributeType': 'S'},
                {'AttributeName': 'employee_id#date', 'AttributeType': 'S'},
                {'AttributeName': 'date', 'AttributeType': 'S'},
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'DateIndex',
                    'KeySchema': [
                        {'AttributeName': 'company_id', 'KeyType': 'HASH'},
                        {'AttributeName': 'date', 'KeyType': 'RANGE'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        print("✅ Tabela DailySummary criada com sucesso!")
        return True
    except dynamodb.exceptions.ResourceInUseException:
        print("⚠️  Tabela DailySummary já existe")
        return True
    except Exception as e:
        print(f"❌ Erro ao criar DailySummary: {e}")
        return False

def criar_tabela_monthly_summary():
    """Cria tabela MonthlySummary para resumos mensais"""
    try:
        response = dynamodb.create_table(
            TableName='MonthlySummary',
            KeySchema=[
                {'AttributeName': 'company_id', 'KeyType': 'HASH'},
                {'AttributeName': 'employee_id#month', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'company_id', 'AttributeType': 'S'},
                {'AttributeName': 'employee_id#month', 'AttributeType': 'S'},
                {'AttributeName': 'month', 'AttributeType': 'S'},
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'MonthIndex',
                    'KeySchema': [
                        {'AttributeName': 'company_id', 'KeyType': 'HASH'},
                        {'AttributeName': 'month', 'KeyType': 'RANGE'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        print("✅ Tabela MonthlySummary criada com sucesso!")
        return True
    except dynamodb.exceptions.ResourceInUseException:
        print("⚠️  Tabela MonthlySummary já existe")
        return True
    except Exception as e:
        print(f"❌ Erro ao criar MonthlySummary: {e}")
        return False

def verificar_tabelas_existentes():
    """Verifica quais tabelas já existem"""
    try:
        response = dynamodb.list_tables()
        tabelas = response.get('TableNames', [])
        return tabelas
    except Exception as e:
        print(f"❌ Erro ao listar tabelas: {e}")
        return []

if __name__ == "__main__":
    print("\n" + "="*70)
    print("CRIAÇÃO DE NOVAS TABELAS DYNAMODB")
    print("="*70 + "\n")
    
    # Verificar tabelas existentes
    print("📋 Verificando tabelas existentes...")
    tabelas_existentes = verificar_tabelas_existentes()
    print(f"   Tabelas encontradas: {len(tabelas_existentes)}")
    for tabela in sorted(tabelas_existentes):
        print(f"   - {tabela}")
    print()
    
    # Criar novas tabelas
    print("🔨 Criando novas tabelas...\n")
    
    sucesso_daily = criar_tabela_daily_summary()
    sucesso_monthly = criar_tabela_monthly_summary()
    
    print("\n" + "="*70)
    if sucesso_daily and sucesso_monthly:
        print("✅ TODAS AS TABELAS FORAM CRIADAS COM SUCESSO!")
    else:
        print("⚠️  ALGUMAS TABELAS NÃO FORAM CRIADAS")
    print("="*70 + "\n")
