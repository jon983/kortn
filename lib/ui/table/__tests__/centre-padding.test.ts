import { describe, it, expect } from 'vitest';
import { centrePadding } from '../useCentrePadding';

describe('keeping the stock and discard in the middle of the table', () => {
  it('even side columns need no padding', () => {
    expect(centrePadding(200, 200, 1000)).toEqual({ left: 0, right: 0 });
    expect(centrePadding(0, 0, 1000)).toEqual({ left: 0, right: 0 });
  });
  it('a wider right column (its melds are down) pads the left by the difference', () => {
    expect(centrePadding(180, 420, 900)).toEqual({ left: 240, right: 0 });
  });
  it('a wider left column pads the right', () => {
    expect(centrePadding(420, 180, 900)).toEqual({ left: 0, right: 240 });
  });
  it('never squeezes the piles: capped at the room left beside them', () => {
    // 400px centre, 232px of piles: at most 168px of padding.
    expect(centrePadding(100, 600, 400)).toEqual({ left: 168, right: 0 });
    expect(centrePadding(100, 600, 200)).toEqual({ left: 0, right: 0 });
  });
});
