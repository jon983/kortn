'use client';
import { useEffect, useState, type ReactNode } from 'react';

export interface Flight {
  key: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  node: ReactNode;
}

const DURATION_MS = 340;

/**
 * A single card that animates from `from` to `to` (coordinates relative to the
 * table container). Used for the draw (pile → hand) and discard (hand → pile)
 * motions. Calls onDone once the flight finishes so the caller can clear it.
 */
export function FlyingCard({ flight, onDone }: { flight: Flight; onDone: () => void }) {
  const [pos, setPos] = useState(flight.from);
  useEffect(() => {
    // start at `from`, then on the next frame transition to `to`
    setPos(flight.from);
    const raf = requestAnimationFrame(() => setPos(flight.to));
    const t = setTimeout(onDone, DURATION_MS);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    // re-run per distinct flight
  }, [flight.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{ left: pos.x, top: pos.y, transition: `left ${DURATION_MS}ms ease-out, top ${DURATION_MS}ms ease-out` }}
    >
      {flight.node}
    </div>
  );
}
