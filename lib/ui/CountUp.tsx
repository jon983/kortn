'use client';
import { useRef } from 'react';
import { useCountUp } from './useCountUp';

/** How far (ms) into its entrance a panel can be before its numbers count: beyond this it's already visible. */
const STILL_HIDDEN_MS = 150;

/**
 * True while the enclosing settling panel is still (mostly) invisible — e.g. a
 * client-side navigation. False once it has visibly appeared — e.g. hydration
 * after a slow cold load, or a tab opened in the background — so the number
 * never visibly drops back to 0.
 */
function panelStillHidden(el: HTMLElement | null): boolean {
  const panel = el?.closest('.settle') as (HTMLElement & { getAnimations?: () => Animation[] }) | null;
  const anim = panel?.getAnimations?.()[0];
  if (!anim) return true;
  const delay = Number(anim.effect?.getTiming().delay ?? 0);
  return Number(anim.currentTime ?? 0) - delay < STILL_HIDDEN_MS;
}

/** A number that counts up on arrival, keeping its format (decimals, sign, prefix/suffix). */
export function CountUp({ value, decimals = 0, prefix = '', suffix = '', signed = false }: {
  value: number; decimals?: number; prefix?: string; suffix?: string; signed?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const n = useCountUp(value, 800, () => panelStillHidden(ref.current));
  // Normalise -0 (a negative target's first frame) so it never shows as "-0".
  const shown = (n === 0 ? 0 : n).toFixed(decimals).replace(/^-(0(\.0+)?)$/, '$1');
  const sign = signed && Number(shown) > 0 ? '+' : '';
  return <span ref={ref}>{prefix}{sign}{shown}{suffix}</span>;
}
