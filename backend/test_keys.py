#!/usr/bin/env python3
"""Test script to check DynamoDB table keys"""

import boto3
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('UserCompany')

company_id = '770cef19-6fe0-4dab-aff5-38126992c041'

# Test 1: Try with companyId
print("Test 1: Using companyId as key")
try:
    response = table.get_item(Key={'companyId': company_id})
    if 'Item' in response:
        print("✓ Success with companyId")
        item = response['Item']
        print(f"  Keys in item: {list(item.keys())}")
        print(f"  companyName: {item.get('companyName')}")
    else:
        print("✗ No item found with companyId")
except Exception as e:
    print(f"✗ Error with companyId: {e}")

print()

# Test 2: Try with company_id
print("Test 2: Using company_id as key")
try:
    response = table.get_item(Key={'company_id': company_id})
    if 'Item' in response:
        print("✓ Success with company_id")
        item = response['Item']
        print(f"  Keys in item: {list(item.keys())}")
        print(f"  companyName: {item.get('companyName')}")
    else:
        print("✗ No item found with company_id")
except Exception as e:
    print(f"✗ Error with company_id: {e}")

print()

# Test 3: Scan to see actual keys
print("Test 3: Scanning to see actual partition key name")
try:
    response = table.scan(Limit=1)
    if response['Count'] > 0:
        item = response['Items'][0]
        print(f"  Keys in first item: {list(item.keys())}")
        # Look for any field that might be the partition key
        for key in item.keys():
            if 'company' in key.lower() or 'id' in key.lower():
                print(f"    - {key}: {item[key]}")
except Exception as e:
    print(f"✗ Error scanning: {e}")
