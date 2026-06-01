/**
 * Cliente HTTP central. Axios + interceptors:
 * - Bearer token automático (lê do auth store)
 * - device_id em header customizado
 * - retry transparente para 5xx/timeout via flag
 * - tratamento padronizado de erros
 */
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { Config } from '@utils/config';
import { logger } from '@utils/logger';

interface RetryConfig extends InternalAxiosRequestConfig {
  __retryCount?: number;
  __maxRetries?: number;
}

let authTokenProvider: () => string | null = () => null;
let deviceIdProvider: () => string | null = () => null;
let onUnauthorized: (() => void) | null = null;

export function configureAuthProvider(fn: () => string | null) {
  authTokenProvider = fn;
}

export function configureDeviceIdProvider(fn: () => string | null) {
  deviceIdProvider = fn;
}

export function configureUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

function makeClient(): AxiosInstance {
  const cfg = Config.load();
  const client = axios.create({
    baseURL: cfg.apiBaseUrl,
    timeout: cfg.apiTimeoutMs,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use(req => {
    const token = authTokenProvider();
    if (token) req.headers.Authorization = `Bearer ${token}`;

    const did = deviceIdProvider();
    if (did) req.headers['X-Device-Id'] = did;

    return req;
  });

  client.interceptors.response.use(
    res => res,
    async (error: AxiosError) => {
      const original = error.config as RetryConfig | undefined;
      const status = error.response?.status;

      if (status === 401 && onUnauthorized) {
        logger.warn('http', 'Token expirado/inválido. Disparando logout.');
        onUnauthorized();
        return Promise.reject(error);
      }

      const max = original?.__maxRetries ?? 0;
      const retried = original?.__retryCount ?? 0;
      const isNetwork = !error.response;
      const is5xx = !!status && status >= 500 && status < 600;

      if (original && retried < max && (isNetwork || is5xx)) {
        original.__retryCount = retried + 1;
        const wait = 500 * Math.pow(2, retried);
        logger.warn('http', `Retry ${retried + 1}/${max} em ${wait}ms (${error.message})`);
        await new Promise(r => setTimeout(r, wait));
        return client.request(original);
      }

      return Promise.reject(error);
    },
  );

  return client;
}

let client = makeClient();

export function rebuildHttpClient() {
  client = makeClient();
}

export function http(): AxiosInstance {
  return client;
}

export function withRetries<T extends AxiosRequestConfig>(cfg: T, max = 2): T & RetryConfig {
  return { ...(cfg as object), __maxRetries: max } as T & RetryConfig;
}

export function isOfflineError(e: unknown): boolean {
  const err = e as AxiosError;
  return !err?.response;
}
