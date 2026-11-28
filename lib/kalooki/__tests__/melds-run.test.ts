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

  it('resolves a leading joker at index 0', () => {
    const r = validateRun([joker(), nat(5, 'hearts'), nat(6, 'hearts')]);
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.resolved[0].rank).toBe(4);
      expect(r.resolved[0].suit).toBe('hearts');
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

  it('a joker can never sit above the Ace: picked after K-A, it goes below as the Queen', () => {
    const r = validateRun([nat(13, 'hearts'), nat(14, 'hearts'), joker()]);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.resolved.map((x) => x.rank)).toEqual([12, 13, 14]);
  });
  it('accepts the cards in any order, and resolves them in sequence', () => {
    const r = validateRun([nat(6, 'hearts'), nat(4, 'hearts'), nat(5, 'hearts')]);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.resolved.map((x) => x.rank)).toEqual([4, 5, 6]);
    const down = validateRun([nat(9, 'spades'), nat(8, 'spades'), nat(7, 'spades')]);
    expect(down.valid).toBe(true);
    if (down.valid) expect(down.resolved.map((x) => x.rank)).toEqual([7, 8, 9]);
  });

  it('out of order, a joker fills the gap', () => {
    const r = validateRun([nat(6, 'clubs'), joker(), nat(4, 'clubs')]);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.resolved.map((x) => x.rank)).toEqual([4, 5, 6]);
  });

  it('out of order, a spare joker goes on the end that scores more', () => {
    const r = validateRun([nat(6, 'clubs'), nat(5, 'clubs'), joker()]);
    expect(r.valid).toBe(true);
    if (r.valid) { expect(r.resolved.map((x) => x.rank)).toEqual([5, 6, 7]); expect(r.points).toBe(18); }
    // at the top of the run there's no room above, so it goes below
    const top = validateRun([nat(14, 'clubs'), joker(), nat(13, 'clubs')]);
    expect(top.valid).toBe(true);
    if (top.valid) expect(top.resolved.map((x) => x.rank)).toEqual([12, 13, 14]);
  });

  it('a joker placed in order stays where it was put', () => {
    const r = validateRun([joker(), nat(5, 'hearts'), nat(6, 'hearts')]);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.resolved[0].rank).toBe(4);
  });

  it('still rejects what no order can make a run', () => {
    expect(validateRun([nat(2, 'hearts'), nat(14, 'hearts'), nat(13, 'hearts')]).valid).toBe(false);
    expect(validateRun([nat(7, 'hearts'), nat(4, 'hearts'), nat(6, 'hearts')]).valid).toBe(false);
    expect(validateRun([nat(5, 'hearts'), nat(5, 'hearts', 'B'), nat(6, 'hearts')]).valid).toBe(false);
  });
});
