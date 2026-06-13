#!/usr/bin/env python3
"""
Migração: adiciona role=OWNER e campos de auditoria a todos os itens
existentes em UserCompany, e preenche criado_por nos TimeRecords sem esse campo.

Executar UMA VEZ após o deploy desta feature:
    cd backend && python migrations/migrate_users_roles.py

Requer variáveis de ambiente: AWS_REGION, DYNAMODB_TABLE_USERS, DYNAMODB_TABLE_RECORDS
"""
from __future__ import annotations
import boto3
import os
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key, Attr

AWS_REGION     = os.environ.get('AWS_REGION', 'us-east-1')
TABLE_USERS    = os.environ.get('DYNAMODB_TABLE_USERS', 'UserCompany')
TABLE_RECORDS  = os.environ.get('DYNAMODB_TABLE_RECORDS', 'TimeRecords')

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
tbl_users   = dynamodb.Table(TABLE_USERS)
tbl_records = dynamodb.Table(TABLE_RECORDS)


def paginate(table, **kwargs) -> list:
    items = []
    resp  = table.scan(**kwargs)
    items.extend(resp.get('Items', []))
    while resp.get('LastEvaluatedKey'):
        resp = table.scan(ExclusiveStartKey=resp['LastEvaluatedKey'], **kwargs)
        items.extend(resp.get('Items', []))
    return items


def migrate_users(now: str) -> dict[str, str]:
    """Adiciona role=OWNER nos itens sem role. Retorna mapa company_id → user_id."""
    print(f"[1/2] Varrendo tabela {TABLE_USERS}...")
    items = paginate(tbl_users)
    owner_map: dict[str, str] = {}
    updated = 0

    for item in items:
        company_id = item.get('company_id') or ''
        user_id    = item.get('user_id') or ''
        if not company_id or not user_id:
            continue

        if company_id not in owner_map:
            owner_map[company_id] = user_id

        if 'role' not in item:
            tbl_users.update_item(
                Key={'company_id': company_id, 'user_id': user_id},
                UpdateExpression=(
                    'SET #role = :role, #name = :name, active = :active, '
                    'created_at = :ca, created_by = :cb, '
                    'updated_at = :ua, updated_by = :ub, '
                    'permissions = :perms'
                ),
                ExpressionAttributeNames={'#role': 'role', '#name': 'name'},
                ExpressionAttributeValues={
                    ':role':   'OWNER',
                    ':name':   item.get('name') or item.get('empresa_nome') or 'Admin',
                    ':active': True,
                    ':ca':     now,
                    ':cb':     'system',
                    ':ua':     now,
                    ':ub':     'system',
                    ':perms':  {'add': [], 'remove': []},
                },
            )
            updated += 1
            print(f"  OWNER → company={company_id} user={user_id}")

    print(f"  {updated} itens atualizados, {len(owner_map)} empresas mapeadas.")
    return owner_map


def migrate_records(owner_map: dict[str, str]) -> None:
    """Preenche criado_por nos TimeRecords sem esse campo."""
    print(f"\n[2/2] Varrendo tabela {TABLE_RECORDS}...")
    total_updated = 0

    for company_id, owner_user_id in owner_map.items():
        items = []
        resp = tbl_records.query(
            KeyConditionExpression=Key('company_id').eq(company_id),
            FilterExpression=Attr('criado_por').not_exists(),
            ProjectionExpression='company_id, #edt',
            ExpressionAttributeNames={'#edt': 'employee_id#date_time'},
        )
        items.extend(resp.get('Items', []))
        while resp.get('LastEvaluatedKey'):
            resp = tbl_records.query(
                KeyConditionExpression=Key('company_id').eq(company_id),
                FilterExpression=Attr('criado_por').not_exists(),
                ProjectionExpression='company_id, #edt',
                ExpressionAttributeNames={'#edt': 'employee_id#date_time'},
                ExclusiveStartKey=resp['LastEvaluatedKey'],
            )
            items.extend(resp.get('Items', []))

        count = 0
        for rec in items:
            composite = rec.get('employee_id#date_time')
            if not composite:
                continue
            try:
                tbl_records.update_item(
                    Key={'company_id': company_id, 'employee_id#date_time': composite},
                    UpdateExpression='SET criado_por = :cp',
                    ConditionExpression=Attr('criado_por').not_exists(),
                    ExpressionAttributeValues={':cp': owner_user_id},
                )
                count += 1
            except Exception:
                pass  # ConditionalCheckFailed = já foi preenchido

        total_updated += count
        if count:
            print(f"  company={company_id}: {count} registros atualizados")

    print(f"  Total registros atualizados: {total_updated}")


def main() -> None:
    now = datetime.now(timezone.utc).isoformat()
    print(f"=== Migração multi-usuários {now} ===\n")

    owner_map = migrate_users(now)
    migrate_records(owner_map)

    print("\n=== Migração concluída com sucesso! ===")


if __name__ == '__main__':
    main()
