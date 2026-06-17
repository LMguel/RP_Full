"""
Telemetria do kiosk: logs remotos e heartbeat de tablets.

POST /api/kiosk/logs                    — recebe batch de eventos do kioskLogger
POST /api/kiosk/heartbeat               — estado do tablet (versão, uptime, bateria, fila)
GET  /api/kiosk/heartbeats              — lista heartbeats da empresa autenticada

GET  /api/admin/kiosk/logs              — admin: todos os logs (filtrável por empresa/evento/data)
GET  /api/admin/kiosk/heartbeats        — admin: todos os heartbeats de todas as empresas
"""
from flask import Blueprint, request, jsonify
import boto3
import os
import time
import jwt as pyjwt
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from functools import wraps

from utils.auth import verify_token

_JWT_SECRET = os.getenv('JWT_SECRET_KEY', '')
_JWT_ALGORITHM = 'HS256'

kiosk_telemetry_routes = Blueprint('kiosk_telemetry_routes', __name__)

dynamodb = boto3.resource('dynamodb', region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1'))
_table_name = os.getenv('DYNAMODB_TABLE_KIOSK_TELEMETRY', 'KioskTelemetry')


def _get_table():
    return dynamodb.Table(_table_name)


def _table_missing(e: ClientError) -> bool:
    return e.response['Error']['Code'] in ('ResourceNotFoundException', 'ResourceNotReadyException')


def _admin_required(f):
    """Exige JWT válido com role=super_admin (admin-portal)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return ('', 200)
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'error': 'Token ausente'}), 401
        try:
            payload = pyjwt.decode(auth[7:], _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
        except pyjwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expirado'}), 401
        except pyjwt.InvalidTokenError:
            return jsonify({'error': 'Token inválido'}), 401
        if payload.get('role') != 'super_admin':
            return jsonify({'error': 'Acesso negado — requer super_admin'}), 403
        return f(*args, **kwargs)
    return decorated


def _token_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return ('', 200)
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'error': 'Token ausente'}), 401
        payload = verify_token(auth[7:])
        if not payload:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        return f(payload, *args, **kwargs)
    return decorated


# ─── POST /api/kiosk/logs ────────────────────────────────────────────────────

@kiosk_telemetry_routes.route('/api/kiosk/logs', methods=['POST'])
@_token_required
def receive_logs(payload):
    company_id = payload.get('company_id') or ''
    if not company_id:
        return jsonify({'error': 'company_id ausente no token'}), 403

    data = request.get_json(silent=True) or {}
    entries = data.get('entries', [])
    device_id = data.get('device_id', 'unknown')
    version = data.get('version', 'unknown')

    if not isinstance(entries, list) or len(entries) == 0:
        return jsonify({'ok': True, 'stored': 0}), 200

    # Limitar a 500 entradas por batch para evitar abuso
    entries = entries[:500]

    table = _get_table()
    now_iso = datetime.now(timezone.utc).isoformat()
    stored = 0

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        event = str(entry.get('event', ''))[:64]
        detail = str(entry.get('detail', ''))[:512] if entry.get('detail') else None
        ts = int(entry.get('ts', 0))
        if not event:
            continue
        try:
            item = {
                'pk': f"LOG#{company_id}#{device_id}",
                'sk': f"{ts}#{event}",
                'company_id': company_id,
                'device_id': device_id,
                'version': version,
                'event': event,
                'ts': ts,
                'received_at': now_iso,
                'ttl': int(time.time()) + 30 * 24 * 3600,  # 30 dias
            }
            if detail:
                item['detail'] = detail
            table.put_item(Item=item)
            stored += 1
        except Exception:
            pass

    return jsonify({'ok': True, 'stored': stored}), 200


# ─── POST /api/kiosk/heartbeat ───────────────────────────────────────────────

@kiosk_telemetry_routes.route('/api/kiosk/heartbeat', methods=['POST'])
@_token_required
def receive_heartbeat(payload):
    company_id = payload.get('company_id') or ''
    if not company_id:
        return jsonify({'error': 'company_id ausente no token'}), 403

    data = request.get_json(silent=True) or {}
    device_id = str(data.get('tablet_id', 'unknown'))[:64]
    version = str(data.get('version', 'unknown'))[:32]
    uptime = int(data.get('uptime', 0))
    battery = data.get('battery')          # pode ser None se não disponível
    wifi = bool(data.get('wifi', False))
    queue_size = int(data.get('queue_size', 0))
    last_sync = data.get('last_sync')      # ISO string ou None

    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        item = {
            'pk': f"HEARTBEAT#{company_id}",
            'sk': device_id,
            'company_id': company_id,
            'device_id': device_id,
            'version': version,
            'uptime': uptime,
            'wifi': wifi,
            'queue_size': queue_size,
            'last_seen': now_iso,
            'ttl': int(time.time()) + 7 * 24 * 3600,  # 7 dias
        }
        if battery is not None:
            item['battery'] = int(battery)
        if last_sync:
            item['last_sync'] = str(last_sync)[:64]

        _get_table().put_item(Item=item)
    except ClientError as e:
        if _table_missing(e):
            return jsonify({'ok': True, 'warn': 'tabela não criada ainda'}), 200
        return jsonify({'ok': False, 'error': str(e)}), 200
    except Exception as e:
        # Falha silenciosa — telemetria não deve derrubar o kiosk
        return jsonify({'ok': False, 'error': str(e)}), 200

    return jsonify({'ok': True}), 200


# ─── GET /api/kiosk/heartbeats ───────────────────────────────────────────────

@kiosk_telemetry_routes.route('/api/kiosk/heartbeats', methods=['GET'])
@_token_required
def list_heartbeats(payload):
    company_id = payload.get('company_id') or ''
    if not company_id:
        return jsonify({'error': 'company_id ausente no token'}), 403

    try:
        resp = _get_table().query(
            KeyConditionExpression=Key('pk').eq(f"HEARTBEAT#{company_id}"),
        )
        items = resp.get('Items', [])
        for item in items:
            item.pop('pk', None)
            item.pop('sk', None)
            item.pop('ttl', None)
        return jsonify({'heartbeats': items}), 200
    except ClientError as e:
        if _table_missing(e):
            return jsonify({'heartbeats': []}), 200
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── ADMIN: GET /api/admin/kiosk/logs ────────────────────────────────────────
# Query params:
#   company_id  — filtra por empresa (opcional)
#   event       — filtra por tipo de evento, ex: REGISTER_FAILED (opcional)
#   start_ts    — Unix ms, início do intervalo (padrão: últimas 24h)
#   end_ts      — Unix ms, fim do intervalo (padrão: agora)
#   limit       — máx de registros retornados (padrão/máx: 500)

@kiosk_telemetry_routes.route('/api/admin/kiosk/logs', methods=['GET'])
@_admin_required
def admin_list_logs():
    company_filter = request.args.get('company_id', '').strip()
    event_filter   = request.args.get('event', '').strip().upper()
    limit          = min(int(request.args.get('limit', 500)), 500)

    now_ms = int(time.time() * 1000)
    start_ts = int(request.args.get('start_ts', now_ms - 24 * 3600 * 1000))
    end_ts   = int(request.args.get('end_ts', now_ms))

    try:
        # Scan com FilterExpression — tabela pequena (TTL 30 dias), aceitável para admin
        filter_parts = [
            Attr('ts').between(start_ts, end_ts),
        ]
        if company_filter:
            filter_parts.append(Attr('company_id').eq(company_filter))
        if event_filter:
            filter_parts.append(Attr('event').eq(event_filter))

        # Combina todos os filtros com AND
        fe = filter_parts[0]
        for part in filter_parts[1:]:
            fe = fe & part

        resp = _get_table().scan(
            FilterExpression=fe,
            Limit=2000,  # scan limit (antes dos filtros)
        )
        items = resp.get('Items', [])

        # Ordenar por ts desc e limitar
        items.sort(key=lambda x: x.get('ts', 0), reverse=True)
        items = items[:limit]

        for item in items:
            item.pop('pk', None)
            item.pop('sk', None)
            item.pop('ttl', None)

        return jsonify({'logs': items, 'total': len(items)}), 200
    except ClientError as e:
        if _table_missing(e):
            return jsonify({'logs': [], 'total': 0, 'warn': 'Tabela KioskTelemetry não existe — execute scripts/create_kiosk_telemetry_table.py'}), 200
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── ADMIN: GET /api/admin/kiosk/heartbeats ──────────────────────────────────
# Retorna o último heartbeat de cada tablet, de todas as empresas.
# Query params: company_id (opcional)

@kiosk_telemetry_routes.route('/api/admin/kiosk/heartbeats', methods=['GET'])
@_admin_required
def admin_list_heartbeats():
    company_filter = request.args.get('company_id', '').strip()

    try:
        if company_filter:
            resp = _get_table().query(
                KeyConditionExpression=Key('pk').eq(f"HEARTBEAT#{company_filter}"),
            )
        else:
            resp = _get_table().scan(
                FilterExpression=Attr('pk').begins_with('HEARTBEAT#'),
            )

        items = resp.get('Items', [])
        # Ordenar por last_seen desc
        items.sort(key=lambda x: x.get('last_seen', ''), reverse=True)

        for item in items:
            item.pop('pk', None)
            item.pop('sk', None)
            item.pop('ttl', None)

        return jsonify({'heartbeats': items, 'total': len(items)}), 200
    except ClientError as e:
        if _table_missing(e):
            return jsonify({'heartbeats': [], 'total': 0, 'warn': 'Tabela KioskTelemetry não existe — execute scripts/create_kiosk_telemetry_table.py'}), 200
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500
