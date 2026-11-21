import type { ButtonHTMLAttributes, CSSProperties } from 'react';

/** The brass/walnut lamp button: gleams now and then, lifts on hover. `sheenDelay` (s) staggers the gleam. */
export function LampButton({ children, className = '', sheenDelay = 0, style, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { sheenDelay?: number }) {
  return (
    <button
      style={{ '--sheen-delay': `${sheenDelay}s`, ...style } as CSSProperties}
      className={`btn-sheen btn-lift font-[family-name:var(--font-body)] font-bold text-bone border-2 border-walnut-dark rounded-md px-6 py-3
        bg-[linear-gradient(180deg,var(--color-walnut),var(--color-walnut-dark))]
        shadow-[0_5px_10px_rgba(0,0,0,.4)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
