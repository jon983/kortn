import { describe, it, expect } from 'vitest';
import { validateRun } from '../melds';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });
const joker = (pack = 'A'): Card => ({ id: `${pack}-joker`, kind: 'joker', pack: pack as any });

describe('validateRun', () => {
  it('accepts three consecutive same-suit cards', () => {
    const r = validateRun([nat(4, 'hearts'), nat(5, 'hearts'), nat(6, 'hearts')]);
    expect(r.valid).toBe(true);
    if (r.valid) { expect(r.kind).toBe('run'); expect(r.points).toBe(15); }
  });

  it('accepts Q-K-A (ace high)', () => {
    const r = validateRun([nat(12, 'spades'), nat(13, 'spades'), nat(14, 'spades')]);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.points).toBe(31); // 10 + 10 + 11
  });

  it('resolves a joker filling an interior gap', () => {
    const r = validateRun([nat(4, 'clubs'), joker(), nat(6, 'clubs')]);
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.resolved[1].rank).toBe(5);
      expect(r.resolved[1].suit).toBe('clubs');
      expect(r.points).toBe(15); // 4 + 5 + 6
    }
  });

  it('rejects wraparound K-A-2', () => {
    expect(validateRun([nat(13, 'hearts'), nat(14, 'hearts'), nat(2, 'hearts')]).valid).toBe(false);
  });

  it('rejects Ace-low A-2-3', () => {
    expect(validateRun([nat(14, 'hearts'), nat(2, 'hearts'), nat(3, 'hearts')]).valid).toBe(false);
  });

  it('rejects mixed suits', () => {
    expect(validateRun([nat(4, 'hearts'), nat(5, 'spades'), nat(6, 'hearts')]).valid).toBe(false);
  });

  it('rejects non-consecutive naturals', () => {
    expect(validateRun([nat(4, 'hearts'), nat(6, 'hearts'), nat(7, 'hearts')]).valid).toBe(false);
  });

  it('rejects fewer than 3 cards', () => {
    expect(validateRun([nat(4, 'hearts'), nat(5, 'hearts')]).valid).toBe(false);
  });

  it('rejects a joker that would resolve above the Ace', () => {
    expect(validateRun([nat(13, 'hearts'), nat(14, 'hearts'), joker()]).valid).toBe(false);
  });
});
