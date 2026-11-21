import type { ReactNode } from 'react';
import Link from 'next/link';
import { AmbientRoom } from './ambient/AmbientRoom';

/** Always-visible way back to the front room — so nobody gets stranded on a screen. */
export function KitchenLink({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`rounded-md border border-brass/70 bg-black/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brass shadow backdrop-blur hover:bg-black/75 ${className}`}
    >
      ⌂ Kitchen
    </Link>
  );
}

export function RoomBackdrop({ plate, children, kitchenLink = true, ambient = false }: {
  plate?: string; children: ReactNode; kitchenLink?: boolean;
  /** Bring the room to life (drift, shifting window sunlight, light shaft, dust). */
  ambient?: boolean;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden isolate font-[family-name:var(--font-body)]">
      {/* base fallback gradient (always present) */}
      <div className="absolute inset-0 -z-20"
        style={{ background: 'linear-gradient(180deg,#e7e1cf 0%,#e1dbc8 42%,var(--color-sage) 42.5%,var(--color-sage-deep) 82%,#7f8a94 82.5%,#67737d 100%)' }} />
      {/* photographic plate over the fallback */}
      {plate && (ambient ? <AmbientRoom plate={plate} /> : (
        <div className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: `url(/art/${plate}.jpg)` }} />
      ))}
      {/* vignette */}
      <div className="pointer-events-none absolute inset-0 -z-[5]"
        style={{ background: 'radial-gradient(120% 100% at 50% 42%, transparent 55%, rgba(30,26,18,.5) 100%)' }} />
      {kitchenLink && <KitchenLink className="fixed left-3 top-3 z-50" />}
      {children}
    </div>
  );
}
