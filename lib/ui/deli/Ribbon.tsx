import type { ReactNode } from 'react';

/** A ribbon banner header: green band, wide spaced caps, notched ends. */
export function Ribbon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`deli-ribbon ${className}`}>{children}</div>;
}
