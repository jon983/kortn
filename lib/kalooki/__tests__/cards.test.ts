import { describe, it, expect } from 'vitest';
import { makeDeck, meldPoints, makeRng, shuffle } from '../cards';
import { makeRng as rngFromRng } from '../rng';

describe('makeDeck', () => {
  it('builds 106 unique cards: 2 packs of 52 + 2 jokers', () => {
    const deck = makeDeck();
    expect(deck).toHaveLength(106);
    expect(new Set(deck.map((c) => c.id)).size).toBe(106);
    expect(deck.filter((c) => c.kind === 'joker')).toHaveLength(2);
    expect(deck.filter((c) => c.kind === 'natural')).toHaveLength(104);
    // each pack contributes exactly 52 naturals + 1 joker
    for (const pack of ['A', 'B'] as const) {
      expect(deck.filter((c) => c.pack === pack)).toHaveLength(53);
    }
  });
});

describe('meldPoints', () => {
  it('scores pips, courts as 10, ace as 11', () => {
    expect(meldPoints(2)).toBe(2);
    expect(meldPoints(10)).toBe(10);
    expect(meldPoints(11)).toBe(10); // J
    expect(meldPoints(13)).toBe(10); // K
    expect(meldPoints(14)).toBe(11); // A
  });
});

describe('shuffle', () => {
  it('is deterministic for a given seed and preserves multiset', () => {
    const deck = makeDeck();
    const a = shuffle(deck, rngFromRng(42));
    const b = shuffle(deck, rngFromRng(42));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(new Set(a.map((c) => c.id))).toEqual(new Set(deck.map((c) => c.id)));
    // different seed → (almost certainly) different order
    const c = shuffle(deck, rngFromRng(7));
    expect(a.map((x) => x.id)).not.toEqual(c.map((x) => x.id));
  });
});
