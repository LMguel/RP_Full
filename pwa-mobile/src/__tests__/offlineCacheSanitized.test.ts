import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../services/offline/db';
import { cacheEmployees, getCachedEmployees } from '../services/offline/employeeCache';
import type { Employee } from '../types';

const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'emp1',
    nome: 'Ana Silva',
    cargo: 'Operadora',
    cpf: '123.456.789-00',
    face_id: 'rekognition-face-uuid-123',
    foto_url: 'https://bucket.s3.amazonaws.com/company1/funcionarios/emp1.jpg',
    ativo: true,
  },
  {
    id: 'emp2',
    nome: 'Bruno Costa',
    cargo: 'Técnico',
    matricula: 'MAT001',
    cpf: '987.654.321-00',
    face_id: 'rekognition-face-uuid-456',
    foto_url: 'https://bucket.s3.amazonaws.com/company1/funcionarios/emp2.jpg',
    ativo: true,
  },
  {
    id: 'emp3',
    nome: 'Carlos Lima',
    cargo: 'Gerente',
    ativo: false, // Inativo — não deve ser cacheado
  },
];

beforeEach(async () => {
  await db.employees_cache.clear();
});

describe('offlineCacheSanitized — LGPD compliance', () => {
  it('não armazena CPF no cache offline', async () => {
    await cacheEmployees(MOCK_EMPLOYEES, 'company1');
    const cached = await getCachedEmployees('company1');
    for (const emp of cached) {
      expect((emp as any).cpf).toBeUndefined();
    }
  });

  it('não armazena face_id no cache offline', async () => {
    await cacheEmployees(MOCK_EMPLOYEES, 'company1');
    const cached = await getCachedEmployees('company1');
    for (const emp of cached) {
      expect((emp as any).face_id).toBeUndefined();
    }
  });

  it('não armazena foto_url no cache offline', async () => {
    await cacheEmployees(MOCK_EMPLOYEES, 'company1');
    const cached = await getCachedEmployees('company1');
    for (const emp of cached) {
      expect((emp as any).foto_url).toBeUndefined();
    }
  });

  it('armazena apenas os campos necessários para o kiosk offline', async () => {
    await cacheEmployees(MOCK_EMPLOYEES, 'company1');
    const cached = await getCachedEmployees('company1');
    expect(cached).toHaveLength(2); // Carlos (inativo) não cacheia

    const ana = cached.find(e => e.id === 'emp1')!;
    expect(ana.nome).toBe('Ana Silva');
    expect(ana.cargo).toBe('Operadora');
    expect(ana.company_id).toBe('company1');
    expect(ana.cached_at).toBeGreaterThan(0);

    const bruno = cached.find(e => e.id === 'emp2')!;
    expect(bruno.matricula).toBe('MAT001');
  });

  it('não armazena funcionários inativos', async () => {
    await cacheEmployees(MOCK_EMPLOYEES, 'company1');
    const cached = await getCachedEmployees('company1');
    const ids = cached.map(e => e.id);
    expect(ids).not.toContain('emp3');
  });

  it('cada entrada tem apenas os campos do tipo CachedEmployee', async () => {
    await cacheEmployees(MOCK_EMPLOYEES, 'company1');
    const cached = await getCachedEmployees('company1');
    const allowedKeys = new Set(['id', 'nome', 'cargo', 'matricula', 'company_id', 'cached_at']);
    for (const emp of cached) {
      for (const key of Object.keys(emp)) {
        expect(allowedKeys.has(key)).toBe(true);
      }
    }
  });
});
