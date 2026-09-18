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

  // Build a pristine opening state whose single discard card is a joker.
  function openingStateWithJokerFlip(jokerId = 'A-joker') {
    const m0 = startMatch({ seats: 2, seed: 3 });
    const round = m0.round;
    const joker = round.stock.find((c) => c.id === jokerId)!;
    // Swap the flipped discard card back into stock and flip the joker instead,
    // keeping discard length 1 (pristine opening).
    const flipped = round.discard[round.discard.length - 1];
    const stock = round.stock.filter((c) => c.id !== jokerId).concat(flipped);
    return {
      match: { ...m0, round: { ...round, stock, discard: [joker] } },
      jokerId,
    };
  }

  it('drawJokerDecline never draws the declined joker back into hand', () => {
    const { match: m, jokerId } = openingStateWithJokerFlip();
    const seat = m.round.turn;
    const stockLen = m.round.stock.length;
    const r = applyAction(m, seat, { type: 'drawJokerDecline' }, makeRng(1));
    expect(r.ok).toBe(true);
    if (r.ok) {
      // The player must NOT be holding the declined joker.
      expect(r.match.round.players[seat].hand.map((c) => c.id)).not.toContain(jokerId);
      // The joker is back in the stock.
      expect(r.match.round.stock.map((c) => c.id)).toContain(jokerId);
      // One card drawn from stock, joker reinserted: net stock length unchanged.
      expect(r.match.round.stock.length).toBe(stockLen);
      expect(r.match.round.phase).toBe('awaitingDiscard');
    }
  });

  it('rejects drawJokerDecline when it is not the opening flip', () => {
    const { match: m } = openingStateWithJokerFlip();
    const seat = m.round.turn;
    // Simulate mid-game: a player already has fewer than 13 cards (has drawn/melded).
    const players = m.round.players.map((p, i) =>
      i === seat ? { ...p, hand: p.hand.slice(0, 12) } : p,
    );
    const mid = { ...m, round: { ...m.round, players } };
    const r = applyAction(mid, seat, { type: 'drawJokerDecline' }, makeRng(1));
    expect(r.ok).toBe(false);
  });
});
