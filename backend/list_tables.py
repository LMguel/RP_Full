import os
from dotenv import load_dotenv

load_dotenv()

import boto3

dynamodb = boto3.client('dynamodb', region_name='us-east-1')
tables = dynamodb.list_tables()
print('Tabelas DynamoDB:')
for table in tables['TableNames']:
    print(f'  - {table}')
