import type { Pack } from '../../kalooki';

const SIZES = { sm: 'w-8 h-11', md: 'w-12 h-16' } as const;

export function CardBack({ pack, size = 'md' }: { pack: Pack; size?: 'sm' | 'md' }) {
  const url = `/art/card-back-${pack === 'A' ? 'blue' : 'red'}.png`;
  const fallback = pack === 'A'
    ? 'repeating-linear-gradient(45deg,#274a7a,#274a7a 4px,#1c3557 4px,#1c3557 8px)'
    : 'repeating-linear-gradient(45deg,#7a2740,#7a2740 4px,#571c2e 4px,#571c2e 8px)';
  return (
    <div className={`rounded-md border border-black/40 shadow bg-cover bg-center ${SIZES[size]}`}
      style={{ backgroundImage: `url(${url}), ${fallback}` }} />
  );
}
