"""
Lançamento de ponto manual em lote (vários dias de um funcionário).

Funções puras — sem acesso a banco — para validar as batidas informadas
e definir o tipo (entrada / saída / almoço) de cada uma.
"""

import re
from typing import List, Optional, Tuple

MAX_BATIDAS_DIA = 8
MAX_DIAS_LOTE = 62

_HHMM_RE = re.compile(r'^(\d{1,2})[:hH.](\d{2})$')

DIAS_SEMANA_PT = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']


def normalizar_hhmm(valor: object) -> Optional[str]:
    """Converte '8:00', '08h00', '8.00' ou '08:00' em 'HH:MM'. Retorna None se inválido."""
    if not isinstance(valor, str):
        return None
    m = _HHMM_RE.match(valor.strip())
    if not m:
        return None
    hora, minuto = int(m.group(1)), int(m.group(2))
    if hora > 23 or minuto > 59:
        return None
    return f'{hora:02d}:{minuto:02d}'


def tipos_para_batidas(qtd: int) -> List[str]:
    """
    Define o tipo de cada batida pela posição, igual ao registro manual unitário:
      2 batidas -> entrada, saída
      4 batidas -> entrada, saída almoço, retorno almoço, saída
      6/8       -> entrada, saída, entrada, saída, ...
    """
    if qtd == 2:
        return ['entrada', 'saída']
    if qtd == 4:
        return ['entrada', 'saida_almoco', 'retorno_almoco', 'saída']
    tipos = []
    for i in range(qtd):
        tipos.append('entrada' if i % 2 == 0 else ('saída' if i == qtd - 1 else 'saida'))
    return tipos


def validar_batidas(batidas: object) -> Tuple[Optional[List[str]], Optional[str]]:
    """
    Valida as batidas de um dia. Retorna (batidas_normalizadas, None) ou (None, mensagem_de_erro).
    Regras: lista de horários válidos, quantidade par (entrada/saída), 2 a 8,
    em ordem crescente e sem horários repetidos.
    """
    if not isinstance(batidas, list) or not batidas:
        return None, 'Nenhum horário informado'
    if len(batidas) > MAX_BATIDAS_DIA:
        return None, f'Máximo de {MAX_BATIDAS_DIA} batidas por dia'

    normalizadas: List[str] = []
    for b in batidas:
        hhmm = normalizar_hhmm(b)
        if not hhmm:
            return None, f'Horário inválido: {b}'
        normalizadas.append(hhmm)

    if len(normalizadas) % 2 != 0:
        return None, 'Quantidade ímpar de horários — falta uma entrada ou saída'

    for anterior, atual in zip(normalizadas, normalizadas[1:]):
        if atual <= anterior:
            return None, f'Horários fora de ordem ({anterior} → {atual})'

    return normalizadas, None
