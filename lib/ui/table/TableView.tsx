// lib/ui/table/TableView.tsx
'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useMatchStream } from './useMatchStream';
import { playAction } from '../../../app/actions/play';
import { Hand, sortHand } from './Hand';
import { OpponentSeat } from './OpponentSeat';
import { StockDiscard } from './StockDiscard';
import { MeldPile } from './MeldPile';
import { Card as CardFace } from './Card';
import { CardBack } from './CardBack';
import { ActionBar, LayingDownTray } from './ActionBar';
import { FlyingCard } from './FlyingCard';
import { RoundSummary, RebuyPrompt, MatchSummary, ScorePad } from './overlays';
import { evaluateMeld, canOpen, isMyTurn } from './legality';
import { arrangeRun, type Action } from '../../kalooki';
import type { ClientView, ServerAction } from '../../server';

const ctrlBtn = 'rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-4 py-2 text-sm font-bold text-bone shadow disabled:cursor-not-allowed disabled:opacity-40';

export function TableView({ matchId, initial }: { matchId: string; initial: ClientView }) {
  const view = useMatchStream(matchId, initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [staged, setStaged] = useState<{ cards: import('../../kalooki').Card[] }[]>([]);
  const [order, setOrder] = useState<string[] | null>(null);
  const [obligationId, setObligationId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showScores, setShowScores] = useState(false);
  // While a discard is in flight/settling, keep showing the thrown card on the pile
  // so the previous top never flashes back before the server state catches up.
  const [discardHold, setDiscardHold] = useState<import('../../kalooki').Card | null>(null);
  const pendingDiscard = useRef<import('../../kalooki').Card | null>(null);
  // Melds that just appeared/grew — pulse them so everyone sees what was laid down.
  const [flashMelds, setFlashMelds] = useState<string[]>([]);
  // Melds the local player just changed — their fly animation is launched
  // explicitly (from the actual card), so the meld-diff effect skips flying them.
  const suppressMeldFly = useRef<Set<string>>(new Set());
  // When laying a joker onto a run that could take it at either end, hold the
  // pending lay-off until the player picks an end.
  const [pendingLayoff, setPendingLayoff] = useState<{ meldId: string } | null>(null);
  // Deal animation: card-backs fly from the stock out to each seat on a new hand.
  const [dealing, setDealing] = useState(false);
  const prevRound = useRef(view.roundNumber);
  const dealTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // --- draw / discard fly animations ---
  const rootRef = useRef<HTMLDivElement>(null);
  const stockRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);
  const [flights, setFlights] = useState<import('./FlyingCard').Flight[]>([]);
  const [flyHiddenId, setFlyHiddenId] = useState<string | null>(null);
  const flightKey = useRef(0);

  function rectIn(el: Element | null): { x: number; y: number } | null {
    const root = rootRef.current;
    if (!el || !root) return null;
    const r = el.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    return { x: r.left - b.left, y: r.top - b.top };
  }
  // Centre of an element (relative to the table). Used as the origin for
  // seat-sourced flights so cards fly from the middle of a player's area (their
  // hand) rather than its top-left corner.
  function centerIn(el: Element | null): { x: number; y: number } | null {
    const root = rootRef.current;
    if (!el || !root) return null;
    const r = el.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    return { x: r.left - b.left + r.width / 2 - 48, y: r.top - b.top + r.height / 2 - 64 };
  }

  function startFlight(from: { x: number; y: number } | null, to: { x: number; y: number } | null, node: ReactNode) {
    if (!from || !to) return;
    flightKey.current += 1;
    setFlights((f) => [...f, { key: flightKey.current, from, to, node }]);
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
      // The draw flight is launched immediately on click (see handleDraw*), so
      // here we only flag the newly-arrived card(s) so they're easy to spot.
      setNewIds(added);
      const t = setTimeout(() => setNewIds([]), 4000);
      return () => clearTimeout(t);
    }
  }, [view.you.hand]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly a drawn card from a pile straight into the hand area, immediately on
  // click — no waiting for the server round-trip.
  function flyDrawToHand(from: { x: number; y: number } | null, node: ReactNode) {
    startFlight(from, centerIn(rootRef.current?.querySelector('[data-hand]') ?? null), node);
  }

  // Animate an opponent's throw: when the discard pile grows on a turn an
  // opponent held, fly the discarded card from their seat to the pile.
  const prevDiscardLen = useRef(view.discard.length);
  const prevTurn = useRef(view.currentTurn);
  useEffect(() => {
    const top = view.discard[view.discard.length - 1];
    const grew = view.discard.length > prevDiscardLen.current;
    const discarder = prevTurn.current;
    if (grew && top && discarder !== view.seat) {
      const from = rectIn(rootRef.current?.querySelector(`[data-seat="${discarder}"]`) ?? null);
      const to = rectIn(discardRef.current);
      startFlight(from, to, <CardFace card={top} />);
    }
    prevDiscardLen.current = view.discard.length;
    prevTurn.current = view.currentTurn;
  }, [view.discard, view.currentTurn, view.seat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate melds being laid down / added to, for every seat. When a meld first
  // appears (or grows), fly a card from its owner's seat to the meld and pulse it.
  const prevMelds = useRef<Map<string, number>>(
    new Map(view.melds.map((m) => [m.id, m.cards.length])),
  );
  useEffect(() => {
    const changed = view.melds.filter((m) => (prevMelds.current.get(m.id) ?? 0) < m.cards.length);
    prevMelds.current = new Map(view.melds.map((m) => [m.id, m.cards.length]));
    if (!changed.length) return;
    // pulse the changed melds briefly
    setFlashMelds(changed.map((m) => m.id));
    const clear = setTimeout(() => setFlashMelds([]), 1500);
    // Fly a representative card from the acting player's seat to the meld. The
    // card comes from whoever is taking the turn (the actor), not the meld's
    // owner — a lay-off onto someone else's meld still flies from your hand.
    const actorSeat = view.currentTurn;
    for (const m of changed) {
      // Local changes animate from the real card in handleLayoff/lay-down; skip.
      if (suppressMeldFly.current.has(m.id)) { suppressMeldFly.current.delete(m.id); continue; }
      const fromEl =
        actorSeat === view.seat
          ? rootRef.current?.querySelector('[data-hand]')
          : rootRef.current?.querySelector(`[data-seat="${actorSeat}"]`);
      const from = centerIn(fromEl ?? null);
      const to = rectIn(rootRef.current?.querySelector(`[data-meld="${m.id}"]`) ?? null);
      const face = m.cards[m.cards.length - 1] ?? m.cards[0];
      if (from && to && face) startFlight(from, to, <CardFace card={face} />);
    }
    return () => clearTimeout(clear);
  }, [view.melds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Release the discard hold once the real pile top is the card we threw.
  useEffect(() => {
    if (!discardHold) return;
    if (view.discard[view.discard.length - 1]?.id === discardHold.id) setDiscardHold(null);
  }, [view.discard, discardHold]);

  // A discarded card is hidden in the hand while it flies; once the server has
  // removed it from the hand for real, drop the hide. (Draw hides a card that
  // stays in hand, so this only fires for the discard case.)
  useEffect(() => {
    if (flyHiddenId && !view.you.hand.some((c) => c.id === flyHiddenId)) setFlyHiddenId(null);
  }, [view.you.hand, flyHiddenId]);

  // Deal animation: when a new hand is dealt, fly card-backs from the stock to
  // each seat, round-robin, pacing ~13 cards over ~4s, then reveal the hands.
  useEffect(() => {
    if (view.roundNumber === prevRound.current) return;
    prevRound.current = view.roundNumber;
    if (view.phase !== 'awaitingDraw') return; // only a fresh deal
    const root = rootRef.current;
    const source = centerIn(stockRef.current);
    if (!root || !source) return;

    const seatCount = view.seatNames.length;
    const targets: ({ x: number; y: number } | null)[] = [];
    for (let s = 0; s < seatCount; s++) {
      const el = s === view.seat
        ? root.querySelector('[data-hand]')
        : root.querySelector(`[data-seat="${s}"]`);
      targets[s] = centerIn(el);
    }

    dealTimers.current.forEach(clearTimeout);
    dealTimers.current = [];
    setDealing(true);
    const STEP = Math.max(55, Math.round(4000 / (13 * seatCount)));
    const DUR = 420;
    let i = 0;
    for (let round = 0; round < 13; round++) {
      for (let s = 0; s < seatCount; s++) {
        const t = targets[s];
        if (!t) continue;
        const pack = (round + s) % 2 === 0 ? 'A' : 'B';
        dealTimers.current.push(setTimeout(() => startFlight(source, t, <CardBack pack={pack} />), i * STEP));
        i++;
      }
    }
    dealTimers.current.push(setTimeout(() => setDealing(false), i * STEP + DUR));
    return () => { dealTimers.current.forEach(clearTimeout); dealTimers.current = []; };
  }, [view.roundNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate an opponent's draw: when a seat's hand grows by one, fly a back from
  // the stock (or the taken card's face from the discard) to their seat.
  const prevOppCounts = useRef<Map<number, number>>(new Map(view.opponents.map((o) => [o.seat, o.handCount])));
  const prevStockCount = useRef(view.stockCount);
  const prevDrawDiscardTop = useRef(view.discard[view.discard.length - 1]);
  const prevRoundForDraw = useRef(view.roundNumber);
  useEffect(() => {
    const root = rootRef.current;
    const freshDeal = view.roundNumber !== prevRoundForDraw.current;
    if (!freshDeal && root && !dealing) {
      for (const o of view.opponents) {
        const prev = prevOppCounts.current.get(o.seat);
        if (prev != null && o.handCount === prev + 1) {
          const to = rectIn(root.querySelector(`[data-seat="${o.seat}"]`));
          if (prevStockCount.current > view.stockCount) {
            const pack = o.handPacks?.[o.handPacks.length - 1] ?? 'A';
            startFlight(rectIn(stockRef.current), to, <CardBack pack={pack} />);
          } else if (prevDrawDiscardTop.current) {
            startFlight(rectIn(discardRef.current), to, <CardFace card={prevDrawDiscardTop.current} />);
          }
        }
      }
    }
    prevOppCounts.current = new Map(view.opponents.map((o) => [o.seat, o.handCount]));
    prevStockCount.current = view.stockCount;
    prevDrawDiscardTop.current = view.discard[view.discard.length - 1];
    prevRoundForDraw.current = view.roundNumber;
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // A joker reclaimed this turn still in hand must be re-placed before discarding.
  const jokerOwed = (view.you.jokerObligationIds ?? []).some((id) => handInPlay.some((c) => c.id === id));
  // While melds are staged in the tray you must lay them down (or clear) first —
  // it's lay down or discard, never both in one turn.
  const discardEnabled = selected.length === 1 && (!obligationId || trayIncludesObligation) && !jokerOwed && staged.length === 0;

  // Seat the opponents around the table. 2p → top; 3p → left/right; 4p → left/top/right.
  // Side seats stack their melds vertically so they read as a column down each edge.
  const seating = useMemo(() => {
    const o = [...view.opponents].sort((a, b) => a.seat - b.seat);
    const n = o.length;
    if (n <= 1) return { left: [], top: o, right: [] };
    if (n === 2) return { left: [o[0]], top: [], right: [o[1]] };
    if (n === 3) return { left: [o[0]], top: [o[1]], right: [o[2]] };
    const k = Math.floor(n / 2);
    return { left: o.slice(0, k), top: o.slice(k, n - k), right: o.slice(n - k) };
  }, [view.opponents]);
  // Lay-off is armed once you've opened, it's your turn to act, one or more cards
  // are picked, and none is the just-taken discard (which must start a new meld).
  // Tap a table meld to add them; if the meld holds a joker and the cards complete
  // it, the joker is reclaimed automatically (engine decides). Tap a table meld to add.
  const layoffArmed =
    isMyTurn(view) && view.phase === 'awaitingDiscard' && view.you.hasOpened &&
    selected.length >= 1 && !obligationId;

  async function submit(action: ServerAction) {
    const res = await playAction(matchId, action);
    if (!res.ok) setToast(res.reason ?? 'illegal move');
  }

  const armedMeldIds = layoffArmed ? view.melds.map((m) => m.id) : [];

  function handleLayDown() {
    if (!layDownEnabled) return;
    const groups = staged.map((g) => ({
      kind: evaluateMeld(g.cards)!.kind,
      cardIds: g.cards.map((c) => c.id),
    }));
    submit({ type: 'meld', groups } as Action);
    setStaged([]);
    setObligationId(null);
  }

  function doLayoff(meldId: string, end?: 'low' | 'high') {
    const ids = [...selected];
    // Fly each laid-off card from its spot in the hand to the meld it's joining.
    const to = rectIn(rootRef.current?.querySelector(`[data-meld="${meldId}"]`) ?? null);
    for (const cardId of ids) {
      const from = rectIn(rootRef.current?.querySelector(`[data-card-id="${cardId}"]`) ?? null);
      const card = handInPlay.find((c) => c.id === cardId);
      if (from && to && card) startFlight(from, to, <CardFace card={card} />);
    }
    suppressMeldFly.current.add(meldId);
    submit({ type: 'layoff', cardIds: ids, meldId, ...(end ? { end } : {}) });
    setSelected([]);
    setPendingLayoff(null);
  }

  function onMeldTap(meldId: string) {
    if (!layoffArmed) return;
    const meld = view.melds.find((m) => m.id === meldId);
    const adds = handInPlay.filter((c) => selected.includes(c.id));
    // Placing a joker on a run can go on either end — if both are legal and
    // distinct, let the player choose which end rather than picking for them.
    if (meld?.kind === 'run' && adds.some((c) => c.kind === 'joker')) {
      const low = arrangeRun([...meld.cards, ...adds], 'low');
      const high = arrangeRun([...meld.cards, ...adds], 'high');
      const key = (cs: typeof low) => (cs ? cs.map((c) => c.id).join(',') : '');
      if (low && high && key(low) !== key(high)) {
        setPendingLayoff({ meldId });
        return;
      }
    }
    doLayoff(meldId);
  }

  const renderOpp = (o: ClientView['opponents'][number], orientation: 'row' | 'column') => (
    <div key={o.seat} data-seat={o.seat}>
      <OpponentSeat
        name={view.seatNames[o.seat]}
        handCount={o.handCount}
        handPacks={o.handPacks}
        score={o.score}
        status={o.status}
        hasOpened={o.hasOpened}
        isTurn={view.currentTurn === o.seat}
        melds={view.melds.filter((m) => m.ownerSeat === o.seat)}
        armedMeldIds={armedMeldIds}
        flashMeldIds={flashMelds}
        onMeldClick={onMeldTap}
        meldOrientation={orientation}
        hideCards={dealing}
      />
    </div>
  );

  function handleDrawStock() {
    flyDrawToHand(rectIn(stockRef.current), <CardBack pack={view.stockTopPack ?? 'A'} />);
    submit({ type: 'draw', source: 'stock' });
  }

  async function handleTakeDiscard() {
    const top = view.discard[view.discard.length - 1];
    if (top) flyDrawToHand(rectIn(discardRef.current), <CardFace card={top} />);
    const res = await playAction(matchId, { type: 'draw', source: 'discard' });
    if (res.ok) {
      if (top) setObligationId(top.id);
    } else {
      setObligationId(null);
      setToast(res.reason ?? 'illegal move');
    }
  }

  // Put the just-taken discard back and draw from stock instead.
  async function handleReturnDiscard() {
    const res = await playAction(matchId, { type: 'returnDiscard' });
    if (!res.ok) { setToast(res.reason ?? 'illegal move'); return; }
    setObligationId(null);
    setSelected([]);
    flyDrawToHand(rectIn(stockRef.current), <CardBack pack={view.stockTopPack ?? 'A'} />);
    await playAction(matchId, { type: 'draw', source: 'stock' });
  }

  return (
    <div ref={rootRef} className="relative flex min-h-screen flex-col bg-[url(/art/table-surface.jpg)] bg-cover bg-center text-bone">
      {/* status bar */}
      <div className="sticky top-0 z-30 grid grid-cols-3 items-center bg-black/60 px-4 py-2 text-xs backdrop-blur">
        <span className="flex items-center gap-3 justify-self-start">
          <Link href="/" className="rounded-md border border-brass/60 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brass hover:bg-brass/10">
            ⌂ Kitchen
          </Link>
          <span>Round {view.roundNumber}</span>
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
        <span className="flex items-center gap-3 justify-self-end">
          <button
            type="button"
            onClick={() => setShowScores((s) => !s)}
            className="rounded-md border border-brass/60 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brass hover:bg-brass/10"
          >
            {showScores ? 'Hide scores' : 'Scores'}
          </button>
          <span className="text-[#c9a24b]">Pot {view.pot}</span>
        </span>
      </div>

      {/* full scorecard (toggle) */}
      {showScores && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6" onClick={() => setShowScores(false)}>
          <div className="w-full max-w-3xl rounded-xl border-2 border-brass bg-[#2a1c12] p-6 text-bone shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-display)] text-2xl text-brass">Scorecard</h3>
              <button
                type="button"
                onClick={() => setShowScores(false)}
                className="rounded-md border border-brass/60 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brass hover:bg-brass/10"
              >
                Close
              </button>
            </div>
            <ScorePad view={view} />
          </div>
        </div>
      )}

      {/* Main table area: side seats flank a centre column (top seats + piles). */}
      <div className="flex min-h-0 flex-1">
        {seating.left.length > 0 && (
          <div className="flex flex-col justify-center gap-6 p-2">
            {seating.left.map((o) => renderOpp(o, 'column'))}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {seating.top.length > 0 && (
            <div className="flex flex-wrap justify-around gap-4 p-3">
              {seating.top.map((o) => renderOpp(o, 'row'))}
            </div>
          )}

          {/* stock + discard sit vertically centred; the viewer's melds just below */}
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
            <StockDiscard
              stockCount={view.stockCount}
              stockPack={view.stockTopPack}
              discardTop={discardHold ?? view.discard[view.discard.length - 1]}
              stockRef={stockRef}
              discardRef={discardRef}
              onDrawStock={!dealing && isMyTurn(view) && view.phase === 'awaitingDraw' ? handleDrawStock : undefined}
              onTakeDiscard={!dealing && isMyTurn(view) && view.phase === 'awaitingDraw' ? handleTakeDiscard : undefined}
            />
            <div className="flex flex-wrap justify-center gap-3 px-4">
              {view.melds
                .filter((m) => m.ownerSeat === view.seat)
                .map((m) => (
                  <MeldPile key={m.id} meld={m} armed={armedMeldIds.includes(m.id)} flash={flashMelds.includes(m.id)} onClick={() => onMeldTap(m.id)} />
                ))}
            </div>
          </div>
        </div>

        {seating.right.length > 0 && (
          <div className="flex flex-col justify-center gap-6 p-2">
            {seating.right.map((o) => renderOpp(o, 'column'))}
          </div>
        )}
      </div>

      {/* viewer's area */}
      <div className="bg-gradient-to-t from-black/60 to-transparent p-3" data-you-seat>
        <div className="mb-1 text-center">
          <div className={`text-sm font-bold ${isMyTurn(view) ? 'text-brass' : 'text-bone'}`}>
            {view.seatNames[view.seat]} <span className="text-[#c9b48a]">(you)</span>
          </div>
          <div className="text-[10px] text-[#c9b48a]">{view.you.handCount} cards · {view.you.score} pts</div>
        </div>
        <ActionBar view={view} onReturnDiscard={handleReturnDiscard} />
        {jokerOwed && (
          <div className="mt-1 text-center text-[11px] text-amber-300">
            The reclaimed joker must go into a new meld before you discard.
          </div>
        )}
        <div className="mt-2 flex items-stretch justify-center gap-3">
          <div className={`min-w-0 transition-opacity ${dealing ? 'opacity-0' : ''}`} data-hand>
            <Hand
              cards={handInPlay}
              selectedIds={selected}
              onToggle={(id) =>
                setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
              }
              onReorder={setOrder}
              highlightIds={newIds}
              hiddenId={flyHiddenId}
            />
          </div>
          {/* Match the hand's height/padding (pt-6 pb-2) so the three buttons span
              exactly the card zone and align top-and-bottom with the cards. */}
          <div className="flex shrink-0 flex-col justify-between pt-6 pb-2">
            <button
              type="button"
              className={ctrlBtn}
              onClick={() => setOrder(sortHand(view.you.hand).map((c) => c.id))}
            >
              ↕ Sort
            </button>
            {/* Always rendered (disabled when you can't act) so the column keeps a
                fixed height and the screen never shifts between turns. */}
            {(() => {
              const canAct = isMyTurn(view) && view.phase === 'awaitingDiscard';
              return (
              <>
              <button
                type="button"
                className={ctrlBtn}
                disabled={!canAct || !evaluateMeld(selectedCards)}
                onClick={() => {
                  if (evaluateMeld(selectedCards)) {
                    setStaged([...staged, { cards: selectedCards }]);
                    setSelected([]);
                  }
                }}
              >
                Meld
              </button>
              <button
                type="button"
                className={ctrlBtn}
                disabled={!canAct || !discardEnabled}
                onClick={() => {
                  const id = selected[0];
                  if (id) {
                    const card = handInPlay.find((c) => c.id === id);
                    const from = rectIn(rootRef.current?.querySelector(`[data-card-id="${id}"]`) ?? null);
                    const to = rectIn(discardRef.current);
                    if (card) {
                      pendingDiscard.current = card;
                      setFlyHiddenId(id); // hide it in the hand while it flies
                      startFlight(from, to, <CardFace card={card} />);
                    }
                    submit({ type: 'discard', cardId: id });
                  }
                  setSelected([]);
                }}
              >
                Discard
              </button>
              </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Laying-down tray: floats over the upper-centre of the table so staging
          melds never pushes the hand below the fold. */}
      {staged.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-[32%] z-30 flex w-full max-w-[90vw] -translate-x-1/2 justify-center">
          <div className="pointer-events-auto">
            <LayingDownTray view={view} stagedGroups={staged} onClearTray={() => setStaged([])} onLayDown={handleLayDown} canLayDown={layDownEnabled} />
          </div>
        </div>
      )}

      {/* which-end chooser for laying a joker onto a run */}
      {pendingLayoff && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50" onClick={() => setPendingLayoff(null)}>
          <div className="rounded-xl border-2 border-brass bg-[#2a1c12] p-5 text-center text-bone shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-sm text-[#c9b48a]">Which end of the run?</div>
            <div className="flex gap-3">
              <button type="button" className={ctrlBtn} onClick={() => doLayoff(pendingLayoff.meldId, 'low')}>◀ Low end</button>
              <button type="button" className={ctrlBtn} onClick={() => doLayoff(pendingLayoff.meldId, 'high')}>High end ▶</button>
            </div>
            <button type="button" className="mt-3 text-xs text-[#c9b48a] underline" onClick={() => setPendingLayoff(null)}>cancel</button>
          </div>
        </div>
      )}

      {/* draw / discard / lay-off fly animations */}
      {flights.map((fl) => (
        <FlyingCard
          key={fl.key}
          flight={fl}
          onDone={() => {
            setFlights((f) => f.filter((x) => x.key !== fl.key));
            if (pendingDiscard.current) {
              setDiscardHold(pendingDiscard.current);
              pendingDiscard.current = null;
            }
          }}
        />
      ))}

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
          canRebuy={
            [view.you.score, ...view.opponents.map((o) => o.score)].filter((s) => s <= 150).length >= 2
          }
          onRebuy={() => submit({ type: 'rebuy' })}
          onDecline={() => submit({ type: 'decline' })}
        />
      ) : (!view.matchFinished && view.roundFinished && (
        <RoundSummary view={view} onReady={() => submit({ type: 'readyNext' })} />
      ))}
    </div>
  );
}
