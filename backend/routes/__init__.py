"""
Rotas da API - Blueprints organizados por funcionalidade
"""
from .api import routes
from .v2 import routes_v2
from .daily import daily_routes
from .dashboard import dashboard_routes
from .facial import routes_facial
from .admin import admin_routes
from .admin_auth import auth_admin_routes

__all__ = [
    'routes',
    'routes_v2',
    'daily_routes',
    'dashboard_routes',
    'routes_facial',
    'admin_routes',
    'auth_admin_routes'
]

