// Tipos para o sistema de DailySummary consolidado

export interface DailySummary {
  company_id: string;
  employee_id: string;
  employee_name: string;
  employee_photo?: string;
  date: string; // formato YYYY-MM-DD
  first_entry_time?: string; // HH:MM:SS
  last_exit_time?: string; // HH:MM:SS
  worked_hours: number; // em horas decimais (ex: 8.5)
  expected_hours: number; // em horas decimais
  difference_minutes: number; // positivo = extra, negativo = deficit
  status: 'normal' | 'late' | 'extra' | 'absent' | 'missing_exit' | 'incomplete';
  overtime_minutes: number;
  delay_minutes: number;
  balance_minutes: number;
  missing_exit: boolean;
  has_location_issues: boolean;
  total_records: number; // quantidade de batidas do dia
}

export interface TimeRecord {
  id: string;
  company_id: string;
  employee_id: string;
  employee_name?: string;
  data_hora: string; // ISO string
  tipo: 'entrada' | 'saída';
  metodo: 'automatico' | 'manual';
  foto?: string;
  location?: {
    latitude: number;
    longitude: number;
    inside_radius: boolean;
    address?: string;
  };
  observacoes?: string;
  created_at: string;
}

export interface DailySummaryFilters {
  month?: string; // formato YYYY-MM
  employee_id?: string;
  status?: DailySummary['status'];
  date?: string; // dia específico YYYY-MM-DD
}

export interface DailyRecordsResponse {
  summaries: DailySummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface DayDetailsResponse {
  summary: DailySummary;
  records: TimeRecord[];
}
