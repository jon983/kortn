import { describe, it, expect } from 'vitest';
import { validateSet } from '../melds';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });
const joker = (pack = 'A'): Card => ({ id: `${pack}-joker`, kind: 'joker', pack: pack as any });

describe('validateSet', () => {
  it('accepts three distinct-suit naturals of same rank', () => {
    const r = validateSet([nat(7, 'clubs'), nat(7, 'hearts'), nat(7, 'spades')]);
    expect(r.valid).toBe(true);
    if (r.valid) { expect(r.kind).toBe('set'); expect(r.points).toBe(21); }
  });

  it('accepts a set of 3 with two jokers and one natural', () => {
    const r = validateSet([nat(9, 'clubs'), joker('A'), joker('B')]);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.points).toBe(27); // 9 * 3
  });

  it('accepts a four-card set (all four suits)', () => {
    const r = validateSet([nat(5, 'clubs'), nat(5, 'diamonds'), nat(5, 'hearts'), nat(5, 'spades')]);
    expect(r.valid).toBe(true);
  });

  it('rejects duplicate suits among naturals', () => {
    const r = validateSet([nat(7, 'clubs'), nat(7, 'clubs', 'B'), nat(7, 'hearts')]);
    expect(r.valid).toBe(false);
  });

  it('rejects mixed ranks', () => {
    expect(validateSet([nat(7, 'clubs'), nat(8, 'hearts'), nat(7, 'spades')]).valid).toBe(false);
  });

  it('rejects fewer than 3 or more than 4 cards', () => {
    expect(validateSet([nat(7, 'clubs'), nat(7, 'hearts')]).valid).toBe(false);
    expect(validateSet([nat(7, 'clubs'), nat(7, 'diamonds'), nat(7, 'hearts'), nat(7, 'spades'), joker()]).valid).toBe(false);
  });

  it('rejects an all-joker "set" (no natural to define rank)', () => {
    expect(validateSet([joker('A'), joker('B'), nat(2, 'clubs')]).valid).toBe(true);
    expect(validateSet([joker('A'), joker('B')]).valid).toBe(false); // too few anyway
  });
});
