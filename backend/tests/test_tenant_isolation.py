"""
Testes de isolamento multi-tenant — Fase 2 Segurança RegistraPonto.

Valida que:
  - Login de funcionário exige company_id (FIX 3)
  - /recalcular rejeita employee_id de outro tenant (HIGH-4)
  - require_company_scope rejeita tokens sem company_id
  - get_item isola por tenant (sem leitura cross-tenant)

Todos os testes são unitários — sem chamadas AWS reais.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
import jwt
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta
from flask import Flask, jsonify
from functools import wraps

# ── Constantes ────────────────────────────────────────────────────────────────

COMPANY_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
COMPANY_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
EMPLOYEE_A = 'joao_a1b2'
EMPLOYEE_B = 'maria_c3d4'
SECRET = 'test-secret-key-only'

# Forçar secret de teste ANTES de qualquer import de módulo backend
# (load_dotenv() em utils/aws.py pode ter sobrescrito SECRET_KEY com valor real)
os.environ['SECRET_KEY'] = SECRET
os.environ['JWT_SECRET_KEY'] = SECRET
os.environ.setdefault('AWS_DEFAULT_REGION', 'us-east-1')
os.environ.setdefault('AWS_REGION', 'us-east-1')


def _token(company_id: str, tipo: str = 'empresa', **extra) -> str:
    payload = {
        'company_id': company_id,
        'user_id': 'u1',
        'tipo': tipo,
        'exp': datetime.utcnow() + timedelta(hours=1),
        **extra,
    }
    return jwt.encode(payload, SECRET, algorithm='HS256')


# ── 1. require_company_scope ──────────────────────────────────────────────────

class TestRequireCompanyScope:
    """Testa o decorator isolado — sem necessidade do app completo."""

    def _make_test_app(self):
        os.environ['SECRET_KEY'] = SECRET  # garantir antes de chamar verify_token
        from utils.auth import token_required, require_company_scope
        app = Flask(f'test_{__name__}')
        app.config['TESTING'] = True
        app.config['SECRET_KEY'] = SECRET

        @app.route('/guarded')
        @token_required
        @require_company_scope
        def guarded(payload):
            return jsonify({'company_id': payload['company_id']})

        return app

    def test_token_sem_company_id_recebe_403(self):
        app = self._make_test_app()
        bare = jwt.encode(
            {'user_id': 'u1', 'exp': datetime.utcnow() + timedelta(hours=1)},
            SECRET, algorithm='HS256',
        )
        with app.test_client() as c:
            r = c.get('/guarded', headers={'Authorization': f'Bearer {bare}'})
        assert r.status_code == 403
        assert 'company_id' in r.get_json().get('error', '').lower()

    def test_token_company_id_vazio_recebe_403(self):
        app = self._make_test_app()
        empty = jwt.encode(
            {'company_id': '', 'user_id': 'u1', 'exp': datetime.utcnow() + timedelta(hours=1)},
            SECRET, algorithm='HS256',
        )
        with app.test_client() as c:
            r = c.get('/guarded', headers={'Authorization': f'Bearer {empty}'})
        assert r.status_code == 403

    def test_token_valido_passa(self):
        app = self._make_test_app()
        tok = _token(COMPANY_A)
        with app.test_client() as c:
            r = c.get('/guarded', headers={'Authorization': f'Bearer {tok}'})
        assert r.status_code == 200
        assert r.get_json()['company_id'] == COMPANY_A


# ── 2. Login funcionário — company_id obrigatório ────────────────────────────

class TestFuncionarioLoginCompanyIdRequired:
    """
    Testa a lógica de validação no login_funcionario de routes/api.py.
    Importa apenas a função e injeta mocks — sem subir o app Flask completo.
    """

    def _call_login(self, body: dict, mock_table=None):
        """Invoca login_funcionario via test client de um app mínimo."""
        from utils.auth import verify_token as _vt, hash_password

        app = Flask('test_login')
        app.config['TESTING'] = True

        # Registrar apenas a blueprint de api com mocks de tabela
        with patch('utils.aws.dynamodb'), patch('utils.aws.s3'), \
             patch('utils.aws.rekognition', None), \
             patch('boto3.resource'), patch('boto3.client'):
            from routes.api import routes
            if mock_table is not None:
                import routes.api as _api_mod
                _api_mod.tabela_funcionarios = mock_table
            app.register_blueprint(routes, url_prefix='/api')

        with app.test_client() as c:
            return c.post(
                '/api/funcionario/login',
                json=body,
                content_type='application/json',
            )

    def test_sem_company_id_retorna_400(self):
        r = self._call_login({'funcionario_id': EMPLOYEE_A, 'senha': 'x'})
        assert r.status_code == 400
        assert 'company_id' in r.get_json().get('error', '').lower()

    def test_company_id_vazio_retorna_400(self):
        r = self._call_login({'funcionario_id': EMPLOYEE_A, 'senha': 'x', 'company_id': '  '})
        assert r.status_code == 400

    def test_employee_nao_existe_no_tenant_retorna_401(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}  # sem Item
        r = self._call_login(
            {'funcionario_id': EMPLOYEE_B, 'senha': 'x', 'company_id': COMPANY_A},
            mock_table=mock_table,
        )
        assert r.status_code == 401

    def test_get_item_chamado_com_company_id_correto(self):
        """Garante que get_item usa company_id do request, não um scan global."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        self._call_login(
            {'funcionario_id': EMPLOYEE_A, 'senha': 'pw', 'company_id': COMPANY_A},
            mock_table=mock_table,
        )
        mock_table.get_item.assert_called_once_with(
            Key={'company_id': COMPANY_A, 'id': EMPLOYEE_A}
        )
        # Confirma que scan() NÃO foi chamado
        mock_table.scan.assert_not_called()


