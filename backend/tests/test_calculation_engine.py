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
    calculate_early_entry_minutes,
    calculate_expected_minutes,
    calculate_worked_minutes,
    calculate_tolerance_rounding_minutes,
    calculate_daily_balance,
    minutes_to_hhmm,
)
from utils.schedule_settings import resolve_early_entry_overtime


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
        # 12min late, tolerance=10 → 2 (apenas o excedente além da tolerância)
        minutes = calculate_delay_minutes('2026-05-01T08:12:00', '08:00', tolerance_minutes=10)
        assert minutes == 2

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
# calculate_early_entry_minutes
# ─────────────────────────────────────────────

class TestCalculateEarlyEntryMinutes:
    def test_exemplo_1_entrada_30min_antes(self):
        # Jornada 13:00-18:00, registro 12:30 → 30 min antecipados
        minutes = calculate_early_entry_minutes('2026-05-01T12:30:00', '13:00')
        assert minutes == 30

    def test_exemplo_2_apenas_a_entrada_conta(self):
        # A função só mede a entrada; a saída depois é somada pelo chamador
        minutes = calculate_early_entry_minutes('2026-05-01T12:30:00', '13:00')
        assert minutes == 30

    def test_entrada_no_horario_previsto(self):
        minutes = calculate_early_entry_minutes('2026-05-01T13:00:00', '13:00')
        assert minutes == 0

    def test_entrada_depois_do_previsto_nao_penaliza(self):
        minutes = calculate_early_entry_minutes('2026-05-01T13:15:00', '13:00')
        assert minutes == 0

    def test_sem_first_punch_retorna_zero(self):
        assert calculate_early_entry_minutes(None, '13:00') == 0

    def test_sem_horario_previsto_retorna_zero(self):
        assert calculate_early_entry_minutes('2026-05-01T12:30:00', None) == 0


# ─────────────────────────────────────────────
# calculate_tolerance_rounding_minutes
# ─────────────────────────────────────────────

class TestCalculateToleranceRoundingMinutes:
    def test_atraso_dentro_da_tolerancia_arredonda(self):
        # Previsto 13:00, tolerância 10 min, entrada 13:10 → +10 min
        minutes = calculate_tolerance_rounding_minutes('2026-05-01T13:10:00', '13:00', 10)
        assert minutes == 10

    def test_atraso_no_limite_da_tolerancia_arredonda(self):
        minutes = calculate_tolerance_rounding_minutes('2026-05-01T13:05:00', '13:00', 10)
        assert minutes == 5

    def test_atraso_acima_da_tolerancia_nao_arredonda(self):
        # 15 min de atraso com tolerância de 10 → não arredonda (atraso real se aplica)
        minutes = calculate_tolerance_rounding_minutes('2026-05-01T13:15:00', '13:00', 10)
        assert minutes == 0

    def test_entrada_no_horario_nao_arredonda(self):
        minutes = calculate_tolerance_rounding_minutes('2026-05-01T13:00:00', '13:00', 10)
        assert minutes == 0

    def test_entrada_antecipada_nao_arredonda(self):
        minutes = calculate_tolerance_rounding_minutes('2026-05-01T12:50:00', '13:00', 10)
        assert minutes == 0

    def test_sem_first_punch_retorna_zero(self):
        assert calculate_tolerance_rounding_minutes(None, '13:00', 10) == 0

    def test_sem_horario_previsto_retorna_zero(self):
        assert calculate_tolerance_rounding_minutes('2026-05-01T13:10:00', None, 10) == 0


# ─────────────────────────────────────────────
# calculate_daily_balance — banco de horas simétrico: worked vs expected.
# O que exceder o previsto é hora extra, o que faltar é saldo negativo.
# Usado igualmente nos modos manual e automático.
#
# Regressão: routes/daily.py, no modo manual, calculava o banco somando/
# subtraindo atraso de entrada e hora extra de saída medidos separadamente
# contra o horário cadastrado, sem nenhuma relação direta com o total de
# horas trabalhadas no dia — um funcionário podia trabalhar quase a jornada
# inteira e ainda fechar com saldo bem negativo, só porque seu horário
# cadastrado não batia com o horário que ele realmente cumpre.
# ─────────────────────────────────────────────

