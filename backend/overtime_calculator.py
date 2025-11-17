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
    """Arredonda minutos conforme configuração"""
    if arredondamento == 'exato':
        return minutes
    
    interval = int(arredondamento)  # 5, 10 ou 15
    return math.ceil(minutes / interval) * interval

def calculate_overtime(
    horario_entrada_esperado,
    horario_saida_esperado,
    horario_entrada_real,
    horario_saida_real,
    configuracoes,
    intervalo_automatico=None,
    duracao_intervalo=None
):
    """
    Calcula horas extras, atrasos e adiantamentos baseado nas configurações da empresa.
    
    Args:
        horario_entrada_esperado: String HH:MM
        horario_saida_esperado: String HH:MM
        horario_entrada_real: String HH:MM
        horario_saida_real: String HH:MM
        configuracoes: Dict com tolerancia_atraso, hora_extra_entrada_antecipada, arredondamento_horas_extras, compensar_saldo_horas
    
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
        'atraso_minutos': 0,
        'entrada_antecipada_minutos': 0,
        'saida_antecipada_minutos': 0,
        'horas_trabalhadas_minutos': 0
    }
    
    # Se não tem horários esperados, não calcula nada
    if not entrada_esperado or not saida_esperado:
        return resultado
    
    # Calcula horas trabalhadas ESPERADAS (jornada normal)
    if entrada_esperado and saida_esperado:
        horas_brutas = time_diff_minutes(entrada_esperado, saida_esperado)
        
        # Se intervalo automático estiver ativado, desconta o tempo de intervalo
        if intervalo_automatico and duracao_intervalo > 0:
            resultado['horas_trabalhadas_minutos'] = max(0, horas_brutas - duracao_intervalo)
            print(f"[DEBUG] Intervalo automático: {duracao_intervalo}min descontados. Horas brutas: {horas_brutas}, Líquidas: {resultado['horas_trabalhadas_minutos']}")
        else:
            resultado['horas_trabalhadas_minutos'] = horas_brutas
    
    # Análise da ENTRADA
    if entrada_real and entrada_esperado:
        # diff_entrada: positivo => chegou DEPOIS (atraso); negativo => chegou ANTES (adiantado)
        diff_entrada = time_diff_minutes(entrada_esperado, entrada_real)

        if diff_entrada > tolerancia_atraso:  # Chegou ATRASADO (além da tolerância)
            # Atraso = diferença - tolerância
            resultado['atraso_minutos'] = diff_entrada - tolerancia_atraso

        elif diff_entrada < -tolerancia_atraso:  # Chegou MUITO ADIANTADO (antes da tolerância)
            entrada_antecipada = abs(diff_entrada)
            # Só registrar entrada antecipada (visível no status) se a empresa contar hora extra por entrada antecipada
            if conta_entrada_antecipada:
                resultado['entrada_antecipada_minutos'] = entrada_antecipada
                # Se conta como hora extra, considera o tempo além da tolerância como extra
                extra_da_entrada = max(0, entrada_antecipada - tolerancia_atraso)
                resultado['horas_extras_minutos'] += extra_da_entrada
            # Se não conta entrada antecipada como hora extra, manter como NORMAL (não registrar entrada_antecipada_minutos)
        # Se diff_entrada está entre -tolerancia e +tolerancia: entrada NORMAL (não faz nada)
    
    # Análise da SAÍDA
    if saida_real and saida_esperado:
        diff_saida = time_diff_minutes(saida_esperado, saida_real)

        # Se saiu depois do horário esperado além da tolerância, registra hora extra
        # (aqui registramos o tempo total além do horário de saída; a tolerância apenas define o limiar de normalidade)
        if diff_saida > tolerancia_atraso:
            resultado['horas_extras_minutos'] += diff_saida

        elif diff_saida < -tolerancia_atraso:  # Saiu MUITO ANTES (saída antecipada além da tolerância)
            resultado['saida_antecipada_minutos'] = abs(diff_saida) - tolerancia_atraso
        # Se diff_saida está entre -tolerancia e +tolerancia: saída NORMAL (não faz nada)
    
    # Aplica arredondamento nas horas extras
    if resultado['horas_extras_minutos'] > 0:
        resultado['horas_extras_minutos'] = round_minutes(
            resultado['horas_extras_minutos'],
            arredondamento
        )
    
    # Compensação de saldo de horas: Se ativado, atrasos são compensados com horas extras
    if compensar_saldo_horas and resultado['atraso_minutos'] > 0 and resultado['horas_extras_minutos'] > 0:
        print(f"[COMPENSAÇÃO] Antes - Horas Extras: {resultado['horas_extras_minutos']}min, Atrasos: {resultado['atraso_minutos']}min")
        
        # Calcula a compensação
        if resultado['horas_extras_minutos'] >= resultado['atraso_minutos']:
            # Horas extras cobrem todos os atrasos
            resultado['horas_extras_minutos'] -= resultado['atraso_minutos']
            resultado['atraso_minutos'] = 0
        else:
            # Horas extras compensam parcialmente os atrasos
            resultado['atraso_minutos'] -= resultado['horas_extras_minutos']
            resultado['horas_extras_minutos'] = 0
        
        print(f"[COMPENSAÇÃO] Depois - Horas Extras: {resultado['horas_extras_minutos']}min, Atrasos: {resultado['atraso_minutos']}min")
    
    return resultado

def format_minutes_to_time(minutes):
    """Converte minutos para formato HH:MM"""
    if minutes == 0:
        return "00:00"
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"
