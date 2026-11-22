'use client';
import { useEffect, useRef, type ReactElement } from 'react';

// Must match .table-surface in globals.css: photo size, and how far down the
// photo the bottom of the cream double line runs (it sits in the frame edge,
// which scales evenly with the table).
const LANDSCAPE = { w: 2048, h: 1374, line: 258 };
const PORTRAIT = { w: 1073, h: 1600, line: 197 };

/** Pixels from the top of the table area to the bottom of the cream line, at this size. */
export function tableLineY(width: number, height: number, portrait: boolean): number {
  const p = portrait ? PORTRAIT : LANDSCAPE;
  return Math.round(p.line * Math.min(width / p.w, height / p.h));
}

/**
 * The game table photo (a green diner table on parquet), drawn below the
 * header as a nine-piece frame (`.table-frame` in globals.css): it always
 * fits the area exactly, with the chrome the same thickness on all four
 * sides and a strip of parquet all round. Landscape plate by default; the
 * portrait plate on upright screens. The wood colour only shows while the
 * photo loads.
 */
export function TableSurface(): ReactElement {
  // Publish the line's position to the table area as --table-line, so the top
  // seat can keep its melds below it (.table-line-clear).
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const area = el?.parentElement;
    if (!el || !area || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const portrait = window.matchMedia?.('(orientation: portrait)').matches ?? false;
      area.style.setProperty('--table-line', `${tableLineY(el.clientWidth, el.clientHeight, portrait)}px`);
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} data-table-surface aria-hidden className="table-surface pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#5e3b1c] [container-type:size]">
      <div className="table-under table-under--tl" />
      <div className="table-under table-under--tr" />
      <div className="table-under table-under--bl" />
      <div className="table-under table-under--br" />
      <div data-table-photo className="table-frame" />
    </div>
  );
}