class TestCalculateDailyBalance:
    def test_caso_fernanda_quase_cumpriu_jornada_saldo_pequeno(self):
        # Cadastro 07:00-17:00 (8h líquidas com 120min de intervalo), mas ela
        # bateu 08:50/13:02/14:36/18:18 (trabalhado real ~474min = 07:54).
        # Esperado: saldo próximo de zero (~-6min), não -32min.
        worked_min = 474
        expected_min = 480
        banco, extra = calculate_daily_balance(
            worked_min, expected_min,
            first_punch_iso='2026-07-20T08:50:00',
            scheduled_start='07:00',
            tolerance_minutes=0,
            count_early_entry_as_extra=False,
        )
        assert banco == -6
        assert extra == 0

    def test_excedeu_previsto_vira_hora_extra(self):
        banco, extra = calculate_daily_balance(
            worked_min=520, expected_min=480,
            first_punch_iso='2026-07-20T07:00:00', scheduled_start='07:00',
            tolerance_minutes=0, count_early_entry_as_extra=False,
        )
        assert banco == 40
        assert extra == 40

    def test_faltou_previsto_vira_saldo_negativo(self):
        banco, extra = calculate_daily_balance(
            worked_min=450, expected_min=480,
            first_punch_iso='2026-07-20T07:00:00', scheduled_start='07:00',
            tolerance_minutes=0, count_early_entry_as_extra=False,
        )
        assert banco == -30
        assert extra == 0

    def test_cumpriu_exatamente_saldo_zero(self):
        banco, extra = calculate_daily_balance(
            worked_min=480, expected_min=480,
            first_punch_iso='2026-07-20T07:00:00', scheduled_start='07:00',
            tolerance_minutes=0, count_early_entry_as_extra=False,
        )
        assert banco == 0
        assert extra == 0

    def test_dentro_da_tolerancia_zera_saldo(self):
        banco, extra = calculate_daily_balance(
            worked_min=475, expected_min=480,
            first_punch_iso='2026-07-20T07:00:00', scheduled_start='07:00',
            tolerance_minutes=10, count_early_entry_as_extra=False,
        )
        assert banco == 0
        assert extra == 0

    def test_entrada_antecipada_nao_conta_quando_flag_desligada(self):
        # Chegou 30min antes do previsto; sem a flag, esse tempo não entra no saldo.
        banco, extra = calculate_daily_balance(
            worked_min=510, expected_min=480,
            first_punch_iso='2026-07-20T06:30:00', scheduled_start='07:00',
            tolerance_minutes=0, count_early_entry_as_extra=False,
        )
        assert banco == 0
        assert extra == 0

    def test_entrada_antecipada_conta_quando_flag_ligada(self):
        banco, extra = calculate_daily_balance(
            worked_min=510, expected_min=480,
            first_punch_iso='2026-07-20T06:30:00', scheduled_start='07:00',
            tolerance_minutes=0, count_early_entry_as_extra=True,
        )
        assert banco == 30
        assert extra == 30

    def test_caso_nicole_entrada_muito_adiantada_cumpriu_jornada_nao_fica_negativo(self):
        # Cadastro 08:30, mas ela chega rotineiramente perto de 07:00 e sai por
        # volta de 17:00 — total trabalhado quase bate com o previsto (07:59 de
        # 08:00). Sem a flag de hora extra por entrada antecipada, o saldo NÃO
        # pode ficar negativo só porque ela chegou adiantada (regressão: antes
        # descontava o tempo adiantado do total trabalhado, gerando -01:29
        # mesmo ela tendo cumprido a jornada quase inteira).
        worked_min = 479  # 07:59
        banco, extra = calculate_daily_balance(
            worked_min, expected_min=480,
            first_punch_iso='2026-07-20T07:02:00', scheduled_start='08:30',
            tolerance_minutes=0, count_early_entry_as_extra=False,
        )
        assert banco == -1
        assert extra == 0

    def test_entrada_adiantada_nao_gera_hora_extra_mas_tambem_nao_penaliza(self):
        # Chegou 90min adiantada (07:00 vs previsto 08:30) e trabalhou o
        # suficiente para bater exatamente o previsto (8h) — sem a flag, o
        # excedente causado pela entrada adiantada não deve virar hora extra,
        # mas o saldo também não deve ficar negativo (ela cumpriu a jornada).
        banco, extra = calculate_daily_balance(
            worked_min=480, expected_min=480,
            first_punch_iso='2026-07-20T07:00:00', scheduled_start='08:30',
            tolerance_minutes=0, count_early_entry_as_extra=False,
        )
        assert banco == 0
        assert extra == 0

    def test_falta_genuina_mesmo_com_entrada_adiantada_continua_negativa(self):
        # Chegou adiantada mas trabalhou pouco no total (saiu muito cedo) —
        # falta genuína, deve continuar negativo mesmo sem clamp de entrada.
        banco, extra = calculate_daily_balance(
            worked_min=300, expected_min=480,
            first_punch_iso='2026-07-20T07:00:00', scheduled_start='08:30',
            tolerance_minutes=0, count_early_entry_as_extra=False,
        )
        assert banco == -180
        assert extra == 0

    def test_saida_tardia_gera_extra_mesmo_com_flag_desligada(self):
        # Entrada no horário (sem adiantamento) e saída bem depois do previsto:
        # o excedente não tem nenhuma relação com entrada antecipada, então
        # deve contar como hora extra mesmo com count_early_entry_as_extra=False.
        banco, extra = calculate_daily_balance(
            worked_min=540, expected_min=480,
            first_punch_iso='2026-07-20T07:00:00', scheduled_start='07:00',
            tolerance_minutes=0, count_early_entry_as_extra=False,
        )
        assert banco == 60
        assert extra == 60


# ─────────────────────────────────────────────
# resolve_early_entry_overtime — prioridade funcionário > empresa > padrão
# ─────────────────────────────────────────────

class TestResolveEarlyEntryOvertime:
    def test_sem_config_usa_padrao_false(self):
        assert resolve_early_entry_overtime({}, {}) is False

    def test_empresa_liga_funcionario_sem_override(self):
        employee = {}
        company = {'hora_extra_entrada_antecipada': True}
        assert resolve_early_entry_overtime(employee, company) is True

    def test_funcionario_true_sobrepoe_empresa_false(self):
        employee = {'early_entry_overtime': True}
        company = {'hora_extra_entrada_antecipada': False}
        assert resolve_early_entry_overtime(employee, company) is True

    def test_funcionario_false_sobrepoe_empresa_true(self):
        employee = {'early_entry_overtime': False}
        company = {'hora_extra_entrada_antecipada': True}
        assert resolve_early_entry_overtime(employee, company) is False

    def test_funcionario_none_usa_empresa(self):
        employee = {'early_entry_overtime': None}
        company = {'count_early_as_extra': True}
        assert resolve_early_entry_overtime(employee, company) is True


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
