// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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
  it('the logo image is a PNG', async () => {
    expect(await pngSize(await signImage(800, 260))).toEqual([800, 260]);
  });
  it('the link preview is a 1200×630 JPEG small enough for WhatsApp (< 300 KB)', async () => {
    const bytes = await readFile(join(process.cwd(), 'app/opengraph-image.jpg'));
    expect(bytes.length).toBeLessThan(300 * 1024);
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]); // JPEG
    // find the frame header (SOF0/SOF2) for the size
    let i = 2;
    while (i < bytes.length && !(bytes[i] === 0xff && (bytes[i + 1] === 0xc0 || bytes[i + 1] === 0xc2))) i += 2 + bytes.readUInt16BE(i + 2);
    expect([bytes.readUInt16BE(i + 7), bytes.readUInt16BE(i + 5)]).toEqual([1200, 630]);
  });
});
