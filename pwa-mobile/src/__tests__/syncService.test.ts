import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../services/offline/db';
import { syncPendingRecords } from '../services/offline/syncService';
import { queueOfflineRecord, getPendingCount } from '../services/offline/offlineQueue';

vi.mock('../services/api', () => ({
  default: {
    registerPointByFace: vi.fn(),
  },
}));

beforeEach(async () => {
  await db.offline_records.clear();
  vi.clearAllMocks();
  // Reset the sync lock between tests (it's module-level state)
  const mod = await import('../services/offline/syncService');
  // Re-import to reset state — the lock is reset after each sync completes
});

describe('syncService', () => {
  it('returns zeroes when there are no pending records', async () => {
    const result = await syncPendingRecords();
    expect(result).toEqual({ synced: 0, failed: 0, total: 0 });
  });

  it('syncs pending records and marks them synced', async () => {
    const { default: apiService } = await import('../services/api');
    (apiService.registerPointByFace as any).mockResolvedValue({ success: true });

    await queueOfflineRecord({ employee_id: 'e1', company_id: 'c1', tipo: 'entrada', timestamp: '2024-01-15 09:00:00' });
    await queueOfflineRecord({ employee_id: 'e2', company_id: 'c1', tipo: 'saida', timestamp: '2024-01-15 18:00:00' });

    const result = await syncPendingRecords();
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(2);

    const remaining = await getPendingCount();
    expect(remaining).toBe(0);
  });

  it('passes offline=true and device_id to the API', async () => {
    const { default: apiService } = await import('../services/api');
    (apiService.registerPointByFace as any).mockResolvedValue({ success: true });

    await queueOfflineRecord({ employee_id: 'e1', company_id: 'c1', tipo: 'entrada', timestamp: '2024-01-15 09:00:00' });
    await syncPendingRecords();

    const calls = (apiService.registerPointByFace as any).mock.calls;
    expect(calls[0][3]).toMatchObject({ offline: true });
    expect(calls[0][3].device_id).toBeTruthy();
    expect(calls[0][3].company_id).toBe('c1');
  });

  it('counts failed records when API throws', async () => {
    const { default: apiService } = await import('../services/api');
    (apiService.registerPointByFace as any).mockRejectedValue(new Error('Network error'));

    await queueOfflineRecord({ employee_id: 'e1', company_id: 'c1', tipo: 'entrada', timestamp: '2024-01-15 09:00:00' });

    const result = await syncPendingRecords();
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);

    const remaining = await getPendingCount();
    expect(remaining).toBe(1);
  });

  it('partially syncs when some records fail', async () => {
    const { default: apiService } = await import('../services/api');
    (apiService.registerPointByFace as any)
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('Network error'));

    await queueOfflineRecord({ employee_id: 'e1', company_id: 'c1', tipo: 'entrada', timestamp: '2024-01-15 09:00:00' });
    await queueOfflineRecord({ employee_id: 'e2', company_id: 'c1', tipo: 'entrada', timestamp: '2024-01-15 09:05:00' });

    const result = await syncPendingRecords();
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.total).toBe(2);
  });

  it('preserves original timestamp when syncing', async () => {
    const { default: apiService } = await import('../services/api');
    (apiService.registerPointByFace as any).mockResolvedValue({ success: true });

    const ts = '2024-01-15 09:30:00';
    await queueOfflineRecord({ employee_id: 'e1', company_id: 'c1', tipo: 'entrada', timestamp: ts });
    await syncPendingRecords();

    const call = (apiService.registerPointByFace as any).mock.calls[0];
    expect(call[0]).toBe('e1');   // employee_id
    expect(call[2]).toBe(ts);     // original timestamp preserved
  });
});
