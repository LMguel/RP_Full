export type UserRole = 'OWNER' | 'ADMIN' | 'RH' | 'MANAGER' | 'VIEWER';

export type Permission =
  | 'dashboard' | 'funcionarios' | 'registros' | 'correcoes'
  | 'rh_folha' | 'configuracoes' | 'exportacoes' | 'ajustes'
  | 'excluir' | 'criar_usuario' | 'editar_usuario'
  | 'fechar_competencia' | 'reconhecimento';

export interface PermissionOverride {
  add: Permission[];
  remove: Permission[];
}

export interface CompanyUser {
  user_id: string;
  company_id: string;
  name: string;
  email?: string;
  role: UserRole;
  permissions: PermissionOverride;
  active: boolean;
  last_login?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  empresa_nome?: string;
}

export type AuditEntity = 'EMPLOYEE' | 'RECORD' | 'USER' | 'CONFIG' | 'RH';
export type AuditAction = 'CREATE' | 'EDIT' | 'DELETE' | 'ADJUST' | 'INVALIDATE' | 'LOGIN' | 'EXPORT' | 'CLOSE' | 'PERMISSION';

export interface AuditLog {
  log_id: string;
  company_id: string;
  user_id: string;
  user_name: string;
  entity: AuditEntity;
  entity_id: string;
  action: AuditAction;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  device?: string;
  motivo?: string;
  justificativa?: string;
  employee_id?: string;
  employee_name?: string;
  reason?: string;
  created_at: string;
}

export interface User {
  usuario_id: string;
  email: string;
  empresa_nome: string;
  empresa_id: string;
  role?: UserRole;
  permissions?: Permission[];
  user_name?: string;
  company_id?: string;
}

export interface Employee {
  id: string;
  nome: string;
  cargo: string;
  pred_hora?: string;
  email?: string;
  custom_schedule?: WeeklyScheduleMap;
  foto_url: string;
  face_id: string;
  empresa_nome: string;
  empresa_id: string;  // mantém compatibilidade
  company_id?: string; // novo schema DynamoDB
  data_cadastro: string;
  horario_entrada?: string;
  horario_saida?: string;
  is_active?: boolean;
  ativo?: boolean;
  login?: string;
  tolerancia_atraso?: number;
  intervalo_personalizado?: boolean;
  intervalo_emp?: number;
  intervalo_padrao_minutos?: number; // intervalo de almoço em minutos (0 = sem intervalo)
  carga_horaria_mensal?: number; // horas/mês, cadastro manual para banco de horas
}

export type DiaSemana = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado' | 'domingo';

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface WeeklyScheduleDay {
  start?: string;
  end?: string;
  active?: boolean;
}

export type WeeklyScheduleMap = Partial<Record<WeekdayKey, WeeklyScheduleDay>>;

export interface HorarioDiaConfig {
  entrada: string | null;
  saida: string | null;
  ativo: boolean;
}

export interface HorarioPreset {
  id?: string;
  empresa_id?: string;
  nome: string;
  horario_entrada?: string;
  horario_saida?: string;
  horarios?: Record<DiaSemana, HorarioDiaConfig>;
  data_criacao?: string;
}

export interface CompanySettings {
  empresa_id: string;
  tolerancia_atraso: number;
  hora_extra_entrada_antecipada: boolean;
  arredondamento_horas_extras: '5' | '10' | '15' | 'exato';
  intervalo_automatico: boolean;
  duracao_intervalo: number;
  intervalo_padrao_global?: number | null;
  data_atualizacao?: string;
}

// Status possíveis de um registro de ponto
export type RecordStatus = 'ATIVO' | 'AJUSTADO' | 'INVALIDADO';

