// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrint } from '../usePrint';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('usePrint', () => {
  it('reveals lines one by one, then is done', () => {
    const { result } = renderHook(() => usePrint(6, 8));
    expect(result.current.shown).toBe(0);
    expect(result.current.done).toBe(false);
    act(() => { vi.advanceTimersByTime(140); });
    expect(result.current.shown).toBe(1);
    act(() => { vi.advanceTimersByTime(140 * 5); });
    expect(result.current.shown).toBe(6);
    expect(result.current.done).toBe(true);
  });
  it('finish shows everything at once', () => {
    const { result } = renderHook(() => usePrint(6, 8));
    act(() => { result.current.finish(); });
    expect(result.current.shown).toBe(6);
    expect(result.current.done).toBe(true);
  });
  it('does not restart for the same key', () => {
    const { result, rerender } = renderHook(({ k }) => usePrint(6, k), { initialProps: { k: 8 } });
    act(() => { result.current.finish(); });
    rerender({ k: 8 });
    expect(result.current.done).toBe(true);
  });
  it('restarts for a new hand', () => {
    const { result, rerender } = renderHook(({ k }) => usePrint(6, k), { initialProps: { k: 8 } });
    act(() => { result.current.finish(); });
    rerender({ k: 9 });
    act(() => {});
    expect(result.current.done).toBe(false);
  });
  it('reduced motion prints instantly', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
    const { result } = renderHook(() => usePrint(6, 8));
    expect(result.current.done).toBe(true);
  });
});
