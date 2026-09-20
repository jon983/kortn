import { CardBack } from './CardBack';
import { MeldPile } from './MeldPile';
import type { TableMeld, Pack } from '../../kalooki';
import type { ReactElement } from 'react';

export function OpponentSeat({
  name, handCount, handPacks, score, status, isTurn, melds, onMeldClick, meldsArmed,
}: {
  name: string; handCount: number; handPacks?: Pack[]; score: number; status: string; hasOpened?: boolean; isTurn: boolean;
  melds: TableMeld[]; onMeldClick?: (meldId: string) => void; meldsArmed?: boolean;
}): ReactElement {
  // Prefer the real per-card packs; fall back to alternating if not provided.
  const packs: Pack[] = handPacks && handPacks.length
    ? handPacks
    : Array.from({ length: handCount }, (_, i) => (i % 2 === 0 ? 'A' : 'B'));
  return (
    <div className="flex max-w-[18rem] shrink-0 flex-col items-center text-center">
      <div className="w-40">
        <div className={`text-sm font-bold ${isTurn ? 'text-brass' : 'text-bone'} ${status !== 'active' ? 'opacity-50 line-through' : ''}`}>
          {name}
        </div>
        <div className="mt-1 flex justify-center">
          {packs.map((pack, i) => (
            <span key={i} data-cardback className="-ml-2.5 first:ml-0">
              <CardBack pack={pack} size="sm" />
            </span>
          ))}
        </div>
        <div className="text-[10px] text-[#c9b48a]">{handCount} cards · {score} pts</div>
      </div>
      <div className="mt-1 flex w-full flex-wrap justify-center gap-x-3 gap-y-2">
        {melds.map((m) => (
          <MeldPile key={m.id} meld={m} armed={meldsArmed} onClick={onMeldClick ? () => onMeldClick(m.id) : undefined} />
        ))}
      </div>
    </div>
  );
}
