import { iconImage } from '../lib/brand/images';

// The phone home-screen icon (full square; the phone rounds the corners).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return iconImage(180);
}
