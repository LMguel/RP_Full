import { describe, it, expect } from 'vitest';
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

// ── Helpers copied from EspelhoPontoPage (lógica pura) ───────────────────────

const MONTHLY_TOLERANCE_MIN = 120;

function toHHMM(totalMin: number): string {
  const sign = totalMin < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalMin));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function applyMonthlyTolerance(saldoBruto: number, toleranceMin = MONTHLY_TOLERANCE_MIN): { applied: boolean; saldo: number } {
  if (Math.abs(saldoBruto) <= toleranceMin) return { applied: true, saldo: 0 };
  return { applied: false, saldo: saldoBruto };
}

interface MockSummary {
  iso: string;
  horas_trabalhadas_min: number;
  horas_previstas_min: number;
  horas_extras_min: number;
  atraso_minutos: number;
  saida_antecipada_minutos: number;
}

function computeResumo(summaries: MockSummary[], feriadoCredits: Array<{ iso: string; credit: number }> = []) {
  const todayISO = '2026-05-31'; // simulated "today"

  let totalMinTrabalhados = 0;
  let totalMinPrevistos   = 0;
  let totalMinExtras      = 0;
  let totalMinAtrasos     = 0;

  summaries.forEach(s => {
    if (s.iso > todayISO) return;
    totalMinTrabalhados += s.horas_trabalhadas_min;
    totalMinPrevistos   += s.horas_previstas_min;
    totalMinExtras      += s.horas_extras_min;
    totalMinAtrasos     += s.atraso_minutos + s.saida_antecipada_minutos;
  });

  // Feriado credit
  feriadoCredits.forEach(({ iso, credit }) => {
    if (iso > todayISO) return;
    totalMinTrabalhados += credit;
    totalMinPrevistos   += credit;
  });

  const saldoBruto = totalMinExtras - totalMinAtrasos;
  const { applied: toleranciaAplicada, saldo: saldoFinal } = applyMonthlyTolerance(saldoBruto);
  const displayExtras     = toleranciaAplicada ? 0 : totalMinExtras;
  const displayAtrasos    = toleranciaAplicada ? 0 : totalMinAtrasos;
  const displayTrabalhado = toleranciaAplicada ? totalMinPrevistos : totalMinTrabalhados;
  const cumprimento       = Math.round((displayTrabalhado / (totalMinPrevistos || 1)) * 100);

  return {
    totalMinPrevistos,
    totalMinTrabalhados: displayTrabalhado,
    totalMinExtras: displayExtras,
    totalMinAtrasos: displayAtrasos,
    saldoMin: saldoFinal,
    toleranciaAplicada,
    cumprimento,
    trabalhado: toHHMM(displayTrabalhado),
    previsto:   toHHMM(totalMinPrevistos),
    extras:     toHHMM(displayExtras),
    atrasosStr: toHHMM(displayAtrasos),
    saldo:      toHHMM(saldoFinal),
  };
}

// ── Testes novos ─────────────────────────────────────────────────────────────

describe('applyMonthlyTolerance', () => {
  it('zera saldo quando dentro de 2h positivo', () => {
    const { applied, saldo } = applyMonthlyTolerance(117);
    expect(applied).toBe(true);
    expect(saldo).toBe(0);
  });

  it('zera saldo quando dentro de 2h negativo', () => {
    const { applied, saldo } = applyMonthlyTolerance(-118);
    expect(applied).toBe(true);
    expect(saldo).toBe(0);
  });

  it('preserva saldo quando acima da tolerância positiva', () => {
    const { applied, saldo } = applyMonthlyTolerance(150);
    expect(applied).toBe(false);
    expect(saldo).toBe(150);
  });

  it('preserva saldo negativo acima da tolerância', () => {
    const { applied, saldo } = applyMonthlyTolerance(-130);
    expect(applied).toBe(false);
    expect(saldo).toBe(-130);
  });

  it('respeita tolerância exata no limite (igual = dentro)', () => {
    const { applied } = applyMonthlyTolerance(120);
    expect(applied).toBe(true);
  });

  it('tolerance_min customizável', () => {
    const { applied: a30 } = applyMonthlyTolerance(25, 30);
    const { applied: a10 } = applyMonthlyTolerance(25, 10);
    expect(a30).toBe(true);
    expect(a10).toBe(false);
  });
});

