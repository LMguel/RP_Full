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
    # Sinal seguro de "tem biometria cadastrada" sem expor o face_id em si —
    # calculado antes do strip, a partir do dict original.
    tem_biometria_facial = bool(employee.get('face_id'))
    result = {k: v for k, v in employee.items() if k not in _BLOCKED_EMPLOYEE_FIELDS}
    result['tem_biometria_facial'] = tem_biometria_facial

    if generate_foto_url:
        try:
            from utils.aws import extract_s3_key_from_url, generate_presigned_url
            # Ler foto_s3_key do dict ORIGINAL — em `result` esse campo já foi removido
            # pelo strip acima (senão isto sempre caía no extract_s3_key_from_url, que
            # normalmente não tem o que extrair).
            s3_key = employee.get('foto_s3_key') or extract_s3_key_from_url(result.get('foto_url') or '')
            if s3_key:
                presigned = generate_presigned_url(s3_key, expiration_seconds=300)
                if presigned:
                    result['foto_url'] = presigned
        except Exception:
            pass

    return result


def sanitize_employees(employees: list, generate_foto_url: bool = False) -> list:
    """Sanitiza uma lista de funcionários."""
    return [sanitize_employee(e, generate_foto_url=generate_foto_url) for e in employees]
