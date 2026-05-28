import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../services/offline/db';
import { queueOfflineRecord, getPendingCount, getTodayRecordsForEmployee } from '../services/offline/offlineQueue';
import { cacheEmployees, getCachedEmployees, getCachedEmployeeCount } from '../services/offline/employeeCache';
import type { Employee } from '../types';

const MOCK_EMPLOYEES: Employee[] = [
  { id: 'emp1', nome: 'Ana Silva',    cargo: 'Operadora', ativo: true },
  { id: 'emp2', nome: 'Bruno Costa',  cargo: 'Técnico',   ativo: true },
  { id: 'emp3', nome: 'Carlos Lima',  cargo: 'Gerente',   ativo: false }, // inactive — should not cache
];

beforeEach(async () => {
  await db.offline_records.clear();
  await db.employees_cache.clear();
  vi.clearAllMocks();
});

describe('kioskOffline — employee cache for offline mode', () => {
  it('caches only active employees', async () => {
    await cacheEmployees(MOCK_EMPLOYEES, 'company1');
    const cached = await getCachedEmployees('company1');
    expect(cached).toHaveLength(2);
    expect(cached.map(e => e.id)).not.toContain('emp3');
  });

  it('returns cached count correctly', async () => {
    await cacheEmployees(MOCK_EMPLOYEES, 'company1');
    const count = await getCachedEmployeeCount('company1');
    expect(count).toBe(2);
  });

  it('allows searching by name prefix', async () => {
    await cacheEmployees(MOCK_EMPLOYEES, 'company1');
    const all = await getCachedEmployees('company1');
    const filtered = all.filter(e => e.nome.toLowerCase().includes('ana'));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('emp1');
  });
});

describe('kioskOffline — offline record queue', () => {
  it('queues a record with correct fields', async () => {
    const id = await queueOfflineRecord({
      employee_id: 'emp1',
      company_id: 'company1',
      tipo: '',
      timestamp: '2024-03-01 09:00:00',
    });
    expect(id).toBeGreaterThan(0);

    const records = await db.offline_records.toArray();
    expect(records).toHaveLength(1);
    expect(records[0].employee_id).toBe('emp1');
    expect(records[0].synced).toBe(false);
    expect(records[0].created_offline).toBe(true);
    expect(records[0].device_id).toBeTruthy();
  });

  it('allows multiple employees to queue on same day', async () => {
    const today = '2024-03-01';
    await queueOfflineRecord({ employee_id: 'emp1', company_id: 'c1', tipo: '', timestamp: `${today} 08:00:00` });
    await queueOfflineRecord({ employee_id: 'emp2', company_id: 'c1', tipo: '', timestamp: `${today} 08:05:00` });
    await queueOfflineRecord({ employee_id: 'emp1', company_id: 'c1', tipo: '', timestamp: `${today} 17:00:00` });

    expect(await getPendingCount()).toBe(3);

    const emp1Records = await getTodayRecordsForEmployee('emp1', 'c1', today);
    expect(emp1Records).toHaveLength(2);
  });

  it('preserves timestamp as recorded at the moment', async () => {
    const ts = '2024-03-01 14:35:22';
    await queueOfflineRecord({ employee_id: 'emp1', company_id: 'c1', tipo: '', timestamp: ts });

    const records = await db.offline_records.toArray();
    expect(records[0].timestamp).toBe(ts);
  });
});

describe('kioskOffline — sync status', () => {
  it('pending count reflects unsynced records only', async () => {
    await queueOfflineRecord({ employee_id: 'e1', company_id: 'c1', tipo: '', timestamp: '2024-03-01 09:00:00' });
    await queueOfflineRecord({ employee_id: 'e2', company_id: 'c1', tipo: '', timestamp: '2024-03-01 09:01:00' });

    expect(await getPendingCount()).toBe(2);

    // Mark one as synced
    const records = await db.offline_records.toArray();
    await db.offline_records.update(records[0].id!, { synced: true });

    expect(await getPendingCount()).toBe(1);
  });
});
