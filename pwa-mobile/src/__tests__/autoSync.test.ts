import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../services/offline/db';
import { queueOfflineRecord, getPendingCount } from '../services/offline/offlineQueue';
import { syncPendingRecords, scheduleDebouncedSync } from '../services/offline/syncService';

vi.mock('../services/api', () => ({
  default: {
    registerPointByFace: vi.fn(),
  },
}));

beforeEach(async () => {
  await db.offline_records.clear();
  vi.clearAllMocks();
});

describe('autoSync — offline queue and sync', () => {
  it('queues records while offline and clears them on sync', async () => {
    const { default: apiService } = await import('../services/api');
    (apiService.registerPointByFace as any).mockResolvedValue({ success: true });

    await queueOfflineRecord({ employee_id: 'emp1', company_id: 'co1', tipo: 'entrada', timestamp: '2024-03-01 08:00:00' });
    await queueOfflineRecord({ employee_id: 'emp1', company_id: 'co1', tipo: 'saida',   timestamp: '2024-03-01 17:00:00' });

    expect(await getPendingCount()).toBe(2);

    const result = await syncPendingRecords();
    expect(result.synced).toBe(2);
    expect(result.total).toBe(2);
    expect(await getPendingCount()).toBe(0);
  });

  it('scheduleDebouncedSync fires the callback after debounce delay', async () => {
    vi.useFakeTimers();
    try {
      const callback = vi.fn().mockResolvedValue(undefined);
      scheduleDebouncedSync(callback);
      expect(callback).not.toHaveBeenCalled();
      await vi.runAllTimersAsync();
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('scheduleDebouncedSync deduplifies rapid calls', async () => {
    vi.useFakeTimers();
    try {
      const callback = vi.fn().mockResolvedValue(undefined);
      scheduleDebouncedSync(callback);
      scheduleDebouncedSync(callback);
      scheduleDebouncedSync(callback);
      await vi.runAllTimersAsync();
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('failed records remain in queue for retry', async () => {
    const { default: apiService } = await import('../services/api');
    (apiService.registerPointByFace as any).mockRejectedValue(new Error('Timeout'));

    await queueOfflineRecord({ employee_id: 'emp1', company_id: 'co1', tipo: 'entrada', timestamp: '2024-03-01 08:00:00' });

    const result = await syncPendingRecords();
    expect(result.failed).toBe(1);
    expect(await getPendingCount()).toBe(1);
  });

  it('sync includes device_id and offline=true for each record', async () => {
    const { default: apiService } = await import('../services/api');
    (apiService.registerPointByFace as any).mockResolvedValue({ success: true });

    await queueOfflineRecord({ employee_id: 'emp1', company_id: 'co1', tipo: 'entrada', timestamp: '2024-03-01 08:00:00' });
    await syncPendingRecords();

    const calls = (apiService.registerPointByFace as any).mock.calls;
    expect(calls[0][3].offline).toBe(true);
    expect(typeof calls[0][3].device_id).toBe('string');
  });
});

describe('cachePersistence — records survive module re-use', () => {
  it('queued records persist in IndexedDB across calls', async () => {
    await queueOfflineRecord({ employee_id: 'x1', company_id: 'c1', tipo: 'entrada', timestamp: '2024-03-01 09:00:00' });
    await queueOfflineRecord({ employee_id: 'x2', company_id: 'c1', tipo: 'entrada', timestamp: '2024-03-01 09:05:00' });

    const count = await getPendingCount();
    expect(count).toBe(2);

    const all = await db.offline_records.toArray();
    expect(all.every(r => !r.synced)).toBe(true);
    expect(all.every(r => r.created_offline)).toBe(true);
  });
});
