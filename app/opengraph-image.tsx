import { signImage } from '../lib/brand/images';

// The picture shown when someone shares a kortn.com link: the KORTN sign over the dining room.
export const alt = 'KORTN, the card table';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return signImage(1200, 630, { photo: true });
}
