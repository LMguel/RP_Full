import { execute, rowsToArray } from '@database/sqlite';
import type { SyncQueueItem, SyncOpType, SyncStatus } from '@/types/domain';
import { uuid } from '@utils/id';
import { nowIso, exponentialBackoffMs } from '@utils/time';

interface SyncQueueRow {
  id: string;
  type: string;
  payload: string;
  status: string;
  retries: number;
  last_error: string | null;
  next_attempt_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToItem(r: SyncQueueRow): SyncQueueItem {
  return {
    id: r.id,
    type: r.type as SyncOpType,
    payload: r.payload,
    status: r.status as SyncStatus,
    retries: r.retries,
    last_error: r.last_error ?? undefined,
    next_attempt_at: r.next_attempt_at ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export const SyncQueueRepository = {
  async enqueue(type: SyncOpType, payload: unknown): Promise<SyncQueueItem> {
    const item: SyncQueueItem = {
      id: uuid(),
      type,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      status: 'PENDING',
      retries: 0,
      next_attempt_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await execute(
      `INSERT INTO sync_queue (id, type, payload, status, retries, last_error, next_attempt_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.type,
        item.payload,
        item.status,
        item.retries,
        null,
        item.next_attempt_at ?? null,
        item.created_at,
        item.updated_at,
      ],
    );
    return item;
  },

  async listReady(limit = 20): Promise<SyncQueueItem[]> {
    const now = nowIso();
    const res = await execute(
      `SELECT * FROM sync_queue
       WHERE status IN ('PENDING','FAILED')
         AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
       ORDER BY created_at ASC
       LIMIT ?`,
      [now, limit],
    );
    return rowsToArray<SyncQueueRow>(res).map(rowToItem);
  },

  async markInFlight(id: string): Promise<void> {
    await execute(
      `UPDATE sync_queue SET status = 'IN_FLIGHT', updated_at = ? WHERE id = ?`,
      [nowIso(), id],
    );
  },

  async markDone(id: string): Promise<void> {
    await execute(`DELETE FROM sync_queue WHERE id = ?`, [id]);
  },

  async markFailed(id: string, retries: number, error: string): Promise<void> {
    const next = new Date(Date.now() + exponentialBackoffMs(retries)).toISOString();
    await execute(
      `UPDATE sync_queue
       SET status = 'FAILED', retries = ?, last_error = ?, next_attempt_at = ?, updated_at = ?
       WHERE id = ?`,
      [retries, error.slice(0, 500), next, nowIso(), id],
    );
  },

  async countPending(): Promise<number> {
    const res = await execute(
      `SELECT COUNT(*) as c FROM sync_queue WHERE status IN ('PENDING','FAILED')`,
    );
    return Number(res.rows.item(0)?.c ?? 0);
  },

  async clear(): Promise<void> {
    await execute(`DELETE FROM sync_queue`);
  },
};