export interface TimeRecord {
  registro_id: string;
  funcionario_id: string;
  data_hora: string;
  tipo?: 'dia_inteiro' | 'entrada' | 'saída' | 'saida_almoco' | 'retorno_almoco' | 'ferias_folga' | 'atestado';
  type?: 'entrada' | 'saida' | 'saída' | 'saida_almoco' | 'retorno_almoco' | 'ferias_folga' | 'atestado';
  atestado_url?: string;
  method?: 'CAMERA' | 'LOCATION' | 'MANUAL' | 'FACIAL' | 'AJUSTE';  // Método de registro
  status?: RecordStatus;  // ATIVO, AJUSTADO, INVALIDADO
  empresa_id: string;   // mantém compatibilidade
  company_id?: string;  // novo schema DynamoDB
  empresa_nome: string;
  funcionario_nome?: string;
  horas_extras_minutos?: number;
  atraso_minutos?: number;
  entrada_antecipada_minutos?: number;
  saida_antecipada_minutos?: number;
  horas_trabalhadas_minutos?: number;
  horas_extras_formatado?: string;
  atraso_formatado?: string;
  // Propriedades para cálculo detalhado de atraso
  horario_padrao?: string;
  horario_real?: string;
  tolerancia?: number;
  // Campos de auditoria
  justificativa?: string;
  registro_original_id?: string;  // ID do registro original (se for ajuste)
  registro_original_key?: string;
  ajustado_por?: string;
  invalidado_por?: string;
  invalidado_em?: string;
  criado_por?: string;
  criado_em?: string;
}

export interface LoginRequest {
  usuario_id: string;
  senha: string;
}

export interface RegisterRequest {
  usuario_id: string;
  email: string;
  empresa_nome: string;
  senha: string;
}

export interface AuthResponse {
  token: string;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
}

// ─── Módulo RH / Folha ────────────────────────────────────────────────────────

export type TipoRemuneracao = 'mensalista' | 'horista';
export type BancoHorasMode  = 'compensar' | 'pagar' | 'ignorar';
export type CompetenciaStatus = 'ABERTA' | 'FECHADA' | 'PROCESSANDO';
export type PreFolhaStatus = 'CALCULADO' | 'REVISADO' | 'APROVADO';

export interface PayrollConfig {
  company_id: string;
  mode: 'simulacao' | 'pre_folha';
  banco_horas_mode: BancoHorasMode;
  percentual_extra_util: number;
  percentual_domingo: number;
  percentual_feriado: number;
  percentual_noturno: number;
  arredondamento: 0 | 5 | 10 | 15;
  descontar_atraso: boolean;
  descontar_saida_antecipada: boolean;
  considerar_tolerancia: boolean;
}

export interface EmployeePayrollConfig {
  company_id: string;
  employee_id: string;
  tipo_remuneracao: TipoRemuneracao;
  salario_base: number;
  valor_hora: number;
  banco_horas_mode: BancoHorasMode;
  recebe_hora_extra: boolean;
  recebe_adicional_feriado: boolean;
  recebe_adicional_domingo: boolean;
  observacoes_rh: string;
}

export interface Competencia {
  company_id: string;
  competencia: string;
  status: CompetenciaStatus;
  criada_em: string;
  fechada_em?: string;
  calculado_em?: string;
  total_salarios: number;
  total_extras: number;
  total_faltas: number;
  total_folha: number;
}

export interface PreFolhaItem {
  company_id: string;
  employee_id: string;
  competencia: string;
  nome: string;
  status: PreFolhaStatus;
  calculado_em: string;
  tipo_remuneracao: TipoRemuneracao;
  horas_previstas: number;
  horas_trabalhadas: number;
  horas_extras: number;
  horas_falta: number;
  horas_feriado: number;
  horas_domingo: number;
  horas_abonadas: number;
  atraso_minutos: number;
  banco_horas: number;
  dias_uteis: number;
  dias_trabalhados: number;
  salario_base: number;
  valor_hora: number;
  valor_extras: number;
  valor_feriado: number;
  valor_domingo: number;
  desconto_falta: number;
  desconto_atraso: number;
  desconto_banco: number;
  valor_banco: number;
  total: number;
}

export interface RHDashboard {
  competencia: string;
  total_salarios: number;
  total_extras: number;
  total_faltas: number;
  total_folha: number;
  total_funcionarios: number;
  funcionarios_fechados: number;
  com_extra: number;
  com_falta: number;
  status_competencia: CompetenciaStatus | null;
}

export interface DashboardStats {
  total_funcionarios: number;
  total_registros_mes: number;
  funcionarios_ativos: number;
}

export interface HoursWorked {
  funcionario: string;
  funcionario_id: string;
  horas_trabalhadas: string;
}
