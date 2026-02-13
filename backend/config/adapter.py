"""
Camada de compatibilidade e acesso à nova estrutura de configurações
Mantém código antigo funcionando enquanto permite uso da nova estrutura
"""
from typing import Dict, Any, Optional

class ConfigCompanyAdapter:
    """
    Adaptador para acessar configurações em ambos os formatos (antigo e novo)
    Fornece interface unificada independente da versão da estrutura
    """
    
    def __init__(self, config_data: Dict[str, Any]):
        """
        Args:
            config_data: Dados brutos do DynamoDB (antigo ou novo formato)
        """
        self.raw_data = config_data
        self.is_migrated = '_migration' in config_data
    
    # ==================== PROPRIEDADES DE COMPATIBILIDADE ====================
    
    @property
    def company_id(self) -> str:
        """ID da empresa"""
        return self.raw_data.get('empresa_id') or self.raw_data.get('company_id', '')
    
    @property
    def tolerancia_atraso(self) -> int:
        """Tolerância de atraso em minutos (compatibilidade)"""
        if self.is_migrated:
            return self.raw_data.get('rounding_rules', {}).get('tolerance_before', 5)
        return int(self.raw_data.get('tolerancia_atraso', 5))
    
    @property
    def hora_extra_entrada_antecipada(self) -> bool:
        """Se conta entrada antecipada como hora extra (compatibilidade)"""
        if self.is_migrated:
            return self.raw_data.get('extra_time_rules', {}).get('count_early_as_extra', False)
        return bool(self.raw_data.get('hora_extra_entrada_antecipada', False))
    
    @property
    def arredondamento_horas_extras(self) -> str:
        """Arredondamento de horas extras (compatibilidade)"""
        if self.is_migrated:
            valor = self.raw_data.get('rounding_rules', {}).get('round_to_nearest', 5)
            return 'exato' if valor == 0 else str(valor)
        return self.raw_data.get('arredondamento_horas_extras', '5')
    
    @property
    def intervalo_automatico(self) -> bool:
        """Se desconta intervalo automaticamente (compatibilidade)"""
        if self.is_migrated:
            return self.raw_data.get('work_hours', {}).get('intervalo_automatico', False)
        return bool(self.raw_data.get('intervalo_automatico', False))
    
    @property
    def duracao_intervalo(self) -> int:
        """Duração do intervalo em minutos (compatibilidade)"""
        if self.is_migrated:
            return int(self.raw_data.get('work_hours', {}).get('break_duration', 60))
        return int(self.raw_data.get('duracao_intervalo', 60))
    
    @property
    def compensar_saldo_horas(self) -> bool:
        """Se compensa saldo de horas (compatibilidade)"""
        if self.is_migrated:
            return self.raw_data.get('auto_compensation', False)
        return bool(self.raw_data.get('compensar_saldo_horas', False))
    
    @property
    def exigir_localizacao(self) -> bool:
        """Se exige validação de localização (compatibilidade)"""
        if self.is_migrated:
            return self.raw_data.get('location_rules', {}).get('exigir_localizacao', False)
        return bool(self.raw_data.get('exigir_localizacao', False))
    
    @property
    def raio_permitido(self) -> int:
        """Raio permitido em metros (compatibilidade)"""
        if self.is_migrated:
            return int(self.raw_data.get('location_rules', {}).get('raio_permitido', 100))
        return int(self.raw_data.get('raio_permitido', 100))
    
    @property
    def latitude_empresa(self) -> Optional[float]:
        """Latitude da empresa (compatibilidade)"""
        if self.is_migrated:
            return self.raw_data.get('location_rules', {}).get('latitude_empresa')
        return self.raw_data.get('latitude_empresa')
    
    @property
    def longitude_empresa(self) -> Optional[float]:
        """Longitude da empresa (compatibilidade)"""
        if self.is_migrated:
            return self.raw_data.get('location_rules', {}).get('longitude_empresa')
        return self.raw_data.get('longitude_empresa')
    
    # ==================== NOVOS ACESSORES (ESTRUTURA HIERÁRQUICA) ====================
    
    @property
    def work_days(self) -> list:
        """Lista de dias úteis ['mon', 'tue', 'wed', 'thu', 'fri']"""
        if self.is_migrated:
            return self.raw_data.get('work_days', ['mon', 'tue', 'wed', 'thu', 'fri'])
        return ['mon', 'tue', 'wed', 'thu', 'fri']  # padrão
    
    @property
    def work_hours(self) -> Dict[str, Any]:
        """Horários de trabalho completos"""
        if self.is_migrated:
            return self.raw_data.get('work_hours', {})
        return {
            'default_start': '08:00',
            'default_end': '17:00',
            'break_duration': self.duracao_intervalo,
            'intervalo_automatico': self.intervalo_automatico
        }
    
    @property
    def rounding_rules(self) -> Dict[str, int]:
        """Regras de arredondamento e tolerância"""
        if self.is_migrated:
            return self.raw_data.get('rounding_rules', {})
        
        tol = self.tolerancia_atraso
        return {
            'tolerance_before': tol,
            'tolerance_after': tol,
            'round_to_nearest': 0 if self.arredondamento_horas_extras == 'exato' else int(self.arredondamento_horas_extras)
        }
    
    @property
    def extra_time_rules(self) -> Dict[str, bool]:
        """Regras de hora extra"""
        if self.is_migrated:
            return self.raw_data.get('extra_time_rules', {})
        return {
            'count_early_as_extra': self.hora_extra_entrada_antecipada,
            'count_late_as_extra': True
        }
    
    @property
    def auto_compensation(self) -> bool:
        """Se compensa saldo de horas automaticamente"""
        return self.compensar_saldo_horas
    
    @property
    def location_rules(self) -> Dict[str, Any]:
        """Regras de localização"""
        if self.is_migrated:
            return self.raw_data.get('location_rules', {})
        return {
            'exigir_localizacao': self.exigir_localizacao,
            'raio_permitido': self.raio_permitido,
            'latitude_empresa': self.latitude_empresa,
            'longitude_empresa': self.longitude_empresa
        }
    
    @property
    def holiday_policy(self) -> str:
        """Política de feriados"""
        if self.is_migrated:
            return self.raw_data.get('holiday_policy', 'ignore')
        return 'ignore'
    
    @property
    def custom_holidays(self) -> list:
        """Lista de feriados customizados"""
        if self.is_migrated:
            return self.raw_data.get('custom_holidays', [])
        return []
    
    @property
    def weekend_policy(self) -> Dict[str, Any]:
        """Política de finais de semana"""
        if self.is_migrated:
            return self.raw_data.get('weekend_policy', {})
        return {
            'enabled': False,
            'default_hours': {'sat': '00:00', 'sun': '00:00'}
        }
    
    # ==================== MÉTODOS AUXILIARES ====================
    
    def to_dict_old_format(self) -> Dict[str, Any]:
        """
        Retorna configuração no formato antigo (plano)
        Útil para manter compatibilidade com APIs antigas
        """
        return {
            'company_id': self.company_id,
            'tolerancia_atraso': self.tolerancia_atraso,
            'hora_extra_entrada_antecipada': self.hora_extra_entrada_antecipada,
            'arredondamento_horas_extras': self.arredondamento_horas_extras,
            'intervalo_automatico': self.intervalo_automatico,
            'duracao_intervalo': self.duracao_intervalo,
            'compensar_saldo_horas': self.compensar_saldo_horas,
            'exigir_localizacao': self.exigir_localizacao,
            'raio_permitido': self.raio_permitido,
            'latitude_empresa': self.latitude_empresa,
            'longitude_empresa': self.longitude_empresa,
        }
    
    def to_dict_new_format(self) -> Dict[str, Any]:
        """Retorna configuração no formato novo (hierárquico)"""
        if self.is_migrated:
            return self.raw_data
        
        # Converter formato antigo para novo
        from migrate_config_table import migrar_configuracao_antiga_para_nova
        return migrar_configuracao_antiga_para_nova(self.raw_data)
    
    def to_dict(self, format='auto') -> Dict[str, Any]:
        """
        Retorna configuração no formato especificado
        
        Args:
            format: 'old', 'new', ou 'auto' (retorna o formato original)
        """
        if format == 'old':
            return self.to_dict_old_format()
        elif format == 'new':
            return self.to_dict_new_format()
        else:  # auto
            return self.raw_data


# ==================== FUNÇÕES HELPER PARA USO NO CÓDIGO ====================

def wrap_config(config_data: Dict[str, Any]) -> ConfigCompanyAdapter:
    """
    Envolve dados de configuração no adaptador
    
    Uso:
        config = wrap_config(dynamodb_response['Item'])
        tolerancia = config.tolerancia_atraso  # funciona em ambos formatos
    """
    return ConfigCompanyAdapter(config_data)

def is_migrated(config_data: Dict[str, Any]) -> bool:
    """Verifica se uma configuração já foi migrada"""
    return '_migration' in config_data
