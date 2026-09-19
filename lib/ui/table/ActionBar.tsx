// lib/ui/table/ActionBar.tsx
'use client';
import { Card as CardFace } from './Card';
import { evaluateMeld, stagedPoints, OPEN_THRESHOLD, isMyTurn } from './legality';
import type { Card } from '../../kalooki';
import type { ClientView } from '../../server';

const btn = 'rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-4 py-2 text-sm font-bold text-bone shadow disabled:opacity-40 disabled:cursor-not-allowed';

export function ActionBar({
  view, selectedCards, stagedGroups, layDownEnabled, discardEnabled,
  onStageMeld, onLayDown, onDiscard, onClearTray, onReturnDiscard,
}: {
  view: ClientView; selectedCards: Card[]; stagedGroups: { cards: Card[] }[];
  layDownEnabled: boolean; discardEnabled: boolean;
  onStageMeld: () => void; onLayDown: () => void; onDiscard: () => void; onClearTray: () => void;
  onReturnDiscard: () => void;
}) {
  if (!isMyTurn(view)) {
    return <div className="text-center text-sm italic text-[#c9b48a]">Waiting for seat {view.currentTurn}…</div>;
  }
  if (view.phase === 'awaitingDraw') {
    return null;
  }
  const meldValid = !!evaluateMeld(selectedCards);
  const staged = stagedPoints(stagedGroups);
  const toOpen = Math.max(0, OPEN_THRESHOLD - staged);
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
      {stagedGroups.length > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-black/30 px-3 py-1">
          <span className="text-xs text-[#c9b48a]">Laying down:</span>
          {stagedGroups.map((g, i) => (
            <span key={i} className="flex">{g.cards.map((c) => <span key={c.id} className="-ml-1 first:ml-0"><CardFace card={c} size="sm" /></span>)}</span>
          ))}
          <span className="text-xs text-brass">{staged} pts{!view.you.hasOpened && toOpen > 0 ? ` · ${toOpen} to open` : ''}</span>
          <button type="button" className="text-xs underline text-[#c9b48a]" onClick={onClearTray}>clear</button>
        </div>
      )}
      <div className="flex justify-center gap-3">
        <button type="button" className={btn} onClick={onStageMeld} disabled={!meldValid}>Meld</button>
        <button type="button" className={btn} onClick={onLayDown} disabled={!layDownEnabled}>Lay down</button>
        <button type="button" className={btn} onClick={onDiscard} disabled={!discardEnabled}>Discard</button>
      </div>
    </div>
  );
}
