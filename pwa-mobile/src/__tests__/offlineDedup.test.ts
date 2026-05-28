import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../services/offline/db';
import {
  queueOfflineRecord,
  getPendingCount,
  getPendingRecords,
  markSyncFailed,
} from '../services/offline/offlineQueue';

beforeEach(async () => {
  await db.offline_records.clear();
});

describe('offlineDedup — proteção contra duplicidade', () => {
  it('não enfileira o mesmo registro duas vezes', async () => {
    const params = { employee_id: 'emp1', company_id: 'co1', tipo: 'entrada', timestamp: '2024-03-01 08:00:00' };
    const id1 = await queueOfflineRecord(params);
    const id2 = await queueOfflineRecord(params); // duplicado

    expect(id1).not.toBeNull();
    expect(id2).toBeNull();
    expect(await getPendingCount()).toBe(1);
  });

  it('permite registros iguais de funcionários diferentes', async () => {
    const id1 = await queueOfflineRecord({ employee_id: 'emp1', company_id: 'co1', tipo: 'entrada', timestamp: '2024-03-01 08:00:00' });
    const id2 = await queueOfflineRecord({ employee_id: 'emp2', company_id: 'co1', tipo: 'entrada', timestamp: '2024-03-01 08:00:00' });

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();
    expect(await getPendingCount()).toBe(2);
  });

  it('permite registros do mesmo funcionário em horários diferentes', async () => {
    const id1 = await queueOfflineRecord({ employee_id: 'emp1', company_id: 'co1', tipo: 'entrada', timestamp: '2024-03-01 08:00:00' });
    const id2 = await queueOfflineRecord({ employee_id: 'emp1', company_id: 'co1', tipo: 'saida',   timestamp: '2024-03-01 17:00:00' });

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();
    expect(await getPendingCount()).toBe(2);
  });

  it('armazena local_hash em cada registro', async () => {
    await queueOfflineRecord({ employee_id: 'emp1', company_id: 'co1', tipo: 'entrada', timestamp: '2024-03-01 08:00:00' });
    const records = await db.offline_records.toArray();
    expect(records[0].local_hash).toBeTruthy();
    expect(records[0].local_hash!.length).toBe(64); // SHA-256 hex
  });
});

describe('offlineRetry — backoff exponencial', () => {
  it('define next_retry_at após falha (5s para primeira tentativa)', async () => {
    await queueOfflineRecord({ employee_id: 'emp1', company_id: 'co1', tipo: 'entrada', timestamp: '2024-03-01 08:00:00' });
    const [record] = await db.offline_records.toArray();
    const before = Date.now();

    await markSyncFailed(record.id!, 'timeout');

    const updated = await db.offline_records.get(record.id!);
    expect(updated!.sync_attempts).toBe(1);
    expect(updated!.next_retry_at).toBeGreaterThan(before + 4000);
    expect(updated!.next_retry_at).toBeLessThan(before + 10000);
  });

  it('getPendingRecords exclui registros em backoff', async () => {
    await queueOfflineRecord({ employee_id: 'emp1', company_id: 'co1', tipo: 'entrada', timestamp: '2024-03-01 08:00:00' });
    const [record] = await db.offline_records.toArray();

    // Simular backoff com next_retry_at no futuro
    await db.offline_records.update(record.id!, { next_retry_at: Date.now() + 60_000 });

    const pending = await getPendingRecords();
    expect(pending).toHaveLength(0); // Em backoff, não retorna
  });

  it('getPendingCount inclui registros em backoff (para exibição)', async () => {
    await queueOfflineRecord({ employee_id: 'emp1', company_id: 'co1', tipo: 'entrada', timestamp: '2024-03-01 08:00:00' });
    const [record] = await db.offline_records.toArray();
    await db.offline_records.update(record.id!, { next_retry_at: Date.now() + 60_000 });

    expect(await getPendingCount()).toBe(1); // Ainda aparece no contador
  });

  it('incrementa delay com número de tentativas (backoff)', async () => {
    await queueOfflineRecord({ employee_id: 'emp1', company_id: 'co1', tipo: 'entrada', timestamp: '2024-03-01 08:00:00' });
    const [rec] = await db.offline_records.toArray();

    // 1ª falha → 5s
    await markSyncFailed(rec.id!, 'err');
    const r1 = await db.offline_records.get(rec.id!);
    const delay1 = r1!.next_retry_at! - Date.now();
    expect(delay1).toBeLessThanOrEqual(5500);

    // 2ª falha → 15s
    await markSyncFailed(rec.id!, 'err');
    const r2 = await db.offline_records.get(rec.id!);
    const delay2 = r2!.next_retry_at! - Date.now();
    expect(delay2).toBeGreaterThan(10000);
    expect(delay2).toBeLessThanOrEqual(16000);
  });
});
