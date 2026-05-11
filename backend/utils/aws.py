import boto3
import os
import uuid
from datetime import datetime
from dotenv import load_dotenv

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

# Load configuration from environment (defaults kept for local dev)
REGIAO = os.environ.get('AWS_REGION', 'us-east-1')
BUCKET = os.environ.get('S3_BUCKET', 'registraponto-prod-fotos')
COLLECTION = os.environ.get('REKOGNITION_COLLECTION', 'registraponto-faces')

# New DynamoDB table names expected in environment
DYNAMODB_TABLE_EMPLOYEES = os.environ.get('DYNAMODB_TABLE_EMPLOYEES', 'Employees')
DYNAMODB_TABLE_RECORDS = os.environ.get('DYNAMODB_TABLE_RECORDS', 'TimeRecords')
DYNAMODB_TABLE_USERS = os.environ.get('DYNAMODB_TABLE_USERS', 'UserCompany')
DYNAMODB_TABLE_CONFIG = os.environ.get('DYNAMODB_TABLE_CONFIG', 'ConfigCompany')
# NOTA: Tabela HorariosPreset não existe. Horários pré-definidos são salvos em ConfigCompany
# com chave config_key='horarios_preset'

# AWS clients/resources
s3 = boto3.client('s3', region_name=REGIAO)
# Enable Rekognition by default unless explicitly disabled
enable_rekognition = os.environ.get('ENABLE_REKOGNITION', '1') == '1'
if enable_rekognition:
    try:
        rekognition = boto3.client('rekognition', region_name=REGIAO)
    except Exception as e:
        print(f"Aviso: não foi possível criar client Rekognition: {e}")
        rekognition = None
else:
    rekognition = None
dynamodb = boto3.resource('dynamodb', region_name=REGIAO)

# Keep the same variable names used by the rest of the code, but point them
# to the new table names. The application code will be updated to include
# company_id on queries where appropriate.
tabela_funcionarios = dynamodb.Table(DYNAMODB_TABLE_EMPLOYEES)
tabela_registros = dynamodb.Table(DYNAMODB_TABLE_RECORDS)
tabela_usuarioempresa = dynamodb.Table(DYNAMODB_TABLE_USERS)
tabela_configuracoes = dynamodb.Table(DYNAMODB_TABLE_CONFIG)
# Nota: Horários pré-definidos serão salvos na tabela ConfigCompany com id='horarios_preset'

def enviar_s3(caminho, nome_arquivo, company_id):
    """Upload an object under company prefix and return public URL.

    nome_arquivo is the relative path inside the company folder, e.g.
    'funcionarios/<employee_id>.jpg' or 'registros/<registro_id>.jpg'.
    company_id is required and used as the top-level prefix.
    """
    key = f"{company_id}/{nome_arquivo}"
    
    # Upload sem ACL (bucket deve ter política de acesso público configurada)
    s3.upload_file(
        caminho, 
        BUCKET, 
        key,
        ExtraArgs={
            # ACL removido - bucket usa Object Ownership: BucketOwnerEnforced
            'ContentType': 'image/jpeg'
        }
    )
    
    # Use region-aware URL
    url = f"https://{BUCKET}.s3.{REGIAO}.amazonaws.com/{key}"
    print(f"[S3] Upload concluído. URL pública: {url}")
    return url


UUID_LEN = 36  # company_id é um UUID com 36 chars (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)


def parse_external_image_id(external_id):
    """Extrai (company_id, employee_id) de um ExternalImageId no formato '<company_uuid>_<employee_id>'.

    Retorna (None, None) se o formato for inválido. Esta função é a ÚNICA fonte
    canônica para interpretar ExternalImageId — qualquer caller deve usá-la para
    evitar parsings divergentes que possam aceitar formatos legados inseguros.
    """
    if not isinstance(external_id, str):
        return None, None
    # Formato esperado: UUID(36) + '_' + employee_id
    if len(external_id) <= UUID_LEN + 1:
        return None, None
    if external_id[UUID_LEN] != '_':
        return None, None
    company_part = external_id[:UUID_LEN]
    employee_part = external_id[UUID_LEN + 1:]
    # Validação leve do shape de UUID
    if company_part.count('-') != 4:
        return None, None
    if not employee_part:
        return None, None
    return company_part, employee_part


