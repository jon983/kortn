import { CardBack } from './CardBack';
import { MeldPile } from './MeldPile';
import type { TableMeld, Pack } from '../../kalooki';
import type { ReactElement } from 'react';

export function OpponentSeat({
  name, handCount, handPacks, score, status, isTurn, melds, onMeldClick, armedMeldIds, flashMeldIds,
  meldOrientation = 'row', visibleCount, side,
}: {
  name: string; handCount: number; handPacks?: Pack[]; score: number; status: string; hasOpened?: boolean; isTurn: boolean;
  melds: TableMeld[]; onMeldClick?: (meldId: string) => void; armedMeldIds?: string[]; flashMeldIds?: string[];
  /** Side seats (left/right) stack their melds vertically; the top seat lays them in a row. */
  meldOrientation?: 'row' | 'column';
  /** During the deal, limit how many backs are shown so the hand builds up. */
  visibleCount?: number;
  /** Left/right edge seats show a sideways (rotated) hand stacked vertically on the outer edge. */
  side?: 'left' | 'right';
}): ReactElement {
  // Prefer the real per-card packs; fall back to alternating if not provided.
  const allPacks: Pack[] = handPacks && handPacks.length
    ? handPacks
    : Array.from({ length: handCount }, (_, i) => (i % 2 === 0 ? 'A' : 'B'));
  // During the deal, only show the backs that have "landed" so far.
  const packs = visibleCount == null ? allPacks : allPacks.slice(0, visibleCount);

  const nameLine = (
    <div className={`text-sm font-bold ${isTurn ? 'text-brass' : 'text-bone'} ${status !== 'active' ? 'opacity-50 line-through' : ''}`}>
      {name}
    </div>
  );
  const countLine = <div className="text-[10px] text-[#c9b48a]">{handCount} cards · {score} pts</div>;
  const meldPile = (m: TableMeld) => (
    <MeldPile key={m.id} meld={m} armed={armedMeldIds?.includes(m.id)} flash={flashMeldIds?.includes(m.id)} onClick={onMeldClick ? () => onMeldClick(m.id) : undefined} />
  );

  // --- Side seats: sideways hand (rotated 90°) stacked vertically on the outer
  // edge, with the melds column inboard toward the centre of the table. ---
  if (side) {
    const hand = (
      <div className="flex flex-col items-center">
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
        {nameLine}
        {countLine}
        {/* children are [melds, hand]; reverse on the left so the hand lands on the outer edge */}
        <div className={`mt-1 flex items-start gap-2 ${side === 'left' ? 'flex-row-reverse' : 'flex-row'}`}>
          {meldsCol}
          {hand}
        </div>
      </div>
    );
  }

  // --- Top seat: horizontal hand, melds in a row. ---
  return (
    <div className="flex shrink-0 flex-col items-center text-center">
      <div className="w-40">
        {nameLine}
        <div className="mt-1 flex min-h-[3.5rem] justify-center">
          {packs.map((pack, i) => (
            <span key={i} data-cardback className="-ml-2.5 first:ml-0">
              <CardBack pack={pack} size="sm" />
            </span>
          ))}
        </div>
        {countLine}
      </div>
      <div className={`mt-1 flex justify-center gap-2 ${
        meldOrientation === 'column' ? 'flex-col items-center' : 'max-w-[90vw] flex-nowrap gap-3 overflow-x-auto'
      }`}>
        {melds.map(meldPile)}
      </div>
    </div>
  );
}
