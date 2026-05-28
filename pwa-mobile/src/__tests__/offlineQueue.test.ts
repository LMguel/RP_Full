import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../services/offline/db';
import {
  queueOfflineRecord,
  getPendingRecords,
  getPendingCount,
  markSynced,
  markSyncFailed,
  getTodayRecordsForEmployee,
} from '../services/offline/offlineQueue';

beforeEach(async () => {
  await db.offline_records.clear();
});

describe('offlineQueue', () => {
  it('queues a record and retrieves it as pending', async () => {
    const id = await queueOfflineRecord({
      employee_id: 'emp1',
      company_id: 'cmp1',
      tipo: 'entrada',
      timestamp: '2024-01-15 09:00:00',
    });
    expect(typeof id).toBe('number');

    const pending = await getPendingRecords();
    expect(pending).toHaveLength(1);
    expect(pending[0].employee_id).toBe('emp1');
    expect(pending[0].tipo).toBe('entrada');
    expect(pending[0].synced).toBe(false);
    expect(pending[0].created_offline).toBe(true);
  });

  it('getPendingCount returns correct count', async () => {
    await queueOfflineRecord({ employee_id: 'e1', company_id: 'c1', tipo: 'entrada', timestamp: '2024-01-15 09:00:00' });
    await queueOfflineRecord({ employee_id: 'e2', company_id: 'c1', tipo: 'saida', timestamp: '2024-01-15 18:00:00' });
    const count = await getPendingCount();
    expect(count).toBe(2);
  });

  it('markSynced removes record from pending', async () => {
    const id = await queueOfflineRecord({ employee_id: 'e1', company_id: 'c1', tipo: 'entrada', timestamp: '2024-01-15 09:00:00' });
    await markSynced(id as number);
    const count = await getPendingCount();
    expect(count).toBe(0);
  });

  it('markSyncFailed increments sync_attempts and sets backoff', async () => {
    const id = await queueOfflineRecord({ employee_id: 'e1', company_id: 'c1', tipo: 'entrada', timestamp: '2024-01-15 09:00:00' });
    await markSyncFailed(id as number, 'timeout');
    // Após falha, o registro entra em backoff e não aparece em getPendingRecords
    // mas ainda aparece em getPendingCount
    expect(await getPendingCount()).toBe(1);
    // Verificar diretamente no DB
    const { db } = await import('../services/offline/db');
    const rec = await db.offline_records.get(id as number);
    expect(rec!.sync_attempts).toBe(1);
    expect(rec!.last_sync_error).toBe('timeout');
    expect(rec!.next_retry_at).toBeGreaterThan(Date.now());
  });

  it('getTodayRecordsForEmployee filters by date and company', async () => {
    await queueOfflineRecord({ employee_id: 'e1', company_id: 'c1', tipo: 'entrada', timestamp: '2024-01-15 09:00:00' });
    await queueOfflineRecord({ employee_id: 'e1', company_id: 'c1', tipo: 'saida', timestamp: '2024-01-15 18:00:00' });
    await queueOfflineRecord({ employee_id: 'e1', company_id: 'c1', tipo: 'entrada', timestamp: '2024-01-16 09:00:00' });

    const todayRecords = await getTodayRecordsForEmployee('e1', 'c1', '2024-01-15');
    expect(todayRecords).toHaveLength(2);
  });

  it('device_id is assigned from localStorage', async () => {
    await queueOfflineRecord({ employee_id: 'e1', company_id: 'c1', tipo: 'entrada', timestamp: '2024-01-15 09:00:00' });
    const pending = await getPendingRecords();
    expect(pending[0].device_id).toBeTruthy();
    expect(typeof pending[0].device_id).toBe('string');
  });
});
