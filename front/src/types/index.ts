export interface User {
  usuario_id: string;
  email: string;
  empresa_nome: string;
  empresa_id: string;
}

export interface Employee {
  id: string;
  nome: string;
  cargo: string;
  email?: string;
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
}

export interface HorarioPreset {
  id: string;
  empresa_id: string;
  nome: string;
  horario_entrada: string;
  horario_saida: string;
  data_criacao: string;
}

export interface CompanySettings {
  empresa_id: string;
  tolerancia_atraso: number;
  hora_extra_entrada_antecipada: boolean;
  arredondamento_horas_extras: '5' | '10' | '15' | 'exato';
  intervalo_automatico: boolean;
  duracao_intervalo: number;
  data_atualizacao?: string;
}

// Status possíveis de um registro de ponto
export type RecordStatus = 'ATIVO' | 'AJUSTADO' | 'INVALIDADO';

export interface TimeRecord {
  registro_id: string;
  funcionario_id: string;
  data_hora: string;
  tipo: 'entrada' | 'saída';
  type?: 'entrada' | 'saida' | 'saída';  // Novo campo padronizado
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
