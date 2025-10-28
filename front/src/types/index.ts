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
  foto_url: string;
  face_id: string;
  empresa_nome: string;
  empresa_id: string;
  data_cadastro: string;
}

export interface TimeRecord {
  registro_id: string;
  funcionario_id: string;
  data_hora: string;
  tipo: 'entrada' | 'saída';
  empresa_id: string;
  empresa_nome: string;
  funcionario_nome?: string;
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
