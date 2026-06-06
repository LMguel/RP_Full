"""Admin AWS infrastructure & cost metrics endpoints.

Routes:
  GET /api/admin/aws/metrics          - DynamoDB, S3, Rekognition stats
  GET /api/admin/aws/costs            - Cost Explorer monthly breakdown
  GET /api/admin/aws/company/<id>/usage - Per-company AWS usage
"""
from flask import Blueprint, jsonify, request
import boto3
import os
import jwt
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Attr
from datetime import datetime, timedelta
from functools import wraps
from decimal import Decimal

admin_aws_routes = Blueprint('admin_aws_routes', __name__)

REGION   = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
S3_BUCKET         = os.getenv('S3_BUCKET',                  'registraponto-prod-fotos')
REKOGNITION_COLL  = os.getenv('REKOGNITION_COLLECTION',      'registraponto-faces')
TABLE_EMPLOYEES   = os.getenv('DYNAMODB_TABLE_EMPLOYEES',    'Employees')
TABLE_RECORDS     = os.getenv('DYNAMODB_TABLE_RECORDS',      'TimeRecords')
TABLE_USERS       = os.getenv('DYNAMODB_TABLE_USERS',        'UserCompany')
TABLE_CONFIG      = os.getenv('DYNAMODB_TABLE_CONFIG',       'ConfigCompany')
TABLE_DAILY       = os.getenv('DYNAMODB_TABLE_DAILY_SUMMARY','DailySummary')
TABLE_MONTHLY     = os.getenv('DYNAMODB_TABLE_MONTHLY_SUMMARY','MonthlySummary')


