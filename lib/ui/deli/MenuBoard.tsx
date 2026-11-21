import type { ReactNode } from 'react';

const FRAME = 'M40 22 C 140 8, 230 30, 330 16 S 520 6, 610 20 S 760 10, 796 30 C 812 120, 800 220, 812 330 S 798 520, 810 610 C 800 660, 790 684, 760 690 C 650 700, 540 680, 420 694 S 200 680, 90 692 C 50 694, 18 676, 14 640 C 6 540, 20 440, 10 340 S 22 140, 12 70 C 12 40, 22 26, 40 22 Z';
const RULE = 'M52 36 C 150 24, 240 42, 336 30 S 520 22, 606 34 S 750 26, 782 42 C 796 130, 786 230, 796 332 S 784 516, 794 600 C 786 648, 776 668, 752 674 C 646 684, 538 666, 420 678 S 204 666, 96 676 C 62 678, 34 664, 30 632 C 22 536, 36 440, 26 340 S 38 146, 28 78 C 28 52, 36 40, 52 36 Z';

/** Line-art fanned playing cards for the board's corners. */
function FannedCards({ suit, className }: { suit: 'spade' | 'heart'; className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 80" fill="none" stroke="#1d5446" strokeWidth="2.2" strokeLinejoin="round" className={className}>
      <rect x="18" y="10" width="34" height="48" rx="4" transform="rotate(-18 35 34)" fill="#f6efdc" />
      <rect x="32" y="8" width="34" height="48" rx="4" fill="#f6efdc" />
      <rect x="46" y="10" width="34" height="48" rx="4" transform="rotate(18 63 34)" fill="#f6efdc" />
      {suit === 'spade'
        ? <path d="M63 26 c-4 6-9 9-9 13 a4 4 0 0 0 7 2 l-2 5 h8 l-2-5 a4 4 0 0 0 7-2 c0-4-5-7-9-13z" fill="#1d5446" stroke="none" transform="rotate(18 63 34)" />
        : <path d="M63 40 c-6-4-9-8-9-11 a4.5 4.5 0 0 1 9-1 a4.5 4.5 0 0 1 9 1 c0 3-3 7-9 11z" fill="#c8402f" stroke="none" transform="rotate(18 63 34)" />}
    </svg>
  );
}

/**
 * The deli menu board: cream stock in a hand-drawn wavy frame with a double
 * green rule, and line-art cards in two corners. Children flow normally inside.
 */
export function MenuBoard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative px-6 pb-8 pt-9 text-deli-green sm:px-[46px] sm:pb-[34px] sm:pt-10 ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 820 700" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible drop-shadow-[0_22px_40px_rgba(0,0,0,.45)]">
        <defs><pattern id="deli-grain" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="rgba(90,70,40,.08)" /></pattern></defs>
        <path d={FRAME} fill="#f6efdc" />
        <path d={FRAME} fill="url(#deli-grain)" />
        <path d={RULE} fill="none" stroke="#1d5446" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <FannedCards suit="spade" className="pointer-events-none absolute -left-1.5 -top-2.5 w-16 -rotate-[14deg] sm:w-[92px]" />
      <FannedCards suit="heart" className="pointer-events-none absolute -bottom-1.5 -right-1 w-16 rotate-[160deg] sm:w-[92px]" />
      <div className="relative">{children}</div>
    </div>
  );
}
