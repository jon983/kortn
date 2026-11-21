import type { CSSProperties, ReactNode } from 'react';

/** A framed panel. `tilt` hangs it slightly crooked (decorative); turn it off where panels sit in a grid. */
export function Framed({ title, children, className = '', tilt = true, style }: { title?: string; children: ReactNode; className?: string; tilt?: boolean; style?: CSSProperties }) {
  return (
    <div className={`bg-bone text-ink border-[7px] border-walnut rounded-[2px] p-4 shadow-[0_10px_20px_rgba(0,0,0,.35),inset_0_0_0_2px_var(--color-brass)] ${tilt ? '-rotate-[.6deg]' : ''} ${className}`} style={style}>
      {title && (
        <h3 className="text-center text-maroon font-[family-name:var(--font-display)] text-base mb-2 pb-1 border-b border-brass">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
