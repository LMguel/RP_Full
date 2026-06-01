import { execute, rowsToArray } from '@database/sqlite';
import type { TimeRecord } from '@/types/domain';
import { uuid, timeRecordClientId } from '@utils/id';
import { nowIso } from '@utils/time';

interface TimeRecordRow {
  id: string;
  employee_id: string;
  company_id: string;
  timestamp: string;
  tipo: string | null;
  metodo: string;
  similarity: number | null;
  device_id: string;
  offline: number;
  synced: number;
  status: string;
  remote_id: string | null;
  client_id: string | null;
  created_at: string;
}

interface CreateTimeRecordInput {
  employee_id: string;
  company_id: string;
  timestamp?: string;
  tipo?: TimeRecord['tipo'];
  metodo: TimeRecord['metodo'];
  similarity?: number;
  device_id: string;
  offline: boolean;
}

function rowToRecord(r: TimeRecordRow): TimeRecord {
  return {
    id: r.id,
    employee_id: r.employee_id,
    company_id: r.company_id,
    timestamp: r.timestamp,
    tipo: r.tipo as TimeRecord['tipo'],
    metodo: r.metodo as TimeRecord['metodo'],
    similarity: r.similarity ?? undefined,
    device_id: r.device_id,
    offline: r.offline === 1,
    synced: r.synced === 1,
    status: r.status as TimeRecord['status'],
    remote_id: r.remote_id ?? undefined,
    created_at: r.created_at,
  };
}

export const TimeRecordRepository = {
  async create(input: CreateTimeRecordInput): Promise<TimeRecord> {
    const ts = input.timestamp ?? nowIso();
    const tsDate = new Date(ts);
    const record: TimeRecord & { client_id: string } = {
      id: uuid(),
      employee_id: input.employee_id,
      company_id: input.company_id,
      timestamp: ts,
      tipo: input.tipo,
      metodo: input.metodo,
      similarity: input.similarity,
      device_id: input.device_id,
      offline: input.offline,
      synced: false,
      status: 'ATIVO',
      created_at: nowIso(),
      client_id: timeRecordClientId(input.employee_id, tsDate),
    };

    await execute(
      `INSERT INTO time_records
       (id, employee_id, company_id, timestamp, tipo, metodo, similarity,
        device_id, offline, synced, status, remote_id, client_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(client_id) DO NOTHING`,
      [
        record.id,
        record.employee_id,
        record.company_id,
        record.timestamp,
        record.tipo ?? null,
        record.metodo,
        record.similarity ?? null,
        record.device_id,
        record.offline ? 1 : 0,
        record.synced ? 1 : 0,
        record.status,
        record.remote_id ?? null,
        record.client_id,
        record.created_at,
      ],
    );

    return record;
  },

  async markSynced(id: string, remoteId?: string): Promise<void> {
    await execute(
      `UPDATE time_records SET synced = 1, remote_id = ? WHERE id = ?`,
      [remoteId ?? null, id],
    );
  },

  async listPending(limit = 50): Promise<(TimeRecord & { client_id: string })[]> {
    const res = await execute(
      `SELECT * FROM time_records WHERE synced = 0 ORDER BY created_at ASC LIMIT ?`,
      [limit],
    );
    return rowsToArray<TimeRecordRow>(res).map(r => ({
      ...rowToRecord(r),
      client_id: r.client_id ?? '',
    }));
  },

  async listToday(employeeId: string): Promise<TimeRecord[]> {
    const today = new Date().toISOString().slice(0, 10);
    const res = await execute(
      `SELECT * FROM time_records
       WHERE employee_id = ? AND substr(timestamp, 1, 10) = ?
       ORDER BY timestamp DESC`,
      [employeeId, today],
    );
    return rowsToArray<TimeRecordRow>(res).map(rowToRecord);
  },

  async lastForEmployee(employeeId: string): Promise<TimeRecord | null> {
    const res = await execute(
      `SELECT * FROM time_records WHERE employee_id = ? ORDER BY timestamp DESC LIMIT 1`,
      [employeeId],
    );
    const row = rowsToArray<TimeRecordRow>(res)[0];
    return row ? rowToRecord(row) : null;
  },

  async countPending(): Promise<number> {
    const res = await execute('SELECT COUNT(*) as c FROM time_records WHERE synced = 0');
    return Number(res.rows.item(0)?.c ?? 0);
  },
};
