'use client';
import { useEffect, useState, type RefObject } from 'react';

/** Stock + discard: two 96px cards and a 24px gap, plus a little breathing room. */
const PILES_W = 216 + 16;

/**
 * Padding for the centre column's piles area that puts its middle back on the
 * table's middle, however wide each side column is (a side seat's melds widen
 * its column). One side gets the whole difference, which moves the centre by
 * half of it. Capped so the stock and discard always fit in the column.
 */
export function centrePadding(leftW: number, rightW: number, centreW: number): { left: number; right: number } {
  const spare = Math.max(0, centreW - PILES_W);
  const d = Math.max(-spare, Math.min(spare, rightW - leftW));
  return { left: Math.round(Math.max(0, d)), right: Math.round(Math.max(0, -d)) };
}

/**
 * Live centrePadding for the given side columns (either may be absent) and the
 * centre column. Watching the centre column is enough: in the flex row it
 * narrows or widens whenever a side column changes width, or one comes or goes.
 */
export function useCentrePadding(
  leftRef: RefObject<HTMLElement | null>,
  rightRef: RefObject<HTMLElement | null>,
  centreRef: RefObject<HTMLElement | null>,
): { left: number; right: number } {
  const [pad, setPad] = useState({ left: 0, right: 0 });
  useEffect(() => {
    const centre = centreRef.current;
    if (!centre || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const next = centrePadding(leftRef.current?.offsetWidth ?? 0, rightRef.current?.offsetWidth ?? 0, centre.offsetWidth);
      setPad((p) => (p.left === next.left && p.right === next.right ? p : next));
    };
    const ro = new ResizeObserver(update);
    ro.observe(centre);
    update();
    return () => ro.disconnect();
  }, [leftRef, rightRef, centreRef]);
  return pad;
}
