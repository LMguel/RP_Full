import { execute, rowsToArray } from '@database/sqlite';
import type { DeviceConfig } from '@/types/domain';
import { nowIso } from '@utils/time';

interface DeviceConfigRow {
  device_id: string;
  company_id: string;
  kiosk_enabled: number;
  similarity_threshold: number;
  use_cloud_fallback: number;
  sync_interval_ms: number;
  updated_at: string;
}

function rowToConfig(r: DeviceConfigRow): DeviceConfig {
  return {
    device_id: r.device_id,
    company_id: r.company_id,
    kiosk_enabled: r.kiosk_enabled === 1,
    similarity_threshold: r.similarity_threshold,
    use_cloud_fallback: r.use_cloud_fallback === 1,
    sync_interval_ms: r.sync_interval_ms,
    updated_at: r.updated_at,
  };
}

export const DeviceConfigRepository = {
  async upsert(c: DeviceConfig): Promise<void> {
    await execute(
      `INSERT INTO device_config (device_id, company_id, kiosk_enabled, similarity_threshold, use_cloud_fallback, sync_interval_ms, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         company_id=excluded.company_id,
         kiosk_enabled=excluded.kiosk_enabled,
         similarity_threshold=excluded.similarity_threshold,
         use_cloud_fallback=excluded.use_cloud_fallback,
         sync_interval_ms=excluded.sync_interval_ms,
         updated_at=excluded.updated_at`,
      [
        c.device_id,
        c.company_id,
        c.kiosk_enabled ? 1 : 0,
        c.similarity_threshold,
        c.use_cloud_fallback ? 1 : 0,
        c.sync_interval_ms,
        c.updated_at ?? nowIso(),
      ],
    );
  },

  async get(deviceId: string): Promise<DeviceConfig | null> {
    const res = await execute('SELECT * FROM device_config WHERE device_id = ? LIMIT 1', [
      deviceId,
    ]);
    const row = rowsToArray<DeviceConfigRow>(res)[0];
    return row ? rowToConfig(row) : null;
  },
};
