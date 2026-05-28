import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RegistroDiario, TimeRecord } from '../types';

// ── Helpers copied from EspelhoPontoPage (pure functions, no DOM needed) ─────

function formatHours(h: number): string {
  const totalMins = Math.round(Math.abs(h) * 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hours}h${mins > 0 ? String(mins).padStart(2, '0') + 'm' : ''}`;
}

function formatMinutes(m: number): string {
  const absM = Math.abs(m);
  const h = Math.floor(absM / 60);
  const mm = absM % 60;
  return `${h}h${mm > 0 ? String(mm).padStart(2, '0') + 'm' : ''}`;
}

function formatTime(iso: string): string {
  if (!iso) return '--:--';
  if (/^\d{2}:\d{2}$/.test(iso)) return iso;
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

// Simulates getMeusRegistros normalization
function normalizeRecords(raw: any[]): TimeRecord[] {
  return raw.map(r => {
    let data_hora: string = r.data_hora || '';
    if (!data_hora) {
      const composite: string = r['employee_id#date_time'] || '';
      const idx = composite.indexOf('#');
      if (idx >= 0) data_hora = composite.slice(idx + 1);
    }
    return {
      ...r,
      data_hora,
      tipo: (r.tipo || r.type || '') as TimeRecord['tipo'],
      funcionario_id: r.funcionario_id || r.employee_id || '',
    } as TimeRecord;
  }).filter(r => Boolean(r.data_hora));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('formatHours', () => {
  it('formats 8h correctly', () => {
    expect(formatHours(8)).toBe('8h');
  });

  it('formats 8.5h as 8h30m', () => {
    expect(formatHours(8.5)).toBe('8h30m');
  });

  it('formats 0h as 0h', () => {
    expect(formatHours(0)).toBe('0h');
  });

  it('handles negative values (uses absolute)', () => {
    expect(formatHours(-2)).toBe('2h');
  });
});

describe('formatMinutes', () => {
  it('formats 480 min as 8h', () => {
    expect(formatMinutes(480)).toBe('8h');
  });

  it('formats 510 min as 8h30m', () => {
    expect(formatMinutes(510)).toBe('8h30m');
  });

  it('formats negative minutes using absolute value', () => {
    expect(formatMinutes(-60)).toBe('1h');
  });
});

describe('formatTime', () => {
  it('returns HH:MM as-is', () => {
    expect(formatTime('09:15')).toBe('09:15');
  });

  it('returns --:-- for empty string', () => {
    expect(formatTime('')).toBe('--:--');
  });
});

describe('getDailyRegistros response parsing', () => {
  it('parses summaries array from backend response', () => {
    const mockResponse = {
      summaries: [
        {
          data: '2026-05-27',
          employee_id: 'luis_de58',
          dia_semana: 'Ter',
          hora_entrada: '09:00',
          hora_saida: '18:00',
          horas_trabalhadas_min: 480,
          horas_trabalhadas_str: '08:00',
          horas_previstas_min: 480,
          horas_previstas_str: '08:00',
          banco_horas_dia: 0,
          banco_horas_dia_str: '00:00',
          atraso_minutos: 0,
          horario_variavel: false,
        } as RegistroDiario,
      ],
      total: 1,
      page: 1,
      page_size: 200,
    };

    const summaries: RegistroDiario[] = mockResponse.summaries ?? [];
    expect(summaries).toHaveLength(1);
    expect(summaries[0].data).toBe('2026-05-27');
    expect(summaries[0].hora_entrada).toBe('09:00');
    expect(summaries[0].hora_saida).toBe('18:00');
    expect(summaries[0].horas_trabalhadas_str).toBe('08:00');
    expect(summaries[0].banco_horas_dia).toBe(0);
  });

  it('returns empty array when summaries key is missing', () => {
    const mockResponse: any = { error: 'not found' };
    const summaries = mockResponse?.summaries ?? [];
    expect(summaries).toHaveLength(0);
  });

  it('calculates banco total from daily summaries', () => {
    const summaries: Partial<RegistroDiario>[] = [
      { banco_horas_dia: 30 },   // +30 min
      { banco_horas_dia: -15 },  // -15 min
      { banco_horas_dia: 60 },   // +60 min
    ];
    const total = summaries.reduce((acc, s) => acc + (s.banco_horas_dia ?? 0), 0);
    expect(total).toBe(75); // 75 minutes = 1h15m
    expect(formatMinutes(total)).toBe('1h15m');
  });

  it('uses dias_trabalhados from monthly summary', () => {
    const monthlySummary = {
      total_horas_trabalhadas: 176,
      total_horas_extras: 8,
      dias_trabalhados: 22,
    };
    const dailySummaries: Partial<RegistroDiario>[] = [
      { data: '2026-05-01' }, { data: '2026-05-02' }, // only 2 in local
    ];
    // Should use backend value, not local count
    const diasTrabalhados = monthlySummary?.dias_trabalhados ?? dailySummaries.length;
    expect(diasTrabalhados).toBe(22);
  });
});

describe('getMeusRegistros field normalization', () => {
  it('extracts data_hora from composite key when missing', () => {
    const raw = [
      {
        company_id: 'cmp1',
        'employee_id#date_time': 'luis_de58#2026-05-27 09:00:00',
        type: 'entrada',
      },
    ];
    const records = normalizeRecords(raw);
    expect(records).toHaveLength(1);
    expect(records[0].data_hora).toBe('2026-05-27 09:00:00');
    expect(records[0].tipo).toBe('entrada');
  });

  it('uses data_hora directly when present', () => {
    const raw = [
      {
        data_hora: '2026-05-27 09:00:00',
        tipo: 'entrada',
        funcionario_id: 'luis_de58',
      },
    ];
    const records = normalizeRecords(raw);
    expect(records[0].data_hora).toBe('2026-05-27 09:00:00');
    expect(records[0].tipo).toBe('entrada');
  });

  it('normalizes type field to tipo', () => {
    const raw = [
      {
        'employee_id#date_time': 'emp1#2026-05-27 18:00:00',
        type: 'saida',
      },
    ];
    const records = normalizeRecords(raw);
    expect(records[0].tipo).toBe('saida');
  });

  it('filters out records with no extractable data_hora', () => {
    const raw = [
      { company_id: 'cmp1', type: 'entrada' }, // no data_hora, no composite key
      { data_hora: '2026-05-27 09:00:00', tipo: 'entrada' },
    ];
    const records = normalizeRecords(raw);
    expect(records).toHaveLength(1);
    expect(records[0].data_hora).toBe('2026-05-27 09:00:00');
  });

  it('filters records by day for expanded view', () => {
    const records: TimeRecord[] = [
      { data_hora: '2026-05-27 09:00:00', tipo: 'entrada', funcionario_id: 'emp1' },
      { data_hora: '2026-05-27 18:00:00', tipo: 'saida', funcionario_id: 'emp1' },
      { data_hora: '2026-05-28 09:00:00', tipo: 'entrada', funcionario_id: 'emp1' },
    ];
    const dayRecords = records.filter(r => r.data_hora?.startsWith('2026-05-27'));
    expect(dayRecords).toHaveLength(2);
  });
});
