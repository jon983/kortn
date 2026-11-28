import { describe, it, expect } from 'vitest';
import { tableLineY, tableLineSides, sideHandScale, tableEdgeSides } from '../TableSurface';

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
  it('side hands shrink to clear the chrome on the narrower (left) parquet strip, 4px to spare', () => {
    // Full-size photo: 102px of parquet on the left, room for the full 56px hand.
    expect(sideHandScale(2048, 1374, false)).toBe(1);
    // A laptop's table area (1512x787): 58px of parquet -> a 46px hand.
    expect(sideHandScale(1512, 787, false)).toBeCloseTo(46.4 / 56, 2);
    expect(sideHandScale(1512, 787, false)).toBeLessThan(1);
    // Never under half size.
    expect(sideHandScale(640, 300, false)).toBe(0.5);
    // Portrait: the strip is ~99px either side.
    expect(sideHandScale(1073, 1600, true)).toBe(1);
  });
  it('the parquet beside the table: 102px on the left, 121px on the right (landscape), ~100px (portrait), scaled', () => {
    expect(tableEdgeSides(2048, 1374, false)).toEqual({ left: 102, right: 121 });
    expect(tableEdgeSides(1024, 2000, false)).toEqual({ left: 51, right: 61 });
    expect(tableEdgeSides(1073, 1600, true)).toEqual({ left: 99, right: 100 });
  });
});
