import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import {
  useKioskSleep,
  KIOSK_ACTIVE_START_HOUR,
  KIOSK_ACTIVE_END_HOUR,
  SLEEP_IDLE_TIMEOUT_MS,
} from '../hooks/useKioskSleep';

// getSaoPauloDateTime() calcula a hora de SP a partir do instante UTC real, então
// para simular uma hora local de SP basta fixar o relógio do sistema em UTC+3h.
function setUtcTimeForSpHour(spHour: number, spMinute = 0) {
  const utcHour = (spHour + 3) % 24;
  const iso = `2026-08-10T${String(utcHour).padStart(2, '0')}:${String(spMinute).padStart(2, '0')}:00.000Z`;
  vi.setSystemTime(new Date(iso));
}

describe('useKioskSleep', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    localStorage.removeItem('@kiosk:morning_wake_date');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('começa dormindo fora da janela ativa (ex: 22h)', () => {
    setUtcTimeForSpHour(22);
    const { result } = renderHook(() => useKioskSleep());
    expect(result.current.asleep).toBe(true);
  });

  it('começa acordado dentro da janela ativa (ex: 10h)', () => {
    setUtcTimeForSpHour(10);
    const { result } = renderHook(() => useKioskSleep());
    expect(result.current.asleep).toBe(false);
  });

  it('wake() acorda imediatamente durante o repouso', () => {
    setUtcTimeForSpHour(22);
    const { result } = renderHook(() => useKioskSleep());
    expect(result.current.asleep).toBe(true);

    act(() => { result.current.wake('touch'); });
    expect(result.current.asleep).toBe(false);
  });

  it('volta a dormir sozinho após o timeout de inatividade', () => {
    setUtcTimeForSpHour(22);
    const { result } = renderHook(() => useKioskSleep());

    act(() => { result.current.wake('touch'); });
    expect(result.current.asleep).toBe(false);

    act(() => { vi.advanceTimersByTime(SLEEP_IDLE_TIMEOUT_MS + 1000); });
    expect(result.current.asleep).toBe(true);
  });

  it('nova chamada a wake() adia o re-repouso', () => {
    setUtcTimeForSpHour(22);
    const { result } = renderHook(() => useKioskSleep());

    act(() => { result.current.wake('touch'); });
    act(() => { vi.advanceTimersByTime(SLEEP_IDLE_TIMEOUT_MS - 1000); });
    expect(result.current.asleep).toBe(false);

    // atividade renova o timer antes de expirar
    act(() => { result.current.wake('activity'); });
    act(() => { vi.advanceTimersByTime(SLEEP_IDLE_TIMEOUT_MS - 1000); });
    expect(result.current.asleep).toBe(false);

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.asleep).toBe(true);
  });

  it('acorda sozinho ao cruzar o início da janela ativa (6h)', () => {
    setUtcTimeForSpHour(KIOSK_ACTIVE_START_HOUR - 1, 59);
    const { result } = renderHook(() => useKioskSleep());
    expect(result.current.asleep).toBe(true);

    setUtcTimeForSpHour(KIOSK_ACTIVE_START_HOUR, 0);
    act(() => { vi.advanceTimersByTime(61 * 1000); });
    expect(result.current.asleep).toBe(false);
  });

  it('dorme sozinho ao cruzar o fim da janela ativa (19h)', () => {
    setUtcTimeForSpHour(KIOSK_ACTIVE_END_HOUR - 1, 59);
    const { result } = renderHook(() => useKioskSleep());
    expect(result.current.asleep).toBe(false);

    setUtcTimeForSpHour(KIOSK_ACTIVE_END_HOUR, 0);
    act(() => { vi.advanceTimersByTime(61 * 1000); });
    expect(result.current.asleep).toBe(true);
  });

  it('chama onMorningWake uma única vez ao cruzar as 6h', () => {
    setUtcTimeForSpHour(KIOSK_ACTIVE_START_HOUR, 0);
    const onMorningWake = vi.fn();
    renderHook(() => useKioskSleep({ onMorningWake }));
    expect(onMorningWake).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(61 * 1000); });
    expect(onMorningWake).toHaveBeenCalledTimes(1); // não repete no mesmo dia
  });
});
