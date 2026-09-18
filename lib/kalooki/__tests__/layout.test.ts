import { describe, it, expect } from 'vitest';
import { layoutMeld } from '../layout';
import { cardColor } from '../cards';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });

describe('layoutMeld sets', () => {
  it('centers the odd-color-out for a 3-set (two red, one black -> R-B-R)', () => {
    const out = layoutMeld([nat(7, 'hearts'), nat(7, 'diamonds'), nat(7, 'clubs')], 'set');
    const colors = out.map(cardColor);
    expect(colors).toEqual(['red', 'black', 'red']);
  });

  it('centers the odd-color-out (two black, one red -> B-R-B)', () => {
    const out = layoutMeld([nat(7, 'clubs'), nat(7, 'spades'), nat(7, 'hearts')], 'set');
    expect(out.map(cardColor)).toEqual(['black', 'red', 'black']);
  });

  it('alternates a 4-set as R-B-R-B', () => {
    const out = layoutMeld([nat(7, 'hearts'), nat(7, 'diamonds'), nat(7, 'clubs'), nat(7, 'spades')], 'set');
    const colors = out.map(cardColor);
    expect(colors[0]).not.toBe(colors[1]);
    expect(colors[1]).not.toBe(colors[2]);
    expect(colors[2]).not.toBe(colors[3]);
  });

  it('leaves runs in given order', () => {
    const run = [nat(4, 'hearts'), nat(5, 'hearts'), nat(6, 'hearts')];
    expect(layoutMeld(run, 'run').map((c) => c.id)).toEqual(run.map((c) => c.id));
  });
});
