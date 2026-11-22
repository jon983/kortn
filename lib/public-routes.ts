/**
 * Routes anyone can open without signing in: the front page, Clerk's sign-in
 * and sign-up (with their nested steps), the API (it checks auth itself), and
 * the generated favicon / home-screen icon / link-preview images (so browsers
 * and link-preview fetchers can load them). `/logo.png` has a dot in it, so the
 * proxy never runs for it.
 */
export const PUBLIC_ROUTES: string[] = [
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/(.*)',
  '/icon(.*)',
  '/apple-icon(.*)',
  '/opengraph-image(.*)',
];
