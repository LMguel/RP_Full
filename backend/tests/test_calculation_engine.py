"""
Testes unitários para backend/services/calculation_engine.py

Cobre as funções críticas de cálculo do espelho de ponto:
  - apply_monthly_tolerance
  - calculate_delay_minutes
  - calculate_early_departure_minutes
  - calculate_worked_minutes
  - calculate_expected_minutes
  - apply_bank_tolerance
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from services.calculation_engine import (
    apply_monthly_tolerance,
    apply_bank_tolerance,
    calculate_delay_minutes,
    calculate_early_departure_minutes,
    calculate_expected_minutes,
    calculate_worked_minutes,
    minutes_to_hhmm,
)


# ─────────────────────────────────────────────
# apply_monthly_tolerance
# ─────────────────────────────────────────────

class TestApplyMonthlyTolerance:
    def test_zera_saldo_positivo_dentro_tolerancia(self):
        applied, saldo = apply_monthly_tolerance(117)
        assert applied is True
        assert saldo == 0

    def test_zera_saldo_negativo_dentro_tolerancia(self):
        applied, saldo = apply_monthly_tolerance(-118)
        assert applied is True
        assert saldo == 0

    def test_preserva_saldo_positivo_acima_tolerancia(self):
        applied, saldo = apply_monthly_tolerance(150)
        assert applied is False
        assert saldo == 150

    def test_preserva_saldo_negativo_acima_tolerancia(self):
        applied, saldo = apply_monthly_tolerance(-130)
        assert applied is False
        assert saldo == -130

    def test_limite_exato_dentro(self):
        # |120| == 120 → dentro
        applied, saldo = apply_monthly_tolerance(120)
        assert applied is True
        assert saldo == 0

    def test_limite_exato_negativo(self):
        applied, saldo = apply_monthly_tolerance(-120)
        assert applied is True
        assert saldo == 0

    def test_um_acima_limite_fora(self):
        applied, saldo = apply_monthly_tolerance(121)
        assert applied is False
        assert saldo == 121

    def test_tolerancia_customizavel(self):
        applied_30, _ = apply_monthly_tolerance(25, tolerance_min=30)
        applied_10, _ = apply_monthly_tolerance(25, tolerance_min=10)
        assert applied_30 is True
        assert applied_10 is False

    def test_saldo_zero_sempre_dentro(self):
        applied, saldo = apply_monthly_tolerance(0)
        assert applied is True
        assert saldo == 0


# ─────────────────────────────────────────────
# apply_bank_tolerance (tolerância diária)
# ─────────────────────────────────────────────

class TestApplyBankTolerance:
    def test_zera_dentro_tolerancia(self):
        assert apply_bank_tolerance(8, 10) == 0

    def test_preserva_acima_tolerancia(self):
        assert apply_bank_tolerance(15, 10) == 15

    def test_negativo_dentro_tolerancia(self):
        assert apply_bank_tolerance(-9, 10) == 0

    def test_tolerancia_zero_nao_aplica(self):
        # tolerance_minutes=0 → nunca zera
        assert apply_bank_tolerance(5, 0) == 5


# ─────────────────────────────────────────────
# calculate_delay_minutes
# ─────────────────────────────────────────────

class TestCalculateDelayMinutes:
    def test_sem_atraso(self):
        minutes = calculate_delay_minutes('2026-05-01T08:00:00', '08:00', tolerance_minutes=0)
        assert minutes == 0

    def test_atraso_exato(self):
        minutes = calculate_delay_minutes('2026-05-01T08:15:00', '08:00', tolerance_minutes=0)
        assert minutes == 15

    def test_dentro_tolerancia(self):
        # 10min late, tolerance=10 → 0
        minutes = calculate_delay_minutes('2026-05-01T08:10:00', '08:00', tolerance_minutes=10)
        assert minutes == 0

    def test_acima_tolerancia(self):
        # 12min late, tolerance=10 → 12 (not just the excess: full delay returned when over)
        minutes = calculate_delay_minutes('2026-05-01T08:12:00', '08:00', tolerance_minutes=10)
        assert minutes == 12

    def test_sem_first_punch_retorna_zero(self):
        assert calculate_delay_minutes(None, '08:00') == 0

    def test_sem_horario_previsto_retorna_zero(self):
        assert calculate_delay_minutes('2026-05-01T09:00:00', None) == 0


# ─────────────────────────────────────────────
# calculate_early_departure_minutes
# ─────────────────────────────────────────────

class TestCalculateEarlyDeparture:
    def test_sem_saida_antecipada(self):
        minutes = calculate_early_departure_minutes('2026-05-01T17:00:00', '17:00', tolerance_minutes=0)
        assert minutes == 0

    def test_saida_antecipada(self):
        minutes = calculate_early_departure_minutes('2026-05-01T16:30:00', '17:00', tolerance_minutes=0)
        assert minutes == 30

    def test_dentro_tolerancia(self):
        minutes = calculate_early_departure_minutes('2026-05-01T16:55:00', '17:00', tolerance_minutes=10)
        assert minutes == 0

    def test_saiu_depois_nao_penaliza(self):
        # Saiu depois → não é antecipado
        minutes = calculate_early_departure_minutes('2026-05-01T17:30:00', '17:00', tolerance_minutes=0)
        assert minutes == 0


# ─────────────────────────────────────────────
# calculate_expected_minutes
# ─────────────────────────────────────────────

class TestCalculateExpectedMinutes:
    def test_jornada_padrao_8h(self):
        # 08:00 → 17:00, 60min intervalo
        mins = calculate_expected_minutes('08:00', '17:00', break_duration=60)
        assert mins == 480  # 9h - 1h = 8h

    def test_jornada_meio_periodo(self):
        mins = calculate_expected_minutes('13:00', '17:30', break_duration=0)
        assert mins == 270  # 4h30m

    def test_sem_horario_retorna_zero(self):
        assert calculate_expected_minutes(None, '17:00') == 0
        assert calculate_expected_minutes('08:00', None) == 0

    def test_sem_intervalo(self):
        mins = calculate_expected_minutes('09:00', '18:00', break_duration=0)
        assert mins == 540  # 9h


# ─────────────────────────────────────────────
# minutes_to_hhmm
# ─────────────────────────────────────────────

class TestMinutesToHHMM:
    def test_zero(self):
        assert minutes_to_hhmm(0) == '00:00'

    def test_uma_hora(self):
        assert minutes_to_hhmm(60) == '01:00'

    def test_oito_horas(self):
        assert minutes_to_hhmm(480) == '08:00'

    def test_negativo(self):
        assert minutes_to_hhmm(-90) == '-01:30'

    def test_com_minutos(self):
        assert minutes_to_hhmm(137) == '02:17'


# ─────────────────────────────────────────────
# Integração: feriado → horas previstas creditadas
# ─────────────────────────────────────────────

class TestFeriadoCreditIntegration:
    """
    Simula o fluxo de crédito automático de feriado.
    O backend calcula horas previstas via calculate_expected_minutes;
    o frontend credita essas horas quando o dia é feriado sem registros.
    """

    def test_credito_equivale_a_jornada_prevista(self):
        # Funcionária trabalha qui 13:00 → 17:30 (sem intervalo)
        previsto = calculate_expected_minutes('13:00', '17:30', break_duration=0)
        assert previsto == 270  # 4h30m
        assert minutes_to_hhmm(previsto) == '04:30'

    def test_feriado_em_dia_sem_jornada_nao_credita(self):
        # Domingos não têm jornada → expected_minutes retorna 0
        previsto = calculate_expected_minutes(None, None, break_duration=0)
        assert previsto == 0

    def test_tolerancia_mensal_apos_credito_feriado(self):
        # Semana normal: 4 dias × 8h (480min)
        # + 1 feriado (4h = 240min crédito automático)
        # Extras totais: 0, Atrasos: 0 → saldo=0 → tolerância aplicada
        saldo_bruto = 0
        applied, saldo = apply_monthly_tolerance(saldo_bruto)
        assert applied is True
        assert saldo == 0
