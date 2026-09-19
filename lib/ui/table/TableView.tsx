// lib/ui/table/TableView.tsx
'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMatchStream } from './useMatchStream';
import { playAction } from '../../../app/actions/play';
import { Hand, sortHand } from './Hand';
import { OpponentSeat } from './OpponentSeat';
import { StockDiscard } from './StockDiscard';
import { MeldPile } from './MeldPile';
import { Card as CardFace } from './Card';
import { CardBack } from './CardBack';
import { ActionBar } from './ActionBar';
import { FlyingCard } from './FlyingCard';
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
  const [showScores, setShowScores] = useState(false);

  // --- draw / discard fly animations ---
  const rootRef = useRef<HTMLDivElement>(null);
  const stockRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);
  const [flight, setFlight] = useState<import('./FlyingCard').Flight | null>(null);
  const [flyHiddenId, setFlyHiddenId] = useState<string | null>(null);
  const flightKey = useRef(0);
  const drawSource = useRef<'stock' | 'discard' | null>(null);

  function rectIn(el: Element | null): { x: number; y: number } | null {
    const root = rootRef.current;
    if (!el || !root) return null;
    const r = el.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    return { x: r.left - b.left, y: r.top - b.top };
  }

  function startFlight(from: { x: number; y: number } | null, to: { x: number; y: number } | null, node: ReactNode) {
    if (!from || !to) return;
    flightKey.current += 1;
    setFlight({ key: flightKey.current, from, to, node });
  }
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Highlight newly-arrived cards (e.g. the one you just drew) so it's easy to spot.
  const prevHandIds = useRef<Set<string>>(new Set(view.you.hand.map((c) => c.id)));
  const [newIds, setNewIds] = useState<string[]>([]);
  useEffect(() => {
    const current = view.you.hand.map((c) => c.id);
    const added = current.filter((id) => !prevHandIds.current.has(id));
    prevHandIds.current = new Set(current);
    if (added.length) {
      setNewIds(added);
      // Fly the drawn card from its pile into the hand.
      const src = drawSource.current;
      drawSource.current = null;
      const landedId = added[added.length - 1];
      if (src) {
        const from = rectIn(src === 'stock' ? stockRef.current : discardRef.current);
        const to = rectIn(rootRef.current?.querySelector(`[data-card-id="${landedId}"]`) ?? null);
        const card = view.you.hand.find((c) => c.id === landedId);
        if (from && to) {
          setFlyHiddenId(landedId);
          startFlight(from, to, src === 'stock' ? <CardBack pack="A" /> : (card ? <CardFace card={card} /> : null));
          setTimeout(() => setFlyHiddenId(null), 340);
        }
      }
      const t = setTimeout(() => setNewIds([]), 4000);
      return () => clearTimeout(t);
    }
  }, [view.you.hand]); // eslint-disable-line react-hooks/exhaustive-deps

  const hand = useMemo(() => {
    const byId = new Map(view.you.hand.map((c) => [c.id, c] as const));
    const base = order ? order.filter((id) => byId.has(id)) : sortHand(view.you.hand).map((c) => c.id);
    for (const c of view.you.hand) if (!base.includes(c.id)) base.push(c.id);
    return base.map((id) => byId.get(id)!).filter(Boolean);
  }, [view.you.hand, order]);

  // Cards moved into the laying-down tray shouldn't also appear in the hand.
  const stagedIds = useMemo(() => new Set(staged.flatMap((g) => g.cards.map((c) => c.id))), [staged]);
  const handInPlay = hand.filter((c) => !stagedIds.has(c.id));
  const selectedCards = handInPlay.filter((c) => selected.includes(c.id));
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
    drawSource.current = 'stock';
    submit({ type: 'draw', source: 'stock' });
  }

  async function handleTakeDiscard() {
    const top = view.discard[view.discard.length - 1];
    drawSource.current = 'discard';
    const res = await playAction(matchId, { type: 'draw', source: 'discard' });
    if (res.ok) {
      if (top) setObligationId(top.id);
    } else {
      drawSource.current = null;
      setObligationId(null);
      setToast(res.reason ?? 'illegal move');
    }
  }

  // Put the just-taken discard back and draw from stock instead.
  async function handleReturnDiscard() {
    const res = await playAction(matchId, { type: 'returnDiscard' });
    if (!res.ok) { setToast(res.reason ?? 'illegal move'); return; }
    drawSource.current = 'stock';
    setObligationId(null);
    setSelected([]);
    await playAction(matchId, { type: 'draw', source: 'stock' });
  }

  return (
    <div ref={rootRef} className="relative flex min-h-screen flex-col bg-[url(/art/table-surface.jpg)] bg-cover bg-center text-bone">
      {/* status bar */}
      <div className="grid grid-cols-3 items-center bg-black/40 px-4 py-2 text-xs">
        <span className="flex items-center gap-3 justify-self-start">
          <span>Round {view.roundNumber}</span>
          <button
            type="button"
            onClick={() => setShowScores((s) => !s)}
            className="rounded-md border border-brass/60 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brass hover:bg-brass/10"
          >
            {showScores ? 'Hide scores' : 'Scores'}
          </button>
        </span>
        <span className="justify-self-center">
          {isMyTurn(view) ? (
            <span className="animate-pulse rounded-full bg-brass px-4 py-1 text-base font-extrabold uppercase tracking-wide text-[#2a1c12] shadow-[0_0_16px_rgba(232,180,90,.6)]">
              ● Your turn
            </span>
          ) : (
            <span className="text-[#c9b48a]">{view.seatNames[view.currentTurn]}&apos;s turn</span>
          )}
        </span>
        <span className="justify-self-end text-[#c9a24b]">Pot {view.pot}</span>
      </div>

      {/* scoreboard (toggle) */}
      {showScores && (
        <div className="absolute left-1/2 top-12 z-20 -translate-x-1/2 rounded-lg border-2 border-brass bg-[#2a1c12] p-4 text-sm shadow-2xl">
          <table className="min-w-[14rem]">
            <thead>
              <tr className="border-b border-brass/30 text-[11px] uppercase tracking-widest text-[#c9b48a]">
                <th className="pb-1 text-left font-normal">Player</th>
                <th className="pb-1 pl-6 text-right font-normal">Points</th>
                <th className="pb-1 pl-4 text-right font-normal">Bits</th>
              </tr>
            </thead>
            <tbody>
              {[
                { seat: view.you.seat, score: view.you.score, bits: view.you.bits, you: true },
                ...view.opponents.map((o) => ({ seat: o.seat, score: o.score, bits: o.bits, you: false })),
              ]
                .sort((a, b) => a.seat - b.seat)
                .map((r) => (
                  <tr key={r.seat}>
                    <td className="py-0.5 text-left">{view.seatNames[r.seat]}{r.you ? ' (you)' : ''}</td>
                    <td className="py-0.5 pl-6 text-right tabular-nums">{r.score}</td>
                    <td className="py-0.5 pl-4 text-right tabular-nums">{r.bits > 0 ? `+${r.bits}` : r.bits}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* opponents */}
      <div className="flex flex-wrap justify-around gap-4 p-3">
        {view.opponents.map((o) => (
          <OpponentSeat
            key={o.seat}
            name={view.seatNames[o.seat]}
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

      {/* spacer: keeps opponents pinned to the top and the hand to the bottom */}
      <div className="flex-1" />

      {/* Stock/discard pinned dead-centre in their own layer — nothing else can
          reflow or "jerk" them. */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <div className="pointer-events-auto">
          <StockDiscard
            stockCount={view.stockCount}
            discardTop={view.discard[view.discard.length - 1]}
            stockRef={stockRef}
            discardRef={discardRef}
            onDrawStock={isMyTurn(view) && view.phase === 'awaitingDraw' ? handleDrawStock : undefined}
            onTakeDiscard={isMyTurn(view) && view.phase === 'awaitingDraw' ? handleTakeDiscard : undefined}
          />
        </div>
      </div>

      {/* Viewer's melds in a separate layer just below the piles, growing
          downward so adding a meld never moves the piles. */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-0 mt-24 flex flex-col items-center gap-2 px-4">
        <div className="pointer-events-auto flex flex-wrap justify-center gap-3">
          {view.melds
            .filter((m) => m.ownerSeat === view.seat)
            .map((m) => (
              <MeldPile key={m.id} meld={m} armed={layoffArmed} onClick={() => handleLayoff(m.id)} />
            ))}
        </div>
      </div>

      {/* viewer's area */}
      <div className="bg-gradient-to-t from-black/60 to-transparent p-3">
        <ActionBar
          view={view}
          selectedCards={selectedCards}
          stagedGroups={staged}
          layDownEnabled={layDownEnabled}
          discardEnabled={discardEnabled}
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
            const id = selected[0];
            if (id) {
              // fly the card from its place in the hand to the discard pile
              const card = handInPlay.find((c) => c.id === id);
              const from = rectIn(rootRef.current?.querySelector(`[data-card-id="${id}"]`) ?? null);
              const to = rectIn(discardRef.current);
              if (card) startFlight(from, to, <CardFace card={card} />);
              submit({ type: 'discard', cardId: id });
            }
            setSelected([]);
          }}
          onClearTray={() => setStaged([])}
          onReturnDiscard={handleReturnDiscard}
        />
        <div className="mt-2">
          <Hand
            cards={handInPlay}
            selectedIds={selected}
            onToggle={(id) =>
              setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
            }
            onReorder={setOrder}
            onSort={() => setOrder(sortHand(view.you.hand).map((c) => c.id))}
            highlightIds={newIds}
            hiddenId={flyHiddenId}
          />
        </div>
      </div>

      {/* draw / discard fly animation */}
      {flight && <FlyingCard flight={flight} onDone={() => setFlight(null)} />}

      {/* toast */}
      {toast && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded bg-maroon px-3 py-2 text-sm">
          {toast}
        </div>
      )}

      {/* overlays */}
      {view.matchFinished && <MatchSummary view={view} />}
      {!view.matchFinished && view.roundFinished && view.you.status === 'busted' && !view.you.rebought ? (
        <RebuyPrompt
          onRebuy={() => submit({ type: 'rebuy' })}
          onDecline={() => submit({ type: 'decline' })}
        />
      ) : (!view.matchFinished && view.roundFinished && (
        <RoundSummary view={view} onReady={() => submit({ type: 'readyNext' })} />
      ))}
    </div>
  );
}
