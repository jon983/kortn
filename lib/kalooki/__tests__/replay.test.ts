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

  it('same seed + same multi-step sequence => identical state', () => {
    function play(seed: number) {
      let m = startMatch({ seats: 2, seed });
      const rng = makeRng(seed + 1000);
      // Play a few full turns: each player draws from stock then discards their first hand card.
      for (let i = 0; i < 4; i++) {
        const seat = m.round.turn;
        const d = applyAction(m, seat, { type: 'draw', source: 'stock' }, rng);
        if (d.ok) m = d.match;
        const seat2 = m.round.turn; // still same seat (now awaitingDiscard)
        const firstCard = m.round.players[seat2].hand[0];
        const x = applyAction(m, seat2, { type: 'discard', cardId: firstCard.id }, rng);
        if (x.ok) m = x.match;
      }
      return m;
    }
    const a = play(11);
    const b = play(11);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    // sanity: the sequence actually advanced state (turns were taken, stock shrank)
    expect(a.round.discard.length).toBeGreaterThan(1);
  });
});
