import { describe, it, expect } from 'vitest';
import { startMatch } from '../state';
import { applyAction } from '../actions';
import { makeRng } from '../rng';

describe('draw', () => {
  it('draws from stock and advances to awaitingDiscard', () => {
    const m = startMatch({ seats: 2, seed: 3 });
    const seat = m.round.turn;
    const before = m.round.players[seat].hand.length;
    const r = applyAction(m, seat, { type: 'draw', source: 'stock' }, makeRng(1));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.players[seat].hand.length).toBe(before + 1);
      expect(r.match.round.phase).toBe('awaitingDiscard');
    }
  });

  it('rejects a draw when it is not your turn', () => {
    const m = startMatch({ seats: 2, seed: 3 });
    const notTurn = (m.round.turn + 1) % 2;
    const r = applyAction(m, notTurn, { type: 'draw', source: 'stock' }, makeRng(1));
    expect(r.ok).toBe(false);
  });

  it('rejects drawing again after already drawing', () => {
    const m = startMatch({ seats: 2, seed: 3 });
    const seat = m.round.turn;
    const r1 = applyAction(m, seat, { type: 'draw', source: 'stock' }, makeRng(1));
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      const r2 = applyAction(r1.match, seat, { type: 'draw', source: 'stock' }, makeRng(1));
      expect(r2.ok).toBe(false);
    }
  });

  it('taking the discard sets a draw obligation', () => {
    const m = startMatch({ seats: 2, seed: 3 });
    const seat = m.round.turn;
    // Force a known non-joker discard for determinism of intent:
    const top = m.round.discard[m.round.discard.length - 1];
    const r = applyAction(m, seat, { type: 'draw', source: 'discard' }, makeRng(1));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.drawObligation?.id).toBe(top.id);
      expect(r.match.round.players[seat].hand.map((c) => c.id)).toContain(top.id);
    }
  });
});
