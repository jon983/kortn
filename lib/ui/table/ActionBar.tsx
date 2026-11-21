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
  view, onReturnDiscard, jokerOwed = false, onReturnJoker,
}: {
  view: ClientView; onReturnDiscard: () => void;
  /** A joker reclaimed this turn is still in hand (must be melded or put back). */
  jokerOwed?: boolean; onReturnJoker?: () => void;
}) {
  // Whose turn it is already shows in the top bar; render nothing here when it's
  // not your turn (or before you've drawn) so the hand never shifts.
  if (!isMyTurn(view) || view.phase === 'awaitingDraw') {
    return null;
  }
  return (
    <div className="flex flex-col items-center gap-2">
      {view.you.drawObligationId && (
        <div className="deli-paper flex items-center gap-3 rounded-[4px] px-3 py-1 text-deli-green shadow-md">
          <span className="font-sans-deli text-xs">Can&apos;t use the card you took?</span>
          <button type="button" className="font-script text-[16px] text-deli-red underline" onClick={onReturnDiscard}>
            Put it back &amp; draw from stock
          </button>
        </div>
      )}
      {jokerOwed && (
        <div className="deli-paper flex items-center gap-3 rounded-[4px] px-3 py-1 text-deli-green shadow-md">
          <span className="font-sans-deli text-xs">Use the reclaimed joker in a new meld — or</span>
          <button type="button" className="font-script text-[16px] text-deli-red underline" onClick={onReturnJoker}>
            Put the joker back
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
  view, stagedGroups, onClearTray, onLayDown, canLayDown = false,
}: {
  view: ClientView; stagedGroups: { cards: Card[] }[]; onClearTray: () => void;
  onLayDown?: () => void; canLayDown?: boolean;
}) {
  if (stagedGroups.length === 0) return null;
  const staged = stagedPoints(stagedGroups);
  const toOpen = Math.max(0, OPEN_THRESHOLD - staged);
  return (
    <div className="deli-paper flex flex-wrap items-center justify-center gap-3 rounded-md px-3 py-2 text-deli-green shadow-xl">
      <span className="font-script text-[17px] text-deli-red">Laying down:</span>
      {stagedGroups.map((g, i) => (
        <span key={i} className="flex">{g.cards.map((c) => <span key={c.id} className="-ml-1 first:ml-0"><CardFace card={c} size="sm" /></span>)}</span>
      ))}
      <span className="font-cond text-[14px] font-extrabold uppercase tracking-[.06em]">{staged} pts{!view.you.hasOpened && toOpen > 0 ? ` · ${toOpen} to open` : ''}</span>
      <button type="button" className="font-script text-[16px] text-deli-green/60 hover:text-deli-red hover:underline" onClick={onClearTray}>clear</button>
      <button
        type="button"
        className="deli-pill deli-pill--green btn-lift !px-4 !py-2 !text-[14px]"
        disabled={!canLayDown}
        onClick={onLayDown}
      >
        Lay down ▸
      </button>
    </div>
  );
}
