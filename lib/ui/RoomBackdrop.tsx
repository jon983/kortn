import type { ReactNode } from 'react';

export function RoomBackdrop({ plate, children }: { plate?: string; children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden isolate font-[family-name:var(--font-body)]">
      {/* base fallback gradient (always present) */}
      <div className="absolute inset-0 -z-20"
        style={{ background: 'linear-gradient(180deg,#e7e1cf 0%,#e1dbc8 42%,var(--color-sage) 42.5%,var(--color-sage-deep) 82%,#7f8a94 82.5%,#67737d 100%)' }} />
      {/* photographic plate over the fallback */}
      {plate && (
        <div className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: `url(/art/${plate}.jpg)` }} />
      )}
      {/* vignette */}
      <div className="pointer-events-none absolute inset-0 -z-[5]"
        style={{ background: 'radial-gradient(120% 100% at 50% 42%, transparent 55%, rgba(30,26,18,.5) 100%)' }} />
      {children}
    </div>
  );
}
