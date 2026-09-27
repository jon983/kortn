import { CardBack } from './CardBack';
import { MeldPile } from './MeldPile';
import type { TableMeld, Pack } from '../../kalooki';
import type { ReactElement } from 'react';

export function OpponentSeat({
  name, handCount, handPacks, score, status, isTurn, melds, onMeldClick, armedMeldIds, flashMeldIds,
  meldOrientation = 'row', hideCards = false,
}: {
  name: string; handCount: number; handPacks?: Pack[]; score: number; status: string; hasOpened?: boolean; isTurn: boolean;
  melds: TableMeld[]; onMeldClick?: (meldId: string) => void; armedMeldIds?: string[]; flashMeldIds?: string[];
  /** Side seats (left/right) stack their melds vertically; the top seat lays them in a row. */
  meldOrientation?: 'row' | 'column';
  /** During the deal animation the real backs are hidden while cards fly in. */
  hideCards?: boolean;
}): ReactElement {
  // Prefer the real per-card packs; fall back to alternating if not provided.
  const packs: Pack[] = handPacks && handPacks.length
    ? handPacks
    : Array.from({ length: handCount }, (_, i) => (i % 2 === 0 ? 'A' : 'B'));
  return (
    <div className="flex shrink-0 flex-col items-center text-center">
      <div className="w-40">
        <div className={`text-sm font-bold ${isTurn ? 'text-brass' : 'text-bone'} ${status !== 'active' ? 'opacity-50 line-through' : ''}`}>
          {name}
        </div>
        <div className={`mt-1 flex justify-center transition-opacity ${hideCards ? 'opacity-0' : ''}`}>
          {packs.map((pack, i) => (
            <span key={i} data-cardback className="-ml-2.5 first:ml-0">
              <CardBack pack={pack} size="sm" />
            </span>
          ))}
        </div>
        <div className="text-[10px] text-[#c9b48a]">{handCount} cards · {score} pts</div>
      </div>
      <div className={`mt-1 flex justify-center gap-2 ${
        meldOrientation === 'column' ? 'flex-col items-center' : 'max-w-[90vw] flex-nowrap gap-3 overflow-x-auto'
      }`}>
        {melds.map((m) => (
          <MeldPile key={m.id} meld={m} armed={armedMeldIds?.includes(m.id)} flash={flashMeldIds?.includes(m.id)} onClick={onMeldClick ? () => onMeldClick(m.id) : undefined} />
        ))}
      </div>
    </div>
  );
}
