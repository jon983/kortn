import type { ButtonHTMLAttributes } from 'react';

export function LampButton({ children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`font-[family-name:var(--font-body)] font-bold text-bone border-2 border-walnut-dark rounded-md px-6 py-3
        bg-[linear-gradient(180deg,var(--color-walnut),var(--color-walnut-dark))]
        shadow-[0_5px_10px_rgba(0,0,0,.4)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
