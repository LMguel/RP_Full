import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionTimeout, renewSession } from '../hooks/useSessionTimeout';

describe('useSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('@app:session_expires');
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem('@app:session_expires');
  });

  it('chama onExpire após o timeout configurado', async () => {
    const onExpire = vi.fn();
    renderHook(() => useSessionTimeout('funcionario', onExpire));

    // 8h em ms
    await act(() => { vi.advanceTimersByTime(8 * 60 * 60 * 1000 + 1000); });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('não chama onExpire antes do timeout', async () => {
    const onExpire = vi.fn();
    renderHook(() => useSessionTimeout('funcionario', onExpire));

    await act(() => { vi.advanceTimersByTime(7 * 60 * 60 * 1000); });
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('não agenda timer quando userType é null', () => {
    const onExpire = vi.fn();
    renderHook(() => useSessionTimeout(null, onExpire));
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('chama onExpire imediatamente se sessão já expirou no localStorage', async () => {
    // Simular sessão expirada há 1h
    localStorage.setItem('@app:session_expires', String(Date.now() - 3_600_000));
    const onExpire = vi.fn();
    renderHook(() => useSessionTimeout('empresa', onExpire));
    await act(() => Promise.resolve());
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('renewSession estende o tempo de sessão', () => {
    const before = Date.now();
    renewSession('empresa');
    const stored = parseInt(localStorage.getItem('@app:session_expires') || '0', 10);
    expect(stored).toBeGreaterThan(before + 11 * 60 * 60 * 1000); // > 11h a partir de agora
  });
});
