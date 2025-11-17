"""
Script de migração para adicionar campos de exclusão lógica aos funcionários existentes
"""
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('Employees')

def migrate_employees():
    """
    Adiciona campos is_active e deleted_at aos funcionários existentes
    """
    print("=" * 80)
    print("MIGRAÇÃO: Adicionar campos de exclusão lógica")
    print("=" * 80)
    
    # Scan todos os funcionários
    response = table.scan()
    employees = response.get('Items', [])
    
    print(f"\n📊 Total de funcionários encontrados: {len(employees)}")
    
    updated = 0
    errors = 0
    
    for employee in employees:
        company_id = employee.get('company_id')
        employee_id = employee.get('id')
        
        # Verificar se já tem os campos
        has_is_active = 'is_active' in employee
        has_deleted_at = 'deleted_at' in employee
        
        if has_is_active and has_deleted_at:
            print(f"⏭️  {employee.get('nome')} - Já possui campos de exclusão lógica")
            continue
        
        try:
            # Adicionar campos se não existirem
            update_expr = "SET "
            expr_values = {}
            
            if not has_is_active:
                update_expr += "is_active = :is_active, ativo = :ativo"
                expr_values[':is_active'] = True
                expr_values[':ativo'] = True
            
            if not has_deleted_at:
                if not has_is_active:
                    update_expr += ", "
                update_expr += "deleted_at = :deleted_at"
                expr_values[':deleted_at'] = None
            
            # Atualizar
            table.update_item(
                Key={
                    'company_id': company_id,
                    'id': employee_id
                },
                UpdateExpression=update_expr,
                ExpressionAttributeValues=expr_values
            )
            
            print(f"✅ {employee.get('nome')} - Campos adicionados")
            updated += 1
            
        except Exception as e:
            print(f"❌ Erro ao atualizar {employee.get('nome')}: {e}")
            errors += 1
    
    print("\n" + "=" * 80)
    print(f"📊 RESULTADO DA MIGRAÇÃO:")
    print(f"  - Total: {len(employees)}")
    print(f"  - Atualizados: {updated}")
    print(f"  - Erros: {errors}")
    print(f"  - Já tinham os campos: {len(employees) - updated - errors}")
    print("=" * 80)

if __name__ == '__main__':
    confirm = input("⚠️  Esta operação atualizará TODOS os funcionários no DynamoDB. Confirmar? (sim/não): ")
    if confirm.lower() == 'sim':
        migrate_employees()
    else:
        print("Operação cancelada.")
