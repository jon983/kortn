// lib/ui/table/ActionBar.tsx
'use client';
import { Card as CardFace } from './Card';
import { stagedPoints, OPEN_THRESHOLD, isMyTurn } from './legality';
import type { Card } from '../../kalooki';
import type { ClientView } from '../../server';

/**
 * Informational strip above the hand: whose turn it is, the lay-off/return
 * prompt, and the "laying down" tray. The action buttons (Meld / Lay down /
 * Discard) live in the control column beside the hand, not here.
 */
export function ActionBar({
  view, onReturnDiscard,
}: {
  view: ClientView; onReturnDiscard: () => void;
}) {
  if (!isMyTurn(view)) {
    return <div className="text-center text-sm italic text-[#c9b48a]">Waiting for {view.seatNames[view.currentTurn]}…</div>;
  }
  if (view.phase === 'awaitingDraw') {
    return null;
  }
  return (
    <div className="flex flex-col items-center gap-2">
      {view.you.drawObligationId && (
        <div className="flex items-center gap-3 rounded-md bg-black/30 px-3 py-1">
          <span className="text-xs italic text-[#c9b48a]">Can&apos;t use the card you took?</span>
          <button type="button" className="text-xs font-bold underline text-brass" onClick={onReturnDiscard}>
            Put it back &amp; draw from stock
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The "laying down" tray. Rendered as a floating overlay near the centre of the
 * table (not in the hand's flow) so staging melds never pushes the hand off-screen.
 */
export function LayingDownTray({
  view, stagedGroups, onClearTray,
}: {
  view: ClientView; stagedGroups: { cards: Card[] }[]; onClearTray: () => void;
}) {
  if (stagedGroups.length === 0) return null;
  const staged = stagedPoints(stagedGroups);
  const toOpen = Math.max(0, OPEN_THRESHOLD - staged);
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-brass/40 bg-black/75 px-3 py-2 shadow-xl backdrop-blur">
      <span className="text-xs text-[#c9b48a]">Laying down:</span>
      {stagedGroups.map((g, i) => (
        <span key={i} className="flex">{g.cards.map((c) => <span key={c.id} className="-ml-1 first:ml-0"><CardFace card={c} size="sm" /></span>)}</span>
      ))}
      <span className="text-xs text-brass">{staged} pts{!view.you.hasOpened && toOpen > 0 ? ` · ${toOpen} to open` : ''}</span>
      <button type="button" className="text-xs underline text-[#c9b48a]" onClick={onClearTray}>clear</button>
    </div>
  );
}
