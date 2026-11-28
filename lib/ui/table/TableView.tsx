// lib/ui/table/TableView.tsx
'use client';
import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { useMatchStream, type ChatLine } from './useMatchStream';
import { ChatPanel } from './ChatPanel';
import { playYourTurn, playHandEnd, unlockAudioOnce, primeAudio, setVolume as setSoundVolume, setTurnSound, savedTurnSound, TURN_SOUNDS, type TurnSound } from './sounds';
import { playAction, getTableView } from '../../../app/actions/play';
import { Hand, sortHand } from './Hand';
import { OpponentSeat, SEAT_LABEL, TurnRibbon } from './OpponentSeat';
import { ChatIcon, SpeakerIcon, ScoresIcon, RefreshIcon } from './icons';
import { StockDiscard } from './StockDiscard';
import { MeldPile } from './MeldPile';
import { Card as CardFace } from './Card';
import { CardBack } from './CardBack';
import { ActionBar, LayingDownTray } from './ActionBar';
import { FlyingCard } from './FlyingCard';
import { RoundSummary, RebuyPrompt, MatchSummary, ScorePad } from './overlays';
import { evaluateMeld, canOpen, isMyTurn } from './legality';
import { seatAround } from '../table-geometry';
import { CallProvider, CallControls, SeatVideo } from './call';
import { TableSurface } from './TableSurface';
import { useCentrePadding } from './useCentrePadding';
import { countLine } from './countLine';
import { joinCallAction } from '../../../app/actions/call';
import { arrangeRun, type Action } from '../../kalooki';
import type { ClientView, ServerAction } from '../../server';

/** Secondary table buttons (Sort, Add space, run ends): cream pills with a green edge. */
const ctrlBtn = 'deli-pill deli-pill--table btn-lift';
/** Primary actions (Meld, Discard): green pills with a cream edge. */
const goBtn = 'deli-pill deli-pill--table-go btn-lift';
const SPACE_PREFIX = '__space_';
/** Wider than a phone (Tailwind's sm). False on the server and first paint, then live. */
function useWide(): boolean {
  const mq = () => (typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 640px)') : null);
  return useSyncExternalStore(
    (cb) => { const m = mq(); m?.addEventListener('change', cb); return () => m?.removeEventListener('change', cb); },
    () => mq()?.matches ?? false,
    () => false,
  );
}
/** Header controls: cream-outlined tags in condensed caps on the green header. */
const HEADER_TAG = 'font-cond rounded-full border border-deli-cream/50 px-2.5 py-0.5 text-[12px] font-extrabold uppercase tracking-[.12em] text-deli-cream hover:bg-deli-cream/10';
/** Hand and pot: small printed price tags. */
/** Icon-only header buttons: the same pill as the video-call buttons. */
const ICON_TAG = 'flex items-center justify-center rounded-full border border-deli-cream/50 px-2 py-[3px] text-deli-cream hover:bg-deli-cream/10';
const PRINTED_TAG = 'whitespace-nowrap rounded-[3px] bg-deli-cream px-1.5 font-sans-deli text-[9px] font-semibold uppercase leading-[1.45] tracking-[.14em] text-deli-green sm:py-px sm:text-[10.5px]';

