// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { PUBLIC_ROUTES } from '../../public-routes';

const isPublic = createRouteMatcher(PUBLIC_ROUTES);
const at = (path: string) => isPublic(new NextRequest(`https://kortn.com${path}`));

describe('public routes', () => {
  it('the front page, sign-in/up (with Clerk’s nested steps), the API and the generated images are public', () => {
    for (const p of ['/', '/sign-in', '/sign-in/factor-one', '/sign-up', '/icon', '/apple-icon', '/opengraph-image', '/opengraph-image-abc123', '/api/x']) {
      expect(at(p), p).toBe(true);
    }
  });
  it('the rest of the app still needs signing in', () => {
    for (const p of ['/create', '/match/abc']) expect(at(p), p).toBe(false);
  });
});
