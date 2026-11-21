import type { ReactElement } from 'react';

/**
 * The game table photo (a green diner table on parquet), drawn below the
 * header. The photo is sized so the whole table top — chrome edge and all —
 * always fits with a strip of floor round it (`.table-photo` in globals.css).
 * Where the screen is wider or taller than the photo, the parquet's edges
 * fade into a warm dark-wood vignette. Landscape plate by default; the portrait plate on upright screens.
 */
export function TableSurface(): ReactElement {
  return (
    <div data-table-surface aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [container-type:size]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#8a5a30_0%,#5e3b1c_55%,#2e1c0c_100%)]" />
      <div data-table-photo className="table-photo bg-[url(/art/table-surface.jpg)] bg-cover portrait:bg-[url(/art/table-surface-portrait.jpg)]" />
    </div>
  );
}
