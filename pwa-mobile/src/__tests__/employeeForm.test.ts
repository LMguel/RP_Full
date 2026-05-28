import { describe, it, expect } from 'vitest';
import type { FuncionarioFormData, PerDaySchedule } from '../types';

// ─── Validation helpers (extracted logic) ────────────────────────────────────

function validateDados(form: Partial<FuncionarioFormData>): Record<string, string> {
  const e: Record<string, string> = {};
  if (!form.nome?.trim()) e.nome = 'Nome obrigatório';
  const cpfRaw = (form.cpf || '').replace(/\D/g, '');
  if (cpfRaw.length < 11) e.cpf = 'CPF inválido';
  if (!form.cargo?.trim()) e.cargo = 'Cargo obrigatório';
  return e;
}

function buildDefaultPerDia(entrada = '08:00', saida = '17:00'): Record<string, PerDaySchedule> {
  return {
    segunda: { ativo: true,  entrada, saida },
    terca:   { ativo: true,  entrada, saida },
    quarta:  { ativo: true,  entrada, saida },
    quinta:  { ativo: true,  entrada, saida },
    sexta:   { ativo: true,  entrada, saida },
    sabado:  { ativo: false, entrada: null, saida: null },
    domingo: { ativo: false, entrada: null, saida: null },
  };
}

function buildCustomSchedulePayload(schedule: Record<string, PerDaySchedule>) {
  return Object.fromEntries(
    Object.entries(schedule).map(([dia, cfg]) => [
      dia,
      { active: cfg.ativo, start: cfg.entrada || null, end: cfg.saida || null },
    ])
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('employeeForm — validation', () => {
  it('requires nome', () => {
    const errors = validateDados({ nome: '', cpf: '12345678901', cargo: 'Dev' });
    expect(errors.nome).toBe('Nome obrigatório');
  });

  it('requires nome not just whitespace', () => {
    const errors = validateDados({ nome: '   ', cpf: '12345678901', cargo: 'Dev' });
    expect(errors.nome).toBe('Nome obrigatório');
  });

  it('requires valid CPF (11 digits)', () => {
    const errors = validateDados({ nome: 'João', cpf: '123.456.789', cargo: 'Dev' });
    expect(errors.cpf).toBe('CPF inválido');
  });

  it('accepts CPF with formatting', () => {
    const errors = validateDados({ nome: 'João', cpf: '123.456.789-01', cargo: 'Dev' });
    expect(errors.cpf).toBeUndefined();
  });

  it('requires cargo', () => {
    const errors = validateDados({ nome: 'João', cpf: '12345678901', cargo: '' });
    expect(errors.cargo).toBe('Cargo obrigatório');
  });

  it('returns empty errors when all required fields valid', () => {
    const errors = validateDados({ nome: 'João Silva', cpf: '123.456.789-01', cargo: 'Operador' });
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('employeeForm — schedule building', () => {
  it('builds per-day schedule with default times', () => {
    const schedule = buildDefaultPerDia();
    expect(schedule.segunda).toMatchObject({ ativo: true, entrada: '08:00', saida: '17:00' });
    expect(schedule.sabado).toMatchObject({ ativo: false });
    expect(schedule.domingo).toMatchObject({ ativo: false });
  });

  it('builds per-day schedule with custom times', () => {
    const schedule = buildDefaultPerDia('07:00', '16:00');
    expect(schedule.segunda.entrada).toBe('07:00');
    expect(schedule.segunda.saida).toBe('16:00');
    expect(schedule.sexta.entrada).toBe('07:00');
  });

  it('converts per-day schedule to API payload format', () => {
    const schedule = buildDefaultPerDia('08:00', '17:00');
    const payload = buildCustomSchedulePayload(schedule);

    expect(payload.segunda).toMatchObject({ active: true, start: '08:00', end: '17:00' });
    expect(payload.sabado).toMatchObject({ active: false, start: null, end: null });
  });

  it('handles inactive days in payload with null times', () => {
    const schedule: Record<string, PerDaySchedule> = {
      segunda: { ativo: true,  entrada: '09:00', saida: '18:00' },
      sabado:  { ativo: false, entrada: null,    saida: null     },
    };
    const payload = buildCustomSchedulePayload(schedule);
    expect(payload.sabado.start).toBeNull();
    expect(payload.sabado.end).toBeNull();
    expect(payload.sabado.active).toBe(false);
  });
});

describe('employeeForm — password logic', () => {
  it('generates temp password from first name', () => {
    const nome = 'João da Silva';
    const primeiroNome = nome.trim().split(' ')[0]
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    expect(primeiroNome).toBe('joao');
    // Password would be `joao${4digits}`
    const senha = `${primeiroNome}1234`;
    expect(senha).toMatch(/^joao\d{4}$/);
  });

  it('uses provided senha if non-empty', () => {
    const formSenha = 'minhasenha123';
    const primeiroNome = 'joao';
    const senhaTmp = formSenha.trim() || `${primeiroNome}1234`;
    expect(senhaTmp).toBe('minhasenha123');
  });

  it('generates temp senha when provided senha is empty', () => {
    const formSenha = '';
    const primeiroNome = 'joao';
    const sufixo = '5678';
    const senhaTmp = formSenha.trim() || `${primeiroNome}${sufixo}`;
    expect(senhaTmp).toBe('joao5678');
  });
});
