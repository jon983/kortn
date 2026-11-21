'use client';
import { useEffect, useRef, useState } from 'react';
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

/** An entry in the hand row: a real card, or a spacer separator (card === null). */
export interface HandItem { id: string; card: Card | null }

// Hand geometry (px): md cards are w-24; spacers are w-7 with ml-2 either side.
const CARD_W = 96, SPACE_W = 28, SPACE_GAP = 8;
const BASE_OVERLAP = 40;  // the usual fan (-ml-10)
const MIN_SHOW = 18;      // never hide a card's corner index (rank + suit)

/** Total width of the hand row when fanned cards overlap by `overlap` px. */
export function handWidth(items: HandItem[], overlap: number): number {
  let w = 0;
  items.forEach((it, i) => {
    const own = it.card == null ? SPACE_W : CARD_W;
    if (i === 0) w += own;
    else if (it.card == null || items[i - 1].card == null) w += SPACE_GAP + own;
    else w += own - overlap;
  });
  return w;
}

/**
 * How far each card overlaps the one before it: the usual 40px when the hand
 * fits, more on narrow screens so the whole hand shows at once — but always
 * leaving each card's corner index visible (if it still can't fit, it scrolls).
 */
export function fanOverlap(items: HandItem[], width: number): number {
  if (!width) return BASE_OVERLAP;
  const extra = handWidth(items, BASE_OVERLAP) - width;
  if (extra <= 0) return BASE_OVERLAP;
  const fanned = items.filter((it, i) => i > 0 && it.card != null && items[i - 1].card != null).length;
  if (!fanned) return BASE_OVERLAP;
  return Math.min(CARD_W - MIN_SHOW, Math.ceil(BASE_OVERLAP + extra / fanned));
}

const DRAG_THRESHOLD = 6; // px of movement before a press becomes a drag (vs a tap)

export function Hand({
  items, selectedIds, onToggle, onReorder, highlightIds = [], hiddenId = null,
}: {
  items: HandItem[]; selectedIds: string[]; onToggle: (id: string) => void;
  onReorder: (ids: string[]) => void; highlightIds?: string[]; hiddenId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Pointer-based drag so it works with touch (iPad) as well as mouse.
  const drag = useRef<{ id: string; startX: number; active: boolean; pointerId: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Measure the room we have, so the fan can tighten to fit (phones).
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const overlap = fanOverlap(items, width);

  const isSpace = (id: string) => items.find((i) => i.id === id)?.card == null;

  // New order with the dragged item inserted where the pointer sits.
  function orderForPointer(clientX: number): string[] {
    const el = containerRef.current;
    const d = drag.current;
    if (!el || !d) return items.map((i) => i.id);
    const others = Array.from(el.querySelectorAll<HTMLElement>('[data-card-id]'))
      .filter((n) => n.dataset.cardId !== d.id);
    let insert = others.length;
    for (let i = 0; i < others.length; i++) {
      const r = others[i].getBoundingClientRect();
      if (clientX < r.left + r.width / 2) { insert = i; break; }
    }
    const rest = items.map((i) => i.id).filter((x) => x !== d.id);
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
    if (!d) return;
    if (!d.active) { onToggle(id); return; } // no movement → a tap
    // A spacer dragged off either end is removed.
    const ids = items.map((i) => i.id);
    const idx = ids.indexOf(id);
    if (isSpace(id) && (idx === 0 || idx === ids.length - 1)) {
      onReorder(ids.filter((x) => x !== id));
    }
  }

  // "safe" centring: if the hand still overflows, it scrolls from the first
  // card rather than clipping the start.
  return (
    <div ref={containerRef} className="flex overflow-x-auto pt-6 pb-2 [justify-content:safe_center]">
      {items.map((item, i) => {
        const space = item.card == null;
        const prevSpace = i > 0 && items[i - 1].card == null;
        // Cards fan with overlap; a spacer (and the card after it) break the fan.
        const margin = i === 0 ? '' : space || prevSpace ? 'ml-2' : '';
        const fan = i > 0 && !space && !prevSpace ? { marginLeft: -overlap } : undefined;
        return (
          <div
            key={item.id}
            data-card-id={item.id}
            style={{ touchAction: 'none', ...fan }}
            className={`${margin} shrink-0 ${hiddenId === item.id ? 'opacity-0' : ''} ${activeId === item.id ? 'z-20 scale-105' : ''}`}
            onPointerDown={(e) => onPointerDown(e, item.id)}
            onPointerMove={onPointerMove}
            onPointerUp={() => endDrag(item.id)}
            onPointerCancel={() => endDrag(item.id)}
          >
            {space ? (
              <div className="h-32 w-7 rounded-md border-2 border-dashed border-bone/25" aria-label="separator" />
            ) : (
              <CardFace card={item.card as Card} selected={selectedIds.includes(item.id)} highlight={highlightIds.includes(item.id)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
