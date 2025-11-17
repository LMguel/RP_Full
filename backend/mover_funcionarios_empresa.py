"""
Script para mover funcionários de teste para o company_id correto
"""
import boto3
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table_employees = dynamodb.Table('Employees')
table_records = dynamodb.Table('TimeRecords')
table_users = dynamodb.Table('UserCompany')

OLD_COMPANY_ID = 'empresa_teste_outubro'
NEW_COMPANY_ID = '937373ab-6d74-4a67-a580-7c57c5e608e4'

def mover_funcionarios():
    """Move funcionários para o company_id correto"""
    print("=" * 80)
    print("MOVENDO FUNCIONÁRIOS PARA EMPRESA CORRETA")
    print("=" * 80)
    print(f"De: {OLD_COMPANY_ID}")
    print(f"Para: {NEW_COMPANY_ID}")
    
    # 1. Buscar todos os funcionários da empresa antiga
    response = table_employees.scan(
        FilterExpression=Attr('company_id').eq(OLD_COMPANY_ID)
    )
    funcionarios = response.get('Items', [])
    
    print(f"\n📊 Funcionários encontrados: {len(funcionarios)}")
    
    if not funcionarios:
        print("❌ Nenhum funcionário encontrado na empresa antiga")
        return
    
    # 2. Deletar e recriar funcionários no novo company_id
    for func in funcionarios:
        old_id = func['id']
        nome = func.get('nome', 'N/A')
        
        try:
            # Deletar da empresa antiga
            table_employees.delete_item(
                Key={
                    'company_id': OLD_COMPANY_ID,
                    'id': old_id
                }
            )
            
            # Atualizar company_id e recriar
            func['company_id'] = NEW_COMPANY_ID
            func['empresa_nome'] = 'Empresa Principal'
            
            table_employees.put_item(Item=func)
            
            print(f"✅ {nome} (ID: {old_id})")
            
        except Exception as e:
            print(f"❌ Erro ao mover {nome}: {e}")
    
    print(f"\n✅ {len(funcionarios)} funcionários movidos!")

def mover_registros():
    """Move registros de ponto para o company_id correto"""
    print("\n" + "=" * 80)
    print("MOVENDO REGISTROS DE PONTO")
    print("=" * 80)
    
    # Buscar todos os registros da empresa antiga
    response = table_records.scan(
        FilterExpression=Attr('company_id').eq(OLD_COMPANY_ID)
    )
    registros = response.get('Items', [])
    
    print(f"\n📊 Registros encontrados: {len(registros)}")
    
    if not registros:
        print("❌ Nenhum registro encontrado na empresa antiga")
        return
    
    moved = 0
    
    for reg in registros:
        employee_id_date_time = reg.get('employee_id#date_time')
        
        try:
            # Deletar registro antigo
            table_records.delete_item(
                Key={
                    'company_id': OLD_COMPANY_ID,
                    'employee_id#date_time': employee_id_date_time
                }
            )
            
            # Atualizar company_id e recriar
            reg['company_id'] = NEW_COMPANY_ID
            reg['empresa_nome'] = 'Empresa Principal'
            
            table_records.put_item(Item=reg)
            
            moved += 1
            
            if moved % 100 == 0:
                print(f"  ... {moved} registros movidos")
            
        except Exception as e:
            print(f"❌ Erro ao mover registro {employee_id_date_time}: {e}")
    
    print(f"\n✅ {moved} registros movidos!")

def atualizar_usuario():
    """Atualiza o usuário 'aaa' para o company_id correto"""
    print("\n" + "=" * 80)
    print("ATUALIZANDO USUÁRIO")
    print("=" * 80)
    
    try:
        # Buscar usuário 'aaa'
        response = table_users.scan(
            FilterExpression=Attr('username').eq('aaa')
        )
        
        users = response.get('Items', [])
        
        if not users:
            print("❌ Usuário 'aaa' não encontrado")
            return
        
        user = users[0]
        user_id = user.get('user_id')
        
        # Atualizar company_id
        table_users.update_item(
            Key={'user_id': user_id},
            UpdateExpression='SET company_id = :new_company',
            ExpressionAttributeValues={
                ':new_company': NEW_COMPANY_ID
            }
        )
        
        print(f"✅ Usuário 'aaa' atualizado para company_id: {NEW_COMPANY_ID}")
        
    except Exception as e:
        print(f"❌ Erro ao atualizar usuário: {e}")

def main():
    print("=" * 80)
    print("MIGRAÇÃO DE DADOS PARA EMPRESA CORRETA")
    print("=" * 80)
    
    confirm = input("\n⚠️  Confirmar migração? (sim/não): ")
    if confirm.lower() != 'sim':
        print("Operação cancelada.")
        return
    
    # 1. Mover funcionários
    mover_funcionarios()
    
    # 2. Mover registros
    mover_registros()
    
    # 3. Atualizar usuário
    atualizar_usuario()
    
    print("\n" + "=" * 80)
    print("✅ MIGRAÇÃO COMPLETA!")
    print("=" * 80)
    print("\n🔑 Login: aaa")
    print("🔐 Senha: aaaaaa")
    print(f"🏢 Company ID: {NEW_COMPANY_ID}")

if __name__ == '__main__':
    main()
