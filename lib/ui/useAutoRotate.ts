'use client';
import { startTransition, useCallback, useEffect, useState } from 'react';

/**
 * Rotate through `keys` every `intervalMs`, wrapping. Holds still while any
 * reason applies (hover, focus, explicit pause) and while the tab is hidden; a manual `select` stops rotation for good (so a list
 * is never taken away mid-read); reduced motion means it never starts.
 * `cycle` changes whenever a fresh countdown begins — key a progress bar on it.
 */
export function useAutoRotate<K extends string>(keys: K[], opts: { intervalMs: number; initial: K }) {
  const { intervalMs, initial } = opts;
  const [current, setCurrent] = useState<K>(initial);
  // Independent reasons to hold still: pointer over it, keyboard focus in it, or an explicit pause.
  const [holds, setHolds] = useState({ hover: false, focus: false, manual: false });
  const paused = holds.hover || holds.focus || holds.manual;
  const [hidden, setHidden] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [cycle, setCycle] = useState(0);
  const keysKey = keys.join('|');

  useEffect(() => {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) setStopped(true);
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const running = !stopped && !paused && !hidden && keys.length > 1;
  useEffect(() => {
    if (!running) return;
    setCycle((c) => c + 1);
    const t = setTimeout(() => {
      startTransition(() => setCurrent((c) => keys[(keys.indexOf(c) + 1) % keys.length]));
    }, intervalMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keysKey stands in for keys
  }, [running, current, intervalMs, keysKey]);

  const select = useCallback((k: K) => { setStopped(true); startTransition(() => setCurrent(k)); }, []);
  const hold = useCallback((source: 'hover' | 'focus' | 'manual', on: boolean) => setHolds((h) => (h[source] === on ? h : { ...h, [source]: on })), []);
  const pause = useCallback(() => hold('manual', true), [hold]);
  const resume = useCallback(() => hold('manual', false), [hold]);
  return { current, select, pause, resume, hold, paused: paused || hidden, stopped, running, cycle };
}
