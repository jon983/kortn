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
  sm: { box: 'w-16 h-24', idxRank: 'text-sm', idxSuit: 'text-xs', pip: 'text-2xl', star: 'text-xl', joker: 'text-[9px]' },
  md: { box: 'w-24 h-32', idxRank: 'text-lg', idxSuit: 'text-sm', pip: 'text-4xl', star: 'text-3xl', joker: 'text-xs' },
} as const;

export function Card({
  card, size = 'md', selected = false, highlight = false, onClick,
}: { card: CardT; size?: 'sm' | 'md'; selected?: boolean; highlight?: boolean; onClick?: () => void }) {
  const s = SIZES[size];
  const lift = selected ? '-translate-y-5 ring-2 ring-brass' : '';
  const glow = highlight ? 'ring-4 ring-amber-300 z-10 animate-pulse' : '';
  const base = `relative inline-flex items-center justify-center rounded-md bg-[#f6f2e6] border border-[#cfc9b4] shadow font-bold select-none ${s.box} ${lift} ${glow}`;

  if (card.kind === 'joker') {
    return (
      <button type="button" onClick={onClick} className={`${base} flex-col text-maroon`}>
        <span className={`${s.star} leading-none`}>★</span>
        <span className={`${s.joker} leading-none tracking-widest`}>JOKER</span>
      </button>
    );
  }

  const color = cardColor(card) === 'red' ? 'text-[#b22]' : 'text-[#222]';
  const rank = rankLabel(card.rank);
  const glyph = suitGlyph(card.suit);
  const Index = ({ corner }: { corner: 'tl' | 'br' }) => (
    <span
      className={`absolute flex flex-col items-center leading-none ${
        corner === 'tl' ? 'top-1 left-1' : 'bottom-1 right-1 rotate-180'
      }`}
    >
      <span className={s.idxRank}>{rank}</span>
      <span className={s.idxSuit}>{glyph}</span>
    </span>
  );
  return (
    <button type="button" onClick={onClick} className={`${base} ${color}`}>
      <Index corner="tl" />
      <span className={`${s.pip} leading-none`}>{glyph}</span>
      <Index corner="br" />
    </button>
  );
}
