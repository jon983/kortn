import { describe, it, expect } from 'vitest';
import { seatPositions, tableKind, seatAround, playOrderFrom } from '../table-geometry';

describe('table geometry', () => {
  it('chooses square for 2-4, pentagon for 5', () => {
    for (const n of [2, 3, 4]) expect(tableKind(n)).toBe('square');
    expect(tableKind(5)).toBe('pentagon');
  });

  it('returns one position per seat, all within 0..100, none at exact corners', () => {
    for (const n of [2, 3, 4, 5]) {
      const pos = seatPositions(n);
      expect(pos).toHaveLength(n);
      expect(new Set(pos.map((p) => p.seat))).toEqual(new Set([...Array(n).keys()]));
      for (const p of pos) {
        expect(p.xPct).toBeGreaterThanOrEqual(0);
        expect(p.xPct).toBeLessThanOrEqual(100);
        expect(p.yPct).toBeGreaterThanOrEqual(0);
        expect(p.yPct).toBeLessThanOrEqual(100);
      }
    }
  });

  it('places 2 players on opposite sides (top & bottom)', () => {
    const p = seatPositions(2).sort((a, b) => a.yPct - b.yPct);
    expect(p[0].xPct).toBeCloseTo(50, 0);   // top centered
    expect(p[1].xPct).toBeCloseTo(50, 0);   // bottom centered
    expect(p[1].yPct - p[0].yPct).toBeGreaterThan(50); // clearly opposite
  });

  it('pentagon seats sit on edges (none at the top vertex x=50,y=0)', () => {
    const p = seatPositions(5);
    for (const s of p) expect(!(Math.abs(s.xPct - 50) < 1 && s.yPct < 3)).toBe(true);
  });
});

describe('seatAround — clockwise seating relative to the viewer', () => {
  const opps = (seats: number, me: number) =>
    Array.from({ length: seats }, (_, s) => ({ seat: s })).filter((o) => o.seat !== me);
  const ids = (xs: { seat: number }[]) => xs.map((o) => o.seat);

  it('2 players: the opponent sits across the top', () => {
    const r = seatAround(1, 2, opps(2, 1));
    expect([ids(r.left), ids(r.top), ids(r.right)]).toEqual([[], [0], []]);
  });

  it('3 players: next to play sits on your left, the one after on your right — for every viewer', () => {
    // Play goes seat → seat+1, so from seat 1 the next is 2 (left), then 0 (right).
    expect(ids(seatAround(0, 3, opps(3, 0)).left)).toEqual([1]);
    expect(ids(seatAround(0, 3, opps(3, 0)).right)).toEqual([2]);
    expect(ids(seatAround(1, 3, opps(3, 1)).left)).toEqual([2]);
    expect(ids(seatAround(1, 3, opps(3, 1)).right)).toEqual([0]);
    expect(ids(seatAround(2, 3, opps(3, 2)).left)).toEqual([0]);
    expect(ids(seatAround(2, 3, opps(3, 2)).right)).toEqual([1]);
  });

  it('4 players: left, top, right in play order', () => {
    const r = seatAround(2, 4, opps(4, 2));
    expect([ids(r.left), ids(r.top), ids(r.right)]).toEqual([[3], [0], [1]]);
  });

  it('5 players: left, then the two across the top left-to-right, then right', () => {
    const r = seatAround(3, 5, opps(5, 3));
    expect([ids(r.left), ids(r.top), ids(r.right)]).toEqual([[4], [0, 1], [2]]);
  });
});

describe('playOrderFrom — you first, then in play order', () => {
  it('starts with your seat and wraps round the table', () => {
    const seats = [0, 1, 2, 3].map((seatIndex) => ({ seatIndex }));
    expect([...seats].sort(playOrderFrom(2, 4)).map((s) => s.seatIndex)).toEqual([2, 3, 0, 1]);
    expect([...seats].sort(playOrderFrom(0, 4)).map((s) => s.seatIndex)).toEqual([0, 1, 2, 3]);
  });
  it('without a seat for you (lobby), keeps plain seat order', () => {
    const seats = [2, 0, 1].map((seatIndex) => ({ seatIndex }));
    expect([...seats].sort(playOrderFrom(null, 3)).map((s) => s.seatIndex)).toEqual([0, 1, 2]);
  });
});
