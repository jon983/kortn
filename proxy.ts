import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { PUBLIC_ROUTES } from './lib/public-routes';
import { CLERK_URLS } from './lib/clerk-setup';

const isPublic = createRouteMatcher(PUBLIC_ROUTES);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) return redirectToSignIn();
  }
}, CLERK_URLS);

export const config = { matcher: ['/((?!_next|.*\\..*).*)', '/api/(.*)'] };
