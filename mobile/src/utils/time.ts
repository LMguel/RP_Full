/**
 * Utilitários de tempo. Padroniza ISO 8601 com offset.
 */

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Formata Date no formato local America/Sao_Paulo (sem libs).
 * Ex: 2025-01-09 14:35:22
 */
export function formatLocalDateTime(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export function formatClockHM(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateLong(d: Date = new Date()): string {
  const dias = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  const meses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

export function exponentialBackoffMs(retries: number, baseMs = 2000, capMs = 5 * 60_000): number {
  const exp = baseMs * Math.pow(2, Math.max(0, retries));
  const jitter = Math.random() * baseMs;
  return Math.min(capMs, Math.floor(exp + jitter));
}