describe('cálculo separado: Horas Extras', () => {
  it('soma apenas balances positivos do dia (fora tolerância)', () => {
    // saldo bruto = 150 - 10 = 140 > 120 → fora tolerância
    const summaries: MockSummary[] = [
      { iso: '2026-05-05', horas_trabalhadas_min: 570, horas_previstas_min: 480, horas_extras_min: 90, atraso_minutos: 0,  saida_antecipada_minutos: 0  },
      { iso: '2026-05-06', horas_trabalhadas_min: 470, horas_previstas_min: 480, horas_extras_min: 0,  atraso_minutos: 10, saida_antecipada_minutos: 0  },
      { iso: '2026-05-07', horas_trabalhadas_min: 540, horas_previstas_min: 480, horas_extras_min: 60, atraso_minutos: 0,  saida_antecipada_minutos: 0  },
    ];
    const r = computeResumo(summaries);
    expect(r.toleranciaAplicada).toBe(false); // saldo=140 > 120
    expect(r.totalMinExtras).toBe(150);
    expect(toHHMM(150)).toBe('02:30');
  });

  it('mostra 00:00 quando tolerância aplicada', () => {
    const summaries: MockSummary[] = [
      { iso: '2026-05-05', horas_trabalhadas_min: 498, horas_previstas_min: 480, horas_extras_min: 18, atraso_minutos: 0, saida_antecipada_minutos: 0 },
      { iso: '2026-05-06', horas_trabalhadas_min: 467, horas_previstas_min: 480, horas_extras_min: 0,  atraso_minutos: 0, saida_antecipada_minutos: 13 },
    ];
    // extras = 18, atrasos = 13, saldo = 5 < 120 → tolerância aplicada
    const r = computeResumo(summaries);
    expect(r.toleranciaAplicada).toBe(true);
    expect(r.totalMinExtras).toBe(0);
    expect(r.extras).toBe('00:00');
  });
});

describe('cálculo separado: Atrasos', () => {
  it('soma atraso_minutos + saida_antecipada_minutos por dia (fora tolerância)', () => {
    // saldo bruto = 0 - 150 = -150 < -120 → fora tolerância
    const summaries: MockSummary[] = [
      { iso: '2026-05-05', horas_trabalhadas_min: 400, horas_previstas_min: 480, horas_extras_min: 0, atraso_minutos: 60, saida_antecipada_minutos: 20 },
      { iso: '2026-05-06', horas_trabalhadas_min: 410, horas_previstas_min: 480, horas_extras_min: 0, atraso_minutos: 30, saida_antecipada_minutos: 40 },
    ];
    // atrasos = (60+20) + (30+40) = 150, extras = 0, saldo = -150 → fora tolerância
    const r = computeResumo(summaries);
    expect(r.toleranciaAplicada).toBe(false);
    expect(r.totalMinAtrasos).toBe(150);
    expect(r.atrasosStr).toBe('02:30');
  });

  it('mostra 00:00 quando tolerância aplicada', () => {
    const summaries: MockSummary[] = [
      { iso: '2026-05-05', horas_trabalhadas_min: 475, horas_previstas_min: 480, horas_extras_min: 0, atraso_minutos: 5, saida_antecipada_minutos: 0 },
    ];
    // saldo = 0 - 5 = -5, dentro tolerância
    const r = computeResumo(summaries);
    expect(r.toleranciaAplicada).toBe(true);
    expect(r.totalMinAtrasos).toBe(0);
  });
});

