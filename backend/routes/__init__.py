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
from .feriados import feriados_routes
from .chatbot_rh import chatbot_rh_routes
from .admin_aws import admin_aws_routes
from .payroll import payroll_routes
from .users import users_routes
from .audit import audit_routes

__all__ = [
    'routes',
    'routes_v2',
    'daily_routes',
    'dashboard_routes',
    'routes_facial',
    'admin_routes',
    'auth_admin_routes',
    'feriados_routes',
    'chatbot_rh_routes',
    'admin_aws_routes',
    'payroll_routes',
    'users_routes',
    'audit_routes',
]

