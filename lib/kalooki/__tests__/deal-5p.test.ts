import { describe, it, expect } from 'vitest';
import { startMatch } from '../index';

describe('5-player deal', () => {
  it('deals 13 to each of 5 seats, stock 40, no card lost', () => {
    const m = startMatch({ seats: 5, seed: 12 });
    expect(m.round.players).toHaveLength(5);
    for (const p of m.round.players) expect(p.hand).toHaveLength(13);
    expect(m.round.discard).toHaveLength(1);
    expect(m.round.stock).toHaveLength(40); // 106 - 65 - 1
    const all = [...m.round.stock, ...m.round.discard, ...m.round.players.flatMap((p) => p.hand)];
    expect(all).toHaveLength(106);
    expect(new Set(all.map((c) => c.id)).size).toBe(106);
    expect(m.pot).toBe(20); // 5 * 4
  });
});
