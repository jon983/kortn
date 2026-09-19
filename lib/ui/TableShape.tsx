import type { ReactNode } from 'react';
import { seatPositions, tableKind } from './table-geometry';

const PENTAGON_CLIP = 'polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%)';

export function TableShape({
  seats,
  renderSeat,
}: {
  seats: number;
  renderSeat: (seat: number) => ReactNode;
}) {
  const kind = tableKind(seats);
  const positions = seatPositions(seats);
  return (
    <div className="relative aspect-square w-full max-w-[420px] mx-auto">
      <div
        className="absolute inset-[16%] bg-[radial-gradient(circle_at_50%_40%,#3f6b46,#2c4d32_72%,#223c27)] shadow-[0_16px_34px_rgba(0,0,0,.5)]"
        style={kind === 'pentagon' ? { clipPath: PENTAGON_CLIP } : { borderRadius: 14, border: '10px solid var(--color-walnut-dark)' }}
      />
      {positions.map((p) => (
        <div
          key={p.seat}
          className="absolute w-[26%] -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
          data-seat={p.seat}
        >
          {renderSeat(p.seat)}
        </div>
      ))}
    </div>
  );
}
