import { iconImage } from '../lib/brand/images';

// The browser-tab favicon: a green K on a cream sign.
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return iconImage(32);
}
