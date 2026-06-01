import { create } from 'zustand';
import { Config, type RuntimeConfig } from '@utils/config';
import { rebuildHttpClient } from '@api/httpClient';

interface ConfigState {
  config: RuntimeConfig;
  refresh: () => void;
  update: (patch: Partial<RuntimeConfig>) => void;
  reset: () => void;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: Config.load(),

  refresh() {
    set({ config: Config.load() });
  },

  update(patch) {
    const next = Config.save(patch);
    set({ config: next });

    if (
      patch.apiBaseUrl !== undefined ||
      patch.apiTimeoutMs !== undefined
    ) {
      rebuildHttpClient();
    }
  },

  reset() {
    Config.reset();
    set({ config: Config.load() });
    rebuildHttpClient();
    void get;
  },
}));
