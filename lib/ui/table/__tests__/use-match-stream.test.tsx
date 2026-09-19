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
  it('starts with initial and updates on message', () => {
    const initial: any = { seat: 0, currentTurn: 0, phase: 'awaitingDraw' };
    const { result } = renderHook(() => useMatchStream('m1', initial));
    expect(result.current.phase).toBe('awaitingDraw');
    act(() => { FakeES.last!.onmessage?.({ data: JSON.stringify({ ...initial, phase: 'awaitingDiscard' }) }); });
    expect(result.current.phase).toBe('awaitingDiscard');
  });
});
