'use client';
import { useEffect, useRef, type ReactElement } from 'react';

// Must match .table-surface in globals.css: photo size, and how far down the
// photo the bottom of the cream double line runs (it sits in the frame edge,
// which scales evenly with the table).
// The side lines' inner edges are measured in from each side of the photo, and
// so is the outer edge of the chrome (edgeL/edgeR: the parquet strip beside it).
// The landscape photo's table sits off-centre: less parquet on the left.
const LANDSCAPE = { w: 2048, h: 1374, line: 258, left: 238, right: 251, edgeL: 102, edgeR: 121 };
const PORTRAIT = { w: 1073, h: 1600, line: 197, left: 202, right: 201, edgeL: 99, edgeR: 100 };

const scaleOf = (p: typeof LANDSCAPE, width: number, height: number) => Math.min(width / p.w, height / p.h);

/** Pixels in from the left and right edges of the table area to the inside of the side cream lines. */
export function tableLineSides(width: number, height: number, portrait: boolean): { left: number; right: number } {
  const p = portrait ? PORTRAIT : LANDSCAPE;
  const s = scaleOf(p, width, height);
  return { left: Math.round(p.left * s), right: Math.round(p.right * s) };
}

/** The side seats' sideways hands: 56px wide at full size, starting 8px in from
 *  the screen edge. Scale both alike so each clears the chrome by 4px on the
 *  narrower parquet strip (never larger than full size, never under half). */
export const SIDE_HAND_W = 56;
export function sideHandScale(width: number, height: number, portrait: boolean): number {
  const p = portrait ? PORTRAIT : LANDSCAPE;
  const strip = Math.min(p.edgeL, p.edgeR) * scaleOf(p, width, height);
  const k = (strip - 8 - 4) / SIDE_HAND_W;
  return Math.round(Math.min(1, Math.max(0.5, k)) * 1000) / 1000;
}

/** Pixels from the top of the table area to the bottom of the cream line, at this size. */
export function tableLineY(width: number, height: number, portrait: boolean): number {
  const p = portrait ? PORTRAIT : LANDSCAPE;
  return Math.round(p.line * scaleOf(p, width, height));
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
  // Publish the lines' positions to the table area (--table-line, and
  // --table-line-left / -right), so seats can keep their melds inside them
  // (.table-line-clear, .side-melds-clear-*); and --side-hand-k, so the side
  // hands fit on the parquet beside the chrome (.side-hand).
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const area = el?.parentElement;
    if (!el || !area || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const portrait = window.matchMedia?.('(orientation: portrait)').matches ?? false;
      area.style.setProperty('--table-line', `${tableLineY(el.clientWidth, el.clientHeight, portrait)}px`);
      const sides = tableLineSides(el.clientWidth, el.clientHeight, portrait);
      area.style.setProperty('--table-line-left', `${sides.left}px`);
      area.style.setProperty('--table-line-right', `${sides.right}px`);
      area.style.setProperty('--side-hand-k', String(sideHandScale(el.clientWidth, el.clientHeight, portrait)));
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
