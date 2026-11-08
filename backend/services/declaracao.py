"""
Declaração de comparecimento (abono parcial do dia).

Diferente do atestado (que abona o dia todo), a declaração abona só o período
declarado (ex.: consulta médica das 08:00 às 11:00). O funcionário bate o ponto
normalmente no restante do dia. O registro é gravado na tabela TimeRecords com
type='declaracao' e NÃO conta como batida — o cálculo de horas só soma o abono.
"""

from typing import Dict, Iterable, List, Optional, Tuple

TIPO_DECLARACAO = 'declaracao'
MAX_DECLARACOES_DIA = 5


def _hhmm_to_min(valor: object) -> Optional[int]:
    if not isinstance(valor, str) or ':' not in valor:
        return None
    try:
        h, m = valor.strip()[:5].split(':')
        h, m = int(h), int(m)
    except ValueError:
        return None
    if not (0 <= h <= 23 and 0 <= m <= 59):
        return None
    return h * 60 + m


def is_declaracao(registro: Dict) -> bool:
    tipo = str(registro.get('type') or registro.get('tipo') or '').lower().strip()
    return tipo == TIPO_DECLARACAO


def declaracoes_ativas(registros: Iterable[Dict]) -> List[Dict]:
    return [
        r for r in registros
        if is_declaracao(r) and str(r.get('status') or 'ATIVO').upper() not in ('INVALIDADO', 'AJUSTADO')
    ]


def intervalo_declaracao(registro: Dict) -> Optional[Tuple[int, int]]:
    """(início, fim) em minutos desde 00:00, ou None se a declaração estiver inválida."""
    ini = _hhmm_to_min(registro.get('abono_inicio'))
    fim = _hhmm_to_min(registro.get('abono_fim'))
    if ini is None or fim is None or fim <= ini:
        return None
    return ini, fim


def abono_minutos(registros: Iterable[Dict]) -> int:
    """Total de minutos abonados no dia (une intervalos sobrepostos para não contar duas vezes)."""
    intervalos = sorted(
        i for i in (intervalo_declaracao(r) for r in declaracoes_ativas(registros)) if i
    )
    total = 0
    atual_ini = atual_fim = None
    for ini, fim in intervalos:
        if atual_fim is None or ini > atual_fim:
            if atual_fim is not None:
                total += atual_fim - atual_ini
            atual_ini, atual_fim = ini, fim
        else:
            atual_fim = max(atual_fim, fim)
    if atual_fim is not None:
        total += atual_fim - atual_ini
    return total


def credito_abono(trabalhado_min: int, previsto_min: Optional[int], abono_min: int) -> int:
    """
    Quanto do abono vira horas creditadas: nunca passa do que falta para cumprir o
    previsto do dia — abono não gera hora extra.
    """
    if not abono_min or previsto_min is None:
        return 0
    return max(0, min(abono_min, previsto_min - trabalhado_min))


def reduzir_ocorrencias(atraso: Optional[int], saida_antecipada: Optional[int], credito: int) -> Tuple[Optional[int], Optional[int]]:
    """Desconta o crédito do abono primeiro do atraso de entrada e depois da saída antecipada."""
    if not credito:
        return atraso, saida_antecipada
    restante = credito
    novo_atraso = atraso
    if atraso:
        usado = min(atraso, restante)
        novo_atraso = atraso - usado
        restante -= usado
    nova_saida = saida_antecipada
    if saida_antecipada and restante:
        nova_saida = saida_antecipada - min(saida_antecipada, restante)
    return novo_atraso, nova_saida


def validar_periodo(hora_inicio: object, hora_fim: object) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Retorna (inicio 'HH:MM', fim 'HH:MM', erro)."""
    ini = _hhmm_to_min(hora_inicio)
    fim = _hhmm_to_min(hora_fim)
    if ini is None or fim is None:
        return None, None, 'Informe o horário inicial e final da declaração'
    if fim <= ini:
        return None, None, 'O horário final deve ser depois do inicial'
    return f'{ini // 60:02d}:{ini % 60:02d}', f'{fim // 60:02d}:{fim % 60:02d}', None
