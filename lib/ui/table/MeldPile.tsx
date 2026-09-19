import { Card as CardFace } from './Card';
import { layoutMeld, type TableMeld } from '../../kalooki';

export function MeldPile({ meld, onClick }: { meld: TableMeld; onClick?: () => void }) {
  const ordered = layoutMeld(meld.cards, meld.kind);
  return (
    <div className="flex" onClick={onClick} data-meld={meld.id}>
      {ordered.map((c) => (
        <div key={c.id} className="-ml-8 first:ml-0"><CardFace card={c} size="sm" /></div>
      ))}
    </div>
  );
}
