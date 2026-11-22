import type { ComponentProps } from 'react';
import type { ClerkProvider } from '@clerk/nextjs';

/**
 * Sign in and sign up on our own pages (the KORTN sign over the dining room),
 * never on Clerk's hosted page, which shows the dashboard logo. Used by the
 * proxy (where logged-out deep links are sent) and by ClerkProvider (the links
 * inside Clerk's box).
 */
export const CLERK_URLS = { signInUrl: '/sign-in', signUpUrl: '/sign-up' } as const;

/**
 * Clerk's box wording, in the deli voice ("Pull up a chair"). Every default
 * line that would show the Clerk app's name says KORTN instead, so the box
 * reads the same whichever Clerk keys are in use (a local .env.local may hold
 * another app's development keys).
 */
export const CLERK_TEXT: NonNullable<ComponentProps<typeof ClerkProvider>['localization']> = {
  signIn: {
    start: {
      title: 'Sign in to KORTN',
      titleCombined: 'Continue to KORTN',
      subtitle: 'Welcome back. Pull up a chair.',
    },
    emailCode: { subtitle: 'to continue to KORTN' },
    emailLink: { subtitle: 'to continue to KORTN' },
    phoneCode: { subtitle: 'to continue to KORTN' },
  },
  signUp: {
    start: {
      title: 'Pull up a chair',
      subtitle: 'Make an account to join the table.',
    },
    emailLink: { subtitle: 'to continue to KORTN' },
  },
};
