# backend/routes/audit.py
"""
GET /api/audit — lista logs de auditoria da empresa.
Params: user_id, action, entity, date_from, date_to, limit (max 500)
"""
from __future__ import annotations
from flask import Blueprint, request, jsonify
import boto3
import os
from boto3.dynamodb.conditions import Key, Attr
from utils.auth import token_required, require_permission

audit_routes = Blueprint('audit_routes', __name__)

_dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
_table_audit = _dynamodb.Table(os.environ.get('DYNAMODB_TABLE_AUDIT', 'AuditLogs'))


@audit_routes.route('/api/audit', methods=['GET', 'OPTIONS'])
@token_required
@require_permission('configuracoes')
def get_audit_logs(payload):
    if request.method == 'OPTIONS':
        return '', 200

    company_id = payload.get('company_id')
    if not company_id:
        return jsonify({'error': 'company_id ausente no token'}), 400

    date_from      = (request.args.get('date_from') or '').strip()
    date_to        = (request.args.get('date_to') or '').strip()
    filter_user    = (request.args.get('user_id') or '').strip()
    filter_action  = (request.args.get('action') or '').strip()
    filter_entity  = (request.args.get('entity') or '').strip()
    limit          = min(int(request.args.get('limit', 100)), 500)

    key_cond = Key('company_id').eq(company_id)
    if date_from and date_to:
        key_cond = key_cond & Key('created_at_log_id').between(date_from, date_to + '\xff')
    elif date_from:
        key_cond = key_cond & Key('created_at_log_id').gte(date_from)

    filter_expr = None
    if filter_user:
        filter_expr = Attr('user_id').eq(filter_user)
    if filter_action:
        cond = Attr('action').eq(filter_action)
        filter_expr = cond if filter_expr is None else (filter_expr & cond)
    if filter_entity:
        cond = Attr('entity').eq(filter_entity)
        filter_expr = cond if filter_expr is None else (filter_expr & cond)

    kwargs: dict = {
        'KeyConditionExpression': key_cond,
        'Limit': limit,
        'ScanIndexForward': False,
    }
    if filter_expr is not None:
        kwargs['FilterExpression'] = filter_expr

    resp = _table_audit.query(**kwargs)
    logs = resp.get('Items', [])

    return jsonify({'logs': logs, 'count': len(logs)}), 200
