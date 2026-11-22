import { signImage } from '../../lib/brand/images';

// The logo as a plain image (transparent background), e.g. to upload in the
// Clerk dashboard for the emails Clerk sends.
export async function GET() {
  return signImage(800, 260);
}
