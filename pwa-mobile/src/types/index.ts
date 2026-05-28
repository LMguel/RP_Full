// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserType = 'funcionario' | 'empresa';

export interface FuncionarioUser {
  id: string;
  nome: string;
  cargo?: string;
  email?: string;
  company_id?: string;
  horario_entrada?: string;
  horario_saida?: string;
  must_change_password?: boolean;
}

export interface EmpresaUser {
  usuario_id: string;
  empresa_nome: string;
  company_id: string;
  tipo: string;
}

// ─── Employee ────────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  nome: string;
  cargo?: string;
  setor?: string;
  cpf?: string;
  matricula?: string;
  telefone?: string;
  email?: string;
  data_admissao?: string;
  ativo?: boolean;
  foto_url?: string;
  face_id?: string;
  horario_entrada?: string;
  horario_saida?: string;
  intervalo_emp?: number;
  tolerancia_atraso?: number;
  custom_schedule?: WeeklySchedule;
  pred_hora?: string;
  login?: string;
  must_change_password?: boolean;
}

export interface WeeklySchedule {
  [day: string]: DaySchedule;
}

export interface DaySchedule {
  active: boolean;
  start?: string;
  end?: string;
  break_start?: string;
  break_end?: string;
}

export interface JornadaPreset {
  nome: string;
  descricao?: string;
  horarios: {
    [day: string]: { entrada: string; saida: string; intervalo?: number };
  };
}

// ─── Time Records ─────────────────────────────────────────────────────────────

export type RegistroTipo = 'entrada' | 'saida' | 'intervalo_inicio' | 'intervalo_fim';

export interface TimeRecord {
  id?: string;
  funcionario_id: string;
  data_hora: string;
  tipo: RegistroTipo;
  status?: 'ativo' | 'invalidado' | 'editado';
  foto_url?: string;
  latitude?: number;
  longitude?: number;
  metodo?: string;
  // Audit trail for manual edits
  editado?: boolean;
  horario_original?: string;
  editado_por?: string;
  motivo_edicao?: string;
  editado_em?: string;
  justificativa?: string;
}

// ─── Daily / Monthly Summary ─────────────────────────────────────────────────

export interface DailySummary {
  date: string;
  hora_entrada?: string;
  hora_saida?: string;
  horas_trabalhadas?: number;
  horas_extras?: number;
  atraso_minutos?: number;
  status?: 'presente' | 'ausente' | 'falta' | 'atraso' | 'incompleto';
  records?: TimeRecord[];
}

// Backend-calculated daily summary from /api/registros-diarios
export interface RegistroDiario {
  data: string;            // YYYY-MM-DD
  employee_id: string;
  nome?: string;
  dia_semana?: string;
  hora_entrada?: string;      // HH:MM
  hora_saida?: string;        // HH:MM
  intervalo_saida?: string;   // HH:MM
  intervalo_volta?: string;   // HH:MM
  horas_trabalhadas?: number;
  horas_trabalhadas_min?: number;
  horas_trabalhadas_str?: string;   // HH:MM
  horas_previstas?: number;
  horas_previstas_min?: number;
  horas_previstas_str?: string;     // HH:MM
  horas_extras?: number;
  horas_extras_str?: string;
  banco_horas_dia?: number;
  banco_horas_dia_str?: string;
  atraso_minutos?: number;
  saida_antecipada_minutos?: number;
  intervalo_automatico?: boolean;
  horario_variavel?: boolean;
}

export interface MonthlySummary {
  year: number;
  month: number;
  total_horas_trabalhadas: number;
  total_horas_extras: number;
  dias_trabalhados: number;
  faltas?: number;
  atrasos?: number;
  banco_horas?: number;
}

export interface FuncionarioDashboard {
  last_7_days: DailySummary[];
  current_month?: {
    total_horas_trabalhadas: number;
    total_horas_extras: number;
    dias_trabalhados: number;
  };
  today_records?: TimeRecord[];
  next_expected?: string;
  day_status?: 'presente' | 'ausente' | 'incompleto';
  last_record?: TimeRecord;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface RecognitionResult {
  reconhecido: boolean;
  nenhumRostoDetectado?: boolean;
  ponto_completo?: boolean;
  funcionario?: {
    funcionario_id: string;
    nome: string;
    cargo?: string;
    company_id?: string;
  };
  proximo_tipo?: RegistroTipo;
  proximo_tipo_label?: string;
  confianca?: number;
}

export interface RegisterPointResult {
  success: boolean;
  tipo?: RegistroTipo;
  tipo_label?: string;
  timestamp?: string;
  ponto_completo?: boolean;
  error?: string;
}

export interface CredenciaisFuncionario {
  login: string;
  senha_temporaria: string;
}

// ─── Form Types ───────────────────────────────────────────────────────────────

export interface PerDaySchedule {
  ativo: boolean;
  entrada?: string | null;
  saida?: string | null;
}

export interface FuncionarioFormData {
  // Step 1: Dados
  nome: string;
  cpf: string;
  matricula?: string;
  cargo?: string;
  setor?: string;
  telefone?: string;
  email?: string;
  data_admissao?: string;
  ativo?: boolean;
  senha?: string;
  home_office?: boolean;
  // Step 2: Jornada
  jornada_tipo?: 'preset' | 'personalizada' | 'por_dia';
  jornada_preset?: string;
  horario_entrada?: string;
  horario_saida?: string;
  intervalo_minutos?: number;
  tolerancia_atraso?: number;
  dias_semana?: string[];
  horario_variavel?: boolean;
  schedule_por_dia?: Record<string, PerDaySchedule>;
  // Step 3: Face
  foto_blob?: Blob | File | null;
  foto_preview?: string;
}