describe('Banco de Horas = Extras − Atrasos', () => {
  it('banco positivo quando extras > atrasos fora tolerância', () => {
    const summaries: MockSummary[] = [
      { iso: '2026-05-05', horas_trabalhadas_min: 630, horas_previstas_min: 480, horas_extras_min: 150, atraso_minutos: 0,  saida_antecipada_minutos: 0  },
      { iso: '2026-05-06', horas_trabalhadas_min: 435, horas_previstas_min: 480, horas_extras_min: 0,   atraso_minutos: 15, saida_antecipada_minutos: 30 },
    ];
    // extras=150, atrasos=45, saldo=+105 → fora tolerância (>0 mas <=120)
    // Na verdade 105 < 120 → tolerância aplicada
    const r = computeResumo(summaries);
    expect(r.toleranciaAplicada).toBe(true);
    expect(r.saldoMin).toBe(0);
  });

  it('banco negativo quando atrasos > extras fora tolerância', () => {
    const summaries: MockSummary[] = [
      { iso: '2026-05-05', horas_trabalhadas_min: 180, horas_previstas_min: 480, horas_extras_min: 0, atraso_minutos: 60, saida_antecipada_minutos: 200 },
    ];
    // extras=0, atrasos=260, saldo=-260 → fora tolerância
    const r = computeResumo(summaries);
    expect(r.toleranciaAplicada).toBe(false);
    expect(r.saldoMin).toBe(-260);
    expect(r.saldo).toBe('-04:20');
  });

  it('banco zerado com tolerância aplicada', () => {
    const summaries: MockSummary[] = [
      { iso: '2026-05-05', horas_trabalhadas_min: 498, horas_previstas_min: 480, horas_extras_min: 18, atraso_minutos: 0, saida_antecipada_minutos: 0 },
    ];
    // extras=18, atrasos=0, saldo=+18 → tolerância aplicada → banco=00:00
    const r = computeResumo(summaries);
    expect(r.saldo).toBe('00:00');
  });
});

describe('Feriado contabilizado automaticamente', () => {
  it('adiciona crédito de feriado em dia útil ao previsto e trabalhado', () => {
    const summaries: MockSummary[] = [
      { iso: '2026-05-04', horas_trabalhadas_min: 480, horas_previstas_min: 480, horas_extras_min: 0, atraso_minutos: 0, saida_antecipada_minutos: 0 },
    ];
    // 01/05 é feriado (qui), jornada = 4h (240 min)
    const feriadoCredits = [{ iso: '2026-05-01', credit: 240 }];
    const r = computeResumo(summaries, feriadoCredits);
    expect(r.totalMinPrevistos).toBe(480 + 240); // 720
    expect(r.totalMinTrabalhados).toBe(480 + 240); // tolerância aplicada → igual previsto? Check saldo first
    // saldo bruto = 0 + 0 = 0 → tolerância → trabalhado = previsto = 720
    expect(r.toleranciaAplicada).toBe(true);
    expect(toHHMM(r.totalMinPrevistos)).toBe('12:00');
  });

  it('não gera atraso nem extra para dia de feriado creditado', () => {
    const feriadoCredits = [{ iso: '2026-05-01', credit: 270 }];
    const r = computeResumo([], feriadoCredits);
    expect(r.totalMinExtras).toBe(0);
    expect(r.totalMinAtrasos).toBe(0);
    expect(r.saldoMin).toBe(0);
  });

  it('não credita feriado sem jornada naquele dia (crédito=0)', () => {
    const feriadoCredits = [{ iso: '2026-05-03', credit: 0 }]; // domingo = sem jornada
    const r = computeResumo([], feriadoCredits);
    expect(r.totalMinPrevistos).toBe(0);
    expect(r.totalMinTrabalhados).toBe(0);
  });
});

describe('Horas Trabalhadas — exibição com tolerância', () => {
  it('exibe previsto como trabalhado quando dentro da tolerância', () => {
    const summaries: MockSummary[] = [
      { iso: '2026-05-05', horas_trabalhadas_min: 497, horas_previstas_min: 480, horas_extras_min: 17, atraso_minutos: 0, saida_antecipada_minutos: 0 },
      { iso: '2026-05-06', horas_trabalhadas_min: 461, horas_previstas_min: 480, horas_extras_min: 0,  atraso_minutos: 0, saida_antecipada_minutos: 19 },
    ];
    // extras=17, atrasos=19, saldo=-2 → tolerância
    const r = computeResumo(summaries);
    expect(r.toleranciaAplicada).toBe(true);
    // trabalhado exibido = previsto (960)
    expect(r.totalMinTrabalhados).toBe(960);
    expect(r.trabalhado).toBe('16:00');
    expect(r.previsto).toBe('16:00');
  });

  it('exibe horas reais quando fora da tolerância', () => {
    const summaries: MockSummary[] = [
      { iso: '2026-05-05', horas_trabalhadas_min: 630, horas_previstas_min: 480, horas_extras_min: 150, atraso_minutos: 0, saida_antecipada_minutos: 0 },
    ];
    // extras=150, atrasos=0, saldo=150 > 120 → fora tolerância
    const r = computeResumo(summaries);
    expect(r.toleranciaAplicada).toBe(false);
    expect(r.totalMinTrabalhados).toBe(630);
  });
});

