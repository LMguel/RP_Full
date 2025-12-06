import os
from dotenv import load_dotenv

load_dotenv()

import boto3
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('Employees')

# Tentar descobrir a chave da tabela
try:
    response = table.scan(Limit=1)
    if response['Items']:
        item = response['Items'][0]
        print("Chaves do item de exemplo:")
        for key in item.keys():
            print(f"  - {key}: {item[key]}")
except Exception as e:
    print(f"Erro: {e}")

# Verificar quantos funcionários ativos existem
try:
    response = table.scan(FilterExpression=Attr('ativo').eq(True))
    print(f"\nTotal de funcionários ativos: {response.get('Count', 0)}")
except Exception as e:
    print(f"Erro ao contar ativos: {e}")

