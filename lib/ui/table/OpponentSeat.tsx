import { CardBack } from './CardBack';
import { MeldPile } from './MeldPile';
import type { TableMeld, Pack } from '../../kalooki';
import type { ReactElement, ReactNode } from 'react';
import { Avatar } from '../Avatar';
import { countLine } from './countLine';

/** Cream name-plate sign behind seat labels (deli style); reads on any table art. */
export const SEAT_LABEL = 'relative inline-block max-w-[34vw] overflow-hidden rounded-[4px] bg-deli-cream px-2 pb-1.5 pt-2.5 leading-tight sm:max-w-[13rem] sm:px-2.5 text-deli-green shadow-[0_3px_10px_rgba(0,0,0,.4)]';

/** The red ribbon across the top of whoever's turn it is (slides on as the turn arrives). */
export function TurnRibbon(): ReactElement {
  return <span data-turn-ribbon aria-hidden className="plate-ribbon-in absolute inset-x-0 top-0 h-[6px] bg-deli-red" />;
}

export function OpponentSeat({
  name, avatarUrl, handCount, handPacks, score, status, isTurn, melds, onMeldClick, armedMeldIds, flashMeldIds,
  meldOrientation = 'row', visibleCount, side, media, centreHand = false,
}: {
  name: string; avatarUrl?: string | null;
  /** Live video circle (video call): above the plate on side seats; on the top seat beside the plate (phones) or left of plate and cards (wider). Renders nothing when off. */
  media?: ReactNode; handCount: number; handPacks?: Pack[]; score: number; status: string; hasOpened?: boolean; isTurn: boolean;
  melds: TableMeld[]; onMeldClick?: (meldId: string) => void; armedMeldIds?: string[]; flashMeldIds?: string[];
  /** Side seats (left/right) stack their melds vertically; the top seat lays them in a row. */
  meldOrientation?: 'row' | 'column';
  /** During the deal, limit how many backs are shown so the hand builds up. */
  visibleCount?: number;
  /** Left/right edge seats show a sideways (rotated) hand stacked vertically on the outer edge. */
  side?: 'left' | 'right';
  /** The only top seat: balance the video with an empty column so the cards stay centred. */
  centreHand?: boolean;
}): ReactElement {
  // Prefer the real per-card packs; fall back to alternating if not provided.
  const allPacks: Pack[] = handPacks && handPacks.length
    ? handPacks
    : Array.from({ length: handCount }, (_, i) => (i % 2 === 0 ? 'A' : 'B'));
  // During the deal, only show the backs that have "landed" so far.
  const packs = visibleCount == null ? allPacks : allPacks.slice(0, visibleCount);

  // One cream plate: name (condensed caps) over the count line; the turn ribbon on top.
  const plate = (
    <div data-plate className={`${SEAT_LABEL} text-center ${status !== 'active' ? 'opacity-60' : ''}`}>
      {isTurn && <TurnRibbon key="ribbon" />}
      <div className="flex items-center justify-center gap-1.5">
        <Avatar name={name} src={avatarUrl} size={20} />
        <span className={`font-cond min-w-0 break-words text-[13px] font-extrabold uppercase leading-none tracking-[.04em] sm:text-[15px] ${status !== 'active' ? 'line-through' : ''}`}>{name}</span>
      </div>
      <div className="mt-0.5 font-sans-deli text-[10px] font-medium tracking-[.02em] opacity-80 sm:text-[10.5px]">{countLine(handCount, score)}</div>
    </div>
  );
  const meldPile = (m: TableMeld) => (
    <MeldPile key={m.id} meld={m} armed={armedMeldIds?.includes(m.id)} flash={flashMeldIds?.includes(m.id)} onClick={onMeldClick ? () => onMeldClick(m.id) : undefined} />
  );

  // --- Side seats: sideways hand (rotated 90°) stacked vertically on the outer
  // edge, with the melds column inboard toward the centre of the table. ---
  if (side) {
    // Small screens: just the name plate (it already says how many cards) — no backs.
    const hand = (
      <div className="flex flex-col items-center max-sm:hidden">
        {packs.map((pack, i) => (
          <div key={i} data-cardback className="relative h-5 w-14 first:mt-1">
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90">
              <CardBack pack={pack} size="sm" />
            </span>
          </div>
        ))}
      </div>
    );
    const meldsCol = (
      <div className="flex flex-col items-center gap-2">
        {melds.map(meldPile)}
      </div>
    );
    return (
      <div className="flex shrink-0 flex-col items-center text-center">
        <div className="mb-1.5 flex empty:hidden">{media}</div>
        {plate}
        {/* children are [melds, hand]; reverse on the left so the hand lands on the outer edge.
            The row hugs the outer edge; with melds, the gap keeps them inboard of the
            table's cream line (.side-melds-clear-*, wider screens). */}
        <div data-seat-row className={`mt-3.5 flex items-start gap-2 ${side === 'left' ? 'flex-row-reverse self-start' : 'flex-row self-end'} ${melds.length ? `side-melds-clear-${side}` : ''}`}>
          {meldsCol}
          {hand}
        </div>
      </div>
    );
  }

  // --- Top seat: horizontal hand, melds in a row. Phones: the video hangs
  // beside the plate. Wider screens: it sits to the left of plate and cards
  // together, so it costs no height. For a lone top seat the matching empty
  // third column keeps the cards centred; it collapses when there's no video.
  // Several top seats share the row, so they skip that balancing width. ---
  return (
    <div className="flex shrink-0 flex-col items-center text-center">
      {/* An invisible spacer shares a cell with the plate and cards, reaching just
          past the table's cream line: the melds start below whichever is taller. */}
      <div className="grid">
      <div data-line-clear aria-hidden className="table-line-clear [grid-area:1/1]" />
      <div data-seat-grid className={`grid grid-cols-[1fr_auto_1fr] items-center self-start [grid-area:1/1] ${centreHand ? '' : 'sm:grid-cols-[auto_auto]'}`}>
        <div className="col-start-1 row-start-1 flex justify-end pr-2 empty:pr-0 sm:[grid-row:1/span_2] sm:pr-3">{media}</div>
        <div className="col-start-2 row-start-1">{plate}</div>
        {/* Small screens: hidden — the plate says how many cards. Wider: the hand's own width, so the video never overlaps it. */}
        <div className="col-span-full row-start-2 w-40 justify-self-center max-sm:hidden sm:[grid-column:2] sm:w-auto">
          <div className="mt-1 flex min-h-[3.5rem] justify-center">
            {packs.map((pack, i) => (
              <span key={i} data-cardback className="-ml-2.5 first:ml-0">
                <CardBack pack={pack} size="sm" />
              </span>
            ))}
          </div>
        </div>
      </div>
      </div>
      <div className={`mt-1 flex justify-center gap-2 ${
        meldOrientation === 'column' ? 'flex-col items-center' : 'max-w-[90vw] flex-nowrap gap-3 overflow-x-auto'
      }`}>
        {melds.map(meldPile)}
      </div>
    </div>
  );
}
