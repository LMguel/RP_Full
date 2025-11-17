"""
Modelos de dados para a nova arquitetura escalável
Define estruturas de DailySummary, MonthlySummary, etc.
"""
from typing import Dict, List, Optional, Literal
from dataclasses import dataclass, asdict
from datetime import datetime, date
from decimal import Decimal

# Tipos de trabalho
WorkMode = Literal["onsite", "remote", "external"]
RecordType = Literal["in", "out", "break_start", "break_end"]
DayStatus = Literal["normal", "late", "extra", "compensated", "absent"]
MonthStatus = Literal["positive", "negative", "balanced"]

@dataclass
class DailySummary:
    """Resumo diário de um funcionário"""
    company_id: str
    employee_id: str
    date: str  # YYYY-MM-DD
    
    # Modo de trabalho
    work_mode: WorkMode
    
    # Horários
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None
    actual_start: Optional[str] = None
    actual_end: Optional[str] = None
    
    # Horas calculadas
    expected_hours: Decimal = Decimal('0')
    worked_hours: Decimal = Decimal('0')
    extra_hours: Decimal = Decimal('0')
    delay_minutes: Decimal = Decimal('0')
    compensated_minutes: Decimal = Decimal('0')
    daily_balance: Decimal = Decimal('0')
    
    # Status
    status: DayStatus = "normal"
    
    # Metadados
    breaks_total: Decimal = Decimal('0')
    records_count: int = 0
    last_updated: str = None
    
    def to_dynamodb(self) -> Dict:
        """Converte para formato DynamoDB"""
        data = asdict(self)
        data['employee_id#date'] = f"{self.employee_id}#{self.date}"
        data['last_updated'] = datetime.now().isoformat()
        
        # Converter Decimal para formato DynamoDB
        for key, value in data.items():
            if isinstance(value, Decimal):
                data[key] = value
        
        return data
    
    @classmethod
    def from_dynamodb(cls, item: Dict) -> 'DailySummary':
        """Cria instância a partir de item DynamoDB"""
        # Remover chave composta
        item.pop('employee_id#date', None)
        return cls(**item)

@dataclass
class MonthlySummary:
    """Resumo mensal de um funcionário"""
    company_id: str
    employee_id: str
    month: str  # YYYY-MM
    
    # Totais do mês
    expected_hours: Decimal = Decimal('0')
    worked_hours: Decimal = Decimal('0')
    extra_hours: Decimal = Decimal('0')
    delay_minutes: Decimal = Decimal('0')
    compensated_minutes: Decimal = Decimal('0')
    final_balance: Decimal = Decimal('0')
    
    # Contadores
    absences: int = 0
    worked_holidays: int = 0
    days_worked: int = 0
    days_late: int = 0
    days_extra: int = 0
    
    # Status
    status: MonthStatus = "balanced"
    
    # Metadados
    last_updated: str = None
    
    def to_dynamodb(self) -> Dict:
        """Converte para formato DynamoDB"""
        data = asdict(self)
        data['employee_id#month'] = f"{self.employee_id}#{self.month}"
        data['last_updated'] = datetime.now().isoformat()
        
        # Converter Decimal
        for key, value in data.items():
            if isinstance(value, Decimal):
                data[key] = value
        
        return data
    
    @classmethod
    def from_dynamodb(cls, item: Dict) -> 'MonthlySummary':
        """Cria instância a partir de item DynamoDB"""
        item.pop('employee_id#month', None)
        return cls(**item)

@dataclass
class TimeRecord:
    """Registro de ponto individual"""
    company_id: str
    employee_id: str
    date_time: str  # ISO timestamp
    record_type: RecordType
    
    # Localização
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    valid_location: bool = True
    
    # Foto
    photo_s3_key: Optional[str] = None
    
    # Modo de trabalho no momento
    work_mode_at_time: WorkMode = "onsite"
    
    # Metadados
    created_at: str = None
    
    def to_dynamodb(self) -> Dict:
        """Converte para formato DynamoDB"""
        data = asdict(self)
        data['employee_id#date_time'] = f"{self.employee_id}#{self.date_time}"
        data['created_at'] = datetime.now().isoformat()
        return data

@dataclass
class WeeklySchedule:
    """Horário semanal"""
    mon: Optional[Dict[str, str]] = None  # {"start": "08:00", "end": "17:00"}
    tue: Optional[Dict[str, str]] = None
    wed: Optional[Dict[str, str]] = None
    thu: Optional[Dict[str, str]] = None
    fri: Optional[Dict[str, str]] = None
    sat: Optional[Dict[str, str]] = None
    sun: Optional[Dict[str, str]] = None
    
    def get_day_schedule(self, day: str) -> Optional[Dict[str, str]]:
        """Retorna horário de um dia específico"""
        return getattr(self, day.lower(), None)

@dataclass
class CompanyConfig:
    """Configuração completa da empresa (nova estrutura)"""
    company_id: str
    
    # Horário padrão semanal
    weekly_schedule: WeeklySchedule
    work_days: List[str]  # ["mon", "tue", "wed", "thu", "fri"]
    
    # Regras de arredondamento e tolerância
    rounding_extra_hours: int = 5  # minutos
    tolerance_before: int = 10
    tolerance_after: int = 10
    
    # Intervalo
    break_auto: bool = True
    break_duration: int = 60
    
    # Compensação
    compensate_balance: bool = False
    
    # Localização
    require_location: bool = False
    allow_remote: bool = False
    allow_external: bool = False
    company_lat: Optional[float] = None
    company_lng: Optional[float] = None
    radius_allowed: int = 100
    
    # Feriados
    custom_holidays: List[str] = None  # ["2025-12-25", "2025-04-21"]
    holiday_is_workday: bool = False
    saturday_is_halfday: bool = False
    
    def to_dynamodb(self) -> Dict:
        """Converte para DynamoDB"""
        data = asdict(self)
        if self.custom_holidays is None:
            data['custom_holidays'] = []
        return data

@dataclass
class Employee:
    """Funcionário com novos campos de modo de trabalho"""
    company_id: str
    id: str
    nome: str
    cargo: str
    
    # Email e senha para login
    email: Optional[str] = None
    senha_hash: Optional[str] = None
    
    # Modo de trabalho
    work_mode: WorkMode = "onsite"
    allow_remote: bool = False
    allow_external: bool = False
    
    # Horário customizado (sobrescreve horário da empresa)
    custom_schedule: Optional[WeeklySchedule] = None
    
    # Regras de localização customizadas
    custom_location_rules: Optional[Dict] = None
    
    # Foto
    foto_url: Optional[str] = None
    foto_s3_key: Optional[str] = None
    
    # Horários padrão (legado, será substituído por custom_schedule)
    horario_entrada: Optional[str] = None
    horario_saida: Optional[str] = None
    
    # Status
    ativo: bool = True
    is_active: bool = True  # Exclusão lógica
    deleted_at: Optional[str] = None  # Timestamp da exclusão
    data_cadastro: str = None
    
    def to_dynamodb(self) -> Dict:
        """Converte para DynamoDB"""
        data = asdict(self)
        if self.data_cadastro is None:
            data['data_cadastro'] = datetime.now().isoformat()
        return data
