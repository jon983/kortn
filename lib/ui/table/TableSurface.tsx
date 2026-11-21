import type { ReactElement } from 'react';

/**
 * The game table photo (a green diner table on parquet), drawn below the
 * header as a nine-piece frame (`.table-frame` in globals.css): it always
 * fits the area exactly, with the chrome the same thickness on all four
 * sides and a strip of parquet all round. Landscape plate by default; the
 * portrait plate on upright screens. The wood colour only shows while the
 * photo loads.
 */
export function TableSurface(): ReactElement {
  return (
    <div data-table-surface aria-hidden className="table-surface pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#5e3b1c] [container-type:size]">
      <div className="table-under table-under--tl" />
      <div className="table-under table-under--tr" />
      <div className="table-under table-under--bl" />
      <div className="table-under table-under--br" />
      <div data-table-photo className="table-frame" />
    </div>
  );
}
