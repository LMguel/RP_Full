/**
 * KioskService - bridge para o módulo nativo Android (KioskModule).
 * O módulo nativo expõe:
 *   - startLockTask()  -> ativa screen pinning (lock task mode)
 *   - stopLockTask()   -> sai do pinning
 *   - isLocked()       -> bool
 *   - setBootStartEnabled(boolean)
 *   - setKeepAwake(boolean)
 *   - watchdogPing()   -> reinicia activity caso saída detectada
 *
 * Em iOS / dev sem módulo nativo, faz no-op com logs.
 */
import { NativeModules, Platform } from 'react-native';
import { logger } from '@utils/logger';
import { useKioskStore } from './kioskStore';

interface NativeKiosk {
  startLockTask(): Promise<boolean>;
  stopLockTask(): Promise<boolean>;
  isLocked(): Promise<boolean>;
  setBootStartEnabled(enabled: boolean): Promise<void>;
  setKeepAwake(enabled: boolean): Promise<void>;
  watchdogPing(): Promise<void>;
  isDeviceOwner(): Promise<boolean>;
}

const native: NativeKiosk | null =
  Platform.OS === 'android' && (NativeModules as Record<string, unknown>).KioskModule
    ? (NativeModules as Record<string, NativeKiosk>).KioskModule
    : null;

export const KioskService = {
  async start(): Promise<boolean> {
    if (!native) {
      logger.warn('Kiosk', 'Native module ausente (modo dev). Kiosk simulado.');
      useKioskStore.getState().setEnabled(true);
      useKioskStore.getState().setLocked(false);
      return true;
    }
    try {
      const ok = await native.startLockTask();
      useKioskStore.getState().setEnabled(true);
      useKioskStore.getState().setLocked(ok);
      logger.info('Kiosk', `startLockTask -> ${ok}`);
      return ok;
    } catch (e) {
      logger.error('Kiosk', 'startLockTask falhou', e);
      return false;
    }
  },

  async stop(): Promise<void> {
    if (!native) {
      useKioskStore.getState().setEnabled(false);
      useKioskStore.getState().setLocked(false);
      return;
    }
    try {
      await native.stopLockTask();
    } catch (e) {
      logger.warn('Kiosk', 'stopLockTask falhou', e);
    } finally {
      useKioskStore.getState().setEnabled(false);
      useKioskStore.getState().setLocked(false);
    }
  },

  async isLocked(): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.isLocked();
    } catch {
      return false;
    }
  },

  async setBootStartEnabled(enabled: boolean): Promise<void> {
    if (!native) return;
    try {
      await native.setBootStartEnabled(enabled);
    } catch (e) {
      logger.warn('Kiosk', 'setBootStartEnabled falhou', e);
    }
  },

  async setKeepAwake(enabled: boolean): Promise<void> {
    if (!native) return;
    try {
      await native.setKeepAwake(enabled);
    } catch (e) {
      logger.warn('Kiosk', 'setKeepAwake falhou', e);
    }
  },

  async watchdog(): Promise<void> {
    if (!native) return;
    try {
      await native.watchdogPing();
    } catch {
      // ignore
    }
  },

  async isDeviceOwner(): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.isDeviceOwner();
    } catch {
      return false;
    }
  },
};
