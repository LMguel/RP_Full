/**
 * Tipos dos contratos de API.
 * Mantidos sincronizados com /backend/routes/api.py e /backend/routes/facial.py
 */

export interface LoginRequest {
  usuario_id: string;
  senha: string;
}

export interface LoginResponse {
  token: string;
  tipo: 'empresa';
  usuario_id: string;
  empresa_nome: string;
  company_id: string;
}

export interface FuncionarioApi {
  id: string;
  nome: string;
  cargo?: string;
  foto_url?: string;
  matricula?: string;
  data_cadastro?: string;
  horario_entrada?: string;
  horario_saida?: string;
  ativo?: boolean;
  is_active?: boolean;
  face_id?: string;
  empresa_nome?: string;
  empresa_id?: string;
  login?: string;
  intervalo_personalizado?: boolean;
  intervalo_emp?: unknown;
  tolerancia_atraso?: number;
  custom_schedule?: unknown;
}

export interface ListFuncionariosResponse {
  funcionarios: FuncionarioApi[];
}

export interface RecognizeFaceResponse {
  reconhecido: boolean;
  funcionario_id?: string;
  funcionario_nome?: string;
  similarity?: number;
  confidence?: number;
  error?: string;
}

export interface RegisterPointFacialRequest {
  funcionario_id: string;
  metodo?: 'reconhecimento_facial' | 'kiosk_offline_facial';
  data_hora?: string;
  tipo?: string;
  device_id?: string;
  similarity?: number;
  offline?: boolean;
  client_id?: string;
}

export interface RegisterPointFacialResponse {
  sucesso: boolean;
  registro?: {
    id: string;
    timestamp: string;
    tipo: string;
  };
  message?: string;
  error?: string;
}

export interface ApiError {
  error?: string;
  message?: string;
  status?: number;
}
