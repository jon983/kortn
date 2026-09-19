import { Card as CardFace } from './Card';
import type { Card } from '../../kalooki';

export function StockDiscard({
  stockCount, discardTop, onDrawStock, onTakeDiscard,
}: { stockCount: number; discardTop?: Card; onDrawStock?: () => void; onTakeDiscard?: () => void }) {
  return (
    <div className="flex items-center gap-6">
      <button type="button" onClick={onDrawStock} disabled={!onDrawStock}
        className="relative h-32 w-24 rounded-md border-2 border-[#14243f] bg-[repeating-linear-gradient(45deg,#274a7a,#274a7a_4px,#1c3557_4px,#1c3557_8px)] shadow disabled:cursor-default">
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-[#dfe7f5]">{stockCount}</span>
      </button>
      <div
        role="button"
        tabIndex={onTakeDiscard && discardTop ? 0 : -1}
        aria-disabled={!onTakeDiscard || !discardTop}
        onClick={onTakeDiscard && discardTop ? onTakeDiscard : undefined}
        className={`${(!onTakeDiscard || !discardTop) ? 'cursor-default' : 'cursor-pointer'}`}
      >
        {discardTop ? <CardFace card={discardTop} /> : <span className="inline-block h-32 w-24 rounded-md border-2 border-dashed border-[#cfc9b4]/40" />}
      </div>
    </div>
  );
}
