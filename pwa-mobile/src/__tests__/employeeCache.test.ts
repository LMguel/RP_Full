import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../services/offline/db';
import {
  cacheEmployees,
  getCachedEmployees,
  getCachedEmployeeCount,
  clearEmployeeCache,
  refreshEmployeeCache,
} from '../services/offline/employeeCache';
import apiService from '../services/api';
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

  it('resposta vazia não apaga um cache existente', async () => {
    await cacheEmployees(mockEmployees, 'cmp1');
    await cacheEmployees([], 'cmp1'); // ex: instabilidade momentânea da API
    const cached = await getCachedEmployees('cmp1');
    expect(cached).toHaveLength(2); // cache anterior preservado
  });

  it('resposta vazia grava normalmente quando não havia cache antes', async () => {
    await cacheEmployees([], 'cmp1');
    const cached = await getCachedEmployees('cmp1');
    expect(cached).toHaveLength(0);
  });

  it('company_id vazio nunca é confundido com um cache real', async () => {
    await cacheEmployees(mockEmployees, 'cmp1');
    const empty = await getCachedEmployees('');
    expect(empty).toHaveLength(0); // não deve "vazar" o cache de cmp1
    const real = await getCachedEmployees('cmp1');
    expect(real).toHaveLength(2);
  });
});

describe('refreshEmployeeCache', () => {
  beforeEach(async () => {
    await db.employees_cache.clear();
    vi.restoreAllMocks();
  });

  it('busca da API, grava o cache e retorna a contagem', async () => {
    vi.spyOn(apiService, 'getEmployees').mockResolvedValue(mockEmployees);
    const count = await refreshEmployeeCache('cmp1');
    expect(count).toBe(2);
    const cached = await getCachedEmployees('cmp1');
    expect(cached).toHaveLength(2);
  });

  it('nunca lança e retorna 0 quando a API falha', async () => {
    vi.spyOn(apiService, 'getEmployees').mockRejectedValue(new Error('network down'));
    await expect(refreshEmployeeCache('cmp1')).resolves.toBe(0);
  });

  it('retorna 0 e não chama a API sem company_id', async () => {
    const spy = vi.spyOn(apiService, 'getEmployees');
    const count = await refreshEmployeeCache('');
    expect(count).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('não apaga um cache bom quando a API responde lista vazia', async () => {
    await cacheEmployees(mockEmployees, 'cmp1');
    vi.spyOn(apiService, 'getEmployees').mockResolvedValue([]);
    const count = await refreshEmployeeCache('cmp1');
    expect(count).toBe(2); // cache anterior preservado, contagem reflete o que sobrou
  });
});
