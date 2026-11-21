import { useId } from 'react';
import type { Pack } from '../../kalooki';

const SIZES = { sm: 'w-10 h-14 p-[2px]', md: 'w-24 h-32 p-[3px]' } as const;
const CREAM = '#f6efdc';
/** Pack A: deli green with a diamond check. Pack B: tomato red with dots — different in colour and in print. */
const PACKS = { A: { field: '#1d5446' }, B: { field: '#c8402f' } } as const;

/** A deli-print card back: cream border, a fine repeating print, and a K monogram medallion. */
export function CardBack({ pack, size = 'md' }: { pack: Pack; size?: 'sm' | 'md' }) {
  const pid = `cb-${useId().replace(/:/g, '')}`;
  const { field } = PACKS[pack];
  return (
    <div data-pack={pack} className={`rounded-md border border-black/35 bg-[#f6efdc] shadow ${SIZES[size]}`}>
      <svg width="100%" height="100%" className="block rounded-[3px]" aria-hidden>
        <defs>
          {pack === 'A' ? (
            <pattern id={pid} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="3" height="3" fill={CREAM} opacity=".16" />
              <rect x="3" y="3" width="3" height="3" fill={CREAM} opacity=".16" />
            </pattern>
          ) : (
            <pattern id={pid} width="5" height="5" patternUnits="userSpaceOnUse">
              <circle cx="2.5" cy="2.5" r="1" fill={CREAM} opacity=".28" />
            </pattern>
          )}
        </defs>
        <rect width="100%" height="100%" fill={field} />
        <rect width="100%" height="100%" fill={`url(#${pid})`} />
        <rect x="7%" y="5%" width="86%" height="90%" rx="2" fill="none" stroke={CREAM} strokeOpacity=".6" strokeWidth="1" />
        <svg x="15%" y="25%" width="70%" height="50%" viewBox="0 0 40 40" preserveAspectRatio="xMidYMid meet">
          <circle cx="20" cy="20" r="17" fill={CREAM} />
          <circle cx="20" cy="20" r="14.5" fill="none" stroke={field} strokeWidth="1.2" />
          <text x="20" y="28" textAnchor="middle" fontSize="23" fontWeight="900" fill={field} style={{ fontFamily: 'var(--font-cond), sans-serif' }}>K</text>
        </svg>
      </svg>
    </div>
  );
}
