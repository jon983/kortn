import { describe, it, expect } from 'vitest';
import { startMatch, applyAction, makeRng } from '../index';
import type { Action } from '../index';

function playScript(seed: number, actions: { seat: number; action: Action }[]) {
  let m = startMatch({ seats: 2, seed });
  const rng = makeRng(seed + 1000);
  for (const step of actions) {
    const r = applyAction(m, step.seat, step.action, rng);
    if (r.ok) m = r.match;
  }
  return m;
}

describe('replay determinism', () => {
  it('same seed + same actions => identical state', () => {
    const seat = startMatch({ seats: 2, seed: 11 }).round.turn;
    const script = [{ seat, action: { type: 'draw', source: 'stock' } as Action }];
    const a = playScript(11, script);
    const b = playScript(11, script);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});
