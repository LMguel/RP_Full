# backend/services/permissions.py
from __future__ import annotations

ALL_PERMISSIONS: list[str] = [
    "dashboard", "funcionarios", "registros", "correcoes",
    "rh_folha", "configuracoes", "exportacoes", "ajustes",
    "excluir", "criar_usuario", "editar_usuario",
    "fechar_competencia", "reconhecimento", "admin_aws",
]

ROLE_DEFAULTS: dict[str, list[str]] = {
    'OWNER': list(ALL_PERMISSIONS),
    'ADMIN': [
        "dashboard", "funcionarios", "registros", "correcoes", "rh_folha",
        "configuracoes", "exportacoes", "ajustes", "excluir",
        "editar_usuario", "fechar_competencia", "reconhecimento",
    ],
    'RH': [
        "dashboard", "funcionarios", "registros", "correcoes", "rh_folha",
        "exportacoes", "ajustes", "fechar_competencia",
    ],
    'MANAGER': ["dashboard", "funcionarios", "registros", "correcoes", "ajustes"],
    'VIEWER':  ["dashboard", "funcionarios", "registros"],
}

ALLOWED_ROLES_FOR_NEW: list[str] = ['ADMIN', 'RH', 'MANAGER', 'VIEWER']


def calculate_permissions(role: str, overrides: dict) -> list[str]:
    """Calcula lista final: ROLE_DEFAULTS[role] + overrides.add - overrides.remove."""
    base = set(ROLE_DEFAULTS.get(role, ROLE_DEFAULTS['VIEWER']))
    base.update(overrides.get('add', []))
    base.difference_update(overrides.get('remove', []))
    return sorted(base)


def check_permission(payload: dict, permission: str) -> bool:
    """True se o payload JWT tem a permissão solicitada."""
    role = payload.get('role', 'OWNER')
    if role == 'OWNER':
        return True
    return permission in payload.get('permissions', [])
