import type { ReactNode } from 'react';

export function Framed({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-bone text-ink border-[7px] border-walnut rounded-[2px] p-4 shadow-[0_10px_20px_rgba(0,0,0,.35),inset_0_0_0_2px_var(--color-brass)] -rotate-[.6deg] ${className}`}>
      {title && (
        <h3 className="text-center text-maroon font-[family-name:var(--font-display)] text-base mb-2 pb-1 border-b border-brass">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
