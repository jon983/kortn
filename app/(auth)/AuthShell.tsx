import Link from 'next/link';
import type { ReactNode } from 'react';
import { RoomBackdrop } from '../../lib/ui/RoomBackdrop';
import { KortnSign } from '../../lib/ui/deli';

/**
 * Sign-in and sign-up: the dining room, our green KORTN sign hung above Clerk's
 * box (Clerk's own logo is switched off on the box), and a way back to the
 * front page.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <RoomBackdrop plate="room-home" kitchenLink={false}>
      <Link
        href="/"
        className="fixed left-3 top-3 z-50 rounded-full bg-deli-green px-3 py-1 font-cond text-[12px] font-extrabold uppercase tracking-[.12em] text-deli-cream shadow-[0_4px_12px_rgba(0,0,0,.3)] hover:brightness-110"
      >
        ← kortn.com
      </Link>
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-6">
        <KortnSign size="md" />
        {children}
      </div>
    </RoomBackdrop>
  );
}
