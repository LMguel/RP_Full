# backend/services/audit_service.py
from __future__ import annotations
import boto3
import os
import uuid
from datetime import datetime, timezone

_dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
_table_name = os.environ.get('DYNAMODB_TABLE_AUDIT', 'AuditLogs')
_table = None


def _get_table():
    global _table
    if _table is None:
        _table = _dynamodb.Table(_table_name)
    return _table


def log_event(
    company_id: str,
    user_id: str,
    user_name: str,
    entity: str,
    entity_id: str,
    action: str,
    before: dict | None,
    after: dict | None,
    request=None,
    employee_id: str = '',
    employee_name: str = '',
    reason: str = '',
) -> None:
    """Registra evento na tabela AuditLogs. Fire-and-forget — nunca propaga exceção."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        log_id = str(uuid.uuid4())
        item: dict = {
            'company_id': company_id,
            'created_at_log_id': f"{now}#{log_id}",
            'log_id': log_id,
            'user_id': user_id or '',
            'user_name': user_name or '',
            'entity': entity,
            'entity_id': entity_id or '',
            'action': action,
            'created_at': now,
        }
        if employee_id:
            item['employee_id'] = employee_id
        if employee_name:
            item['employee_name'] = employee_name
        if reason:
            item['reason'] = reason
        if before is not None:
            item['before'] = before
        if after is not None:
            item['after'] = after
        if request is not None:
            item['ip'] = request.headers.get('X-Forwarded-For', '') or (request.remote_addr or '')
            item['device'] = (request.headers.get('User-Agent') or '')[:200]
        _get_table().put_item(Item=item)
    except Exception as exc:
        print(f"[AUDIT] log_event falhou silenciosamente: {exc}")
