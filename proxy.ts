import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { PUBLIC_ROUTES } from './lib/public-routes';

const isPublic = createRouteMatcher(PUBLIC_ROUTES);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) return redirectToSignIn();
  }
});

export const config = { matcher: ['/((?!_next|.*\\..*).*)', '/api/(.*)'] };