def reconhecer_funcionario(caminho_foto, expected_company_id=None):
    """Procura o rosto na collection do Rekognition.

    Quando `expected_company_id` é fornecido, qualquer match cujo ExternalImageId
    NÃO pertença a essa company é descartado e a função retorna
    `{'status': 'TENANT_MISMATCH', ...}` — garantindo isolamento multi-tenant
    no nível do backend, independentemente do que o frontend envie.

    Retorna um dict com pelo menos a chave `status`:
      - {'status': 'NO_MATCH'}
      - {'status': 'INVALID_EXTERNAL_ID', 'external_image_id': ...}
      - {'status': 'TENANT_MISMATCH', 'matched_company_id': ..., 'expected_company_id': ...}
      - {'status': 'OK', 'company_id', 'employee_id', 'similarity', 'external_image_id'}
      - {'status': 'ERROR', 'reason': ...}
    """
    try:
        print(f"[REKOGNITION] Iniciando busca facial na collection: {COLLECTION}")
        print(f"[REKOGNITION] Foto: {caminho_foto}, expected_company_id={expected_company_id}")

        with open(caminho_foto, 'rb') as image_file:
            image_bytes = image_file.read()
            print(f"[REKOGNITION] Tamanho da imagem: {len(image_bytes)} bytes")

        # Threshold configurável via variável de ambiente (padrão: 85)
        threshold = int(os.environ.get('REKOGNITION_THRESHOLD', '85'))

        response = rekognition.search_faces_by_image(
            CollectionId=COLLECTION,
            Image={'Bytes': image_bytes},
            MaxFaces=1,
            FaceMatchThreshold=threshold,
        )

        matches = response.get('FaceMatches') or []
        if not matches:
            print("[REKOGNITION] Nenhum rosto correspondente encontrado")
            return {'status': 'NO_MATCH'}

        face_match = matches[0]
        external_id = face_match['Face']['ExternalImageId']
        similarity = face_match['Similarity']
        print(f"[REKOGNITION] Match bruto: ExternalImageId={external_id}, Similarity={similarity}%")

        matched_company_id, employee_id = parse_external_image_id(external_id)
        if not matched_company_id or not employee_id:
            print(f"[REKOGNITION] ExternalImageId em formato inválido (não 'uuid_employeeid'): {external_id}")
            return {
                'status': 'INVALID_EXTERNAL_ID',
                'external_image_id': external_id,
            }

        if expected_company_id and matched_company_id != expected_company_id:
            # Bloqueio defensivo: rosto pertence a outra empresa.
            print(
                f"[REKOGNITION][TENANT_MISMATCH] match externo pertence a "
                f"company_id={matched_company_id}, mas kiosk autenticado é {expected_company_id}. "
                f"Rejeitando reconhecimento."
            )
            return {
                'status': 'TENANT_MISMATCH',
                'matched_company_id': matched_company_id,
                'expected_company_id': expected_company_id,
                'external_image_id': external_id,
            }

        return {
            'status': 'OK',
            'company_id': matched_company_id,
            'employee_id': employee_id,
            'similarity': similarity,
            'external_image_id': external_id,
        }

    except rekognition.exceptions.InvalidParameterException as e:
        # Caso típico: nenhuma face detectada na imagem.
        print(f"[REKOGNITION] Parâmetro inválido (provável 'no faces in image'): {str(e)}")
        return {'status': 'NO_FACE', 'reason': str(e)}
    except rekognition.exceptions.ResourceNotFoundException as e:
        print(f"[REKOGNITION] Collection não encontrada: {str(e)}")
        return {'status': 'ERROR', 'reason': 'collection-not-found'}
    except Exception as e:
        import traceback
        print(f"[REKOGNITION] Erro no reconhecimento: {str(e)}")
        print(f"[REKOGNITION] Traceback: {traceback.format_exc()}")
        return {'status': 'ERROR', 'reason': str(e)}
