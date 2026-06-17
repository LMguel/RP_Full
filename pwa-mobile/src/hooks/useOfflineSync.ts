import { useState, useEffect, useCallback, useRef } from 'react';
import { syncPendingRecords, scheduleDebouncedSync, type SyncResult } from '../services/offline/syncService';
import { getPendingCount } from '../services/offline/offlineQueue';
import { useConnectivity } from './useConnectivity';
import { useBackendStatus } from './useBackendStatus';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface OfflineSyncState {
  isOnline: boolean;
  backendAvailable: boolean;
  pendingCount: number;
  syncStatus: SyncStatus;
  lastSyncResult: SyncResult | null;
  triggerSync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

export function useOfflineSync(): OfflineSyncState {
  const isOnline = useConnectivity();
  const backendAvailable = useBackendStatus(12000);
  const prevOnline = useRef(isOnline);
  const prevBackend = useRef(backendAvailable);
  const syncLock = useRef(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncLock.current) return;
    const count = await getPendingCount();
    if (count === 0) return;
    syncLock.current = true;
    setSyncStatus('syncing');
    try {
      const result = await syncPendingRecords();
      setLastSyncResult(result);
      setSyncStatus(result.failed > 0 ? 'error' : 'synced');
      await refreshPendingCount();
      // Marca timestamp da última sync para o heartbeat de telemetria
      if (result.synced > 0) {
        localStorage.setItem('@kiosk:last_sync', new Date().toISOString());
      }
      setTimeout(() => setSyncStatus('idle'), 5000);
    } catch {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
    } finally {
      syncLock.current = false;
    }
  }, [refreshPendingCount]);

  // Auto-sync when network connectivity is restored
  useEffect(() => {
    if (isOnline && !prevOnline.current) {
      triggerSync();
    }
    prevOnline.current = isOnline;
  }, [isOnline, triggerSync]);

  // Auto-sync (with debounce) when backend becomes available again
  useEffect(() => {
    if (backendAvailable && !prevBackend.current) {
      scheduleDebouncedSync(triggerSync);
    }
    prevBackend.current = backendAvailable;
  }, [backendAvailable, triggerSync]);

  // Poll pending count every 30s
  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 30000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  return { isOnline, backendAvailable, pendingCount, syncStatus, lastSyncResult, triggerSync, refreshPendingCount };
}
