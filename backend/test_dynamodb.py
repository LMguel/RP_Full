import boto3
import os
from dotenv import load_dotenv

load_dotenv()

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('UserCompany')

# Try to scan and get first item
try:
    response = table.scan(Limit=1)
    print("Scan successful!")
    items = response.get('Items', [])
    if items:
        print("First company:")
        print(items[0])
        # Try to get the same company by ID
        company_id = items[0].get('company_id')
        if company_id:
            get_response = table.get_item(Key={'company_id': company_id})
            print(f"\nget_item with company_id '{company_id}':")
            print(get_response.get('Item', 'Not found'))
    else:
        print("No items found in UserCompany table")
except Exception as e:
    print(f"Error: {e}")
    print(f"Error type: {type(e)}")
