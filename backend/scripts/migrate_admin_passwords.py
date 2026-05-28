#!/usr/bin/env python3
"""
Script de migração: Converte senhas admin de plaintext para bcrypt.

Uso:
    # Dry-run (lista contas afetadas, não altera)
    python scripts/migrate_admin_passwords.py

    # Executar migração real
    python scripts/migrate_admin_passwords.py --execute

Requer:
    pip install bcrypt boto3 python-dotenv
"""
import boto3
import bcrypt
import os
import sys
from dotenv import load_dotenv

load_dotenv()

DRY_RUN = '--execute' not in sys.argv

REGION = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')
dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table('AdminUsers')


def is_bcrypt_hash(value: str) -> bool:
    return isinstance(value, str) and (value.startswith('$2b$') or value.startswith('$2a$'))


def scan_all_admins():
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
    print(f"{'[DRY-RUN] ' if DRY_RUN else ''}Migrando senhas admin para bcrypt — tabela: AdminUsers")
    print()

    admins = scan_all_admins()
    needs_migration = []

    for admin in admins:
        has_hash = is_bcrypt_hash(admin.get('password_hash', ''))
        has_plain = bool(admin.get('password', ''))
        if has_plain and not has_hash:
            needs_migration.append(admin)

    print(f"Total de admins: {len(admins)}")
    print(f"Precisam de migração (plaintext → bcrypt): {len(needs_migration)}")

    if not needs_migration:
        print("[OK] Todos os admins já usam bcrypt.")
        return

    if DRY_RUN:
        print("\n[DRY-RUN] Contas que seriam migradas:")
        for admin in needs_migration:
            print(f"  - login={admin.get('login')}")
        print(f"\nExecute com --execute para aplicar.")
        return

    migrated = 0
    errors = 0
    for admin in needs_migration:
        login = admin.get('login')
        plain_password = admin.get('password', '')
        if not login or not plain_password:
            continue
        try:
            hashed = bcrypt.hashpw(plain_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            table.update_item(
                Key={'login': login},
                UpdateExpression='SET password_hash = :h REMOVE #pw',
                ExpressionAttributeNames={'#pw': 'password'},
                ExpressionAttributeValues={':h': hashed},
            )
            migrated += 1
            print(f"  [MIGRATED] Admin '{login}' → bcrypt")
        except Exception as e:
            errors += 1
            print(f"  [ERROR] Falha ao migrar '{login}': {e}")

    print(f"\n[MIGRATION] Concluído — {migrated} migrados, {errors} erros")
    if migrated > 0:
        print("\n[IMPORTANTE] Teste o login de cada conta admin antes de prosseguir.")


if __name__ == '__main__':
    main()
