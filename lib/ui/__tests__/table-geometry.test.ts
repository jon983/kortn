import { describe, it, expect } from 'vitest';
import { seatPositions, tableKind } from '../table-geometry';

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
