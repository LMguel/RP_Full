import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStableOffline } from '../hooks/useStableOffline';

describe('useStableOffline', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('entra no offline imediatamente', () => {
    const { result, rerender } = renderHook(({ raw }) => useStableOffline(raw, 60_000), { initialProps: { raw: false } });
    expect(result.current).toBe(false);
    rerender({ raw: true });
    expect(result.current).toBe(true);
  });

  it('só sai do offline após o atraso de conexão estável', () => {
    const { result, rerender } = renderHook(({ raw }) => useStableOffline(raw, 60_000), { initialProps: { raw: true } });
    rerender({ raw: false });
    act(() => { vi.advanceTimersByTime(59_000); });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(result.current).toBe(false);
  });

  it('Wi-Fi oscilando mantém o offline sem alternar', () => {
    const { result, rerender } = renderHook(({ raw }) => useStableOffline(raw, 60_000), { initialProps: { raw: true } });
    for (let i = 0; i < 5; i++) {
      rerender({ raw: false });
      act(() => { vi.advanceTimersByTime(30_000); });
      expect(result.current).toBe(true);
      rerender({ raw: true });
      act(() => { vi.advanceTimersByTime(30_000); });
      expect(result.current).toBe(true);
    }
  });
});
