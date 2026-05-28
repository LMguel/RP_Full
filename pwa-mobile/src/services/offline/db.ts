import Dexie, { type Table } from 'dexie';

/**
 * Subconjunto mínimo de dados de funcionário para o modo offline.
 * Intencionalmente NÃO inclui: cpf, face_id, foto_url, senha_hash, foto_s3_key.
 * LGPD: dados biométricos não devem ser armazenados sem criptografia no dispositivo.
 */
export interface CachedEmployee {
  id: string;
  nome: string;
  cargo?: string;
  matricula?: string;
  company_id: string;
  cached_at: number;
}

export interface OfflineRecord {
  id?: number;
  employee_id: string;
  company_id: string;
  tipo: string;
  timestamp: string;       // São Paulo time: "YYYY-MM-DD HH:MM:SS"
  device_id: string;
  created_offline: boolean;
  synced: boolean;
  sync_attempts: number;
  last_sync_error?: string;
  next_retry_at?: number;  // Unix ms — quando tentar novamente (backoff exponencial)
  local_hash?: string;     // Hash SHA-256 para deduplicação (employee_id|company_id|timestamp)
}

class AppDB extends Dexie {
  employees_cache!: Table<CachedEmployee>;
  offline_records!: Table<OfflineRecord>;

  constructor() {
    super('registraponto_db');

    this.version(1).stores({
      employees_cache: 'id, company_id, nome, matricula, cached_at',
      offline_records: '++id, employee_id, company_id, synced, timestamp',
    });

    // v2: adiciona índice local_hash para deduplicação eficiente
    this.version(2).stores({
      employees_cache: 'id, company_id, nome, matricula, cached_at',
      offline_records: '++id, employee_id, company_id, synced, timestamp, local_hash',
    });
  }
}

export const db = new AppDB();
