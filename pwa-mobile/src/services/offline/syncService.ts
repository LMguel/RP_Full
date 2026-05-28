import apiService from '../api';
import { getPendingRecords, markSynced, markSyncFailed } from './offlineQueue';

export interface SyncResult {
  synced: number;
  failed: number;
  total: number;
}

let _syncLock = false;
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

export async function syncPendingRecords(): Promise<SyncResult> {
  if (_syncLock) {
    console.log('[SyncService] Sync já em andamento — ignorando solicitação duplicada');
    return { synced: 0, failed: 0, total: 0 };
  }

  const pending = await getPendingRecords();
  if (pending.length === 0) {
    return { synced: 0, failed: 0, total: 0 };
  }

  _syncLock = true;
  let synced = 0;
  let failed = 0;

  try {
    for (const record of pending) {
      try {
        await apiService.registerPointByFace(
          record.employee_id,
          record.tipo,
          record.timestamp,
          {
            offline: true,
            device_id: record.device_id,
            company_id: record.company_id,
          },
        );
        await markSynced(record.id!);
        synced++;
        console.log(`[SyncService] Registro sincronizado: ${record.employee_id}`);
      } catch (err: unknown) {
        const msg =
          (err as any)?.response?.data?.error ||
          (err as any)?.message ||
          'Erro desconhecido';
        await markSyncFailed(record.id!, msg);
        failed++;
        console.warn(`[SyncService] Falha ao sincronizar ${record.employee_id}: ${msg}`);
      }
    }
  } finally {
    _syncLock = false;
  }

  console.log(`[SyncService] Sync concluído — ${synced} sincronizados, ${failed} falhas`);
  return { synced, failed, total: pending.length };
}

export function scheduleDebouncedSync(callback: () => Promise<void>): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(async () => {
    console.log('[SyncService] Backend voltou — iniciando sync');
    _debounceTimer = null;
    await callback();
  }, 800);
}
