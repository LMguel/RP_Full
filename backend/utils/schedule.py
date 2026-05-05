from datetime import date
from typing import Dict, Optional, Tuple

DAYS_PT = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"]
DAYS_EN = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
PT_TO_EN = dict(zip(DAYS_PT, DAYS_EN))


def build_pt_schedule_from_legacy(entrada: Optional[str], saida: Optional[str]) -> Dict[str, Dict[str, Optional[str]]]:
    if not entrada or not saida:
        return {}
    return {
        day: {"entrada": entrada, "saida": saida, "ativo": True}
        for day in DAYS_PT
    }


def build_weekly_from_legacy(entrada: Optional[str], saida: Optional[str]) -> Dict[str, Dict[str, Optional[str]]]:
    if not entrada or not saida:
        return {}
    return {
        day: {"start": entrada, "end": saida, "active": True}
        for day in DAYS_EN
    }


def normalize_preset_schedule(preset: Dict) -> Dict:
    if not isinstance(preset, dict):
        return preset
    horarios = preset.get("horarios")
    if isinstance(horarios, dict) and horarios:
        return preset
    entrada = preset.get("horario_entrada")
    saida = preset.get("horario_saida")
    if entrada and saida:
        preset["horarios"] = build_pt_schedule_from_legacy(entrada, saida)
    return preset


def get_first_active_times(horarios_pt: Dict) -> Tuple[Optional[str], Optional[str]]:
    if not isinstance(horarios_pt, dict):
        return None, None
    for day in DAYS_PT:
        day_data = horarios_pt.get(day) or {}
        if day_data.get("ativo", True):
            entrada = day_data.get("entrada")
            saida = day_data.get("saida")
            if entrada and saida:
                return entrada, saida
    return None, None


def pt_schedule_to_weekly(horarios_pt: Dict) -> Dict[str, Dict[str, Optional[str]]]:
    weekly: Dict[str, Dict[str, Optional[str]]] = {}
    if not isinstance(horarios_pt, dict):
        return weekly
    for pt_day, en_day in PT_TO_EN.items():
        day_data = horarios_pt.get(pt_day)
        if not day_data:
            continue
        ativo = day_data.get("ativo", True)
        if not ativo:
            weekly[en_day] = {"active": False}
            continue
        weekly[en_day] = {
            "start": day_data.get("entrada"),
            "end": day_data.get("saida"),
            "active": True
        }
    return weekly


def get_schedule_for_date(
    employee: Dict,
    target_date: date,
    company_config: Optional[Dict] = None
) -> Tuple[Optional[str], Optional[str]]:
    weekday = DAYS_EN[target_date.weekday()]

    if isinstance(employee, dict):
        custom_schedule = employee.get("custom_schedule") or {}
        day_schedule = custom_schedule.get(weekday)
        if day_schedule:
            active = day_schedule.get("active", True)
            if active is False:
                return None, None
            return day_schedule.get("start"), day_schedule.get("end")

    if company_config:
        weekly_schedule = company_config.get("weekly_schedule") or {}
        day_schedule = weekly_schedule.get(weekday)
        if day_schedule:
            active = day_schedule.get("active", True)
            if active is False:
                return None, None
            return day_schedule.get("start"), day_schedule.get("end")

    if isinstance(employee, dict):
        return employee.get("horario_entrada"), employee.get("horario_saida")

    return None, None
