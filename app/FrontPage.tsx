import Link from 'next/link';
import { RoomBackdrop } from '../lib/ui/RoomBackdrop';
import { KortnSign } from '../lib/ui/deli';

const ON_PHOTO = '[text-shadow:0_2px_12px_rgba(0,0,0,.65)]';

/**
 * The front door, for visitors who aren't signed in: the big green KORTN sign
 * hanging over the dining room, and the way in. One screen.
 */
export function FrontPage() {
  return (
    <RoomBackdrop plate="room-home" kitchenLink={false} ambient>
      {/* a light dusk over the room so the cream lettering reads (as in the mockup) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-[4] bg-[linear-gradient(180deg,rgba(20,16,10,.12),rgba(20,16,10,.38))]" />
      <main className="flex min-h-[100svh] flex-col items-center px-4 pb-4 text-center">
        <KortnSign size="lg" chains className="settle" />
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-[clamp(16px,3.2vh,28px)] py-6">
          <div className="settle flex w-full max-w-[20rem] flex-col gap-3 [animation-delay:90ms] sm:w-auto sm:max-w-none sm:flex-row sm:gap-4">
            <Link href="/sign-up" className="deli-pill deli-pill--on-photo btn-lift !px-8 !py-3.5 !text-[20px]">Sign up</Link>
            <Link href="/sign-in" className="deli-pill deli-pill--cream-outline btn-lift !px-8 !py-3.5 !text-[20px]">Sign in</Link>
          </div>
        </div>
        <footer className={`font-sans-deli text-[11px] font-medium uppercase tracking-[.22em] text-deli-cream/85 ${ON_PHOTO}`}>KORTN · Kalooki online</footer>
      </main>
    </RoomBackdrop>
  );
}
