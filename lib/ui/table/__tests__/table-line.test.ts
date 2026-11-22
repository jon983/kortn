import { describe, it, expect } from 'vitest';
import { tableLineY } from '../TableSurface';

describe('where the cream line sits on the table photo', () => {
  it('landscape: 258px down the photo, scaled with the table', () => {
    expect(tableLineY(2048, 1374, false)).toBe(258);
    expect(tableLineY(1024, 2000, false)).toBe(129); // width-limited
    expect(tableLineY(4000, 687, false)).toBe(129);  // height-limited
  });
  it('portrait photo: 197px down, scaled', () => {
    expect(tableLineY(1073, 1600, true)).toBe(197);
    expect(tableLineY(536.5, 2000, true)).toBe(99);
  });
});
