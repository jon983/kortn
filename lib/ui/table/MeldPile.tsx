import { Card as CardFace } from './Card';
import { cardColor, layoutMeld, type Card, type TableMeld } from '../../kalooki';

export function MeldPile({ meld, onClick, armed }: { meld: TableMeld; onClick?: () => void; armed?: boolean }) {
  const ordered = layoutMeld(meld.cards, meld.kind);
  const armedCls = armed ? 'cursor-pointer ring-2 ring-brass ring-offset-2 ring-offset-transparent' : '';

  // A completed set of four collapses into a single tidy pile. The visible top
  // card signals whether the set contains a joker: red if it does, black if not.
  const isCompleteSet = meld.kind === 'set' && meld.cards.length === 4;
  if (isCompleteSet) {
    const hasJoker = meld.cards.some((c) => c.kind === 'joker');
    const naturals = meld.cards.filter((c): c is Extract<Card, { kind: 'natural' }> => c.kind === 'natural');
    const wantRed = hasJoker;
    const top =
      naturals.find((c) => (wantRed ? cardColor(c) === 'red' : cardColor(c) === 'black')) ??
      naturals[0] ??
      meld.cards[0];
    return (
      <div className={`relative rounded-lg p-1 ${armedCls}`} onClick={onClick} data-meld={meld.id}>
        {/* stacked shadows behind, to read as a pile of four */}
        <span className="pointer-events-none absolute left-2.5 top-2.5 h-24 w-16 rounded-md border border-[#cfc9b4] bg-[#eae4d3] shadow" />
        <span className="pointer-events-none absolute left-2 top-2 h-24 w-16 rounded-md border border-[#cfc9b4] bg-[#efe9d8] shadow" />
        <span className="pointer-events-none absolute left-1.5 top-1.5 h-24 w-16 rounded-md border border-[#cfc9b4] bg-[#f3edda] shadow" />
        <div className="relative"><CardFace card={top} size="sm" /></div>
      </div>
    );
  }

  return (
    <div
      className={`flex rounded-lg p-1 ${armedCls}`}
      onClick={onClick}
      data-meld={meld.id}
    >
      {ordered.map((c) => (
        <div key={c.id} className="-ml-8 first:ml-0"><CardFace card={c} size="sm" /></div>
      ))}
    </div>
  );
}
