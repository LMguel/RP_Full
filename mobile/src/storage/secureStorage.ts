/**
 * Wrapper sobre react-native-keychain.
 * Tokens JWT, credenciais e device_id sensíveis ficam aqui.
 */
import * as Keychain from 'react-native-keychain';
import { logger } from '@utils/logger';

const SERVICE_AUTH = 'rp.auth';
const SERVICE_DEVICE = 'rp.device';
const SERVICE_LOGIN = 'rp.login';

const KEYCHAIN_OPTS: Keychain.Options = {
  accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
  securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
};

export const SecureStorage = {
  async setAuthToken(token: string, companyId: string): Promise<void> {
    try {
      await Keychain.setGenericPassword(companyId, token, {
        ...KEYCHAIN_OPTS,
        service: SERVICE_AUTH,
      });
    } catch (e) {
      logger.error('SecureStorage', 'setAuthToken falhou', e);
      throw e;
    }
  },

  async getAuthToken(): Promise<{ token: string; companyId: string } | null> {
    try {
      const creds = await Keychain.getGenericPassword({ service: SERVICE_AUTH });
      if (!creds || creds === false) return null;
      return { token: creds.password, companyId: creds.username };
    } catch (e) {
      logger.error('SecureStorage', 'getAuthToken falhou', e);
      return null;
    }
  },

  async clearAuthToken(): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: SERVICE_AUTH });
    } catch (e) {
      logger.warn('SecureStorage', 'clearAuthToken falhou', e);
    }
  },

  async setDeviceSecret(deviceId: string, secret: string): Promise<void> {
    await Keychain.setGenericPassword(deviceId, secret, {
      ...KEYCHAIN_OPTS,
      service: SERVICE_DEVICE,
    });
  },

  async getDeviceSecret(): Promise<{ deviceId: string; secret: string } | null> {
    const creds = await Keychain.getGenericPassword({ service: SERVICE_DEVICE });
    if (!creds || creds === false) return null;
    return { deviceId: creds.username, secret: creds.password };
  },

  async saveLoginCredentials(usuario: string, senha: string): Promise<void> {
    try {
      await Keychain.setGenericPassword(usuario, senha, {
        ...KEYCHAIN_OPTS,
        service: SERVICE_LOGIN,
      });
    } catch (e) {
      logger.error('SecureStorage', 'saveLoginCredentials falhou', e);
    }
  },

  async getLoginCredentials(): Promise<{ usuario: string; senha: string } | null> {
    try {
      const creds = await Keychain.getGenericPassword({ service: SERVICE_LOGIN });
      if (!creds || creds === false) return null;
      return { usuario: creds.username, senha: creds.password };
    } catch (e) {
      logger.error('SecureStorage', 'getLoginCredentials falhou', e);
      return null;
    }
  },

  async clearLoginCredentials(): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: SERVICE_LOGIN });
    } catch (e) {
      logger.warn('SecureStorage', 'clearLoginCredentials falhou', e);
    }
  },
};
