"""
Regras de negócio para cálculo de pré-folha.
Sem INSS, FGTS, IRRF ou obrigações legais — apenas pré-fechamento financeiro.
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict


def calcular_prefolha(
    emp_config: Dict[str, Any],
    worked_data: Dict[str, Any],
    company_config: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Calcula o total da pré-folha para um funcionário em uma competência.
    Retorna dicionário com todos os componentes financeiros.
    """
    tipo        = emp_config.get('tipo_remuneracao', 'mensalista')
    salario_base      = Decimal(str(emp_config.get('salario_base', 0) or 0))
    valor_hora_manual = Decimal(str(emp_config.get('valor_hora', 0) or 0))

    horas_previstas = Decimal(str(worked_data.get('horas_previstas', 176) or 176))

    # Valor/hora efetivo
    if valor_hora_manual > 0:
        valor_hora = valor_hora_manual
    elif tipo == 'mensalista' and salario_base > 0 and horas_previstas > 0:
        valor_hora = (salario_base / horas_previstas).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    else:
        valor_hora = Decimal('0')

    # Horas do mês
    horas_trab     = Decimal(str(worked_data.get('horas_trabalhadas', 0) or 0))
    horas_extra    = Decimal(str(worked_data.get('horas_extras', 0) or 0))
    horas_falta    = Decimal(str(worked_data.get('horas_falta', 0) or 0))
    horas_feriado  = Decimal(str(worked_data.get('horas_feriado', 0) or 0))
    horas_domingo  = Decimal(str(worked_data.get('horas_domingo', 0) or 0))
    horas_abonadas = Decimal(str(worked_data.get('horas_abonadas', 0) or 0))
    atraso_min     = Decimal(str(worked_data.get('atraso_minutos', 0) or 0))
    banco_horas    = Decimal(str(worked_data.get('banco_horas', 0) or 0))

    # Percentuais
    perc_extra   = Decimal(str(company_config.get('percentual_extra_util', 50))) / 100
    perc_feriado = Decimal(str(company_config.get('percentual_feriado', 100))) / 100
    perc_domingo = Decimal(str(company_config.get('percentual_domingo', 100))) / 100

    # Flags
    descontar_atraso  = bool(company_config.get('descontar_atraso', True))
    recebe_extra      = bool(emp_config.get('recebe_hora_extra', True))
    recebe_feriado    = bool(emp_config.get('recebe_adicional_feriado', True))
    recebe_domingo    = bool(emp_config.get('recebe_adicional_domingo', True))
    banco_mode        = emp_config.get('banco_horas_mode') or company_config.get('banco_horas_mode', 'pagar')

    # Adicionais
    valor_extras  = (horas_extra * valor_hora * perc_extra)   if recebe_extra   else Decimal('0')
    valor_feriado = (horas_feriado * valor_hora * perc_feriado) if recebe_feriado else Decimal('0')
    valor_domingo = (horas_domingo * valor_hora * perc_domingo) if recebe_domingo  else Decimal('0')

    # Descontos
    desconto_falta  = horas_falta * valor_hora
    desconto_atraso = (atraso_min / 60 * valor_hora) if descontar_atraso else Decimal('0')

    # Banco de horas
    desconto_banco = Decimal('0')
    valor_banco    = Decimal('0')
    if banco_mode == 'pagar':
        if banco_horas < 0:
            desconto_banco = abs(banco_horas) * valor_hora
        elif banco_horas > 0:
            valor_banco = banco_horas * valor_hora

    if tipo == 'mensalista':
        total = (salario_base
                 + valor_extras + valor_feriado + valor_domingo + valor_banco
                 - desconto_falta - desconto_atraso - desconto_banco)
    else:
        base_horista = (horas_trab + horas_abonadas) * valor_hora
        total = (base_horista
                 + valor_extras + valor_feriado + valor_domingo + valor_banco
                 - desconto_atraso - desconto_banco)

    def q(v: Decimal) -> float:
        return float(v.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))

    return {
        'tipo_remuneracao':  tipo,
        'horas_previstas':   float(horas_previstas),
        'horas_trabalhadas': float(horas_trab),
        'horas_extras':      float(horas_extra),
        'horas_falta':       float(horas_falta),
        'horas_feriado':     float(horas_feriado),
        'horas_domingo':     float(horas_domingo),
        'horas_abonadas':    float(horas_abonadas),
        'atraso_minutos':    float(atraso_min),
        'banco_horas':       float(banco_horas),
        'salario_base':      q(salario_base),
        'valor_hora':        q(valor_hora),
        'valor_extras':      q(valor_extras),
        'valor_feriado':     q(valor_feriado),
        'valor_domingo':     q(valor_domingo),
        'desconto_falta':    q(desconto_falta),
        'desconto_atraso':   q(desconto_atraso),
        'desconto_banco':    q(desconto_banco),
        'valor_banco':       q(valor_banco),
        'total':             q(total),
    }
