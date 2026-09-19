// lib/ui/table/TableView.tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useMatchStream } from './useMatchStream';
import { playAction } from '../../../app/actions/play';
import { Hand, sortHand } from './Hand';
import { OpponentSeat } from './OpponentSeat';
import { StockDiscard } from './StockDiscard';
import { MeldPile } from './MeldPile';
import { ActionBar } from './ActionBar';
import { RoundSummary, RebuyPrompt, MatchSummary } from './overlays';
import { evaluateMeld, canOpen, isMyTurn } from './legality';
import type { Action } from '../../kalooki';
import type { ClientView, ServerAction } from '../../server';

export function TableView({ matchId, initial }: { matchId: string; initial: ClientView }) {
  const view = useMatchStream(matchId, initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [staged, setStaged] = useState<{ cards: import('../../kalooki').Card[] }[]>([]);
  const [order, setOrder] = useState<string[] | null>(null);
  const [obligationId, setObligationId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const hand = useMemo(() => {
    const byId = new Map(view.you.hand.map((c) => [c.id, c] as const));
    const base = order ? order.filter((id) => byId.has(id)) : sortHand(view.you.hand).map((c) => c.id);
    for (const c of view.you.hand) if (!base.includes(c.id)) base.push(c.id);
    return base.map((id) => byId.get(id)!).filter(Boolean);
  }, [view.you.hand, order]);

  const selectedCards = hand.filter((c) => selected.includes(c.id));
  const trayIncludesObligation = !obligationId || staged.some((g) => g.cards.some((c) => c.id === obligationId));
  const layDownEnabled = staged.length > 0 && canOpen(view, staged) && trayIncludesObligation;
  const discardEnabled = selected.length === 1 && (!obligationId || trayIncludesObligation);
  // Lay-off is armed once you've opened, it's your turn to act, exactly one card is picked,
  // and it isn't the just-taken discard (which must start a new meld). Tap a table meld to add it.
  const layoffArmed =
    isMyTurn(view) && view.phase === 'awaitingDiscard' && view.you.hasOpened &&
    selected.length === 1 && !obligationId;

  async function submit(action: ServerAction) {
    const res = await playAction(matchId, action);
    if (!res.ok) setToast(res.reason ?? 'illegal move');
  }

  function handleLayoff(meldId: string) {
    if (!layoffArmed) return;
    submit({ type: 'layoff', cardId: selected[0], meldId });
    setSelected([]);
  }

  function handleDrawStock() {
    submit({ type: 'draw', source: 'stock' });
  }

  async function handleTakeDiscard() {
    const top = view.discard[view.discard.length - 1];
    const res = await playAction(matchId, { type: 'draw', source: 'discard' });
    if (res.ok) {
      if (top) setObligationId(top.id);
    } else {
      setObligationId(null);
      setToast(res.reason ?? 'illegal move');
    }
  }

  return (
    <div className="relative min-h-screen bg-[url(/art/table-surface.jpg)] bg-cover bg-center text-bone">
      {/* status bar */}
      <div className="flex justify-between bg-black/40 px-4 py-2 text-xs">
        <span>Round {view.roundNumber} · 40 to open</span>
        <span className="text-brass">
          {isMyTurn(view) ? 'Your turn' : `Seat ${view.currentTurn}'s turn`}
        </span>
        <span className="text-[#c9a24b]">Pot {view.pot}</span>
      </div>

      {/* opponents */}
      <div className="flex flex-wrap justify-around p-3">
        {view.opponents.map((o) => (
          <OpponentSeat
            key={o.seat}
            name={`Seat ${o.seat}`}
            handCount={o.handCount}
            score={o.score}
            status={o.status}
            hasOpened={o.hasOpened}
            isTurn={view.currentTurn === o.seat}
            melds={view.melds.filter((m) => m.ownerSeat === o.seat)}
            meldsArmed={layoffArmed}
            onMeldClick={handleLayoff}
          />
        ))}
      </div>

      {/* center: stock + discard */}
      <div className="flex justify-center py-4">
        <StockDiscard
          stockCount={view.stockCount}
          discardTop={view.discard[view.discard.length - 1]}
          onDrawStock={isMyTurn(view) && view.phase === 'awaitingDraw' ? handleDrawStock : undefined}
          onTakeDiscard={isMyTurn(view) && view.phase === 'awaitingDraw' ? handleTakeDiscard : undefined}
        />
      </div>

      {/* viewer's melds */}
      <div className="flex flex-wrap justify-center gap-3 px-4">
        {view.melds
          .filter((m) => m.ownerSeat === view.seat)
          .map((m) => (
            <MeldPile key={m.id} meld={m} armed={layoffArmed} onClick={() => handleLayoff(m.id)} />
          ))}
      </div>
      {layoffArmed && (
        <div className="text-center text-xs italic text-brass">Tap a meld to lay off your selected card</div>
      )}

      {/* viewer's area */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
        <ActionBar
          view={view}
          selectedCards={selectedCards}
          stagedGroups={staged}
          layDownEnabled={layDownEnabled}
          discardEnabled={discardEnabled}
          onDrawStock={handleDrawStock}
          onTakeDiscard={handleTakeDiscard}
          onStageMeld={() => {
            const e = evaluateMeld(selectedCards);
            if (e) {
              setStaged([...staged, { cards: selectedCards }]);
              setSelected([]);
            }
          }}
          onLayDown={() => {
            const groups = staged.map((g) => ({
              kind: evaluateMeld(g.cards)!.kind,
              cardIds: g.cards.map((c) => c.id),
            }));
            submit({ type: 'meld', groups } as Action);
            setStaged([]);
            setObligationId(null);
          }}
          onDiscard={() => {
            if (selected[0]) submit({ type: 'discard', cardId: selected[0] });
            setSelected([]);
          }}
          onClearTray={() => setStaged([])}
        />
        <div className="mt-2">
          <Hand
            cards={hand}
            selectedIds={selected}
            onToggle={(id) =>
              setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
            }
            onReorder={setOrder}
            onSort={() => setOrder(sortHand(view.you.hand).map((c) => c.id))}
          />
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded bg-maroon px-3 py-2 text-sm">
          {toast}
        </div>
      )}

      {/* overlays */}
      {view.roundFinished && !view.matchFinished && (
        <RoundSummary view={view} onContinue={() => { /* SSE will advance */ }} />
      )}
      {view.matchFinished && <MatchSummary view={view} />}
      {view.you.status === 'busted' && !view.matchFinished && (
        <RebuyPrompt
          onRebuy={() => submit({ type: 'rebuy' })}
          onDecline={() => submit({ type: 'decline' })}
        />
      )}
    </div>
  );
}
