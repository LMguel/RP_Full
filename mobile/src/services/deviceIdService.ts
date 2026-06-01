/**
 * Serviço de DeviceID - identidade única e estável por tablet.
 * Combina hardware id + uuid persistido no keychain.
 */
import DeviceInfo from 'react-native-device-info';
import { uuid } from '@utils/id';
import { storage } from '@storage/mmkv';
import { SecureStorage } from '@storage/secureStorage';
import { logger } from '@utils/logger';

const DEVICE_ID_KEY = 'device_id_v1';

let cached: string | null = null;

export const DeviceIdService = {
  async ensure(): Promise<string> {
    if (cached) return cached;

    const fromMmkv = storage.getString(DEVICE_ID_KEY);
    if (fromMmkv) {
      cached = fromMmkv;
      return fromMmkv;
    }

    const fromKeychain = await SecureStorage.getDeviceSecret();
    if (fromKeychain?.deviceId) {
      storage.set(DEVICE_ID_KEY, fromKeychain.deviceId);
      cached = fromKeychain.deviceId;
      return fromKeychain.deviceId;
    }

    let hardware = '';
    try {
      hardware = await DeviceInfo.getUniqueId();
    } catch (e) {
      logger.warn('DeviceIdService', 'getUniqueId falhou', e);
    }
    const id = `tab-${hardware || ''}-${uuid()}`.replace(/--+/g, '-');

    storage.set(DEVICE_ID_KEY, id);
    try {
      await SecureStorage.setDeviceSecret(id, uuid());
    } catch (e) {
      logger.warn('DeviceIdService', 'persistência keychain falhou', e);
    }
    cached = id;
    return id;
  },

  async get(): Promise<string | null> {
    if (cached) return cached;
    const v = storage.getString(DEVICE_ID_KEY);
    if (v) cached = v;
    return cached;
  },

  async getModel(): Promise<string> {
    try {
      return `${await DeviceInfo.getManufacturer()} ${DeviceInfo.getModel()}`.trim();
    } catch {
      return 'unknown';
    }
  },
};
