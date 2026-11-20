import { describe, it, expect } from 'vitest';
import { timeAgo } from '../time-ago';

const now = new Date('2026-11-21T12:00:00Z');
const ago = (ms: number) => timeAgo(new Date(now.getTime() - ms), now);
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

describe('timeAgo', () => {
  it('reads naturally across scales', () => {
    expect(ago(20_000)).toBe('just now');
    expect(ago(5 * MIN)).toBe('5 minutes ago');
    expect(ago(3 * HOUR)).toBe('3 hours ago');
    expect(ago(1 * DAY + HOUR)).toBe('yesterday');
    expect(ago(2 * DAY + HOUR)).toBe('2 days ago');
    expect(ago(15 * DAY)).toBe('2 weeks ago');
    expect(ago(70 * DAY)).toBe('2 months ago');
  });
});
