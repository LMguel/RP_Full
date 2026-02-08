from datetime import datetime, timedelta
import math

def parse_time(time_str):
    """Converte string HH:MM para objeto datetime"""
    if not time_str:
        return None
    try:
        return datetime.strptime(time_str, '%H:%M')
    except:
        return None

def time_diff_minutes(time1, time2):
    """Calcula diferença em minutos entre dois horários"""
    if not time1 or not time2:
        return 0
    diff = time2 - time1
    return int(diff.total_seconds() / 60)

def round_minutes(minutes, arredondamento):
    """Arredonda minutos para baixo ao bloco mais próximo conforme configuração.
    Ex: 25min com intervalo 15 → (25//15)*15 = 15min
    Ex: 11min com intervalo 10 → (11//10)*10 = 10min
    Ex: 9min com intervalo 10 → (9//10)*10 = 0min
    """
    if arredondamento == 'exato':
        return minutes

    try:
        interval = int(arredondamento)  # 5, 10 ou 15
    except Exception:
        return minutes

    # Arredondar para baixo ao bloco completo mais próximo
    if interval > 0:
        return (minutes // interval) * interval
    return minutes

def calculate_overtime(
    horario_entrada_esperado,
    horario_saida_esperado,
    horario_entrada_real,
    horario_saida_real,
    configuracoes,
    intervalo_automatico=None,
    duracao_intervalo=None,
    break_real_minutes=None
):
    """
    Calcula horas extras, atrasos e adiantamentos baseado nas configurações da empresa.
    
    Args:
        horario_entrada_esperado: String HH:MM
        horario_saida_esperado: String HH:MM
        horario_entrada_real: String HH:MM
        horario_saida_real: String HH:MM
        configuracoes: Dict com tolerancia_atraso, hora_extra_entrada_antecipada, arredondamento_horas_extras, compensar_saldo_horas
        intervalo_automatico: Bool - se True, desconta duracao_intervalo; se False, desconta break_real_minutes
        duracao_intervalo: Int - duração do intervalo automático em minutos
        break_real_minutes: Int - tempo real de intervalo em minutos (break_start → break_end)
    
    Returns:
        Dict com horas_extras_minutos, atraso_minutos, entrada_antecipada_minutos, saida_antecipada_minutos
    """
    
    # Valores padrão das configurações
    tolerancia_atraso = configuracoes.get('tolerancia_atraso', 0)
    conta_entrada_antecipada = configuracoes.get('hora_extra_entrada_antecipada', False)
    arredondamento = configuracoes.get('arredondamento_horas_extras', 'exato')
    compensar_saldo_horas = configuracoes.get('compensar_saldo_horas', False)
    
    # Usar parâmetros diretos se fornecidos, senão usar configurações
    intervalo_automatico = intervalo_automatico if intervalo_automatico is not None else configuracoes.get('intervalo_automatico', False)
    duracao_intervalo = duracao_intervalo if duracao_intervalo is not None else configuracoes.get('duracao_intervalo', 60)
    
    # Parse dos horários
    entrada_esperado = parse_time(horario_entrada_esperado)
    saida_esperado = parse_time(horario_saida_esperado)
    entrada_real = parse_time(horario_entrada_real)
    saida_real = parse_time(horario_saida_real)
    
    resultado = {
        'horas_extras_minutos': 0,
        'horas_trabalhadas_minutos': 0
    }
    
    # Se não tem horários esperados, não calcula nada
    if not entrada_esperado or not saida_esperado:
        return resultado
    
    # Calcula horas trabalhadas ESPERADAS (jornada normal)
    if entrada_esperado and saida_esperado:
        horas_brutas = time_diff_minutes(entrada_esperado, saida_esperado)
        
        # Se intervalo automático estiver ativado, desconta o tempo de intervalo fixo
        # Se intervalo manual e temos break_real_minutes, desconta o tempo real
        if intervalo_automatico and duracao_intervalo > 0:
            resultado['horas_trabalhadas_minutos'] = max(0, horas_brutas - duracao_intervalo)
            print(f"[DEBUG] Intervalo automático: {duracao_intervalo}min descontados. Horas brutas: {horas_brutas}, Líquidas: {resultado['horas_trabalhadas_minutos']}")
        elif not intervalo_automatico and break_real_minutes is not None and break_real_minutes > 0:
            resultado['horas_trabalhadas_minutos'] = max(0, horas_brutas - break_real_minutes)
            print(f"[DEBUG] Intervalo manual: {break_real_minutes}min reais descontados. Horas brutas: {horas_brutas}, Líquidas: {resultado['horas_trabalhadas_minutos']}")
        else:
            resultado['horas_trabalhadas_minutos'] = horas_brutas
    
    # Análise da ENTRADA: não registrar atrasos, apenas contar entrada antecipada como hora extra se configurado
    if entrada_real and entrada_esperado:
        diff_entrada = time_diff_minutes(entrada_esperado, entrada_real)
        # Se chegou muito adiantado e empresa conta entrada antecipada como extra, converter em horas extras
        if diff_entrada < -tolerancia_atraso and conta_entrada_antecipada:
            entrada_antecipada = abs(diff_entrada)
            extra_da_entrada = max(0, entrada_antecipada - tolerancia_atraso)
            resultado['horas_extras_minutos'] += extra_da_entrada
    
    # Análise da SAÍDA
    if saida_real and saida_esperado:
        diff_saida = time_diff_minutes(saida_esperado, saida_real)

        # Se saiu depois do horário esperado além da tolerância, registra hora extra
        # (aqui registramos o tempo total além do horário de saída; a tolerância apenas define o limiar de normalidade)
        if diff_saida > tolerancia_atraso:
            resultado['horas_extras_minutos'] += diff_saida

        elif diff_saida < -tolerancia_atraso:
            # Saída antecipada: não registrar minutos de penalização, apenas ignorar
            pass
        # Se diff_saida está entre -tolerancia e +tolerancia: saída NORMAL (não faz nada)
    
    # Aplica arredondamento nas horas extras
    if resultado['horas_extras_minutos'] > 0:
        resultado['horas_extras_minutos'] = round_minutes(
            resultado['horas_extras_minutos'],
            arredondamento
        )
    
    # Não aplicar compensação de atraso
    
    return resultado

def format_minutes_to_time(minutes):
    """Converte minutos para formato HH:MM"""
    if minutes == 0:
        return "00:00"
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"
