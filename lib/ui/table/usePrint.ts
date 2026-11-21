'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

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
  // Always start unprinted so the first client render matches the server's HTML.
  const [state, setState] = useState(() => ({ key, shown: 0 }));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // A new hand: start printing again (during render, so the old receipt never flashes as "done").
  if (state.key !== key) setState({ key, shown: 0 });

  // Reduced motion: print it all before the first paint.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) setState((s) => ({ ...s, shown: Infinity }));
  }, [state.key]);

  const finished = state.shown >= lineCount;
  useEffect(() => {
    if (finished) return;
    timer.current = setInterval(() => setState((s) => ({ ...s, shown: s.shown + 1 })), stepMs);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [state.key, finished, stepMs]);

  const finish = useCallback(() => setState((s) => ({ ...s, shown: Infinity })), []);
  return { shown: Math.min(state.shown, lineCount), done: finished, finish };
}
