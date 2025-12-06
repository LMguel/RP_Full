#!/usr/bin/env python3
"""Quick setup script to create first admin user in DynamoDB."""
from __future__ import annotations

import os
import sys
import uuid

import bcrypt
import boto3
from botocore.exceptions import ClientError, NoCredentialsError


def generate_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def main() -> int:
    region = os.getenv("AWS_REGION", "us-east-1")
    endpoint_url = os.getenv("DYNAMODB_ENDPOINT_URL")

    # Default admin credentials
    email = "admin@registraponto.com"
    password = "Admin@123456"  # Change this in production!
    admin_id = "admin-root"

    print("=" * 60)
    print("Creating First Admin User")
    print("=" * 60)
    print()
    print(f"Email: {email}")
    print(f"Password: {password}")
    print(f"Admin ID: {admin_id}")
    print()

    try:
        # Generate password hash
        password_hash = generate_password_hash(password)
        print("✓ Password hash generated")

        # Connect to DynamoDB
        dynamodb = boto3.resource(
            "dynamodb",
            region_name=region,
            endpoint_url=endpoint_url,
        )
        table = dynamodb.Table("AdminUsers")
        print("✓ Connected to AdminUsers table")

        # Check if email already exists
        response = table.query(
            IndexName="email_index",
            KeyConditionExpression="email = :email",
            ExpressionAttributeValues={":email": email},
        )

        if response.get("Items"):
            print(f"⚠️  Email '{email}' already exists.")
            print("   Skipping insertion.")
            return 0

        # Insert admin
        table.put_item(
            Item={
                "admin_id": admin_id,
                "email": email,
                "password_hash": password_hash,
                "role": "super_admin",
            }
        )

        print("✓ Admin inserted into DynamoDB")
        print()
        print("=" * 60)
        print("✅ Success! Admin user created.")
        print("=" * 60)
        print()
        print("Login credentials:")
        print(f"  Email:    {email}")
        print(f"  Password: {password}")
        print()
        print("⚠️  IMPORTANT:")
        print("  - Change the password after first login!")
        print("  - This is a development setup.")
        print()
        return 0

    except NoCredentialsError:
        print("❌ AWS credentials not found.")
        print("\nPlease set environment variables:")
        print("  AWS_ACCESS_KEY_ID")
        print("  AWS_SECRET_ACCESS_KEY")
        print("  AWS_REGION (optional, default: us-east-1)")
        return 1

    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        error_msg = exc.response.get("Error", {}).get("Message")
        print(f"❌ DynamoDB error ({error_code}): {error_msg}")
        return 1

    except Exception as e:
        print(f"❌ Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
