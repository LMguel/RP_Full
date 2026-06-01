/**
 * Tipos de domínio do REGISTRA.PONTO
 * Espelham os modelos do backend Flask + DynamoDB.
 */

export type ISODateTime = string;

export interface Company {
  company_id: string;
  empresa_nome: string;
  latitude?: number;
  longitude?: number;
  raio_metros?: number;
  kiosk_enabled?: boolean;
}

export interface Employee {
  id: string;
  company_id: string;
  nome: string;
  matricula?: string;
  cargo?: string;
  foto_url?: string;
  face_id?: string;
  ativo: boolean;
  horario_entrada?: string;
  horario_saida?: string;
  updated_at?: ISODateTime;
}

/**
 * Embedding facial local (vetor float).
 * Persistido como JSON no SQLite.
 */
export interface FaceEmbedding {
  employee_id: string;
  embedding: number[];
  model_version: string;
  updated_at: ISODateTime;
}

export type RecordType = 'ENTRADA' | 'SAIDA' | 'INTERVALO_INICIO' | 'INTERVALO_FIM' | 'AUTO';
export type RecordMethod = 'FACIAL' | 'MANUAL' | 'LOCALIZACAO';
export type RecordStatus = 'ATIVO' | 'INVALIDADO' | 'AJUSTADO';

export interface TimeRecord {
  id: string;
  employee_id: string;
  company_id: string;
  timestamp: ISODateTime;
  tipo?: RecordType;
  metodo: RecordMethod;
  similarity?: number;
  device_id: string;
  offline: boolean;
  synced: boolean;
  status: RecordStatus;
  remote_id?: string;
  created_at: ISODateTime;
}

export type SyncOpType =
  | 'TIME_RECORD_CREATE'
  | 'EMPLOYEE_PULL'
  | 'EMBEDDING_PULL'
  | 'CONFIG_PULL'
  | 'DEVICE_REGISTER'
  | 'LOG_FLUSH';

export type SyncStatus = 'PENDING' | 'IN_FLIGHT' | 'FAILED' | 'DONE';

export interface SyncQueueItem {
  id: string;
  type: SyncOpType;
  payload: string;
  status: SyncStatus;
  retries: number;
  last_error?: string;
  next_attempt_at?: ISODateTime;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface DeviceConfig {
  device_id: string;
  company_id: string;
  kiosk_enabled: boolean;
  similarity_threshold: number;
  use_cloud_fallback: boolean;
  sync_interval_ms: number;
  updated_at: ISODateTime;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  context?: string;
  created_at: ISODateTime;
}

export interface AuthSession {
  token: string;
  company_id: string;
  empresa_nome: string;
  usuario_id: string;
  issued_at: ISODateTime;
  expires_at?: ISODateTime;
}
