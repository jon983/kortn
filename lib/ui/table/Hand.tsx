'use client';
import { useRef } from 'react';
import { Card as CardFace } from './Card';
import type { Card } from '../../kalooki';

const SUIT_ORDER: Record<string, number> = { clubs: 0, diamonds: 1, hearts: 2, spades: 3 };

export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const aj = a.kind === 'joker', bj = b.kind === 'joker';
    if (aj !== bj) return aj ? 1 : -1;           // jokers last
    if (aj && bj) return a.id.localeCompare(b.id);
    const an = a as Extract<Card, { kind: 'natural' }>;
    const bn = b as Extract<Card, { kind: 'natural' }>;
    if (an.rank !== bn.rank) return an.rank - bn.rank;
    return SUIT_ORDER[an.suit] - SUIT_ORDER[bn.suit];
  });
}

export function Hand({
  cards, selectedIds, onToggle, onReorder, onSort, highlightIds = [],
}: {
  cards: Card[]; selectedIds: string[]; onToggle: (id: string) => void;
  onReorder: (ids: string[]) => void; onSort: () => void; highlightIds?: string[];
}) {
  const dragId = useRef<string | null>(null);
  function onDrop(targetId: string) {
    const from = dragId.current; dragId.current = null;
    if (!from || from === targetId) return;
    const ids = cards.map((c) => c.id);
    const fromIdx = ids.indexOf(from), toIdx = ids.indexOf(targetId);
    ids.splice(toIdx, 0, ids.splice(fromIdx, 1)[0]);
    onReorder(ids);
  }
  return (
    <div>
      <div className="mb-2 flex justify-center">
        <button type="button" onClick={onSort}
          className="rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#8a6a3a,#5c4426)] px-3 py-1 text-sm font-bold text-bone">
          ↕ Sort
        </button>
      </div>
      <div className="flex justify-center overflow-x-auto pt-6 pb-2">
        {cards.map((c) => (
          <div key={c.id} className="-ml-10 first:ml-0 shrink-0" draggable
            onDragStart={() => (dragId.current = c.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(c.id)}>
            <CardFace card={c} selected={selectedIds.includes(c.id)} highlight={highlightIds.includes(c.id)} onClick={() => onToggle(c.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
