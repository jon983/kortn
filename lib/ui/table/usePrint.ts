'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Reveal `lineCount` lines one at a time, like a receipt printing. Restarts only when
 * `key` changes (a new hand), never on re-renders; `finish()` prints the rest at once.
 * With reduced motion everything shows immediately.
 */
export function usePrint(lineCount: number, key: string | number, stepMs = 140): { shown: number; done: boolean; finish: () => void } {
  const [state, setState] = useState(() => ({ key, shown: prefersReducedMotion() ? Infinity : 0 }));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // A new hand: start printing again (during render, so the old receipt never flashes as "done").
  if (state.key !== key) setState({ key, shown: prefersReducedMotion() ? Infinity : 0 });

  const finished = state.shown >= lineCount;
  useEffect(() => {
    if (finished) return;
    timer.current = setInterval(() => setState((s) => ({ ...s, shown: s.shown + 1 })), stepMs);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [state.key, finished, stepMs]);

  const finish = useCallback(() => setState((s) => ({ ...s, shown: Infinity })), []);
  return { shown: Math.min(state.shown, lineCount), done: finished, finish };
}