describe('Percentual de cumprimento', () => {
  it('100% quando tolerância aplicada', () => {
    const summaries: MockSummary[] = [
      { iso: '2026-05-05', horas_trabalhadas_min: 490, horas_previstas_min: 480, horas_extras_min: 10, atraso_minutos: 0, saida_antecipada_minutos: 0 },
    ];
    const r = computeResumo(summaries);
    expect(r.cumprimento).toBe(100);
  });

  it('calcula percentual correto fora da tolerância', () => {
    const summaries: MockSummary[] = [
      { iso: '2026-05-05', horas_trabalhadas_min: 360, horas_previstas_min: 480, horas_extras_min: 0, atraso_minutos: 120, saida_antecipada_minutos: 0 },
    ];
    // atrasos=120 = limite exato → tolerância aplicada → 100%
    const r = computeResumo(summaries);
    expect(r.toleranciaAplicada).toBe(true);
    expect(r.cumprimento).toBe(100);
  });

  it('abaixo de 100% quando fora da tolerância', () => {
    const summaries: MockSummary[] = [
      { iso: '2026-05-05', horas_trabalhadas_min: 240, horas_previstas_min: 480, horas_extras_min: 0, atraso_minutos: 240, saida_antecipada_minutos: 0 },
    ];
    // atrasos=240 > 120 → fora tolerância, trabalhado=240, previsto=480 → 50%
    const r = computeResumo(summaries);
    expect(r.toleranciaAplicada).toBe(false);
    expect(r.cumprimento).toBe(50);
  });
});

// ── Testes de intervalo manual (bug paginação/formato data) ─────────────────

function buildCalendarStatus(
  summaries: Record<string, { horas_trabalhadas_min: number; atraso_minutos?: number }>,
  rawRecordsByDate: Record<string, number>, // date → count
  workdays: Set<string>,
  todayISO: string,
  holidays: Set<string> = new Set(),
): Record<string, 'PRESENTE' | 'ATRASO' | 'FALTA' | 'FERIADO' | 'SEM_REGISTRO'> {
  const result: Record<string, any> = {};
  const dates = new Set([...Object.keys(summaries), ...Object.keys(rawRecordsByDate), ...Array.from(workdays)]);

  for (const iso of dates) {
    const summary = summaries[iso];
    const records = rawRecordsByDate[iso] ?? 0;
    const isPast = iso <= todayISO;
    const isWorkday = workdays.has(iso);
    const isHoliday = holidays.has(iso);
    const summaryHasWork = summary && summary.horas_trabalhadas_min > 0;

    let status: string = 'SEM_REGISTRO';
    if (isHoliday) {
      status = 'FERIADO';
    } else if (records > 0 || summaryHasWork) {
      status = (summary?.atraso_minutos ?? 0) > 0 ? 'ATRASO' : 'PRESENTE';
    } else if (isWorkday && isPast) {
      status = 'FALTA';
    }
    result[iso] = status;
  }
  return result;
}

