import boto3
import os
import uuid
import hashlib
import time
from threading import Lock
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
    """Faz upload sob o prefixo da empresa e retorna a S3 key.

    Retorna a key (ex: '{company_id}/funcionarios/{id}.jpg').
    Para obter uma URL temporária, use generate_presigned_url(key).
    """
    key = f"{company_id}/{nome_arquivo}"
    s3.upload_file(
        caminho,
        BUCKET,
        key,
        ExtraArgs={'ContentType': 'image/jpeg'},
    )
    print(f"[S3] Upload concluído. Bucket={BUCKET}, Key={key[:40]}…")
    # Retornar a URL pública por compatibilidade com dados legados.
    # Novos clientes devem usar generate_presigned_url() para URLs temporárias.
    url = f"https://{BUCKET}.s3.{REGIAO}.amazonaws.com/{key}"
    return url


def generate_presigned_url(key: str, expiration_seconds: int = 3600) -> str | None:
    """Gera uma URL assinada temporária para um objeto S3.

    Args:
        key: S3 object key (ex: '{company_id}/funcionarios/{id}.jpg')
        expiration_seconds: Tempo de validade em segundos (padrão: 1 hora)

    Returns:
        URL assinada ou None em caso de erro.
    """
    try:
        url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET, 'Key': key},
            ExpiresIn=expiration_seconds,
        )
        return url
    except Exception as e:
        print(f"[S3] Erro ao gerar presigned URL: {type(e).__name__}")
        return None


def extract_s3_key_from_url(url: str) -> str | None:
    """Extrai a S3 key de uma URL pública do bucket.

    Ex: 'https://bucket.s3.region.amazonaws.com/{company_id}/foo.jpg'
    → '{company_id}/foo.jpg'
    """
    if not url or 'amazonaws.com' not in url:
        return None
    try:
        # Formato: https://{bucket}.s3.{region}.amazonaws.com/{key}
        marker = '.amazonaws.com/'
        idx = url.find(marker)
        if idx < 0:
            return None
        return url[idx + len(marker):]
    except Exception:
        return None


# ── Cache Rekognition ─────────────────────────────────────────────────────────
# Evita chamadas duplicadas em retentativas do kiosk (TTL=10s, máx 100 entradas).
# Cache por worker Gunicorn — cada worker tem sua própria cópia (comportamento esperado).
_rek_cache: dict = {}
_rek_cache_lock = Lock()
_REK_CACHE_TTL = 10
_REK_CACHE_MAX = 100


def _rek_cache_get(key: str):
    with _rek_cache_lock:
        entry = _rek_cache.get(key)
        if entry and time.monotonic() < entry[0]:
            return entry[1]
        _rek_cache.pop(key, None)
        return None


def _rek_cache_set(key: str, result: dict):
    with _rek_cache_lock:
        if len(_rek_cache) >= _REK_CACHE_MAX:
            oldest = min(_rek_cache, key=lambda k: _rek_cache[k][0])
            del _rek_cache[oldest]
        _rek_cache[key] = (time.monotonic() + _REK_CACHE_TTL, result)


