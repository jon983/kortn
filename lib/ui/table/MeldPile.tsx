import { Card as CardFace } from './Card';
import { layoutMeld, type TableMeld } from '../../kalooki';

export function MeldPile({ meld, onClick, armed }: { meld: TableMeld; onClick?: () => void; armed?: boolean }) {
  const ordered = layoutMeld(meld.cards, meld.kind);
  return (
    <div
      className={`flex rounded-lg p-1 ${armed ? 'cursor-pointer ring-2 ring-brass ring-offset-2 ring-offset-transparent' : ''}`}
      onClick={onClick}
      data-meld={meld.id}
    >
      {ordered.map((c) => (
        <div key={c.id} className="-ml-8 first:ml-0"><CardFace card={c} size="sm" /></div>
      ))}
    </div>
  );
}
