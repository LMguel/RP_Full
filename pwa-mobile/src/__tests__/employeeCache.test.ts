import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../services/offline/db';
import {
  cacheEmployees,
  getCachedEmployees,
  getCachedEmployeeCount,
  clearEmployeeCache,
} from '../services/offline/employeeCache';
import type { Employee } from '../types';

const mockEmployees: Employee[] = [
  { id: 'emp1', nome: 'Ana Silva', cargo: 'Analista', ativo: true },
  { id: 'emp2', nome: 'Bruno Costa', cargo: 'Desenvolvedor', ativo: true },
  { id: 'emp3', nome: 'Carlos Lima', cargo: 'Gerente', ativo: false },
];

beforeEach(async () => {
  await db.employees_cache.clear();
});

describe('employeeCache', () => {
  it('caches only active employees', async () => {
    await cacheEmployees(mockEmployees, 'cmp1');
    const cached = await getCachedEmployees('cmp1');
    expect(cached).toHaveLength(2); // Carlos (ativo:false) não é cacheado
    // CachedEmployee não expõe ativo — verificar que Carlos (emp3) não está presente
    const ids = cached.map(e => e.id);
    expect(ids).not.toContain('emp3');
  });

  it('getCachedEmployees returns sorted by nome', async () => {
    await cacheEmployees(mockEmployees, 'cmp1');
    const cached = await getCachedEmployees('cmp1');
    expect(cached[0].nome).toBe('Ana Silva');
    expect(cached[1].nome).toBe('Bruno Costa');
  });

  it('getCachedEmployeeCount returns correct count', async () => {
    await cacheEmployees(mockEmployees, 'cmp1');
    const count = await getCachedEmployeeCount('cmp1');
    expect(count).toBe(2);
  });

  it('caches are isolated by company_id', async () => {
    await cacheEmployees(mockEmployees, 'cmp1');
    await cacheEmployees([{ id: 'emp4', nome: 'Diana', ativo: true }], 'cmp2');
    const cmp1 = await getCachedEmployees('cmp1');
    const cmp2 = await getCachedEmployees('cmp2');
    expect(cmp1).toHaveLength(2);
    expect(cmp2).toHaveLength(1);
  });

  it('clearEmployeeCache removes by company_id', async () => {
    await cacheEmployees(mockEmployees, 'cmp1');
    await cacheEmployees([{ id: 'emp4', nome: 'Diana', ativo: true }], 'cmp2');
    await clearEmployeeCache('cmp1');
    const cmp1 = await getCachedEmployees('cmp1');
    const cmp2 = await getCachedEmployees('cmp2');
    expect(cmp1).toHaveLength(0);
    expect(cmp2).toHaveLength(1);
  });

  it('re-caching replaces previous cache', async () => {
    await cacheEmployees(mockEmployees, 'cmp1');
    const updated: Employee[] = [{ id: 'emp5', nome: 'Eduardo', ativo: true }];
    await cacheEmployees(updated, 'cmp1');
    const cached = await getCachedEmployees('cmp1');
    expect(cached).toHaveLength(1);
    expect(cached[0].nome).toBe('Eduardo');
  });
});