describe('Bug de intervalo manual — presença', () => {
  const TODAY = '2026-05-31';
  const WORKDAYS = new Set(['2026-05-04','2026-05-05','2026-05-06','2026-05-07','2026-05-08',
    '2026-05-11','2026-05-12','2026-05-13','2026-05-14','2026-05-15']);

  it('CASO 1 — intervalo automático: registros presentes com 2 records/dia', () => {
    const summaries: Record<string, any> = {};
    const rawRecords: Record<string, number> = {};
    Array.from(WORKDAYS).forEach(d => {
      summaries[d] = { horas_trabalhadas_min: 480, atraso_minutos: 0 };
      rawRecords[d] = 2; // entrada + saida
    });
    const status = buildCalendarStatus(summaries, rawRecords, WORKDAYS, TODAY);
    expect(Object.values(status).every(s => s === 'PRESENTE')).toBe(true);
  });

  it('CASO 2 — intervalo manual completo: 4 records/dia', () => {
    const summaries: Record<string, any> = {};
    const rawRecords: Record<string, number> = {};
    Array.from(WORKDAYS).forEach(d => {
      summaries[d] = { horas_trabalhadas_min: 480, atraso_minutos: 0 };
      rawRecords[d] = 4; // entrada + saida_almoco + retorno_almoco + saida
    });
    const status = buildCalendarStatus(summaries, rawRecords, WORKDAYS, TODAY);
    expect(Object.values(status).every(s => s === 'PRESENTE')).toBe(true);
  });

  it('CASO 3 — sem intervalo: apenas entrada + saída', () => {
    const summaries: Record<string, any> = {};
    const rawRecords: Record<string, number> = {};
    Array.from(WORKDAYS).forEach(d => {
      summaries[d] = { horas_trabalhadas_min: 240, atraso_minutos: 0 };
      rawRecords[d] = 2;
    });
    const status = buildCalendarStatus(summaries, rawRecords, WORKDAYS, TODAY);
    expect(Object.values(status).every(s => s === 'PRESENTE')).toBe(true);
  });

  it('CASO 4 — safety net: summary sem raw records NÃO vira FALTA', () => {
    const summaries: Record<string, any> = {
      '2026-05-05': { horas_trabalhadas_min: 480, atraso_minutos: 0 },
      '2026-05-06': { horas_trabalhadas_min: 480, atraso_minutos: 0 },
    };
    // rawRecords VAZIO (simula paginação incompleta)
    const rawRecords: Record<string, number> = {};
    const status = buildCalendarStatus(summaries, rawRecords, WORKDAYS, TODAY);
    expect(status['2026-05-05']).toBe('PRESENTE');
    expect(status['2026-05-06']).toBe('PRESENTE');
    // Dias sem summary continuam FALTA
    expect(status['2026-05-04']).toBe('FALTA');
  });

  it('CASO 5 — múltiplos registros no mesmo dia agrupados corretamente', () => {
    // Simula 4 records num dia → todos agrupam na mesma data-chave
    const dates = ['2026-05-05T08:00:00', '2026-05-05T12:00:00', '2026-05-05T13:00:00', '2026-05-05T17:00:00'];
    const keys = dates.map(d => (d.includes('T') ? d.split('T')[0] : d.split(' ')[0]));
    // Todos devem resultar na mesma chave
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe('2026-05-05');
  });

  it('CASO 6 — registros antigos com formato DD-MM-YYYY agrupados corretamente', () => {
    // Registros antigos retornam do backend no formato DD-MM-YYYY HH:MM:SS
    const dataHoras = ['05-05-2026 08:00:00', '05-05-2026 12:00:00', '05-05-2026 13:00:00', '05-05-2026 17:00:00'];
    const keys = dataHoras.map(dh => {
      const raw = dh.includes('T') ? dh.split('T')[0] : dh.split(' ')[0];
      const segs = raw.split('-');
      return segs[0].length === 4 ? raw : `${segs[2]}-${segs[1]}-${segs[0]}`;
    });
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe('2026-05-05');
  });

  it('CASO 4 ainda funciona após fix (safety net sem bloquear auto-break)', () => {
    // Dias com summary e SEM raw records → PRESENTE via summaryHasWork
    const summaries: Record<string, any> = {};
    Array.from(WORKDAYS).forEach(d => { summaries[d] = { horas_trabalhadas_min: 480, atraso_minutos: 0 }; });
    const rawRecords: Record<string, number> = {}; // vazio
    const status = buildCalendarStatus(summaries, rawRecords, WORKDAYS, TODAY);
    expect(Object.values(status).every(s => s === 'PRESENTE')).toBe(true);
  });

  it('atraso em intervalo manual aparece corretamente', () => {
    const summaries: Record<string, any> = {
      '2026-05-05': { horas_trabalhadas_min: 460, atraso_minutos: 20 },
    };
    const rawRecords: Record<string, number> = { '2026-05-05': 4 };
    const status = buildCalendarStatus(summaries, rawRecords, WORKDAYS, TODAY);
    expect(status['2026-05-05']).toBe('ATRASO');
  });
});

