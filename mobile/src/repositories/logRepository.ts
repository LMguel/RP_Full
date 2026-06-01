import { execute, rowsToArray } from '@database/sqlite';
import type { LogEntry, LogLevel } from '@/types/domain';
import { uuid } from '@utils/id';
import { nowIso } from '@utils/time';

interface LogRow {
  id: string;
  level: string;
  message: string;
  context: string | null;
  created_at: string;
}

const MAX_LOGS = 5000;

export const LogRepository = {
  async append(level: LogLevel, message: string, context?: string): Promise<void> {
    await execute(
      `INSERT INTO logs (id, level, message, context, created_at) VALUES (?, ?, ?, ?, ?)`,
      [uuid(), level, message.slice(0, 1000), context?.slice(0, 2000) ?? null, nowIso()],
    );
  },

  async list(limit = 200): Promise<LogEntry[]> {
    const res = await execute(
      `SELECT * FROM logs ORDER BY created_at DESC LIMIT ?`,
      [limit],
    );
    return rowsToArray<LogRow>(res).map(r => ({
      id: r.id,
      level: r.level as LogLevel,
      message: r.message,
      context: r.context ?? undefined,
      created_at: r.created_at,
    }));
  },

  async prune(): Promise<void> {
    await execute(
      `DELETE FROM logs WHERE id NOT IN (
         SELECT id FROM logs ORDER BY created_at DESC LIMIT ?
       )`,
      [MAX_LOGS],
    );
  },

  async clear(): Promise<void> {
    await execute(`DELETE FROM logs`);
  },
};
