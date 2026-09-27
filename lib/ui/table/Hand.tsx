'use client';
import { useRef, useState } from 'react';
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

const DRAG_THRESHOLD = 6; // px of movement before a press becomes a drag (vs a tap)

export function Hand({
  cards, selectedIds, onToggle, onReorder, highlightIds = [], hiddenId = null,
}: {
  cards: Card[]; selectedIds: string[]; onToggle: (id: string) => void;
  onReorder: (ids: string[]) => void; highlightIds?: string[]; hiddenId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Pointer-based drag so it works with touch (iPad) as well as mouse; HTML5
  // drag-and-drop doesn't fire for touch on iOS Safari.
  const drag = useRef<{ id: string; startX: number; active: boolean; pointerId: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // New order with the dragged card inserted where the pointer sits.
  function orderForPointer(clientX: number): string[] {
    const el = containerRef.current;
    const d = drag.current;
    if (!el || !d) return cards.map((c) => c.id);
    const others = Array.from(el.querySelectorAll<HTMLElement>('[data-card-id]'))
      .filter((n) => n.dataset.cardId !== d.id);
    let insert = others.length;
    for (let i = 0; i < others.length; i++) {
      const r = others[i].getBoundingClientRect();
      if (clientX < r.left + r.width / 2) { insert = i; break; }
    }
    const rest = cards.map((c) => c.id).filter((x) => x !== d.id);
    rest.splice(insert, 0, d.id);
    return rest;
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    drag.current = { id, startX: e.clientX, active: false, pointerId: e.pointerId };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (!d.active) {
      if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD) return;
      d.active = true;
      setActiveId(d.id);
      (e.currentTarget as HTMLElement).setPointerCapture?.(d.pointerId);
    }
    e.preventDefault();
    onReorder(orderForPointer(e.clientX));
  }

  function endDrag(id: string) {
    const d = drag.current;
    drag.current = null;
    setActiveId(null);
    if (d && !d.active) onToggle(id); // no meaningful movement → treat as a tap
  }

  return (
    <div ref={containerRef} className="flex justify-center overflow-x-auto pt-6 pb-2">
      {cards.map((c) => (
        <div
          key={c.id}
          data-card-id={c.id}
          style={{ touchAction: 'none' }}
          className={`-ml-10 shrink-0 first:ml-0 ${hiddenId === c.id ? 'opacity-0' : ''} ${activeId === c.id ? 'z-20 scale-105' : ''}`}
          onPointerDown={(e) => onPointerDown(e, c.id)}
          onPointerMove={onPointerMove}
          onPointerUp={() => endDrag(c.id)}
          onPointerCancel={() => endDrag(c.id)}
        >
          <CardFace card={c} selected={selectedIds.includes(c.id)} highlight={highlightIds.includes(c.id)} />
        </div>
      ))}
    </div>
  );
}