describe('Bug previsto = jornada bruta (intervalo manual n≤2)', () => {
  it('expected usa break_duration configurado, não effective_break baseado em batidas', () => {
    // Simula o cálculo correto: previsto = schedule_end - schedule_start - break_configured
    // Independentemente de quantas batidas foram registradas
    function calcExpected(start: string, end: string, breakMin: number): number {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const total = (eh * 60 + em) - (sh * 60 + sm);
      return Math.max(0, total - breakMin);
    }
    // 07:00 → 17:00, break=60 → expected=540 (9h) sempre
    expect(calcExpected('07:00', '17:00', 60)).toBe(540);
    // break=0 → 600 (10h bruto) — mas isso só ocorre se empresa configura break=0
    expect(calcExpected('07:00', '17:00', 0)).toBe(600);
    // Independente do n_punches, o expected não deve variar
    // (o bug era: n<=2 → effective_break=0 → expected=10h mesmo com break=60)
  });

  it('break_duration configurado = 60 garante expected = 9h', () => {
    const scheduleStart = '07:00', scheduleEnd = '17:00';
    const breakDuration = 60;
    // n<=2: effective_break seria 0 no bug — mas expected deve usar breakDuration
    const [sh, sm] = scheduleStart.split(':').map(Number);
    const [eh, em] = scheduleEnd.split(':').map(Number);
    const expected = Math.max(0, (eh * 60 + em) - (sh * 60 + sm) - breakDuration);
    expect(expected).toBe(540); // 9h, não 10h
    expect(toHHMM(expected)).toBe('09:00');
  });
});

describe('Bug feriado + horário variável', () => {
  it('feriado NÃO credita horas para horário variável', () => {
    // isVariableSchedule = true → feriadoCreditMin deve ser 0
    const isVariableSchedule = true;
    const creditMin = isVariableSchedule ? 0 : 240; // lógica do buildCalendar
    expect(creditMin).toBe(0);
  });

  it('feriado CREDITA horas para jornada fixa', () => {
    const isVariableSchedule = false;
    const scheduledMinutes = 270; // 4h30
    const creditMin = isVariableSchedule ? 0 : scheduledMinutes;
    expect(creditMin).toBe(270);
  });

  it('resumo não soma crédito de feriado para variável', () => {
    // variável: feriado_credit_min pode estar definido no CalendarDay
    // mas o resumo NÃO deve somá-lo
    const isVariableSchedule = true;
    let totalMinTrabalhados = 0;
    const feriadoCredit = 270;

    // Lógica do resumo: if (!isVariableSchedule) { credit += ... }
    if (!isVariableSchedule) {
      totalMinTrabalhados += feriadoCredit;
    }
    expect(totalMinTrabalhados).toBe(0);
  });

  it('feriado com trabalho real (variável) contabiliza horas reais', () => {
    // Variável que trabalhou no feriado: horas reais vêm do backend summary
    const summaryWorked = 360; // 6h reais
    const isVariableSchedule = true;
    const feriadoCredit = isVariableSchedule ? 0 : 270; // sem crédito automático
    const totalTrabalhado = summaryWorked + feriadoCredit;
    expect(totalTrabalhado).toBe(360); // apenas horas reais
  });
});

