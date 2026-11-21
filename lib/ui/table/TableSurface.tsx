import type { ReactElement } from 'react';

/**
 * The game table photo (a green diner table on parquet), drawn below the
 * header. It always fills the area, with the table spanning nearly the full
 * width (`.table-photo` in globals.css). The dark-wood layer underneath only
 * shows while the photo loads. Landscape plate by default; the portrait
 * plate on upright screens.
 */
export function TableSurface(): ReactElement {
  return (
    <div data-table-surface aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [container-type:size]">
      <div className="absolute inset-0 bg-[#5e3b1c]" />
      <div data-table-photo className="table-photo bg-[url(/art/table-surface.jpg)] bg-cover portrait:bg-[url(/art/table-surface-portrait.jpg)]" />
    </div>
  );
}
