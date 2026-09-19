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

const SIZES = {
  sm: { box: 'w-16 h-24', rank: 'text-base', glyph: 'text-2xl', star: 'text-xl', joker: 'text-[9px]', dot: 'h-2 w-2' },
  md: { box: 'w-24 h-32', rank: 'text-xl', glyph: 'text-4xl', star: 'text-3xl', joker: 'text-xs', dot: 'h-2.5 w-2.5' },
} as const;

export function Card({
  card, size = 'md', selected = false, onClick,
}: { card: CardT; size?: 'sm' | 'md'; selected?: boolean; onClick?: () => void }) {
  const s = SIZES[size];
  const packDot = card.pack === 'A' ? 'bg-[#2f5c9a]' : 'bg-[#9a2f45]';
  const lift = selected ? '-translate-y-5 ring-2 ring-brass' : '';
  const base = `relative inline-flex flex-col items-center justify-between rounded-md bg-[#f6f2e6] border border-[#cfc9b4] shadow px-1.5 py-1.5 font-bold select-none ${s.box} ${lift}`;
  if (card.kind === 'joker') {
    return (
      <button type="button" onClick={onClick} className={`${base} text-maroon`}>
        <span className={`${s.star} leading-none`}>★</span>
        <span className={`${s.joker} leading-none`}>JOKER</span>
        <span className={`absolute top-1 right-1 rounded-full ${s.dot} ${packDot}`} />
      </button>
    );
  }
  const color = cardColor(card) === 'red' ? 'text-[#b22]' : 'text-[#222]';
  return (
    <button type="button" onClick={onClick} className={`${base} ${color}`}>
      <span className={`self-start leading-none ${s.rank}`}>{rankLabel(card.rank)}</span>
      <span className={`${s.glyph} leading-none`}>{suitGlyph(card.suit)}</span>
      <span className={`absolute top-1 right-1 rounded-full ${s.dot} ${packDot}`} />
    </button>
  );
}
