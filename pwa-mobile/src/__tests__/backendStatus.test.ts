import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pingBackend } from '../hooks/useBackendStatus';

describe('backendStatus — pingBackend', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when navigator is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const result = await pingBackend();
    expect(result).toBe(false);
  });

  it('returns true when fetch succeeds', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('navigator', { onLine: true });

    const result = await pingBackend();
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('returns false when fetch throws (connection refused)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('ERR_CONNECTION_REFUSED'));
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('navigator', { onLine: true });

    const result = await pingBackend();
    expect(result).toBe(false);
  });

  it('uses cache-busting timestamp in URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('navigator', { onLine: true });

    await pingBackend();

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toMatch(/_p=\d+/);
  });

  it('uses no-store cache policy', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('navigator', { onLine: true });

    await pingBackend();

    const options = mockFetch.mock.calls[0][1] as RequestInit;
    expect(options.cache).toBe('no-store');
  });
});
