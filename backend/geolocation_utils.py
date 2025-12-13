"""
Utilitários para validação de geolocalização
"""
import math

def calcular_distancia(lat1, lon1, lat2, lon2):
    """
    Calcula a distância entre duas coordenadas geográficas usando a fórmula de Haversine.
    Retorna a distância em metros.
    
    Args:
        lat1: Latitude do ponto 1
        lon1: Longitude do ponto 1
        lat2: Latitude do ponto 2
        lon2: Longitude do ponto 2
    
    Returns:
        float: Distância em metros
    """
    # Raio da Terra em metros
    R = 6371000
    
    # Converter graus para radianos
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    # Fórmula de Haversine
    a = math.sin(delta_lat / 2) ** 2 + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * \
        math.sin(delta_lon / 2) ** 2
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distancia = R * c
    
    return distancia


def validar_localizacao(lat_usuario, lon_usuario, lat_empresa, lon_empresa, raio_permitido):
    """
    Valida se o usuário está dentro do raio permitido da empresa.
    
    Args:
        lat_usuario: Latitude do usuário
        lon_usuario: Longitude do usuário
        lat_empresa: Latitude da empresa
        lon_empresa: Longitude da empresa
        raio_permitido: Raio em metros
    
    Returns:
        tuple: (bool, float) - (está dentro do raio?, distância em metros)
    """
    try:
        print(f"[GEOLOCATION] Validando localização:")
        print(f"  Usuário: {lat_usuario}, {lon_usuario}")
        print(f"  Empresa: {lat_empresa}, {lon_empresa}")
        print(f"  Raio permitido: {raio_permitido}m")
        
        distancia = calcular_distancia(lat_usuario, lon_usuario, lat_empresa, lon_empresa)
        dentro_do_raio = distancia <= raio_permitido
        
        print(f"  Distância calculada: {distancia}m")
        print(f"  Dentro do raio? {dentro_do_raio}")
        
        return dentro_do_raio, distancia
    except Exception as e:
        print(f"[GEOLOCATION] Erro ao validar localização: {str(e)}")
        import traceback
        traceback.print_exc()
        return False, 0


def formatar_distancia(distancia_metros):
    """
    Formata a distância para exibição amigável.
    
    Args:
        distancia_metros: Distância em metros
    
    Returns:
        str: Distância formatada (ex: "50m" ou "1.2km")
    """
    if distancia_metros < 1000:
        return f"{int(distancia_metros)}m"
    else:
        return f"{distancia_metros / 1000:.1f}km"
