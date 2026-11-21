'use client';
import { startTransition, useCallback, useEffect, useState } from 'react';

/**
 * Rotate through `keys` every `intervalMs`, wrapping. Pauses on request and
 * while the tab is hidden; a manual `select` stops rotation for good (so a list
 * is never taken away mid-read); reduced motion means it never starts.
 * `cycle` changes whenever a fresh countdown begins — key a progress bar on it.
 */
export function useAutoRotate<K extends string>(keys: K[], opts: { intervalMs: number; initial: K }) {
  const { intervalMs, initial } = opts;
  const [current, setCurrent] = useState<K>(initial);
  const [paused, setPaused] = useState(false);
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
  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);
  return { current, select, pause, resume, paused: paused || hidden, stopped, running, cycle };
}
