import { cardColor, type Card as CardT, type Rank, type Suit } from '../../kalooki';

export function rankLabel(rank: Rank): string {
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}

export function suitGlyph(suit: Suit): string {
  return { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }[suit];
}

const SIZES = { sm: 'w-8 h-11 text-xs', md: 'w-12 h-16 text-sm' } as const;

export function Card({
  card, size = 'md', selected = false, onClick,
}: { card: CardT; size?: 'sm' | 'md'; selected?: boolean; onClick?: () => void }) {
  const packDot = card.pack === 'A' ? 'bg-[#2f5c9a]' : 'bg-[#9a2f45]';
  const lift = selected ? '-translate-y-4 ring-2 ring-brass' : '';
  const base = `relative inline-flex flex-col items-center justify-between rounded-md bg-[#f6f2e6] border border-[#cfc9b4] shadow px-1 py-1 font-bold select-none ${SIZES[size]} ${lift}`;
  if (card.kind === 'joker') {
    return (
      <button type="button" onClick={onClick} className={`${base} text-maroon`}>
        <span className="text-[10px] leading-none">★</span>
        <span className="text-[9px] leading-none">JOKER</span>
        <span className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${packDot}`} />
      </button>
    );
  }
  const color = cardColor(card) === 'red' ? 'text-[#b22]' : 'text-[#222]';
  return (
    <button type="button" onClick={onClick} className={`${base} ${color}`}>
      <span className="self-start leading-none">{rankLabel(card.rank)}</span>
      <span className="text-lg leading-none">{suitGlyph(card.suit)}</span>
      <span className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${packDot}`} />
    </button>
  );
}
