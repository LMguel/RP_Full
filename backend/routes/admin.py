"""Admin portal API routes.

Routes:
  GET /api/admin/dashboard/stats - Dashboard statistics
  GET /api/admin/companies - List all companies
  POST /api/admin/companies - Create a new company
  GET /api/admin/companies/{companyId} - Get company details
  GET /api/admin/companies/{companyId}/employees - Get company employees
  GET /api/admin/companies/{companyId}/records - Get company time records
"""
from flask import Blueprint, request, jsonify
import boto3
from botocore.exceptions import ClientError
from decimal import Decimal
from datetime import datetime
from boto3.dynamodb.conditions import Attr, Key
import uuid
import bcrypt

admin_routes = Blueprint('admin_routes', __name__)

# AWS
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table_user_company = dynamodb.Table('UserCompany')
table_employees = dynamodb.Table('Employees')
table_time_records = dynamodb.Table('TimeRecords')


def _convert_decimal(obj):
    """Convert Decimal objects to int/float for JSON serialization."""
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    raise TypeError


@admin_routes.route('/api/admin/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    """Get dashboard statistics from DynamoDB.
    
    Returns:
    {
        "totalCompanies": int,
        "totalEmployees": int (apenas ativos),
        "totalTimeEntries": int,
        "activeCompanies": int,
        "inactiveCompanies": int,
        "paidCompanies": int,
        "unpaidCompanies": int,
        "lastCreatedCompanies": [...]
    }
    """
    try:
        # Get total companies
        try:
            company_response = table_user_company.scan()
            total_companies = company_response.get('Count', 0)
            companies_list = company_response.get('Items', [])
            
            # Handle pagination
            while 'LastEvaluatedKey' in company_response:
                company_response = table_user_company.scan(
                    ExclusiveStartKey=company_response['LastEvaluatedKey']
                )
                total_companies += company_response.get('Count', 0)
                companies_list.extend(company_response.get('Items', []))
        except ClientError as e:
            print(f"Error scanning UserCompany: {e}")
            total_companies = 0
            companies_list = []

        # Get total employees (apenas ativos - ativo = True)
        try:
            employee_response = table_employees.scan(
                FilterExpression='ativo = :active',
                ExpressionAttributeValues={
                    ':active': True
                }
            )
            total_employees = employee_response.get('Count', 0)
            
            # Handle pagination
            while 'LastEvaluatedKey' in employee_response:
                employee_response = table_employees.scan(
                    FilterExpression='ativo = :active',
                    ExpressionAttributeValues={
                        ':active': True
                    },
                    ExclusiveStartKey=employee_response['LastEvaluatedKey']
                )
                total_employees += employee_response.get('Count', 0)
        except ClientError as e:
            print(f"Error scanning Employees: {e}")
            total_employees = 0

        # Get total time records
        try:
            records_response = table_time_records.scan()
            total_time_entries = records_response.get('Count', 0)
            
            # Handle pagination
            while 'LastEvaluatedKey' in records_response:
                records_response = table_time_records.scan(
                    ExclusiveStartKey=records_response['LastEvaluatedKey']
                )
                total_time_entries += records_response.get('Count', 0)
        except ClientError as e:
            print(f"Error scanning TimeRecords: {e}")
            total_time_entries = 0

        # Count active/inactive companies
        active_companies = 0
        inactive_companies = 0
        paid_companies = 0
        unpaid_companies = 0
        
        for company in companies_list:
            status = company.get('status', 'active').lower()
            if status == 'active':
                active_companies += 1
            else:
                inactive_companies += 1
            
            # Check payment status if available
            payment_status = company.get('paymentStatus', 'unpaid').lower()
            if payment_status == 'paid':
                paid_companies += 1
            else:
                unpaid_companies += 1

        # Get last created companies (sort by creation date, get last 5)
        last_companies = sorted(
            companies_list,
            key=lambda x: x.get('createdAt', ''),
            reverse=True
        )[:5]
        
        last_created_companies = [
            {
                'companyId': company.get('companyId', ''),
                'companyName': company.get('companyName', ''),
                'dateCreated': company.get('createdAt', ''),
                'status': company.get('status', 'active')
            }
            for company in last_companies
        ]

        return jsonify({
            'totalCompanies': total_companies,
            'totalEmployees': total_employees,
            'totalTimeEntries': total_time_entries,
            'activeCompanies': active_companies,
            'inactiveCompanies': inactive_companies,
            'paidCompanies': paid_companies,
            'unpaidCompanies': unpaid_companies,
            'lastCreatedCompanies': last_created_companies
        }), 200

    except Exception as e:
        print(f"Error in get_dashboard_stats: {e}")
        return jsonify({'error': 'Erro ao buscar estatísticas do dashboard'}), 500


@admin_routes.route('/api/admin/companies', methods=['GET'])
def get_companies():
    """Get all companies with payment and employee count data.
    
    Returns a list of all companies from UserCompany table.
    """
    try:
        response = table_user_company.scan()
        companies = response.get('Items', [])
        
        # Handle pagination
        while 'LastEvaluatedKey' in response:
            response = table_user_company.scan(
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            companies.extend(response.get('Items', []))

        # Enrich companies with employee counts
        enriched_companies = []
        for company in companies:
            company_id = company.get('company_id', '')
            
            # Count active employees for this company
            try:
                emp_response = table_employees.scan(
                    FilterExpression=Attr('company_id').eq(company_id) & Attr('ativo').eq(True)
                )
                active_employees = emp_response.get('Count', 0)
                
                # Handle pagination for employees
                while 'LastEvaluatedKey' in emp_response:
                    emp_response = table_employees.scan(
                        FilterExpression=Attr('company_id').eq(company_id) & Attr('ativo').eq(True),
                        ExclusiveStartKey=emp_response['LastEvaluatedKey']
                    )
                    active_employees += emp_response.get('Count', 0)
            except Exception as emp_error:
                print(f"Error counting employees for {company_id}: {emp_error}")
                active_employees = 0
            
            # Get payment status
            payments = company.get('payments', {})
            
            enriched_companies.append({
                'companyId': company_id,
                'companyName': company.get('empresa_nome', ''),
                'email': company.get('email', ''),
                'status': company.get('status', 'active'),
                'dateCreated': company.get('data_criacao', ''),
                'activeEmployees': active_employees,
                'expectedEmployees': company.get('numero_funcionarios', 0),
                'payments': payments,
                'userId': company.get('user_id', '')
            })

        return jsonify({
            'companies': enriched_companies
        }), 200

    except ClientError as e:
        print(f"Error scanning companies: {e}")
        return jsonify({'error': 'Erro ao buscar empresas'}), 500
    except Exception as e:
        print(f"Error in get_companies: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


@admin_routes.route('/api/admin/companies', methods=['POST'])
def create_company():
    """Create a new company with admin user.
    
    Expected payload:
    {
        "user_id": "admin",
        "email": "admin@empresa.com",
        "company_name": "Minha Empresa",
        "password": "senha123"
    }
    
    Returns:
    {
        "company": {
            "companyId": "uuid",
            "companyName": "Minha Empresa",
            "email": "admin@empresa.com",
            "userId": "admin",
            ...
        }
    }
    """
    try:
        data = request.get_json() or {}
        
        # Get required fields
        user_id = data.get('user_id', '').strip()
        email = data.get('email', '').strip()
        company_name = data.get('company_name', '').strip()
        password = data.get('password', '')
        expected_employees = data.get('expected_employees', 0)
        
        # Validate required fields
        if not all([user_id, email, company_name, password]):
            return jsonify({'error': 'user_id, email, company_name e password são obrigatórios'}), 400
        
        print(f"[DEBUG] Creating company - user_id: {user_id}, email: {email}, company_name: {company_name}, expected_employees: {expected_employees}")
        
        # Generate company_id (UUID)
        company_id = str(uuid.uuid4())
        
        # Hash password using bcrypt
        senha_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create item for UserCompany table
        company_item = {
            'company_id': company_id,
            'user_id': user_id,
            'email': email,
            'empresa_nome': company_name,
            'senha_hash': senha_hash,
            'senha': password,  # Store original password for display
            'status': 'active',
            'data_criacao': datetime.now().isoformat(),
            'numero_funcionarios': int(expected_employees) if expected_employees else 0,
            'payments': {}  # Initialize empty payments
        }
        
        # Insert into UserCompany table
        table_user_company.put_item(Item=company_item)
        
        print(f"[DEBUG] Company created successfully - company_id: {company_id}")
        
        return jsonify({
            'company': {
                'companyId': company_id,
                'companyName': company_name,
                'email': email,
                'status': 'active',
                'dateCreated': company_item['data_criacao'],
                'userId': user_id,
                'activeEmployees': 0,
                'expectedEmployees': int(expected_employees) if expected_employees else 0,
                'payments': {}
            }
        }), 201

    except ClientError as e:
        print(f"[ERROR] ClientError creating company: {e}")
        print(f"[ERROR] Error code: {e.response.get('Error', {}).get('Code')}")
        return jsonify({'error': 'Erro ao criar empresa', 'details': str(e)}), 500
    except Exception as e:
        print(f"[ERROR] Unexpected error in create_company: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Erro interno do servidor', 'details': str(e)}), 500


@admin_routes.route('/api/admin/companies/<company_id>', methods=['GET'])
def get_company_details(company_id: str):
    """Get specific company details.
    
    Args:
        company_id: The company ID (partition key in UserCompany)
    
    Note: UserCompany table has company_id (HASH) + user_id (RANGE).
    We use query() to get the first company record since each company_id
    should have consistent data across all user_id entries for that company.
    """
    try:
        print(f"[DEBUG] Fetching company details for: {company_id}")
        
        # Use query() instead of get_item() because we have a composite key
        # Query returns all records with this company_id
        response = table_user_company.query(
            KeyConditionExpression='company_id = :company_id',
            ExpressionAttributeValues={':company_id': company_id}
        )
        
        print(f"[DEBUG] Query response: {response}")
        items = response.get('Items', [])
        
        if not items:
            print(f"[DEBUG] Company not found for ID: {company_id}")
            return jsonify({'error': 'Empresa não encontrada'}), 404
        
        # Get the first item (company data should be consistent across all users)
        company = items[0]

        return jsonify({
            'company': {
                'companyId': company.get('company_id', ''),
                'companyName': company.get('empresa_nome', ''),
                'email': company.get('email', ''),
                'status': company.get('status', 'active'),
                'dateCreated': company.get('data_criacao', ''),
                'userId': company.get('user_id', ''),
                'activeEmployees': 0,  # Will be calculated separately if needed
                'expectedEmployees': company.get('numero_funcionarios', 0),
                'payments': company.get('payments', {}),
                'senha': company.get('senha', '')  # Return original password
            }
        }), 200

    except ClientError as e:
        print(f"[ERROR] ClientError getting company details: {e}")
        print(f"[ERROR] Error code: {e.response.get('Error', {}).get('Code')}")
        print(f"[ERROR] Error message: {e.response.get('Error', {}).get('Message')}")
        return jsonify({'error': 'Erro ao buscar detalhes da empresa', 'details': str(e)}), 500
    except Exception as e:
        print(f"[ERROR] Unexpected error in get_company_details: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Erro interno do servidor', 'details': str(e)}), 500


@admin_routes.route('/api/admin/companies/<company_id>/employees', methods=['GET'])
def get_company_employees(company_id: str):
    """Get all active employees for a specific company.
    
    Args:
        company_id: The company ID
    """
    try:
        response = table_employees.scan(
            FilterExpression=Attr('company_id').eq(company_id) & Attr('ativo').eq(True)
        )
        
        employees = response.get('Items', [])
        
        # Handle pagination
        while 'LastEvaluatedKey' in response:
            response = table_employees.scan(
                FilterExpression=Attr('company_id').eq(company_id) & Attr('ativo').eq(True),
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            employees.extend(response.get('Items', []))

        return jsonify({
            'employees': employees,
            'total': len(employees)
        }), 200

    except ClientError as e:
        print(f"Error querying company employees: {e}")
        return jsonify({'error': 'Erro ao buscar funcionários da empresa'}), 500
    except Exception as e:
        print(f"Error in get_company_employees: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


@admin_routes.route('/api/admin/companies/<company_id>/records', methods=['GET'])
def get_company_records(company_id: str):
    """Get all time records for a specific company.
    
    Args:
        company_id: The company ID
    """
    try:
        response = table_time_records.scan(
            FilterExpression=Attr('company_id').eq(company_id)
        )
        
        records = response.get('Items', [])
        
        # Handle pagination
        while 'LastEvaluatedKey' in response:
            response = table_time_records.scan(
                FilterExpression=Attr('company_id').eq(company_id),
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            records.extend(response.get('Items', []))

        return jsonify({
            'records': records,
            'total': len(records)
        }), 200

    except ClientError as e:
        print(f"Error querying company records: {e}")
        return jsonify({'error': 'Erro ao buscar registros da empresa'}), 500
    except Exception as e:
        print(f"Error in get_company_records: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


@admin_routes.route('/api/admin/companies/<company_id>/payment-status', methods=['GET'])
def get_company_payment_status(company_id: str):
    """Get payment status for a company by month/year.
    
    Args:
        company_id: The company ID
    """
    try:
        # Query because table has composite key (company_id + user_id)
        response = table_user_company.query(
            KeyConditionExpression='company_id = :company_id',
            ExpressionAttributeValues={':company_id': company_id}
        )
        
        items = response.get('Items', [])
        if not items:
            return jsonify({'error': 'Empresa não encontrada'}), 404

        company = items[0]
        # Get payment status from company record
        payments = company.get('payments', {})
        
        # If no payments, return empty structure
        if not payments:
            payments = {}

        return jsonify({
            'companyId': company_id,
            'payments': payments
        }), 200

    except ClientError as e:
        print(f"Error getting payment status: {e}")
        return jsonify({'error': 'Erro ao buscar status de pagamento'}), 500
    except Exception as e:
        print(f"Error in get_company_payment_status: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


@admin_routes.route('/api/admin/companies/<company_id>/payment-status', methods=['POST'])
def update_company_payment_status(company_id: str):
    """Update payment status for a company by month/year.
    
    Expected payload:
    {
        "monthYear": "2025-12",  # YYYY-MM format
        "isPaid": true/false
    }
    
    Args:
        company_id: The company ID
    """
    try:
        data = request.get_json() or {}
        month_year = data.get('monthYear', '')
        is_paid = data.get('isPaid', False)

        print(f"[DEBUG] Updating payment status - company_id: {company_id}, month_year: {month_year}, is_paid: {is_paid}")

        if not month_year:
            return jsonify({'error': 'monthYear é obrigatório'}), 400

        # Query to get the first user/admin of this company to update
        query_response = table_user_company.query(
            KeyConditionExpression='company_id = :company_id',
            ExpressionAttributeValues={':company_id': company_id},
            Limit=1
        )
        
        items_q = query_response.get('Items', [])
        if not items_q:
            print(f"[ERROR] Company not found: {company_id}")
            return jsonify({'error': 'Empresa não encontrada'}), 404
        
        # Get the user_id of the first user in this company
        user_id = items_q[0].get('user_id')
        print(f"[DEBUG] Found user_id: {user_id}")
        
        # Update company record with payment status
        # First, check if payments attribute exists, if not initialize it
        try:
            # Get current item to check if payments exists
            current_item = items_q[0]
            has_payments = 'payments' in current_item
            
            if has_payments:
                # Payments already exists, just update the month
                update_expr = 'SET payments.#my = :is_paid'
                attr_names = {'#my': month_year}
                attr_values = {':is_paid': is_paid}
            else:
                # Initialize payments map with the month
                update_expr = 'SET payments = :payments_map'
                attr_names = {}
                attr_values = {':payments_map': {month_year: is_paid}}
            
            print(f"[DEBUG] Has payments: {has_payments}, UpdateExpression: {update_expr}")
            
            table_user_company.update_item(
                Key={'company_id': company_id, 'user_id': user_id},
                UpdateExpression=update_expr,
                ExpressionAttributeNames=attr_names if attr_names else None,
                ExpressionAttributeValues=attr_values
            )
        except Exception as update_error:
            print(f"[ERROR] Update error: {update_error}")
            # If direct update fails, try using put_item to replace the entire item
            current_item = items_q[0]
            if 'payments' not in current_item:
                current_item['payments'] = {}
            current_item['payments'][month_year] = is_paid
            
            print(f"[DEBUG] Using put_item fallback")
            table_user_company.put_item(Item=current_item)

        print(f"[DEBUG] Update successful")

        return jsonify({
            'message': 'Status de pagamento atualizado com sucesso',
            'companyId': company_id,
            'monthYear': month_year,
            'isPaid': is_paid
        }), 200

    except ClientError as e:
        print(f"[ERROR] ClientError updating payment status: {e}")
        print(f"[ERROR] Error code: {e.response.get('Error', {}).get('Code')}")
        print(f"[ERROR] Error message: {e.response.get('Error', {}).get('Message')}")
        return jsonify({'error': 'Erro ao atualizar status de pagamento', 'details': str(e)}), 500
    except Exception as e:
        print(f"[ERROR] Unexpected error in update_company_payment_status: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Erro interno do servidor', 'details': str(e)}), 500


@admin_routes.route('/api/admin/companies/<company_id>/suspend', methods=['POST'])
def suspend_company(company_id: str):
    """Temporarily suspend/pause a company (prevent login).
    
    Args:
        company_id: The company ID
    """
    try:
        # Query to get the first user/admin of this company to update
        query_response = table_user_company.query(
            KeyConditionExpression='company_id = :company_id',
            ExpressionAttributeValues={':company_id': company_id},
            Limit=1
        )
        
        items = query_response.get('Items', [])
        if not items:
            return jsonify({'error': 'Empresa não encontrada'}), 404
        
        user_id = items[0].get('user_id')
        
        # Update company status to 'suspended'
        table_user_company.update_item(
            Key={'company_id': company_id, 'user_id': user_id},
            UpdateExpression='SET #status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': 'suspended'}
        )

        return jsonify({
            'message': 'Empresa suspensa com sucesso',
            'companyId': company_id,
            'status': 'suspended'
        }), 200

    except ClientError as e:
        print(f"Error suspending company: {e}")
        return jsonify({'error': 'Erro ao suspender empresa'}), 500
    except Exception as e:
        print(f"Error in suspend_company: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


@admin_routes.route('/api/admin/companies/<company_id>/resume', methods=['POST'])
def resume_company(company_id: str):
    """Resume a suspended company (re-enable login).
    
    Args:
        company_id: The company ID
    """
    try:
        # Query to get the first user/admin of this company to update
        query_response = table_user_company.query(
            KeyConditionExpression='company_id = :company_id',
            ExpressionAttributeValues={':company_id': company_id},
            Limit=1
        )
        
        items = query_response.get('Items', [])
        if not items:
            return jsonify({'error': 'Empresa não encontrada'}), 404
        
        user_id = items[0].get('user_id')
        
        # Update company status to 'active'
        table_user_company.update_item(
            Key={'company_id': company_id, 'user_id': user_id},
            UpdateExpression='SET #status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': 'active'}
        )

        return jsonify({
            'message': 'Empresa reativada com sucesso',
            'companyId': company_id,
            'status': 'active'
        }), 200

    except ClientError as e:
        print(f"Error resuming company: {e}")
        return jsonify({'error': 'Erro ao reativar empresa'}), 500
    except Exception as e:
        print(f"Error in resume_company: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500


@admin_routes.route('/api/admin/companies/<company_id>', methods=['DELETE'])
def delete_company(company_id: str):
    """Delete/remove a company.
    
    Args:
        company_id: The company ID
    """
    try:
        # Query to get the first user/admin of this company to update
        query_response = table_user_company.query(
            KeyConditionExpression='company_id = :company_id',
            ExpressionAttributeValues={':company_id': company_id},
            Limit=1
        )
        
        items = query_response.get('Items', [])
        if not items:
            return jsonify({'error': 'Empresa não encontrada'}), 404
        
        user_id = items[0].get('user_id')
        
        # Soft delete: mark company as deleted
        table_user_company.update_item(
            Key={'company_id': company_id, 'user_id': user_id},
            UpdateExpression='SET #status = :status, deleted_at = :now',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'deleted',
                ':now': datetime.utcnow().isoformat()
            }
        )

        return jsonify({
            'message': 'Empresa deletada com sucesso',
            'companyId': company_id
        }), 200

    except ClientError as e:
        print(f"Error deleting company: {e}")
        return jsonify({'error': 'Erro ao deletar empresa'}), 500
    except Exception as e:
        print(f"Error in delete_company: {e}")
        return jsonify({'error': 'Erro interno do servidor'}), 500
