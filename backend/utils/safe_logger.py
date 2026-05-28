"""Utilitários de logging seguro — nunca imprime dados sensíveis."""
import re
import logging

_SENSITIVE_PATTERNS = [
    r'(senha|password|secret|token|authorization|credential|hash)\s*[=:]\s*\S+',
]
_COMPILED = [re.compile(p, re.IGNORECASE) for p in _SENSITIVE_PATTERNS]


def mask_token(token: str | None) -> str:
    """Retorna apenas os primeiros 8 chars do token para debugging."""
    if not token:
        return '<ausente>'
    safe = token[:8]
    return f"{safe}…[{len(token)} chars]"


def mask_id(entity_id: str | None, keep_chars: int = 6) -> str:
    """Mascara IDs longos mantendo apenas os primeiros N chars."""
    if not entity_id:
        return '<nulo>'
    if len(entity_id) <= keep_chars:
        return entity_id
    return entity_id[:keep_chars] + '…'


def sanitize_log_data(data: dict) -> dict:
    """Remove campos sensíveis de dicionários antes de logar."""
    _BLOCKED = {
        'senha', 'senha_hash', 'senha_original', 'password', 'password_hash',
        'secret', 'secret_key', 'token', 'authorization', 'face_id',
    }
    return {
        k: '***' if k.lower() in _BLOCKED else v
        for k, v in data.items()
    }


def get_safe_logger(name: str) -> logging.Logger:
    """Retorna logger configurado sem handlers que exponham dados sensíveis."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            '[%(levelname)s] %(name)s — %(message)s'
        ))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger
