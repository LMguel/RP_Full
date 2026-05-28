#!/usr/bin/env python3
"""
Script de migração LGPD: Remove senha_original (plaintext) de todos os funcionários.

Uso:
    # Modo dry-run (apenas lista, não altera)
    python scripts/remove_plaintext_passwords.py

    # Executar migração real
    python scripts/remove_plaintext_passwords.py --execute

Requer variáveis de ambiente:
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
    DYNAMODB_TABLE_EMPLOYEES (default: Employees)
"""
import boto3
import os
import sys
from dotenv import load_dotenv

load_dotenv()

DRY_RUN = '--execute' not in sys.argv

TABLE = os.environ.get('DYNAMODB_TABLE_EMPLOYEES', 'Employees')
REGION = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')

dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(TABLE)


def scan_all_items():
    items = []
    scan_kwargs = {}
    while True:
        response = table.scan(**scan_kwargs)
        items.extend(response.get('Items', []))
        last_key = response.get('LastEvaluatedKey')
        if not last_key:
            break
        scan_kwargs['ExclusiveStartKey'] = last_key
    return items


def main():
    print(f"{'[DRY-RUN] ' if DRY_RUN else ''}Iniciando migração — tabela: {TABLE}")
    print(f"{'[DRY-RUN] ' if DRY_RUN else ''}Nenhuma alteração será feita." if DRY_RUN else "ATENÇÃO: Esta operação é irreversível.")
    print()

    items = scan_all_items()
    affected = [i for i in items if 'senha_original' in i or 'password' in i]

    print(f"Total de funcionários: {len(items)}")
    print(f"Com senha_original ou password em plaintext: {len(affected)}")

    if not affected:
        print("[OK] Nenhum campo de senha plaintext encontrado.")
        return

    if DRY_RUN:
        print("\n[DRY-RUN] Funcionários que seriam alterados:")
        for item in affected:
            print(f"  - id={item.get('id')} company_id={item.get('company_id')} campos={[k for k in item if k in ('senha_original', 'password')]}")
        print(f"\nExecute com --execute para aplicar as alterações.")
        return

    removed = 0
    errors = 0
    for item in affected:
        company_id = item.get('company_id')
        emp_id = item.get('id')
        if not company_id or not emp_id:
            print(f"  [SKIP] Item sem company_id ou id: {item.keys()}")
            continue
        try:
            remove_expr = []
            if 'senha_original' in item:
                remove_expr.append('senha_original')
            # Nota: 'password' em funcionários é incomum — manter bcrypt hash intacto
            update_expr = 'REMOVE ' + ', '.join(remove_expr)
            table.update_item(
                Key={'company_id': company_id, 'id': emp_id},
                UpdateExpression=update_expr,
            )
            removed += 1
            print(f"  [MIGRATION] senha_original removido de {emp_id}")
        except Exception as e:
            errors += 1
            print(f"  [ERROR] Falha ao atualizar {emp_id}: {e}")

    print(f"\n[MIGRATION] Concluído — {removed} atualizados, {errors} erros")


if __name__ == '__main__':
    main()
