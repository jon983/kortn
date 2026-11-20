// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMatchStream } from '../useMatchStream';

class FakeES {
  onmessage: ((e: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  static last: FakeES | null = null;
  static count = 0;
  constructor(public url: string) { FakeES.last = this; FakeES.count++; }
  close() { this.readyState = 2; }
}
beforeEach(() => { (globalThis as any).EventSource = FakeES as any; FakeES.count = 0; });
afterEach(() => { vi.useRealTimers(); });

describe('useMatchStream', () => {
  it('starts with initial and updates view on a state message', () => {
    const initial: any = { seat: 0, you: {}, currentTurn: 0, phase: 'awaitingDraw' };
    const { result } = renderHook(() => useMatchStream('m1', initial));
    expect(result.current.view.phase).toBe('awaitingDraw');
    act(() => { FakeES.last!.onmessage?.({ data: JSON.stringify({ ...initial, phase: 'awaitingDiscard' }) }); });
    expect(result.current.view.phase).toBe('awaitingDiscard');
  });

  it('collects chat messages separately from view', () => {
    const initial: any = { seat: 0, you: {}, currentTurn: 0, phase: 'awaitingDraw' };
    const { result } = renderHook(() => useMatchStream('m1', initial));
    act(() => { FakeES.last!.onmessage?.({ data: JSON.stringify({ type: 'chat', id: 'c1', seat: 1, body: 'hi', at: 't' }) }); });
    expect(result.current.chat).toEqual([{ id: 'c1', seat: 1, body: 'hi', at: 't' }]);
    expect(result.current.view.phase).toBe('awaitingDraw'); // unchanged
    // duplicate id ignored
    act(() => { FakeES.last!.onmessage?.({ data: JSON.stringify({ type: 'chat', id: 'c1', seat: 1, body: 'hi', at: 't' }) }); });
    expect(result.current.chat).toHaveLength(1);
  });

  it('reopens the stream after the browser gives up on it (e.g. a rejected reconnect)', async () => {
    vi.useFakeTimers();
    const initial: any = { seat: 0, you: {}, currentTurn: 0, phase: 'awaitingDraw' };
    const fetchView = vi.fn(async () => null);
    const { result } = renderHook(() => useMatchStream('m1', initial, [], { fetchView }));
    const first = FakeES.last!;
    act(() => { first.readyState = 1; first.onopen?.(); });
    expect(result.current.connected).toBe(true);
    act(() => { first.readyState = 2; first.onerror?.(); });
    expect(result.current.connected).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(FakeES.count).toBe(2);
    expect(FakeES.last).not.toBe(first);
    expect(fetchView).toHaveBeenCalled();
  });

  it('re-syncs the table when the tab becomes visible again', async () => {
    const initial: any = { seat: 0, you: {}, currentTurn: 0, phase: 'awaitingDraw' };
    const fresh: any = { ...initial, phase: 'awaitingDiscard' };
    const fetchView = vi.fn(async () => fresh);
    const { result } = renderHook(() => useMatchStream('m1', initial, [], { fetchView }));
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); });
    expect(fetchView).toHaveBeenCalled();
    expect(result.current.view.phase).toBe('awaitingDiscard');
  });
});
