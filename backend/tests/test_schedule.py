"""
Testes unitários para backend/utils/schedule.py::get_schedule_for_date

Esta função é o critério canônico de "o funcionário trabalha neste dia?",
usado por routes/api.py::registrar_ferias para não marcar férias/folga em
dias que o funcionário não trabalha (ex: fim de semana sem escala).
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from datetime import date
from utils.schedule import get_schedule_for_date


# Segunda-feira e sábado de referência
MONDAY = date(2026, 7, 20)
SATURDAY = date(2026, 7, 25)
SUNDAY = date(2026, 7, 26)


class TestLegacyFallback:
    """Sem custom_schedule nem weekly_schedule: usa horario_entrada/saida fixo, só Seg-Sex."""

    def test_dia_de_semana_usa_horario_fixo(self):
        employee = {'horario_entrada': '07:00', 'horario_saida': '17:00'}
        assert get_schedule_for_date(employee, MONDAY, {}) == ('07:00', '17:00')

    def test_sabado_nao_trabalha(self):
        employee = {'horario_entrada': '07:00', 'horario_saida': '17:00'}
        assert get_schedule_for_date(employee, SATURDAY, {}) == (None, None)

    def test_domingo_nao_trabalha(self):
        employee = {'horario_entrada': '07:00', 'horario_saida': '17:00'}
        assert get_schedule_for_date(employee, SUNDAY, {}) == (None, None)

    def test_sem_horario_cadastrado_nao_trabalha(self):
        employee = {}
        assert get_schedule_for_date(employee, MONDAY, {}) == (None, None)


class TestCustomSchedulePorFuncionario:
    """custom_schedule do funcionário tem prioridade sobre tudo."""

    def test_dia_marcado_inativo_nao_trabalha(self):
        employee = {
            'horario_entrada': '07:00', 'horario_saida': '17:00',
            'custom_schedule': {'sat': {'active': False}},
        }
        assert get_schedule_for_date(employee, SATURDAY, {}) == (None, None)

    def test_dia_marcado_ativo_com_horario_proprio(self):
        employee = {
            'custom_schedule': {'sat': {'active': True, 'start': '08:00', 'end': '12:00'}},
        }
        assert get_schedule_for_date(employee, SATURDAY, {}) == ('08:00', '12:00')

    def test_custom_schedule_sobrepoe_weekly_schedule_da_empresa(self):
        employee = {'custom_schedule': {'mon': {'active': False}}}
        company_config = {'weekly_schedule': {'mon': {'active': True, 'start': '07:00', 'end': '17:00'}}}
        assert get_schedule_for_date(employee, MONDAY, company_config) == (None, None)


class TestWeeklyScheduleDaEmpresa:
    """weekly_schedule da empresa é usado quando o funcionário não tem custom_schedule."""

    def test_empresa_habilita_sabado(self):
        employee = {'horario_entrada': '07:00', 'horario_saida': '17:00'}
        company_config = {'weekly_schedule': {'sat': {'active': True, 'start': '08:00', 'end': '12:00'}}}
        assert get_schedule_for_date(employee, SATURDAY, company_config) == ('08:00', '12:00')

    def test_empresa_desabilita_dia_de_semana(self):
        employee = {'horario_entrada': '07:00', 'horario_saida': '17:00'}
        company_config = {'weekly_schedule': {'mon': {'active': False}}}
        assert get_schedule_for_date(employee, MONDAY, company_config) == (None, None)


class TestScheduleHistoryVigencia:
    """schedule_history preserva o cálculo dos dias anteriores a uma troca de horário."""

    def test_data_antes_da_vigencia_usa_horario_antigo(self):
        employee = {
            'horario_entrada': '12:50', 'horario_saida': '17:30',
            'schedule_history': [
                {'effective_until': '2026-08-06', 'horario_entrada': '07:30', 'horario_saida': '17:30'},
            ],
        }
        assert get_schedule_for_date(employee, date(2026, 8, 5), {}) == ('07:30', '17:30')

    def test_data_a_partir_da_vigencia_usa_horario_novo(self):
        employee = {
            'horario_entrada': '12:50', 'horario_saida': '17:30',
            'schedule_history': [
                {'effective_until': '2026-08-06', 'horario_entrada': '07:30', 'horario_saida': '17:30'},
            ],
        }
        assert get_schedule_for_date(employee, date(2026, 8, 6), {}) == ('12:50', '17:30')

    def test_custom_schedule_no_periodo_historico_e_respeitado(self):
        employee = {
            'custom_schedule': {'mon': {'active': True, 'start': '12:50', 'end': '17:30'}},
            'schedule_history': [
                {
                    'effective_until': '2026-08-06',
                    'custom_schedule': {'mon': {'active': True, 'start': '07:30', 'end': '17:30'}},
                },
            ],
        }
        assert get_schedule_for_date(employee, MONDAY, {}) == ('07:30', '17:30')

    def test_multiplas_trocas_escolhe_o_periodo_correto(self):
        employee = {
            'horario_entrada': '12:50', 'horario_saida': '17:30',
            'schedule_history': [
                {'effective_until': '2026-06-01', 'horario_entrada': '06:00', 'horario_saida': '15:00'},
                {'effective_until': '2026-08-06', 'horario_entrada': '07:30', 'horario_saida': '17:30'},
            ],
        }
        assert get_schedule_for_date(employee, date(2026, 5, 1), {}) == ('06:00', '15:00')
        assert get_schedule_for_date(employee, date(2026, 7, 1), {}) == ('07:30', '17:30')
        assert get_schedule_for_date(employee, date(2026, 9, 1), {}) == ('12:50', '17:30')

    def test_sem_schedule_history_comportamento_inalterado(self):
        employee = {'horario_entrada': '07:00', 'horario_saida': '17:00', 'schedule_history': []}
        assert get_schedule_for_date(employee, MONDAY, {}) == ('07:00', '17:00')
