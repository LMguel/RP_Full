"""
Script para criar a tabela KioskTelemetry no DynamoDB.

Uso:
    python backend/scripts/create_kiosk_telemetry_table.py

Variáveis de ambiente necessárias:
    AWS_DEFAULT_REGION  (ex: us-east-1)
    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY

Ou usando perfil AWS local:
    AWS_PROFILE=registraponto python backend/scripts/create_kiosk_telemetry_table.py
"""
import boto3
import os
from botocore.exceptions import ClientError

REGION     = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
TABLE_NAME = os.getenv('DYNAMODB_TABLE_KIOSK_TELEMETRY', 'KioskTelemetry')

dynamodb = boto3.client('dynamodb', region_name=REGION)


def create_table():
    print(f'Criando tabela {TABLE_NAME} na região {REGION}...')

    try:
        resp = dynamodb.create_table(
            TableName=TABLE_NAME,
            KeySchema=[
                {'AttributeName': 'pk', 'KeyType': 'HASH'},
                {'AttributeName': 'sk', 'KeyType': 'RANGE'},
            ],
            AttributeDefinitions=[
                {'AttributeName': 'pk', 'AttributeType': 'S'},
                {'AttributeName': 'sk', 'AttributeType': 'S'},
            ],
            BillingMode='PAY_PER_REQUEST',  # on-demand — sem custo quando inativo
        )
        table_arn = resp['TableDescription']['TableArn']
        print(f'✓ Tabela criada: {table_arn}')

        # Aguarda a tabela ficar ACTIVE antes de configurar TTL
        print('  Aguardando tabela ficar ACTIVE...')
        waiter = dynamodb.get_waiter('table_exists')
        waiter.wait(TableName=TABLE_NAME)
        print('  Tabela ACTIVE.')

    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceInUseException':
            print(f'  A tabela {TABLE_NAME} já existe — pulando criação.')
        else:
            raise

    # Habilitar TTL no atributo 'ttl' (valor Unix epoch em segundos)
    try:
        dynamodb.update_time_to_live(
            TableName=TABLE_NAME,
            TimeToLiveSpecification={
                'Enabled': True,
                'AttributeName': 'ttl',
            },
        )
        print('✓ TTL habilitado no atributo "ttl".')
    except ClientError as e:
        if 'already enabled' in str(e).lower() or 'ValidationException' in str(e):
            print('  TTL já habilitado — nada a fazer.')
        else:
            print(f'  Aviso ao configurar TTL: {e}')

    print()
    print('Estrutura da tabela:')
    print(f'  Partition key : pk  (String)')
    print(f'  Sort key      : sk  (String)')
    print(f'  TTL attribute : ttl (Number, Unix epoch em segundos)')
    print()
    print('Padrões de chave usados:')
    print('  Logs       — pk: LOG#<company_id>#<device_id>  sk: <ts_ms>#<event>')
    print('  Heartbeats — pk: HEARTBEAT#<company_id>        sk: <device_id>')
    print()
    print('TTL configurado:')
    print('  Logs       : 30 dias')
    print('  Heartbeats : 7 dias')
    print()
    print('Pronto.')


if __name__ == '__main__':
    create_table()
