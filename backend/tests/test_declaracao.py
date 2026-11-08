import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.calculation_engine import calculate_worked_minutes, count_valid_punches
from services.declaracao import (
    abono_minutos, credito_abono, reduzir_ocorrencias, validar_periodo,
)


def _decl(ini, fim, status='ATIVO'):
    return {'type': 'declaracao', 'status': status, 'data_hora': '2026-11-03 00:00:10',
            'abono_inicio': ini, 'abono_fim': fim}


def _punch(hhmm):
    return {'type': 'entrada', 'status': 'ATIVO', 'data_hora': f'2026-11-03 {hhmm}:00'}


def test_declaracao_nao_conta_como_batida():
    regs = [_decl('08:00', '11:00'), _punch('11:05'), _punch('17:00')]
    assert count_valid_punches(regs) == 2
    worked, first, _ = calculate_worked_minutes(regs, True, 0)
    assert worked == 355 and first.endswith('11:05:00')


def test_abono_soma_e_une_sobreposicao():
    assert abono_minutos([_decl('08:00', '10:00'), _decl('14:00', '15:00')]) == 180
    assert abono_minutos([_decl('08:00', '10:00'), _decl('09:00', '11:00')]) == 180


def test_abono_ignora_invalidada_e_invalida():
    assert abono_minutos([_decl('08:00', '10:00', status='INVALIDADO')]) == 0
    assert abono_minutos([_decl('10:00', '08:00')]) == 0


def test_credito_nunca_gera_hora_extra():
    # previsto 480, trabalhou 300, abono 180 -> credita 180 (fecha o dia)
    assert credito_abono(300, 480, 180) == 180
    # trabalhou 420, abono 180 -> só falta 60
    assert credito_abono(420, 480, 180) == 60
    # já cumpriu o dia -> 0
    assert credito_abono(480, 480, 180) == 0
    assert credito_abono(300, None, 180) == 0


def test_reduz_atraso_primeiro_depois_saida():
    assert reduzir_ocorrencias(120, 30, 90) == (30, 30)
    assert reduzir_ocorrencias(60, 30, 80) == (0, 10)
    assert reduzir_ocorrencias(0, 0, 50) == (0, 0)


def test_validar_periodo():
    assert validar_periodo('8:00', '11:30')[:2] == ('08:00', '11:30')
    assert validar_periodo('11:00', '08:00')[2] is not None
    assert validar_periodo('', '08:00')[2] is not None
