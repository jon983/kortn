import type { CSSProperties } from 'react';
import { makeMotes } from './motes';

/** Fixed seed: the same dust on the server and the client (no hydration mismatch). */
const MOTES = makeMotes(20, 11);

/**
 * The living room behind the kitchen: the photo drifting slowly, candle glow,
 * a breathing shaft of window light, and dust floating up through it.
 * Purely decorative. Respects prefers-reduced-motion via globals.css.
 */
export function AmbientRoom({ plate }: { plate: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="amb-drift" style={{ backgroundImage: `url(/art/${plate}.jpg)` }} />
      <div className="amb-shaft" />
      <div className="amb-warm" />
      <div className="amb-glow" />
      {MOTES.map((m, i) => (
        <i
          key={i}
          className="amb-mote"
          style={{
            left: `${m.left}%`, top: `${m.top}%`, width: m.size, height: m.size,
            filter: m.blur ? `blur(${m.blur}px)` : undefined,
            '--dur': `${m.duration}s`, '--delay': `-${m.delay}s`, '--tw': `${m.twinkle}s`,
            '--x1': `${m.path[0][0]}px`, '--y1': `${m.path[0][1]}px`,
            '--x2': `${m.path[1][0]}px`, '--y2': `${m.path[1][1]}px`,
            '--x3': `${m.path[2][0]}px`, '--y3': `${m.path[2][1]}px`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
