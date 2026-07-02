"""
Resolução de configurações individuais de jornada.
Prioridade: funcionário > empresa > padrão do sistema.
"""

from typing import Dict, Optional


def resolve_early_entry_overtime(employee: Optional[Dict], company_config: Optional[Dict]) -> bool:
    """
    Resolve se entrada antecipada conta como hora extra.

    Prioridade:
      1. employee['early_entry_overtime'] se não for None (override individual)
      2. company_config['hora_extra_entrada_antecipada'] ou ['count_early_as_extra']
      3. False (padrão do sistema)
    """
    if isinstance(employee, dict):
        emp_val = employee.get('early_entry_overtime')
        if emp_val is not None:
            return bool(emp_val)

    if isinstance(company_config, dict):
        if 'hora_extra_entrada_antecipada' in company_config:
            return bool(company_config.get('hora_extra_entrada_antecipada'))
        if 'count_early_as_extra' in company_config:
            return bool(company_config.get('count_early_as_extra'))

    return False


def resolve_interval_automatico(employee: Optional[Dict], company_config: Optional[Dict]) -> bool:
    """
    Resolve o modo de intervalo (automático vs manual) do funcionário.

    Manual: exige que o funcionário registre saída e volta do intervalo (batidas).
    Automático: desconta o intervalo configurado da jornada sem exigir registro.

    Prioridade:
      1. employee['intervalo_automatico'] se não for None (override individual)
      2. company_config['intervalo_automatico'] ou ['interval_auto'] ou ['break_auto']
      3. False (padrão do sistema = manual)
    """
    if isinstance(employee, dict):
        emp_val = employee.get('intervalo_automatico')
        if emp_val is not None:
            return bool(emp_val)

    if isinstance(company_config, dict):
        if 'intervalo_automatico' in company_config:
            return bool(company_config.get('intervalo_automatico'))
        if 'interval_auto' in company_config:
            return bool(company_config.get('interval_auto'))
        if 'break_auto' in company_config:
            return bool(company_config.get('break_auto'))

    return False