# ── 3. /recalcular — validação de tenant ─────────────────────────────────────

class TestRecalcularTenantValidation:
    """
    Valida que o endpoint recalculate_day_summary rejeita employee_id
    que não pertence ao company_id do token.
    """

    def _setup_daily_app(self):
        os.environ['SECRET_KEY'] = SECRET
        app = Flask('test_daily')
        app.config['TESTING'] = True
        app.config['SECRET_KEY'] = SECRET
        with patch('utils.aws.dynamodb'), patch('boto3.resource'), patch('boto3.client'):
            from routes.daily import daily_routes
            app.register_blueprint(daily_routes)
        return app

    def test_employee_de_outro_tenant_retorna_403(self):
        app = self._setup_daily_app()
        token_a = _token(COMPANY_A)

        mock_emp = MagicMock()
        mock_emp.get_item.return_value = {}  # EMPLOYEE_B não existe em COMPANY_A

        with patch('routes.daily.table_employees', mock_emp):
            with app.test_client() as c:
                r = c.post(
                    f'/api/registros-diarios/{EMPLOYEE_B}/2026-06-15/recalcular',
                    headers={'Authorization': f'Bearer {token_a}'},
                )
        assert r.status_code == 403
        assert 'empresa' in r.get_json().get('error', '').lower()

    def test_employee_do_proprio_tenant_nao_retorna_403(self):
        app = self._setup_daily_app()
        token_a = _token(COMPANY_A)

        mock_emp = MagicMock()
        mock_emp.get_item.return_value = {'Item': {'id': EMPLOYEE_A, 'company_id': COMPANY_A}}
        mock_rec = MagicMock()
        mock_rec.query.return_value = {'Items': []}

        with patch('routes.daily.table_employees', mock_emp), \
             patch('routes.daily.table_records', mock_rec):
            with app.test_client() as c:
                r = c.post(
                    f'/api/registros-diarios/{EMPLOYEE_A}/2026-06-15/recalcular',
                    headers={'Authorization': f'Bearer {token_a}'},
                )
        assert r.status_code != 403

    def test_get_item_valida_tenant_antes_de_query(self):
        """Confirma que get_item é chamado com (company_id_do_token, employee_id_da_url)."""
        app = self._setup_daily_app()
        token_a = _token(COMPANY_A)

        mock_emp = MagicMock()
        mock_emp.get_item.return_value = {}

        with patch('routes.daily.table_employees', mock_emp):
            with app.test_client() as c:
                c.post(
                    f'/api/registros-diarios/{EMPLOYEE_B}/2026-06-15/recalcular',
                    headers={'Authorization': f'Bearer {token_a}'},
                )

        mock_emp.get_item.assert_called_once_with(
            Key={'company_id': COMPANY_A, 'id': EMPLOYEE_B}
        )


# ── 4. GET /funcionarios/<id> — isolamento por tenant ────────────────────────

class TestGetFuncionarioTenantIsolation:
    """Garante que GET /api/funcionarios/<id> usa get_item com company_id do token."""

    def _setup_api_app(self):
        os.environ['SECRET_KEY'] = SECRET
        app = Flask('test_api_iso')
        app.config['TESTING'] = True
        app.config['SECRET_KEY'] = SECRET
        with patch('utils.aws.dynamodb'), patch('utils.aws.s3'), \
             patch('utils.aws.rekognition', None), \
             patch('boto3.resource'), patch('boto3.client'):
            from routes.api import routes
            app.register_blueprint(routes, url_prefix='/api')
        return app

    def test_funcionario_outro_tenant_retorna_404(self):
        app = self._setup_api_app()
        token_a = _token(COMPANY_A)

        mock_table = MagicMock()
        mock_table.get_item.return_value = {}  # não existe em COMPANY_A

        with patch('routes.api.tabela_funcionarios', mock_table):
            with app.test_client() as c:
                r = c.get(
                    f'/api/funcionarios/{EMPLOYEE_B}',
                    headers={'Authorization': f'Bearer {token_a}'},
                )
        assert r.status_code == 404

    def test_get_item_usa_company_id_do_token(self):
        app = self._setup_api_app()
        token_a = _token(COMPANY_A)
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}

        with patch('routes.api.tabela_funcionarios', mock_table):
            with app.test_client() as c:
                c.get(
                    f'/api/funcionarios/{EMPLOYEE_B}',
                    headers={'Authorization': f'Bearer {token_a}'},
                )

        # get_item deve ser chamado com company_id do TOKEN (não da URL)
        call_key = mock_table.get_item.call_args[1].get('Key') or \
                   mock_table.get_item.call_args[0][0].get('Key', {})
        assert call_key.get('company_id') == COMPANY_A

    def test_scan_nao_e_chamado_no_get(self):
        app = self._setup_api_app()
        token_a = _token(COMPANY_A)
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {'id': EMPLOYEE_A, 'company_id': COMPANY_A, 'nome': 'João', 'cargo': 'Dev'}
        }
        with patch('routes.api.tabela_funcionarios', mock_table):
            with app.test_client() as c:
                r = c.get(
                    f'/api/funcionarios/{EMPLOYEE_A}',
                    headers={'Authorization': f'Bearer {token_a}'},
                )
        assert r.status_code == 200
        mock_table.scan.assert_not_called()
