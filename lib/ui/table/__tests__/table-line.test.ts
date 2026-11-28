import { describe, it, expect } from 'vitest';
import { tableLineY, tableLineSides } from '../TableSurface';

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
  it('the side lines: 238px in from the left and 251px from the right (landscape), ~202px (portrait), scaled', () => {
    expect(tableLineSides(2048, 1374, false)).toEqual({ left: 238, right: 251 });
    expect(tableLineSides(1024, 2000, false)).toEqual({ left: 119, right: 126 });
    expect(tableLineSides(1073, 1600, true)).toEqual({ left: 202, right: 201 });
  });
});
