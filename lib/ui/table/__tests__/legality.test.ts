import { describe, it, expect } from 'vitest';
import { evaluateMeld, stagedPoints, canOpen, isMyTurn, OPEN_THRESHOLD } from '../legality';
import type { Card } from '../../../kalooki';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });

describe('legality', () => {
  it('evaluateMeld recognises a set and a run, rejects junk', () => {
    expect(evaluateMeld([nat(7, 'clubs'), nat(7, 'hearts'), nat(7, 'spades')])).toEqual({ kind: 'set', points: 21 });
    expect(evaluateMeld([nat(4, 'hearts'), nat(5, 'hearts'), nat(6, 'hearts')])).toEqual({ kind: 'run', points: 15 });
    expect(evaluateMeld([nat(4, 'hearts'), nat(9, 'spades')])).toBeNull();
  });
  it('stagedPoints sums valid groups', () => {
    const g = [{ cards: [nat(13, 'clubs'), nat(13, 'hearts'), nat(13, 'spades')] }, { cards: [nat(4, 'diamonds'), nat(5, 'diamonds'), nat(6, 'diamonds')] }];
    expect(stagedPoints(g)).toBe(45); // 30 + 15
  });
  it('canOpen requires 40 unless already opened', () => {
    const base: any = { you: { hasOpened: false } };
    expect(canOpen(base, [{ cards: [nat(3, 'c'), nat(3, 'h'), nat(3, 's')] }])).toBe(false); // 9
    expect(canOpen(base, [{ cards: [nat(13, 'c'), nat(13, 'h'), nat(13, 's')] }, { cards: [nat(4, 'd'), nat(5, 'd'), nat(6, 'd')] }])).toBe(true); // 45
    expect(canOpen({ you: { hasOpened: true } } as any, [])).toBe(true);
    expect(OPEN_THRESHOLD).toBe(40);
  });
  it('isMyTurn compares seat to currentTurn', () => {
    expect(isMyTurn({ seat: 2, currentTurn: 2 } as any)).toBe(true);
    expect(isMyTurn({ seat: 1, currentTurn: 2 } as any)).toBe(false);
  });
});
