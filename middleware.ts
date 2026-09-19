import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublic = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/api/(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) return redirectToSignIn();
  }
});

export const config = { matcher: ['/((?!_next|.*\\..*).*)', '/api/(.*)'] };
