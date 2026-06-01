import { create } from 'zustand';

export type KioskFlow = 'IDLE' | 'DETECTING' | 'MATCHING' | 'CONFIRMED' | 'NOT_RECOGNIZED' | 'ERROR';

interface KioskState {
  enabled: boolean;
  locked: boolean;
  flow: KioskFlow;
  lastEmployeeName: string | null;
  lastSimilarity: number | null;
  lastError: string | null;
  setEnabled: (v: boolean) => void;
  setLocked: (v: boolean) => void;
  setFlow: (f: KioskFlow) => void;
  setLastResult: (name: string | null, similarity: number | null) => void;
  setLastError: (e: string | null) => void;
  reset: () => void;
}

export const useKioskStore = create<KioskState>(set => ({
  enabled: false,
  locked: false,
  flow: 'IDLE',
  lastEmployeeName: null,
  lastSimilarity: null,
  lastError: null,
  setEnabled: v => set({ enabled: v }),
  setLocked: v => set({ locked: v }),
  setFlow: f => set({ flow: f }),
  setLastResult: (name, similarity) =>
    set({ lastEmployeeName: name, lastSimilarity: similarity }),
  setLastError: e => set({ lastError: e }),
  reset: () =>
    set({
      flow: 'IDLE',
      lastEmployeeName: null,
      lastSimilarity: null,
      lastError: null,
    }),
}));
