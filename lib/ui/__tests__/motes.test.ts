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
      expect(m.top).toBeGreaterThanOrEqual(40); expect(m.top).toBeLessThanOrEqual(100);
      expect(m.size).toBeGreaterThanOrEqual(1.5); expect(m.size).toBeLessThanOrEqual(4.5);
      expect(m.duration).toBeGreaterThanOrEqual(9); expect(m.duration).toBeLessThanOrEqual(22);
      expect(m.delay).toBeGreaterThanOrEqual(0); expect(m.delay).toBeLessThanOrEqual(22);
      expect(m.driftX).toBeGreaterThanOrEqual(-40); expect(m.driftX).toBeLessThanOrEqual(40);
    }
  });
});