export function TableView({ matchId, initial, initialChat = [] }: { matchId: string; initial: ClientView; initialChat?: ChatLine[] }) {
  const { view, chat, connected } = useMatchStream(matchId, initial, initialChat, { fetchView: () => getTableView(matchId) });
  const [selected, setSelected] = useState<string[]>([]);
  const [staged, setStaged] = useState<{ cards: import('../../kalooki').Card[] }[]>([]);
  const [order, setOrder] = useState<string[] | null>(null);
  const spaceSeq = useRef(0);
  // Insert a draggable separator into the hand. It's local/visual only — never
  // part of play — and is removed by dragging it off either end (see Hand).
  function addSpace() {
    setOrder((prev) => {
      const base = prev ?? sortHand(view.you.hand).map((c) => c.id);
      // New spaces start at the left; drag one into place (or off either end to remove).
      return [`${SPACE_PREFIX}${++spaceSeq.current}`, ...base];
    });
  }
  function sortHandCards() {
    setOrder(sortHand(view.you.hand).map((c) => c.id)); // re-sort cards; clears spaces
  }
  const [obligationId, setObligationId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showScores, setShowScores] = useState(false);
  // Chat open state (toggled from the top bar) + unread count while closed.
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const seenChat = useRef(0);
  // Two levels 0..1, each persisted (0 = muted), in a popover off the top bar:
  // `volume` is the your-turn chime (and hand-end flourish); a ref mirrors it so
  // the trigger effects read the latest value. `videoVolume` is the other
  // players' voices on the video call.
  const [volume, setVolume] = useState(1);
  const [videoVolume, setVideoVolume] = useState(1);
  // Which your-turn sound plays (picked in the same popover; saved).
  const [turnSound, setTurnSoundState] = useState<TurnSound>('knock');
  const [volOpen, setVolOpen] = useState(false);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
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
  // How many cards have "landed" per seat during the deal — the hand/backs build
  // up in step with the flights instead of appearing all at once.
  const [dealCounts, setDealCounts] = useState<Record<number, number>>({});
  const prevRound = useRef(view.roundNumber);
  const dealTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // --- draw / discard fly animations ---
  const rootRef = useRef<HTMLDivElement>(null);
  const stockRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);
  const wide = useWide();
  // The stock and discard stay in the middle of the table, whatever the side
  // columns hold (a side seat's melds widen its column).
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const centreColRef = useRef<HTMLDivElement>(null);
  const centrePad = useCentrePadding(leftColRef, rightColRef, centreColRef);
  // How tall the side columns can be with the page still fitting the screen:
  // the window, less everything outside the seats row (header, your hand).
  // Side seats wrap their melds to stay within it.
  const mainRowRef = useRef<HTMLDivElement>(null);
  const [sideBudget, setSideBudget] = useState<number | undefined>(undefined);
  useEffect(() => {
    const root = rootRef.current, row = mainRowRef.current;
    if (!root || !row || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const next = Math.round(window.innerHeight - (root.offsetHeight - row.offsetHeight));
      setSideBudget((b) => (b === next ? b : next));
    };
    const ro = new ResizeObserver(update);
    ro.observe(root);
    window.addEventListener('resize', update);
    update();
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);
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

  // Prime audio on first gesture; load the persisted volume preference.
  useEffect(() => {
    unlockAudioOnce();
    try {
      const saved = parseFloat(localStorage.getItem('kortn-volume') ?? '');
      if (!Number.isNaN(saved)) setVolume(Math.max(0, Math.min(1, saved)));
      const savedVideo = parseFloat(localStorage.getItem('kortn-video-volume') ?? '');
      if (!Number.isNaN(savedVideo)) setVideoVolume(Math.max(0, Math.min(1, savedVideo)));
    } catch { /* ignore */ }
    setTurnSoundState(savedTurnSound());
  }, []);
  // Push volume into the sound engine and persist it whenever it changes.
  useEffect(() => {
    setSoundVolume(volume);
    try { localStorage.setItem('kortn-volume', String(volume)); } catch { /* ignore */ }
  }, [volume]);
  useEffect(() => { setTurnSound(turnSound); }, [turnSound]);
  function onPickTurnSound(id: TurnSound) {
    primeAudio(); // a user gesture — unlock audio
    setTurnSoundState(id);
    try { localStorage.setItem('kortn-turn-sound', id); } catch { /* ignore */ }
    if (volumeRef.current > 0) playYourTurn(id); // let them hear it
  }
  function onVideoVolumeInput(v: number) {
    setVideoVolume(v);
    try { localStorage.setItem('kortn-video-volume', String(v)); } catch { /* ignore */ }
  }
  function onVolumeInput(v: number) {
    primeAudio(); // this interaction is a user gesture — unlock audio
    setVolume(v);
  }

  // Unread chat: reset when open, otherwise count messages since last opened.
  useEffect(() => {
    if (chatOpen) { seenChat.current = chat.length; setUnread(0); }
    else setUnread(chat.length - seenChat.current);
  }, [chat.length, chatOpen]);

  // Sound: chime when it becomes your turn; flourish when a hand ends. Edge-
  // triggered (prev refs) so they never fire on initial mount.
  const prevMyTurn = useRef(isMyTurn(view));
  useEffect(() => {
    const now = isMyTurn(view);
    if (now && !prevMyTurn.current && volumeRef.current > 0) playYourTurn();
    prevMyTurn.current = now;
  }, [view.currentTurn, view.seat]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevRoundFinished = useRef(view.roundFinished);
  useEffect(() => {
    if (view.roundFinished && !prevRoundFinished.current && volumeRef.current > 0) playHandEnd();
    prevRoundFinished.current = view.roundFinished;
  }, [view.roundFinished]);

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
    // Players who are out sit the hand out — no cards fly to them.
    const statusOf = (s: number) => (s === view.seat ? view.you.status : view.opponents.find((o) => o.seat === s)?.status);
    for (let s = 0; s < seatCount; s++) {
      if (statusOf(s) !== 'active') { targets[s] = null; continue; }
      const el = s === view.seat
        ? root.querySelector('[data-hand]')
        : root.querySelector(`[data-seat="${s}"]`);
      targets[s] = centerIn(el);
    }

    dealTimers.current.forEach(clearTimeout);
    dealTimers.current = [];
    setDealing(true);
    setDealCounts({});
    const dealtSeats = Math.max(1, targets.filter(Boolean).length);
    const STEP = Math.max(55, Math.round(4000 / (13 * dealtSeats)));
    const DUR = 420;
    let i = 0;
    for (let round = 0; round < 13; round++) {
      for (let s = 0; s < seatCount; s++) {
        const t = targets[s];
        if (!t) continue;
        const pack = (round + s) % 2 === 0 ? 'A' : 'B';
        dealTimers.current.push(setTimeout(() => startFlight(source, t, <CardBack pack={pack} />), i * STEP));
        // Reveal that seat's next card when this one lands (the hand builds up).
        dealTimers.current.push(setTimeout(
          () => setDealCounts((m) => ({ ...m, [s]: (m[s] ?? 0) + 1 })),
          i * STEP + DUR,
        ));
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
          const to = centerIn(root.querySelector(`[data-seat="${o.seat}"]`));
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

  // The hand order may include synthetic spacer ids (purely-visual separators the
  // player can drag between groups). handItems keeps them; `hand` is cards only.
  const handItems = useMemo(() => {
    const byId = new Map(view.you.hand.map((c) => [c.id, c] as const));
    const base = order
      ? order.filter((id) => byId.has(id) || id.startsWith(SPACE_PREFIX))
      : sortHand(view.you.hand).map((c) => c.id);
    for (const c of view.you.hand) if (!base.includes(c.id)) base.push(c.id);
    return base.map((id) => ({ id, card: byId.get(id) ?? null }));
  }, [view.you.hand, order]);
  const hand = useMemo(
    () => handItems.filter((i) => i.card).map((i) => i.card as import('../../kalooki').Card),
    [handItems],
  );

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

  // Seat the opponents around the table relative to you, so play runs clockwise
  // on every screen (next to act on your left). Side seats stack their melds
  // vertically so they read as a column down each edge.
  const seating = useMemo(
    () => seatAround(view.seat, view.seatNames.length, view.opponents),
    [view.seat, view.seatNames.length, view.opponents],
  );
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

  const renderOpp = (o: ClientView['opponents'][number], orientation: 'row' | 'column', side?: 'left' | 'right') => (
    <div key={o.seat} data-seat={o.seat}>
      <OpponentSeat
        name={view.seatNames[o.seat]}
        avatarUrl={view.seatAvatars?.[o.seat]}
        media={<SeatVideo seat={o.seat} className="h-16 w-16 sm:h-24 sm:w-24" />}
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
        visibleCount={dealing ? (dealCounts[o.seat] ?? 0) : undefined}
        side={side}
        heightBudget={side ? sideBudget : undefined}
        centreHand={!side && seating.top.length === 1}
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

  // Can't use a joker reclaimed from a meld: put it back and take the natural(s) back.
  async function handleReturnJoker() {
    const res = await playAction(matchId, { type: 'returnJoker' });
    if (!res.ok) { setToast(res.reason ?? 'illegal move'); return; }
    setSelected([]);
  }

  return (
    <CallProvider fetchCredentials={() => joinCallAction(matchId)} enabled={!view.matchFinished} volume={videoVolume}>
    <div ref={rootRef} className="relative flex min-h-screen flex-col text-bone">
      {/* status bar: the deli's green header with printed tags. */}
      {/* Phones: controls on one row, whose move on a full-width row beneath.
          Wider: left controls · whose move (centred) · right controls. */}
      <div data-table-header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 bg-deli-green px-3 py-2 text-xs text-deli-cream shadow-[0_2px_0_var(--color-deli-cream),0_6px_16px_rgba(0,0,0,.4)] sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-4">
        <span className="flex items-center gap-2 justify-self-start sm:gap-3">
          <Link href="/" className={`${HEADER_TAG} whitespace-nowrap`}>
            Kitchen
          </Link>
          {/* Escape hatch for any glitch: a full reload re-syncs everything. */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            title="Refresh the table"
            aria-label="Refresh the table"
            className={`${ICON_TAG} gap-1.5 ${connected ? '' : 'animate-pulse !border-deli-gold !text-deli-gold'}`}
          >
            <RefreshIcon />{!connected && <span className="hidden font-cond text-[12px] font-extrabold uppercase tracking-[.12em] sm:inline">Reconnecting…</span>}
          </button>
        </span>
        <span className="order-last flex w-full items-center justify-center gap-3 sm:order-none sm:w-auto sm:justify-self-center">
          {/* Phones: call buttons live on this second row so the top row never overflows. */}
          {!view.matchFinished && <span className="sm:hidden"><CallControls /></span>}
          {isMyTurn(view) ? (
            <span key={`turn-${view.roundNumber}-${view.currentTurn}`} className="deli-ribbon deli-ribbon--red deli-ribbon-drop !px-7 !py-1 !text-[12px] sm:!py-1.5 sm:!text-[13px]">
              Your turn
            </span>
          ) : (
            <span className="font-script text-[19px] leading-none text-deli-cream/90">{`${view.seatNames[view.currentTurn]}'s turn`}</span>
          )}
        </span>
        <span className="flex items-center gap-1.5 justify-self-end sm:gap-2">
          {!view.matchFinished && <span className="hidden sm:inline-flex"><CallControls /></span>}
          <button
            type="button"
            aria-label={chatOpen ? 'Close chat' : 'Open chat'}
            onClick={() => setChatOpen((o) => !o)}
            className={`${ICON_TAG} relative`}
          >
            <ChatIcon />
            {!chatOpen && unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-deli-red px-1 font-sans-deli text-[9px] font-bold text-deli-cream">{unread}</span>
            )}
          </button>
          <span className="relative">
            <button
              type="button"
              aria-label="Volume"
              onClick={() => setVolOpen((o) => !o)}
              className={ICON_TAG}
            >
              <SpeakerIcon volume={Math.max(volume, videoVolume)} />
            </button>
            {volOpen && (
              <div className="deli-paper absolute right-0 top-full z-50 mt-1.5 grid grid-cols-[auto_auto_auto] items-center gap-x-2 gap-y-2.5 rounded-md px-3 py-2.5 text-deli-green shadow-xl">
                {([
                  { label: 'Video', value: videoVolume, onInput: onVideoVolumeInput, onRelease: undefined },
                  { label: 'Your turn', value: volume, onInput: onVolumeInput, onRelease: () => { if (volumeRef.current > 0) playYourTurn(); } },
                ] as const).map((row) => (
                  <Fragment key={row.label}>
                    <span className="whitespace-nowrap font-sans-deli text-[10px] font-semibold uppercase tracking-[.14em]">{row.label}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(row.value * 100)}
                      aria-label={`${row.label} volume`}
                      className="h-1 w-28 accent-deli-red"
                      onChange={(e) => row.onInput(Number(e.target.value) / 100)}
                      onPointerUp={row.onRelease}
                    />
                    <span className="w-7 text-right font-cond text-[13px] font-bold tabular-nums">{Math.round(row.value * 100)}</span>
                  </Fragment>
                ))}
                {/* the your-turn sound: tap one to hear it and keep it */}
                <span className="self-start whitespace-nowrap pt-1 font-sans-deli text-[10px] font-semibold uppercase tracking-[.14em]">Sound</span>
                <div className="col-span-2 flex max-w-[11rem] flex-wrap gap-1">
                  {TURN_SOUNDS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={turnSound === t.id}
                      onClick={() => onPickTurnSound(t.id)}
                      className={`rounded-full border border-deli-green px-2 py-0.5 font-cond text-[12px] font-bold uppercase tracking-[.06em] ${turnSound === t.id ? 'bg-deli-green text-deli-cream' : 'hover:bg-deli-green/10'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </span>
          <button
            type="button"
            onClick={() => setShowScores((s) => !s)}
            aria-label={showScores ? 'Hide scores' : 'Scores'}
            className={HEADER_TAG}
          >
            <span className="sm:hidden" aria-hidden><ScoresIcon /></span>
            <span className="hidden sm:inline">{showScores ? 'Hide scores' : 'Scores'}</span>
          </button>
          <span className="flex flex-col items-end gap-px sm:flex-row sm:items-center sm:gap-1.5">
            <span className={PRINTED_TAG}>{`Hand ${view.roundNumber}`}</span>
            <span className={PRINTED_TAG}>{`Pot ${view.pot} bits`}</span>
          </span>
        </span>
      </div>

      {/* full scorecard (toggle) */}
      {showScores && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6" onClick={() => setShowScores(false)}>
          <div className="deli-paper w-full max-w-3xl rounded-sm px-5 pb-5 pt-4 text-deli-green shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-baseline justify-between border-b-2 border-deli-red/70 pb-1">
              <h3 className="font-cond text-[26px] font-black uppercase leading-none tracking-[.06em]">Scores</h3>
              <button
                type="button"
                onClick={() => setShowScores(false)}
                className="font-script text-[18px] text-deli-green/60 hover:text-deli-red hover:underline"
              >
                close
              </button>
            </div>
            <ScorePad view={view} />
          </div>
        </div>
      )}

      {/* The table: the photo starts below the header; seats, piles and your hand sit on it. */}
      <div className="relative isolate flex min-h-0 flex-1 flex-col">
      <TableSurface />
      {/* Main table area: side seats flank a centre column (top seats + piles). */}
      <div ref={mainRowRef} className="flex min-h-0 flex-1">
        {seating.left.length > 0 && (
          <div ref={leftColRef} data-seat-column="left" className="flex flex-col justify-center gap-6 p-2">
            {seating.left.map((o) => renderOpp(o, 'column', 'left'))}
          </div>
        )}

        <div ref={centreColRef} className="flex min-w-0 flex-1 flex-col">
          {seating.top.length > 0 && (
            <div className="flex flex-wrap justify-around gap-4 p-3">
              {seating.top.map((o) => renderOpp(o, 'row'))}
            </div>
          )}

          {/* stock + discard sit in the middle of the table: vertically, as the middle of
              three rows, and across (padding evens out the side columns). Your melds sit
              at the foot of the bottom row, in front of you; they only push the piles up
              once they need more than that row. */}
          <div data-piles className="grid flex-1 grid-rows-[1fr_auto_1fr] justify-items-center gap-4 py-2" style={{ paddingLeft: centrePad.left, paddingRight: centrePad.right }}>
            <div className="row-start-2">
              <StockDiscard
                stockCount={view.stockCount}
                stockPack={view.stockTopPack}
                discardTop={discardHold ?? view.discard[view.discard.length - 1]}
                stockRef={stockRef}
                discardRef={discardRef}
                onDrawStock={!dealing && isMyTurn(view) && view.phase === 'awaitingDraw' ? handleDrawStock : undefined}
                onTakeDiscard={!dealing && isMyTurn(view) && view.phase === 'awaitingDraw' ? handleTakeDiscard : undefined}
              />
            </div>
            <div data-my-melds className="row-start-3 flex flex-wrap justify-center gap-3 self-end justify-self-stretch px-4">
              {view.melds
                .filter((m) => m.ownerSeat === view.seat)
                .map((m) => (
                  <MeldPile key={m.id} meld={m} armed={armedMeldIds.includes(m.id)} flash={flashMelds.includes(m.id)} onClick={() => onMeldTap(m.id)} />
                ))}
            </div>
          </div>
        </div>

        {seating.right.length > 0 && (
          <div ref={rightColRef} data-seat-column="right" className="flex flex-col justify-center gap-6 p-2">
            {seating.right.map((o) => renderOpp(o, 'column', 'right'))}
          </div>
        )}
      </div>

      {/* viewer's area */}
      <div className="bg-gradient-to-t from-black/60 to-transparent p-3" data-you-seat>
        <div className="mb-1 flex flex-wrap items-center justify-center gap-1">
          {/* Phones: your video sits beside your plate (the hand row is full). */}
          {!wide && <SeatVideo seat={view.seat} className="mr-2 h-16 w-16" />}
          {/* No name label for yourself — just your count (highlighted on your turn). */}
          <div data-plate className={`${SEAT_LABEL} font-sans-deli text-[11px] font-semibold`}>
            {isMyTurn(view) && <TurnRibbon />}
            {countLine(view.you.handCount, view.you.score)}
          </div>
        </div>
        <ActionBar view={view} onReturnDiscard={handleReturnDiscard} jokerOwed={jokerOwed} onReturnJoker={handleReturnJoker} />
        {/* Three columns with equal sides, so the hand stays centred whatever
            sits beside it (your video, the wider Sort/Add space pills). When
            space runs out the hand column shrinks and scrolls. */}
        {/* Phones: the four buttons in a row above, the hand the full width below.
            Wider: three columns — Sort/Add space · hand · Meld/Discard. */}
        <div data-hand-row className="mt-2 grid grid-cols-2 items-center gap-x-2 sm:grid-cols-[1fr_minmax(0,auto)_1fr] sm:items-stretch sm:gap-3">
          <div className="col-start-1 row-start-1 flex justify-self-start gap-3 sm:justify-self-end">
            {/* Wider screens: your video sits at the side of your cards. */}
            {wide && <div className="flex shrink-0 items-center pt-6 pb-2"><SeatVideo seat={view.seat} className="h-24 w-24" /></div>}
            {/* left controls: Sort + Add space (always available; pt-6/pb-2 match the hand) */}
            <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:justify-center sm:gap-3 sm:pt-6 sm:pb-2">
              <button type="button" className={ctrlBtn} onClick={sortHandCards}>↕ Sort</button>
              <button type="button" className={ctrlBtn} onClick={addSpace}>＋ Add space</button>
            </div>
          </div>

          <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1" data-hand>
            <Hand
              items={dealing
                ? handInPlay.slice(0, dealCounts[view.seat] ?? 0).map((c) => ({ id: c.id, card: c }))
                : handItems.filter((i) => !i.card || !stagedIds.has(i.id))}
              selectedIds={selected}
              onToggle={(id) =>
                setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
              }
              onReorder={setOrder}
              highlightIds={newIds}
              hiddenId={flyHiddenId}
            />
          </div>

          {/* right controls: Meld + Discard, centred with a gap. Always rendered
              (disabled when you can't act) so the column height never shifts. */}
          <div className="col-start-2 row-start-1 flex shrink-0 flex-row gap-2 justify-self-end sm:col-start-3 sm:flex-col sm:justify-center sm:gap-3 sm:justify-self-start sm:pt-6 sm:pb-2">
            {(() => {
              const canAct = isMyTurn(view) && view.phase === 'awaitingDiscard';
              return (
              <>
              <button
                type="button"
                className={goBtn}
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
                className={goBtn}
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
          <div className="deli-paper rounded-md p-5 text-center text-deli-green shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 font-script text-[20px] text-deli-red">Which end of the run?</div>
            <div className="flex gap-3">
              <button type="button" className={ctrlBtn} onClick={() => doLayoff(pendingLayoff.meldId, 'low')}>◀ Low end</button>
              <button type="button" className={ctrlBtn} onClick={() => doLayoff(pendingLayoff.meldId, 'high')}>High end ▶</button>
            </div>
            <button type="button" className="mt-3 font-script text-[16px] text-deli-green/60 hover:text-deli-red hover:underline" onClick={() => setPendingLayoff(null)}>cancel</button>
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

      {/* in-game chat */}
      <ChatPanel matchId={matchId} chat={chat} seatNames={view.seatNames} mySeat={view.seat} open={chatOpen} onClose={() => setChatOpen(false)} />

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
    </CallProvider>
  );
}
