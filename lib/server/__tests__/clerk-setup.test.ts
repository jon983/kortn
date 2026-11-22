// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

const seen: { options?: any } = {};
vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (_handler: unknown, options: unknown) => { seen.options = options; return () => {}; },
  createRouteMatcher: () => () => true,
}));

describe('Clerk setup', () => {
  it('logged-out deep links go to our own sign-in page, not Clerk’s hosted one', async () => {
    await import('../../../proxy');
    expect(seen.options).toMatchObject({ signInUrl: '/sign-in', signUpUrl: '/sign-up' });
  });
  it('the sign-in box says KORTN, never the shared Clerk app’s name', async () => {
    const { CLERK_TEXT } = await import('../../clerk-setup');
    expect(CLERK_TEXT.signIn?.start?.title).toBe('Sign in to KORTN');
    expect(JSON.stringify(CLERK_TEXT)).not.toContain('applicationName');
  });
});
