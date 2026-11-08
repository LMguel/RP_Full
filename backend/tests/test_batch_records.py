import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.batch_records import normalizar_hhmm, tipos_para_batidas, validar_batidas


class TestNormalizarHhmm:
    def test_formatos_aceitos(self):
        assert normalizar_hhmm('08:00') == '08:00'
        assert normalizar_hhmm('8:05') == '08:05'
        assert normalizar_hhmm('08h30') == '08:30'
        assert normalizar_hhmm('17.45') == '17:45'
        assert normalizar_hhmm(' 12:00 ') == '12:00'

    def test_invalidos(self):
        for v in ['24:00', '12:60', 'abc', '', '8', None, 800]:
            assert normalizar_hhmm(v) is None


class TestTiposParaBatidas:
    def test_duas_batidas(self):
        assert tipos_para_batidas(2) == ['entrada', 'saída']

    def test_quatro_batidas(self):
        assert tipos_para_batidas(4) == ['entrada', 'saida_almoco', 'retorno_almoco', 'saída']

    def test_seis_batidas_alterna_e_termina_em_saida(self):
        tipos = tipos_para_batidas(6)
        assert tipos[0] == 'entrada'
        assert tipos[-1] == 'saída'
        assert tipos[::2] == ['entrada'] * 3


class TestValidarBatidas:
    def test_dia_completo(self):
        r, erro = validar_batidas(['8:00', '12:00', '13:00', '17:00'])
        assert erro is None
        assert r == ['08:00', '12:00', '13:00', '17:00']

    def test_vazio(self):
        assert validar_batidas([])[1] is not None
        assert validar_batidas(None)[1] is not None

    def test_quantidade_impar(self):
        _, erro = validar_batidas(['08:00', '12:00', '13:00'])
        assert 'ímpar' in erro

    def test_fora_de_ordem(self):
        _, erro = validar_batidas(['08:00', '07:00'])
        assert 'fora de ordem' in erro

    def test_horario_repetido(self):
        _, erro = validar_batidas(['08:00', '08:00'])
        assert erro is not None

    def test_horario_invalido(self):
        _, erro = validar_batidas(['08:00', '25:00'])
        assert 'inválido' in erro

    def test_limite_maximo(self):
        horarios = [f'{h:02d}:00' for h in range(6, 16)]  # 10 batidas
        _, erro = validar_batidas(horarios)
        assert erro is not None
