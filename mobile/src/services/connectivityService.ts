/**
 * Listener global de conectividade.
 * Atualiza o syncStore e dispara sync quando volta online.
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useSyncStore } from '@features/sync/syncStore';
import { logger } from '@utils/logger';

type Listener = (online: boolean) => void;

let unsubscribe: (() => void) | null = null;
const listeners = new Set<Listener>();
let lastOnline: boolean | null = null;

function isOnline(state: NetInfoState): boolean {
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export const ConnectivityService = {
  start() {
    if (unsubscribe) return;

    unsubscribe = NetInfo.addEventListener(state => {
      const online = isOnline(state);
      if (online === lastOnline) return;
      lastOnline = online;

      logger.info('Connectivity', online ? 'Online' : 'Offline');
      useSyncStore.getState().setOnline(online);
      listeners.forEach(l => {
        try {
          l(online);
        } catch (e) {
          logger.warn('Connectivity', 'listener falhou', e);
        }
      });
    });

    NetInfo.fetch().then(state => {
      const online = isOnline(state);
      lastOnline = online;
      useSyncStore.getState().setOnline(online);
    });
  },

  stop() {
    unsubscribe?.();
    unsubscribe = null;
    listeners.clear();
    lastOnline = null;
  },

  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  async isOnline(): Promise<boolean> {
    const s = await NetInfo.fetch();
    return isOnline(s);
  },
};
