/**
 * Logger central. Console + persistência opcional no SQLite (logs table).
 * Hot path NÃO grava no SQLite — handler delegado ao logRepository
 * para evitar require cycles.
 */
import { Config } from './config';
import type { LogLevel } from '@/types/domain';

type PersistFn = (level: LogLevel, message: string, context?: string) => void;

let persist: PersistFn | null = null;

export function setLogPersister(fn: PersistFn | null) {
  persist = fn;
}

function emit(level: LogLevel, tag: string, msg: string, extra?: unknown) {
  const cfg = Config.load();
  if (level === 'DEBUG' && !cfg.debugLogs) return;

  const line = `[${level}] [${tag}] ${msg}`;
  if (level === 'ERROR') console.error(line, extra ?? '');
  else if (level === 'WARN') console.warn(line, extra ?? '');
  else console.log(line, extra ?? '');

  if (persist) {
    try {
      const ctx = extra === undefined ? undefined : safeStringify(extra);
      persist(level, `[${tag}] ${msg}`, ctx);
    } catch {
      // ignore
    }
  }
}

function safeStringify(v: unknown): string {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export const logger = {
  debug: (tag: string, msg: string, extra?: unknown) => emit('DEBUG', tag, msg, extra),
  info: (tag: string, msg: string, extra?: unknown) => emit('INFO', tag, msg, extra),
  warn: (tag: string, msg: string, extra?: unknown) => emit('WARN', tag, msg, extra),
  error: (tag: string, msg: string, extra?: unknown) => emit('ERROR', tag, msg, extra),
};
