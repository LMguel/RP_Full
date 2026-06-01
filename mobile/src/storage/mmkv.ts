import { MMKV } from 'react-native-mmkv';

/**
 * Storage rápido (não-crítico). Para tokens use SecureStorage (Keychain).
 */
export const storage = new MMKV({
  id: 'registra-ponto-v1',
  encryptionKey: 'rp-mmkv-key-rotate-on-deploy',
});