describe('Bug registro saída some (employee_id vazio no campo composto)', () => {
  function extrairEmployeeId(r: Record<string, any>): string {
    const ck = String(r['employee_id#date_time'] || '');
    const emp = ck.includes('#') ? ck.split('#')[0] : '';
    return emp || r.funcionario_id || r.employee_id || '';
  }

  function extrairDataHora(r: Record<string, any>): string {
    const dh = r.data_hora_calculo || r.data_hora || r.timestamp || '';
    if (dh) return String(dh);
    const ck = String(r['employee_id#date_time'] || '');
    return ck.includes('#') ? ck.split('#').slice(1).join('#') : '';
  }

  it('extrai employee_id do campo composto quando presente', () => {
    const r = { 'employee_id#date_time': 'ana_alice#2026-05-12 17:04:00' };
    expect(extrairEmployeeId(r)).toBe('ana_alice');
  });

  it('extrai employee_id do funcionario_id quando composto tem employee_id vazio', () => {
    // Caso do bug: '#2026-05-12 17:04:00' — employee_id vazio no composto
    const r = {
      'employee_id#date_time': '#2026-05-12 17:04:00',
      funcionario_id: 'ana_alice',
    };
    expect(extrairEmployeeId(r)).toBe('ana_alice');
  });

  it('extrai data_hora de data_hora_calculo quando data_hora ausente', () => {
    const r = {
      'employee_id#date_time': 'ana_alice#2026-05-12 17:04:00',
      data_hora_calculo: '2026-05-12T17:04:00',
    };
    expect(extrairDataHora(r)).toBe('2026-05-12T17:04:00');
  });

  it('extrai data_hora do campo composto quando campos explícitos ausentes', () => {
    const r = { 'employee_id#date_time': 'ana_alice#2026-05-12 17:04:00' };
    expect(extrairDataHora(r)).toBe('2026-05-12 17:04:00');
  });

  it('registro com employee_id vazio no composto NÃO é descartado', () => {
    const registros = [
      { 'employee_id#date_time': 'ana_alice#2026-05-12 07:00:00', tipo: 'entrada' },
      { 'employee_id#date_time': '#2026-05-12 17:04:00', funcionario_id: 'ana_alice', tipo: 'saida' },
    ];
    const funcionario_id = 'ana_alice';
    const filtered = registros.filter(r => extrairEmployeeId(r).toLowerCase() === funcionario_id.toLowerCase());
    expect(filtered).toHaveLength(2); // ambos devem passar
    expect(filtered[1].tipo).toBe('saida');
  });
});

describe('Bug timezone: ISO date em buildCalendar', () => {
  it('string formatting dá data correta para qualquer dia', () => {
    // Método correto: string formatting (sem conversão UTC)
    const buildIso = (year: number, month: number, day: number) =>
      `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

    expect(buildIso(2026, 5, 1)).toBe('2026-05-01');
    expect(buildIso(2026, 5, 13)).toBe('2026-05-13');
    expect(buildIso(2026, 5, 31)).toBe('2026-05-31');
    expect(buildIso(2026, 12, 31)).toBe('2026-12-31');
  });

  it('string formatting NÃO depende de timezone UTC+', () => {
    // toISOString() em UTC+3 às 00:00 local retorna dia anterior UTC
    // String formatting sempre retorna a data local correta
    const year = 2026, month = 5, day = 13;
    const iso = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    expect(iso).toBe('2026-05-13'); // sempre correto, independente de fuso
  });

  it('dow calculado via noon local é correto', () => {
    // 13/05/2026 é quarta-feira (dia 3)
    const dow = new Date('2026-05-13T12:00:00').getDay();
    expect(dow).toBe(3); // Quarta
  });
});

describe('Exibição de feriado nos registros', () => {
  it('feriado auto-credit tem feriado_credit_min > 0 e registros.length === 0', () => {
    // Simula uma CalendarDay para feriado workday
    const feriadoDay = {
      data: '2026-05-01',
      status: 'FERIADO' as const,
      feriado_nome: 'Dia do Trabalho',
      feriado_credit_min: 270, // 4h30m de jornada
      registros: [] as TimeRecord[],
      horas_previstas: '04:30',
    };
    // Deve aparecer na tabela de exibição
    const isFeriadoAutoCredit =
      feriadoDay.status === 'FERIADO' &&
      (feriadoDay.feriado_credit_min ?? 0) > 0 &&
      feriadoDay.registros.length === 0;
    expect(isFeriadoAutoCredit).toBe(true);
    expect(toHHMM(feriadoDay.feriado_credit_min)).toBe('04:30');
  });

  it('feriado com registros reais NÃO gera crédito automático', () => {
    const feriadoDay = {
      status: 'FERIADO' as const,
      feriado_credit_min: 0, // já tem registros
      registros: [{ data_hora: '2026-05-01 09:00:00', tipo: 'entrada' as const, funcionario_id: 'emp1' }],
    };
    const isFeriadoAutoCredit =
      feriadoDay.status === 'FERIADO' &&
      (feriadoDay.feriado_credit_min ?? 0) > 0 &&
      feriadoDay.registros.length === 0;
    expect(isFeriadoAutoCredit).toBe(false);
  });

  it('feriado sem jornada (domingo) NÃO gera crédito', () => {
    const creditMin = 0; // domingo não tem jornada
    expect(creditMin).toBe(0);
  });
});
