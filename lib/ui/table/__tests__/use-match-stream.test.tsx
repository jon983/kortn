// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMatchStream } from '../useMatchStream';

class FakeES {
  onmessage: ((e: { data: string }) => void) | null = null;
  static last: FakeES | null = null;
  constructor(public url: string) { FakeES.last = this; }
  close() {}
}
beforeEach(() => { (globalThis as any).EventSource = FakeES as any; });

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
});
