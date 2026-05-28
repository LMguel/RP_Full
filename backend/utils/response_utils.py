"""Utilitários para sanitizar respostas da API — nunca expor campos internos."""

# Campos que NUNCA devem ir para o frontend
_BLOCKED_EMPLOYEE_FIELDS = frozenset({
    'senha_hash',
    'senha_original',
    'face_id',        # Identificador biométrico do Rekognition — dado sensível
    'deleted_at',     # Campo interno de soft-delete
    'foto_s3_key',    # Chave interna S3
    'is_active',      # Campo interno (usar 'ativo')
})


def sanitize_employee(employee: dict, generate_foto_url: bool = False) -> dict:
    """Remove campos internos/sensíveis de um funcionário antes de enviar ao cliente.

    Se generate_foto_url=True, tenta gerar uma URL presigned para foto_url.
    """
    if not isinstance(employee, dict):
        return employee
    result = {k: v for k, v in employee.items() if k not in _BLOCKED_EMPLOYEE_FIELDS}

    if generate_foto_url and result.get('foto_url'):
        try:
            from utils.aws import extract_s3_key_from_url, generate_presigned_url
            key = extract_s3_key_from_url(result['foto_url'])
            if key:
                presigned = generate_presigned_url(key, expiration_seconds=3600)
                if presigned:
                    result['foto_url'] = presigned
        except Exception:
            pass  # Manter URL original como fallback

    return result


def sanitize_employees(employees: list, generate_foto_url: bool = False) -> list:
    """Sanitiza uma lista de funcionários."""
    return [sanitize_employee(e, generate_foto_url=generate_foto_url) for e in employees]
