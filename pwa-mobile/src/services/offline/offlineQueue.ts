import { db, type OfflineRecord } from './db';

// Backoff delays: 5s → 15s → 30s → 1m → 5m
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 300_000];

function getDeviceId(): string {
  let id = localStorage.getItem('@app:device_id');
  if (!id) {
    id = `pwa_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('@app:device_id', id);
  }
  return id;
}

async function computeLocalHash(params: {
  employee_id: string;
  company_id: string;
  timestamp: string;
}): Promise<string> {
  const data = `${params.employee_id}|${params.company_id}|${params.timestamp}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function queueOfflineRecord(params: {
  employee_id: string;
  company_id: string;
  tipo: string;
  timestamp: string;
}): Promise<number | null> {
  const hash = await computeLocalHash(params);

  // Verificar duplicidade: mesmo hash = mesmo registro
  const existing = await db.offline_records
    .where('local_hash').equals(hash)
    .count();
  if (existing > 0) {
    console.log('[OfflineQueue] Registro duplicado ignorado');
    return null;
  }

  const id = await db.offline_records.add({
    ...params,
    device_id: getDeviceId(),
    created_offline: true,
    synced: false,
    sync_attempts: 0,
    local_hash: hash,
  });
  return id as number;
}

/**
 * Retorna registros pendentes que estão prontos para sync (backoff respeitado).
 */
export async function getPendingRecords(): Promise<OfflineRecord[]> {
  const all = await db.offline_records.toArray();
  const now = Date.now();
  return all.filter(r => !r.synced && (!r.next_retry_at || r.next_retry_at <= now));
}

/**
 * Retorna TODOS os registros não sincronizados (incluindo os em backoff).
 * Usado apenas para exibir contagem ao usuário.
 */
export async function getPendingCount(): Promise<number> {
  const all = await db.offline_records.toArray();
  return all.filter(r => !r.synced).length;
}

export async function markSynced(id: number): Promise<void> {
  await db.offline_records.update(id, { synced: true });
}

export async function markSyncFailed(id: number, error: string): Promise<void> {
  const record = await db.offline_records.get(id);
  if (record) {
    const attempts = (record.sync_attempts || 0) + 1;
    const delay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
    await db.offline_records.update(id, {
      sync_attempts: attempts,
      last_sync_error: error,
      next_retry_at: Date.now() + delay,
    });
  }
}

export async function getTodayRecordsForEmployee(
  employeeId: string,
  companyId: string,
  todayDate: string,
): Promise<OfflineRecord[]> {
  const all = await db.offline_records
    .where('employee_id').equals(employeeId)
    .toArray();
  return all.filter(r => r.company_id === companyId && r.timestamp.startsWith(todayDate));
}