# ── auth ──────────────────────────────────────────────────────────────────────

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return '', 200
        token = request.headers.get('Authorization', '').replace('Bearer ', '').strip()
        if not token:
            return jsonify({'error': 'Token ausente'}), 401
        secret = os.getenv('JWT_SECRET_KEY')
        if not secret:
            return jsonify({'error': 'Configuração interna inválida'}), 500
        try:
            payload = jwt.decode(token, secret, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token inválido'}), 401
        if payload.get('role') != 'super_admin':
            return jsonify({'error': 'Acesso negado'}), 403
        return f(*args, **kwargs)
    return decorated


def _bytes_to_mb(b: int) -> float:
    return round(b / (1024 * 1024), 2)

def _bytes_to_gb(b: int) -> float:
    return round(b / (1024 * 1024 * 1024), 4)


# ── /api/admin/aws/metrics ────────────────────────────────────────────────────

@admin_aws_routes.route('/api/admin/aws/metrics', methods=['GET', 'OPTIONS'])
@admin_required
def get_aws_metrics():
    """Returns DynamoDB table stats, S3 bucket stats, and Rekognition collection info."""
    result = {}

    # ── DynamoDB ─────────────────────────────────────────────────────────────
    ddb_client = boto3.client('dynamodb', region_name=REGION)
    tables_cfg = {
        'Employees':      TABLE_EMPLOYEES,
        'TimeRecords':    TABLE_RECORDS,
        'UserCompany':    TABLE_USERS,
        'ConfigCompany':  TABLE_CONFIG,
        'DailySummary':   TABLE_DAILY,
        'MonthlySummary': TABLE_MONTHLY,
    }
    dynamo_tables = []
    total_items = 0
    total_size  = 0
    for label, tname in tables_cfg.items():
        try:
            resp = ddb_client.describe_table(TableName=tname)
            t = resp['Table']
            item_count  = int(t.get('ItemCount', 0))
            size_bytes  = int(t.get('TableSizeBytes', 0))
            total_items += item_count
            total_size  += size_bytes
            dynamo_tables.append({
                'label':        label,
                'table_name':   tname,
                'item_count':   item_count,
                'size_bytes':   size_bytes,
                'size_mb':      _bytes_to_mb(size_bytes),
                'status':       t.get('TableStatus', 'UNKNOWN'),
                'billing_mode': t.get('BillingModeSummary', {}).get('BillingMode', 'PROVISIONED'),
            })
        except ClientError as e:
            dynamo_tables.append({
                'label': label,
                'table_name': tname,
                'error': e.response['Error']['Code'],
            })
        except Exception as e:
            dynamo_tables.append({'label': label, 'table_name': tname, 'error': str(e)})

    result['dynamodb'] = {
        'tables':           dynamo_tables,
        'total_items':      total_items,
        'total_size_bytes': total_size,
        'total_size_mb':    _bytes_to_mb(total_size),
    }

    # ── S3 via CloudWatch ────────────────────────────────────────────────────
    try:
        cw  = boto3.client('cloudwatch', region_name=REGION)
        now = datetime.utcnow()
        start = now - timedelta(days=3)

        def _cw_metric(metric_name, storage_type):
            r = cw.get_metric_statistics(
                Namespace='AWS/S3',
                MetricName=metric_name,
                Dimensions=[
                    {'Name': 'BucketName',   'Value': S3_BUCKET},
                    {'Name': 'StorageType',  'Value': storage_type},
                ],
                StartTime=start,
                EndTime=now,
                Period=86400,
                Statistics=['Average'],
            )
            pts = sorted(r.get('Datapoints', []), key=lambda x: x['Timestamp'])
            return int(pts[-1]['Average']) if pts else 0

        size_bytes   = _cw_metric('BucketSizeBytes',  'StandardStorage')
        object_count = _cw_metric('NumberOfObjects',   'AllStorageTypes')

        result['s3'] = {
            'bucket':        S3_BUCKET,
            'size_bytes':    size_bytes,
            'size_gb':       _bytes_to_gb(size_bytes),
            'size_mb':       _bytes_to_mb(size_bytes),
            'object_count':  object_count,
        }
    except Exception as e:
        result['s3'] = {'bucket': S3_BUCKET, 'error': str(e), 'size_bytes': 0, 'object_count': 0}

    # ── Rekognition ──────────────────────────────────────────────────────────
    try:
        rek  = boto3.client('rekognition', region_name=REGION)
        resp = rek.describe_collection(CollectionId=REKOGNITION_COLL)
        result['rekognition'] = {
            'collection':         REKOGNITION_COLL,
            'face_count':         resp.get('FaceCount', 0),
            'face_model_version': resp.get('FaceModelVersion', 'unknown'),
            'creation_timestamp': str(resp.get('CreationTimestamp', '')),
        }
    except Exception as e:
        result['rekognition'] = {
            'collection': REKOGNITION_COLL,
            'face_count': 0,
            'error': str(e),
        }

    # ── Region ──────────────────────────────────────────────────────────────
    result['region'] = REGION
    result['timestamp'] = datetime.utcnow().isoformat() + 'Z'

    return jsonify(result), 200


# ── /api/admin/aws/costs ──────────────────────────────────────────────────────

@admin_aws_routes.route('/api/admin/aws/costs', methods=['GET', 'OPTIONS'])
@admin_required
def get_aws_costs():
    """Returns monthly AWS costs from Cost Explorer (last 6 months).
    Falls back gracefully if Cost Explorer is not available / no permission.
    """
    months_back = int(request.args.get('months', 6))
    try:
        # Cost Explorer is always in us-east-1
        ce  = boto3.client('ce', region_name='us-east-1')
        now = datetime.utcnow()

        # End = first of current month → only complete months
        end_date   = now.replace(day=1).strftime('%Y-%m-%d')
        start_date = (now.replace(day=1) - timedelta(days=months_back * 31)).replace(day=1).strftime('%Y-%m-%d')

        response = ce.get_cost_and_usage(
            TimePeriod={'Start': start_date, 'End': end_date},
            Granularity='MONTHLY',
            GroupBy=[{'Type': 'DIMENSION', 'Key': 'SERVICE'}],
            Metrics=['BlendedCost', 'UsageQuantity'],
        )

        monthly = []
        for period in response.get('ResultsByTime', []):
            month_str = period['TimePeriod']['Start'][:7]
            services  = []
            total     = 0.0
            for group in period.get('Groups', []):
                cost = float(group['Metrics']['BlendedCost']['Amount'])
                if cost < 0.00001:
                    continue
                service = group['Keys'][0]
                # Shorten long AWS service names
                short = (service
                    .replace('Amazon ', '')
                    .replace('AWS ', '')
                    .replace(' (AWS GovCloud)', '')
                    .strip())
                services.append({'service': short, 'full_name': service, 'cost': round(cost, 6)})
                total += cost

            monthly.append({
                'month':    month_str,
                'services': sorted(services, key=lambda x: x['cost'], reverse=True),
                'total':    round(total, 6),
            })

        # Also get current month-to-date
        today = now.strftime('%Y-%m-%d')
        mtd_resp = ce.get_cost_and_usage(
            TimePeriod={'Start': end_date, 'End': today},
            Granularity='MONTHLY',
            GroupBy=[{'Type': 'DIMENSION', 'Key': 'SERVICE'}],
            Metrics=['BlendedCost'],
        )
        mtd_total = 0.0
        mtd_services = []
        for period in mtd_resp.get('ResultsByTime', []):
            for group in period.get('Groups', []):
                cost = float(group['Metrics']['BlendedCost']['Amount'])
                if cost < 0.00001:
                    continue
                short = group['Keys'][0].replace('Amazon ', '').replace('AWS ', '').strip()
                mtd_services.append({'service': short, 'cost': round(cost, 6)})
                mtd_total += cost

        return jsonify({
            'monthly_costs':  monthly,
            'current_month':  {
                'month':    now.strftime('%Y-%m'),
                'total':    round(mtd_total, 6),
                'services': sorted(mtd_services, key=lambda x: x['cost'], reverse=True),
            },
            'currency': 'USD',
            'error':    None,
        }), 200

    except ClientError as e:
        code = e.response['Error']['Code']
        msg  = e.response['Error']['Message']
        return jsonify({
            'monthly_costs': [],
            'current_month': None,
            'currency': 'USD',
            'error': f'{code}: {msg}',
            'error_hint': 'Adicione permissão ce:GetCostAndUsage na IAM policy do usuário AWS.',
        }), 200
    except Exception as e:
        return jsonify({
            'monthly_costs': [],
            'current_month': None,
            'currency': 'USD',
            'error': str(e),
        }), 200


# ── /api/admin/aws/company/<id>/usage ─────────────────────────────────────────

@admin_aws_routes.route('/api/admin/aws/company/<company_id>/usage', methods=['GET', 'OPTIONS'])
@admin_required
def get_company_aws_usage(company_id):
    """Per-company AWS resource usage: employees, records, S3 photos, Rekognition faces."""
    result = {'company_id': company_id}

    ddb = boto3.resource('dynamodb', region_name=REGION)

    # Employee count
    try:
        emp_table = ddb.Table(TABLE_EMPLOYEES)
        resp = emp_table.scan(
            FilterExpression=Attr('company_id').eq(company_id),
            Select='COUNT',
        )
        result['employee_count'] = resp.get('Count', 0)
    except Exception as e:
        result['employee_count'] = None
        result['employee_count_error'] = str(e)

    # Records count (approximation — scan with filter)
    try:
        rec_table = ddb.Table(TABLE_RECORDS)
        resp = rec_table.scan(
            FilterExpression=Attr('company_id').eq(company_id),
            Select='COUNT',
        )
        result['record_count'] = resp.get('Count', 0)
    except Exception as e:
        result['record_count'] = None
        result['record_count_error'] = str(e)

    # S3: count objects and total size for this company
    try:
        s3_client  = boto3.client('s3', region_name=REGION)
        paginator  = s3_client.get_paginator('list_objects_v2')
        s3_count   = 0
        s3_bytes   = 0
        for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=f'{company_id}/'):
            for obj in page.get('Contents', []):
                s3_count += 1
                s3_bytes += obj.get('Size', 0)
        result['s3_objects']    = s3_count
        result['s3_size_bytes'] = s3_bytes
        result['s3_size_mb']    = _bytes_to_mb(s3_bytes)
    except Exception as e:
        result['s3_objects']    = None
        result['s3_size_bytes'] = None
        result['s3_error']      = str(e)

    # Rekognition: count faces belonging to this company
    try:
        rek  = boto3.client('rekognition', region_name=REGION)
        faces = []
        paginator_rek = rek.get_paginator('list_faces')
        for page in paginator_rek.paginate(CollectionId=REKOGNITION_COLL):
            for face in page.get('Faces', []):
                ext_id = face.get('ExternalImageId', '')
                if ext_id.startswith(company_id):
                    faces.append(face['FaceId'])
        result['rekognition_faces'] = len(faces)
    except Exception as e:
        result['rekognition_faces'] = None
        result['rekognition_error'] = str(e)

    return jsonify(result), 200
