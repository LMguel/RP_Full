/**
 * Schema versionado. Cada elemento do array é aplicado em ordem.
 * NUNCA altere uma migration já aplicada — adicione uma nova.
 */
export interface Migration {
  name: string;
  up: string[];
}

export const migrations: Migration[] = [
  {
    name: '001_initial',
    up: [
      `CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY NOT NULL,
        company_id TEXT NOT NULL,
        nome TEXT NOT NULL,
        matricula TEXT,
        cargo TEXT,
        foto_url TEXT,
        face_id TEXT,
        ativo INTEGER NOT NULL DEFAULT 1,
        horario_entrada TEXT,
        horario_saida TEXT,
        updated_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);`,
      `CREATE INDEX IF NOT EXISTS idx_employees_ativo ON employees(ativo);`,

      `CREATE TABLE IF NOT EXISTS face_embeddings (
        employee_id TEXT PRIMARY KEY NOT NULL,
        embedding TEXT NOT NULL,
        model_version TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      );`,

      `CREATE TABLE IF NOT EXISTS time_records (
        id TEXT PRIMARY KEY NOT NULL,
        employee_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        tipo TEXT,
        metodo TEXT NOT NULL,
        similarity REAL,
        device_id TEXT NOT NULL,
        offline INTEGER NOT NULL DEFAULT 0,
        synced INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ATIVO',
        remote_id TEXT,
        client_id TEXT UNIQUE,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_records_employee ON time_records(employee_id);`,
      `CREATE INDEX IF NOT EXISTS idx_records_synced ON time_records(synced);`,
      `CREATE INDEX IF NOT EXISTS idx_records_ts ON time_records(timestamp);`,

      `CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        retries INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_attempt_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue(status);`,
      `CREATE INDEX IF NOT EXISTS idx_queue_next ON sync_queue(next_attempt_at);`,

      `CREATE TABLE IF NOT EXISTS device_config (
        device_id TEXT PRIMARY KEY NOT NULL,
        company_id TEXT NOT NULL,
        kiosk_enabled INTEGER NOT NULL DEFAULT 1,
        similarity_threshold REAL NOT NULL DEFAULT 0.82,
        use_cloud_fallback INTEGER NOT NULL DEFAULT 1,
        sync_interval_ms INTEGER NOT NULL DEFAULT 60000,
        updated_at TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        context TEXT,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);`,
    ],
  },
];
