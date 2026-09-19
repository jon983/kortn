// lib/server/__tests__/redact.test.ts
import { describe, it, expect } from 'vitest';
import { redactStateFor } from '../redact';
import { startMatch } from '../../kalooki';

describe('redactStateFor', () => {
  it("shows the seat's own hand fully and others as counts only", () => {
    const state = startMatch({ seats: 3, seed: 4 });
    const view = redactStateFor(state, 0);
    expect(view.seat).toBe(0);
    expect(view.you.hand).toHaveLength(13);
    expect(view.you.handCount).toBe(13);
    expect(view.opponents.map((o) => o.seat).sort()).toEqual([1, 2]);
    for (const o of view.opponents) expect(o.handCount).toBe(13);
  });

  it('leaks no card identifiers from other seats', () => {
    const state = startMatch({ seats: 3, seed: 4 });
    const view = redactStateFor(state, 0);
    const serialized = JSON.stringify(view);
    // every card id from seats 1 and 2 must be absent from seat 0's view
    for (const p of state.round.players) {
      if (p.seat === 0) continue;
      for (const c of p.hand) expect(serialized.includes(c.id)).toBe(false);
    }
  });

  it('exposes public zones and derived fields', () => {
    const state = startMatch({ seats: 2, seed: 4 });
    const view = redactStateFor(state, 1);
    expect(view.stockCount).toBe(state.round.stock.length);
    expect(view.discard).toHaveLength(state.round.discard.length);
    expect(view.currentTurn).toBe(state.round.turn);
    expect(view.phase).toBe(state.round.phase);
    expect(view.pot).toBe(state.pot);
    expect(view.roundNumber).toBe(1);
    expect(view.matchFinished).toBe(false);
    expect(view.you.score).toBe(0);
    expect(view.you.status).toBe('active');
  });
});
