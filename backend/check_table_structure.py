import boto3
import os
from dotenv import load_dotenv
from botocore.exceptions import ClientError

load_dotenv()

dynamodb = boto3.client('dynamodb', region_name='us-east-1')
dynamodb_resource = boto3.resource('dynamodb', region_name='us-east-1')

# Obter info da tabela
try:
    response = dynamodb.describe_table(TableName='UserCompany')
    print("=" * 80)
    print("ESTRUTURA DA TABELA UserCompany")
    print("=" * 80)
    
    key_schema = response['Table']['KeySchema']
    attr_definitions = response['Table']['AttributeDefinitions']
    
    print("\n🔑 Key Schema:")
    for key in key_schema:
        print(f"   - {key['AttributeName']} ({key['KeyType']})")
    
    print("\n📋 Attribute Definitions:")
    for attr in attr_definitions:
        print(f"   - {attr['AttributeName']} ({attr['AttributeType']})")
    
    print("\n" + "=" * 80)
    print("AMOSTRA DE DADOS")
    print("=" * 80)
    
    table = dynamodb_resource.Table('UserCompany')
    response = table.scan(Limit=3)
    
    items = response.get('Items', [])
    print(f"\n✅ Encontrados {len(items)} itens")
    
    for i, item in enumerate(items, 1):
        print(f"\n📌 Item {i}:")
        for key, value in item.items():
            print(f"   {key}: {value}")
    
except ClientError as e:
    print(f"❌ Erro ClientError: {e}")
except Exception as e:
    print(f"❌ Erro: {e}")
    import traceback
    traceback.print_exc()
