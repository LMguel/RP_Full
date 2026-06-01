import { create } from 'zustand';

interface SyncState {
  pendingCount: number;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  setPendingCount: (n: number) => void;
  setOnline: (v: boolean) => void;
  setSyncing: (v: boolean) => void;
  setLastSync: (ts: string) => void;
  setLastError: (e: string | null) => void;
}

export const useSyncStore = create<SyncState>(set => ({
  pendingCount: 0,
  isOnline: true,
  isSyncing: false,
  lastSyncAt: null,
  lastError: null,
  setPendingCount: n => set({ pendingCount: n }),
  setOnline: v => set({ isOnline: v }),
  setSyncing: v => set({ isSyncing: v }),
  setLastSync: ts => set({ lastSyncAt: ts }),
  setLastError: e => set({ lastError: e }),
}));
