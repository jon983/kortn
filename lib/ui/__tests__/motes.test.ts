import { describe, it, expect } from 'vitest';
import { makeMotes } from '../ambient/motes';

describe('makeMotes', () => {
  it('is deterministic for a seed (server and client render identical dust)', () => {
    expect(makeMotes(20, 7)).toEqual(makeMotes(20, 7));
    expect(makeMotes(20, 7)).not.toEqual(makeMotes(20, 8));
  });

  it('keeps every mote within the agreed ranges', () => {
    const motes = makeMotes(20, 7);
    expect(motes).toHaveLength(20);
    for (const m of motes) {
      expect(m.left).toBeGreaterThanOrEqual(0); expect(m.left).toBeLessThanOrEqual(100);
      expect(m.top).toBeGreaterThanOrEqual(5); expect(m.top).toBeLessThanOrEqual(95);
      expect(m.size).toBeGreaterThanOrEqual(1.5); expect(m.size).toBeLessThanOrEqual(4.5);
      expect(m.duration).toBeGreaterThanOrEqual(18); expect(m.duration).toBeLessThanOrEqual(34);
      expect(m.delay).toBeGreaterThanOrEqual(0); expect(m.delay).toBeLessThanOrEqual(34);
      expect(m.twinkle).toBeGreaterThanOrEqual(3); expect(m.twinkle).toBeLessThanOrEqual(7);
    }
  });

  it('wanders in every direction rather than only rising', () => {
    const motes = makeMotes(20, 7);
    for (const m of motes) {
      expect(m.path).toHaveLength(3);
      for (const [x, y] of m.path) {
        expect(Math.abs(x)).toBeLessThanOrEqual(60);
        expect(Math.abs(y)).toBeLessThanOrEqual(90);
      }
    }
    const ys = motes.flatMap((m) => m.path.map(([, y]) => y));
    const xs = motes.flatMap((m) => m.path.map(([x]) => x));
    // Some steps go down, some up; some left, some right.
    expect(ys.some((y) => y > 0)).toBe(true);
    expect(ys.some((y) => y < 0)).toBe(true);
    expect(xs.some((x) => x > 0)).toBe(true);
    expect(xs.some((x) => x < 0)).toBe(true);
  });
});
