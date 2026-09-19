import { Card as CardFace } from './Card';
import { CardBack } from './CardBack';
import type { Card } from '../../kalooki';

export function StockDiscard({
  stockCount, discardTop, onDrawStock, onTakeDiscard,
}: { stockCount: number; discardTop?: Card; onDrawStock?: () => void; onTakeDiscard?: () => void }) {
  return (
    <div className="flex items-end gap-6">
      <div className="text-center">
        <button
          type="button"
          aria-label="Draw from stock"
          onClick={onDrawStock}
          disabled={!onDrawStock || stockCount === 0}
          className={`block border-0 bg-transparent p-0 leading-none ${onDrawStock && stockCount > 0 ? 'cursor-pointer' : 'cursor-default'} disabled:opacity-60`}
        >
          {stockCount > 0
            ? <CardBack pack="A" />
            : <span className="inline-block h-32 w-24 rounded-md border-2 border-dashed border-[#cfc9b4]/40" />}
        </button>
      </div>
      <div className="text-center">
        <div
          role="button"
          aria-label="Take discard"
          tabIndex={onTakeDiscard && discardTop ? 0 : -1}
          aria-disabled={!onTakeDiscard || !discardTop}
          onClick={onTakeDiscard && discardTop ? onTakeDiscard : undefined}
          className={`${(!onTakeDiscard || !discardTop) ? 'cursor-default' : 'cursor-pointer'}`}
        >
          {discardTop
            ? <CardFace card={discardTop} />
            : <span className="inline-block h-32 w-24 rounded-md border-2 border-dashed border-[#cfc9b4]/40" />}
        </div>
      </div>
    </div>
  );
}
