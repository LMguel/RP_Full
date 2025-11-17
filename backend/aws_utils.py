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
DYNAMODB_TABLE_HORARIOS = os.environ.get('DYNAMODB_TABLE_HORARIOS', 'HorariosPreset')

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
# Nota: Horários agora são armazenados diretamente nos funcionários (Employees)
# Tabela HorariosPreset não é mais necessária

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


def reconhecer_funcionario(caminho_foto):
    try:
        print(f"[REKOGNITION] Iniciando busca facial na collection: {COLLECTION}")
        print(f"[REKOGNITION] Foto: {caminho_foto}")
        
        with open(caminho_foto, 'rb') as image_file:
            image_bytes = image_file.read()
            print(f"[REKOGNITION] Tamanho da imagem: {len(image_bytes)} bytes")
        
        response = rekognition.search_faces_by_image(
            CollectionId=COLLECTION,
            Image={'Bytes': image_bytes},
            MaxFaces=1,
            FaceMatchThreshold=85
        )
        
        print(f"[REKOGNITION] Resposta recebida: {response}")
        
        if response.get('FaceMatches'):
            face_match = response['FaceMatches'][0]
            external_id = face_match['Face']['ExternalImageId']
            similarity = face_match['Similarity']
            print(f"[REKOGNITION] Match encontrado! ExternalImageId: {external_id}, Similarity: {similarity}%")
            return external_id
        else:
            print(f"[REKOGNITION] Nenhum rosto correspondente encontrado")
            return None
            
    except rekognition.exceptions.InvalidParameterException as e:
        print(f"[REKOGNITION] Erro de parâmetro inválido: {str(e)}")
        return None
    except rekognition.exceptions.ResourceNotFoundException as e:
        print(f"[REKOGNITION] Collection não encontrada: {str(e)}")
        return None
    except Exception as e:
        import traceback
        print(f"[REKOGNITION] Erro no reconhecimento: {str(e)}")
        print(f"[REKOGNITION] Traceback: {traceback.format_exc()}")
        return None
