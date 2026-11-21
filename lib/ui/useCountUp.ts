'use client';
import { useEffect, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animate a number from 0 up to `target` over `durationMs` (ease-out). Jumps
 * straight to `target` when reduced motion is requested (or there's no window).
 * `canStart` is asked on the first frame: if it says no (the number is already
 * on show), the value stays at `target` instead of resetting to 0.
 */
export function useCountUp(target: number, durationMs = 800, canStart?: () => boolean): number {
  // Start at the final value on both server and client (no hydration mismatch);
  // the animation restarts from 0 on the first frame, while the panel is still
  // fading in, so there's no visible flash.
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (prefersReducedMotion()) { setValue(target); return; }
    let raf = 0;
    let start: number | null = null; // timed from the frames' own timestamps
    const tick = (now: number) => {
      if (start === null) {
        if (canStart && !canStart()) { setValue(target); return; }
        start = now; setValue(0);
      }
      const t = Math.min(1, (now - start) / durationMs);
      setValue(target * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- canStart is read once, on the first frame
  }, [target, durationMs]);
  return value;
}
