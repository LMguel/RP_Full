"""
Gerenciamento de fotos no S3 com nova estrutura de pastas
Formato: /company_id/employee_id/YYYY/MM/DD/HH-mm-ss.jpg
"""
import boto3
from datetime import datetime
from typing import Optional
import os

s3 = boto3.client('s3', region_name='us-east-1')
BUCKET = os.environ.get('S3_BUCKET', 'registraponto-prod-fotos')

def generate_s3_key(company_id: str, employee_id: str, timestamp: datetime = None) -> str:
    """
    Gera chave S3 seguindo novo padrão de pastas
    Formato: company_id/employee_id/YYYY/MM/DD/HH-mm-ss.jpg
    """
    if timestamp is None:
        timestamp = datetime.now()
    
    year = timestamp.strftime('%Y')
    month = timestamp.strftime('%m')
    day = timestamp.strftime('%d')
    time_str = timestamp.strftime('%H-%M-%S')
    
    key = f"{company_id}/{employee_id}/{year}/{month}/{day}/{time_str}.jpg"
    return key

def upload_photo_to_s3(
    photo_bytes: bytes,
    company_id: str,
    employee_id: str,
    timestamp: datetime = None,
    content_type: str = 'image/jpeg'
) -> tuple[str, str]:
    """
    Faz upload de foto para S3 usando nova estrutura
    
    Returns:
        tuple: (s3_key, public_url)
    """
    s3_key = generate_s3_key(company_id, employee_id, timestamp)
    
    try:
        # Upload sem ACL (bucket deve ter política de acesso público configurada)
        s3.put_object(
            Bucket=BUCKET,
            Key=s3_key,
            Body=photo_bytes,
            ContentType=content_type
            # ACL removido - bucket usa Object Ownership: BucketOwnerEnforced
        )
        
        # Gerar URL pública
        url = f"https://{BUCKET}.s3.amazonaws.com/{s3_key}"
        
        print(f"[S3] Upload concluído: {s3_key}")
        print(f"[S3] URL: {url}")
        
        return s3_key, url
        
    except Exception as e:
        print(f"[S3] Erro no upload: {e}")
        raise

def delete_photo_from_s3(s3_key: str) -> bool:
    """Remove foto do S3"""
    try:
        s3.delete_object(Bucket=BUCKET, Key=s3_key)
        print(f"[S3] Foto deletada: {s3_key}")
        return True
    except Exception as e:
        print(f"[S3] Erro ao deletar foto: {e}")
        return False

def get_photo_url(s3_key: str) -> str:
    """Retorna URL pública da foto"""
    if not s3_key:
        return None
    return f"https://{BUCKET}.s3.amazonaws.com/{s3_key}"

def migrate_old_photo_key(old_key: str, company_id: str, employee_id: str) -> Optional[str]:
    """
    Migra foto antiga para nova estrutura de pastas
    
    Args:
        old_key: Chave antiga (ex: "fotos/emp123_timestamp.jpg")
        company_id: ID da empresa
        employee_id: ID do funcionário
    
    Returns:
        Nova chave S3 ou None se falhou
    """
    try:
        # Baixar foto antiga
        response = s3.get_object(Bucket=BUCKET, Key=old_key)
        photo_bytes = response['Body'].read()
        
        # Fazer upload com nova estrutura
        new_key, _ = upload_photo_to_s3(photo_bytes, company_id, employee_id)
        
        # Deletar foto antiga
        delete_photo_from_s3(old_key)
        
        print(f"[S3] Foto migrada: {old_key} → {new_key}")
        return new_key
        
    except Exception as e:
        print(f"[S3] Erro ao migrar foto: {e}")
        return None

def list_employee_photos(company_id: str, employee_id: str, year: int = None, month: int = None) -> list:
    """
    Lista todas as fotos de um funcionário
    Pode filtrar por ano/mês
    """
    prefix = f"{company_id}/{employee_id}/"
    
    if year:
        prefix += f"{year:04d}/"
        if month:
            prefix += f"{month:02d}/"
    
    try:
        response = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
        
        if 'Contents' not in response:
            return []
        
        photos = []
        for obj in response['Contents']:
            key = obj['Key']
            if key.endswith('.jpg') or key.endswith('.jpeg'):
                photos.append({
                    'key': key,
                    'url': get_photo_url(key),
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat()
                })
        
        return photos
        
    except Exception as e:
        print(f"[S3] Erro ao listar fotos: {e}")
        return []