def _resize_for_rekognition(image_bytes: bytes, max_px: int = 800) -> bytes:
    """Redimensiona para max_px no lado maior antes de enviar ao Rekognition.

    Reduz custo e latência sem afetar precisão — Rekognition detecta faces
    com confiança a partir de ~80px. Retorna os bytes originais se falhar.
    """
    try:
        from PIL import Image
        import io as _io
        img = Image.open(_io.BytesIO(image_bytes))
        if max(img.size) <= max_px:
            return image_bytes
        img.thumbnail((max_px, max_px), Image.LANCZOS)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        buf = _io.BytesIO()
        img.save(buf, format='JPEG', quality=85)
        resized = buf.getvalue()
        print(f"[REKOGNITION] Resize: {len(image_bytes):,}→{len(resized):,} bytes ({max(img.size)}px)")
        return resized
    except Exception as e:
        print(f"[REKOGNITION] Aviso: resize falhou ({e}), usando imagem original")
        return image_bytes


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

    Quando `expected_company_id` é fornecido, itera por todos os matches
    retornados para encontrar o melhor que pertença a essa empresa — permitindo
    que funcionários vinculados a múltiplas empresas sejam reconhecidos
    corretamente em cada kiosk. Só retorna TENANT_MISMATCH quando nenhum
    match pertence à empresa esperada (person genuinamente não cadastrada aqui).

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

        # Cache: evita chamar a API para a mesma imagem em retentativas rápidas
        _ck = hashlib.sha256(image_bytes).hexdigest() + (expected_company_id or '')
        _cached = _rek_cache_get(_ck)
        if _cached is not None:
            print("[REKOGNITION] Cache hit — chamada à API evitada")
            return _cached

        # Threshold configurável via variável de ambiente (padrão: 85)
        threshold = int(os.environ.get('REKOGNITION_THRESHOLD', '85'))

        # Redimensionar antes da chamada — reduz tamanho do payload e custo
        api_bytes = _resize_for_rekognition(image_bytes)

        # MaxFaces=10 permite encontrar o match correto mesmo quando o funcionário
        # está cadastrado em múltiplas empresas (cada uma com seu próprio ExternalImageId).
        response = rekognition.search_faces_by_image(
            CollectionId=COLLECTION,
            Image={'Bytes': api_bytes},
            MaxFaces=10,
            FaceMatchThreshold=threshold,
        )

        matches = response.get('FaceMatches') or []
        if not matches:
            print("[REKOGNITION] Nenhum rosto correspondente encontrado")
            _no_match = {'status': 'NO_MATCH'}
            _rek_cache_set(_ck, _no_match)
            return _no_match

        # Rekognition já retorna por similaridade decrescente; garantir a ordem.
        matches.sort(key=lambda m: m['Similarity'], reverse=True)

        company_match = None   # melhor match pertencente a expected_company_id
        other_match = None     # melhor match de outra empresa (para TENANT_MISMATCH)
        first_invalid_id = None

        for face_match in matches:
            external_id = face_match['Face']['ExternalImageId']
            similarity = face_match['Similarity']
            print(f"[REKOGNITION] Candidato: ExternalImageId={external_id}, Similarity={similarity:.2f}%")

            matched_company_id, employee_id = parse_external_image_id(external_id)

            if not matched_company_id or not employee_id:
                if first_invalid_id is None:
                    first_invalid_id = external_id
                continue

            if expected_company_id:
                if matched_company_id == expected_company_id:
                    company_match = (face_match, matched_company_id, employee_id)
                    break  # encontrou o melhor match para esta empresa
                elif other_match is None:
                    other_match = (face_match, matched_company_id, employee_id)
            else:
                # Sem filtro de empresa — pega o melhor match válido
                company_match = (face_match, matched_company_id, employee_id)
                break

        if company_match is None:
            if other_match is not None:
                # Rosto reconhecido, mas pertence apenas a outra(s) empresa(s)
                face_match, matched_company_id, _ = other_match
                external_id = face_match['Face']['ExternalImageId']
                print(
                    f"[REKOGNITION][TENANT_MISMATCH] nenhum match para company_id={expected_company_id}. "
                    f"Melhor match pertence a company_id={matched_company_id}."
                )
                return {
                    'status': 'TENANT_MISMATCH',
                    'matched_company_id': matched_company_id,
                    'expected_company_id': expected_company_id,
                    'external_image_id': external_id,
                }
            if first_invalid_id is not None:
                print(f"[REKOGNITION] ExternalImageId em formato inválido (não 'uuid_employeeid'): {first_invalid_id}")
                return {
                    'status': 'INVALID_EXTERNAL_ID',
                    'external_image_id': first_invalid_id,
                }
            return {'status': 'NO_MATCH'}

        face_match, matched_company_id, employee_id = company_match
        similarity = face_match['Similarity']
        external_id = face_match['Face']['ExternalImageId']
        print(
            f"[REKOGNITION] Match OK: company_id={matched_company_id} "
            f"employee_id={employee_id} similarity={similarity:.2f}%"
        )

        _ok = {
            'status': 'OK',
            'company_id': matched_company_id,
            'employee_id': employee_id,
            'similarity': similarity,
            'external_image_id': external_id,
        }
        _rek_cache_set(_ck, _ok)
        return _ok

    except rekognition.exceptions.InvalidParameterException as e:
        # Caso típico: nenhuma face detectada na imagem.
        print(f"[REKOGNITION] Parâmetro inválido (provável 'no faces in image'): {str(e)}")
        _no_face = {'status': 'NO_FACE', 'reason': str(e)}
        _rek_cache_set(_ck, _no_face)
        return _no_face
    except rekognition.exceptions.ResourceNotFoundException as e:
        print(f"[REKOGNITION] Collection não encontrada: {str(e)}")
        return {'status': 'ERROR', 'reason': 'collection-not-found'}
    except Exception as e:
        import traceback
        print(f"[REKOGNITION] Erro no reconhecimento: {str(e)}")
        print(f"[REKOGNITION] Traceback: {traceback.format_exc()}")
        return {'status': 'ERROR', 'reason': str(e)}
