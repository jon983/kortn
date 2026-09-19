import { CardBack } from './CardBack';
import { MeldPile } from './MeldPile';
import type { TableMeld } from '../../kalooki';
import type { ReactElement } from 'react';

export function OpponentSeat({
  name, handCount, score, status, hasOpened, isTurn, melds, onMeldClick, meldsArmed,
}: {
  name: string; handCount: number; score: number; status: string; hasOpened: boolean; isTurn: boolean;
  melds: TableMeld[]; onMeldClick?: (meldId: string) => void; meldsArmed?: boolean;
}): ReactElement {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-40">
        <div className={`text-sm font-bold ${isTurn ? 'text-brass' : 'text-bone'} ${status !== 'active' ? 'opacity-50 line-through' : ''}`}>
          {name}{hasOpened && <span className="ml-1 rounded bg-maroon px-1.5 text-[9px] text-bone">opened</span>}
        </div>
        <div className="mt-1 flex justify-center">
          {Array.from({ length: handCount }).map((_, i) => (
            <span key={i} data-cardback className="-ml-2.5 first:ml-0">
              <CardBack pack={i % 2 === 0 ? 'A' : 'B'} size="sm" />
            </span>
          ))}
        </div>
        <div className="text-[10px] text-[#c9b48a]">{handCount} cards · {score} pts</div>
      </div>
      <div className="mt-1 flex max-w-[92vw] flex-nowrap justify-center gap-3 overflow-x-auto">
        {melds.map((m) => (
          <MeldPile key={m.id} meld={m} armed={meldsArmed} onClick={onMeldClick ? () => onMeldClick(m.id) : undefined} />
        ))}
      </div>
    </div>
  );
}
