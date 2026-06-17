import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSessionTimeout, renewSession } from '../hooks/useSessionTimeout';

describe('useSessionTimeout', () => {
  beforeEach(() => {
    localStorage.removeItem('@app:session_expires');
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem('@app:session_expires');
  });

  it('agenda timer e chama onExpire quando o tempo expira', () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    renderHook(() => useSessionTimeout('funcionario', onExpire));

    act(() => { vi.advanceTimersByTime(8 * 60 * 60 * 1000 + 1000); });
    expect(onExpire).toHaveBeenCalledTimes(1);

    cleanup();
    vi.useRealTimers();
  });

  it('não chama onExpire antes do timeout', () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    renderHook(() => useSessionTimeout('funcionario', onExpire));

    act(() => { vi.advanceTimersByTime(7 * 60 * 60 * 1000); });
    expect(onExpire).not.toHaveBeenCalled();

    cleanup();
    vi.useRealTimers();
  });

  it('não agenda timer quando userType é null', () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    renderHook(() => useSessionTimeout(null, onExpire));

    act(() => { vi.advanceTimersByTime(24 * 60 * 60 * 1000); });
    expect(onExpire).not.toHaveBeenCalled();

    cleanup();
    vi.useRealTimers();
  });

  it('chama onExpire imediatamente se sessão já expirou no localStorage', () => {
    const expired = String(Date.now() - 3_600_000);
    localStorage.setItem('@app:session_expires', expired);

    const onExpire = vi.fn();
    renderHook(() => useSessionTimeout('empresa', onExpire));
    // onExpire é chamado de forma síncrona dentro do useEffect
    act(() => {});
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('renewSession estende o tempo de sessão', () => {
    const before = Date.now();
    renewSession('empresa');
    const stored = parseInt(localStorage.getItem('@app:session_expires') || '0', 10);
    expect(stored).toBeGreaterThan(before + 11 * 60 * 60 * 1000);
  });
});
