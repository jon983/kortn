// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { iconImage, signImage } from '../../brand/images';

/** Width and height from a PNG's IHDR chunk. */
async function pngSize(res: Response) {
  expect(res.headers.get('content-type')).toBe('image/png');
  const v = new DataView(await res.arrayBuffer());
  return [v.getUint32(16), v.getUint32(20)];
}

describe('brand images', () => {
  it('the tab icon is a 32px PNG', async () => {
    expect(await pngSize(await iconImage(32))).toEqual([32, 32]);
  });
  it('the home-screen icon is 180px', async () => {
    expect(await pngSize(await iconImage(180))).toEqual([180, 180]);
  });
  it('the link preview is 1200×630 over the room', async () => {
    expect(await pngSize(await signImage(1200, 630, { photo: true }))).toEqual([1200, 630]);
  }, 20000);
});
