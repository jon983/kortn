# Kitchen ambience: the room comes alive

**Date:** 2026-11-21 · **Status:** awaiting approval · **Size:** small project

## Intent

The kitchen (home page) should feel like a warm, lived-in room you've walked into, not a static menu. The current vintage look stays: the photo room, brass, framed panels. It gains movement. This is the first of three pieces. The waiting room comes next, then the game table, which is its own project. Choices made here, such as the motion style and the reduced-motion rules, should carry over to those.

## Goals

- **Ambient room, always running, slow and subtle:**
  - The room photo drifts with a gentle zoom over about 30 seconds.
  - Candlelight from the chandelier flickers softly.
  - **Dust is a feature.** About 20 motes of varied size and blur drift up at different speeds through a faint shaft of light from the window.
- **Arrival:**
  - Panels settle in one after another, rising slightly and fading in. This plays once per visit and doesn't loop.
  - The numbers in Your record count up from zero.
- **Using it:**
  - Brass buttons get an occasional gleam, and lift slightly on hover or press.
  - Leaderboard tabs slide or crossfade between lists.
  - Game rows slide in, and an abandoned game slides out instead of vanishing.
- **Between pages:** moving from the kitchen to a table, the create page, or a waiting room, and back, feels continuous rather than a hard cut.

## Non-goals

- Restyling the waiting room or the game table. Those are separate pieces, and only the shared transition and reduced-motion rules apply to them now.
- New artwork. The effects use the existing `room-home.jpg`.
- Sound.

## Anti-goals (a failure even if it works)

- **Distracting motion.** Anything that pulls the eye while you're reading stats or picking a game. The ambience should be noticed only when you look for it.
- **Stutter or battery drain on phones.**
- **Motion for people who've asked their device for less of it.**

## Constraints

- **Reduced motion:** when the device asks for reduced motion (`prefers-reduced-motion`), there's no ambient movement, no entrance animation and no count-up. Numbers show final values and the page is still.
- **Performance:**
  - Animate only `transform` and `opacity`. Nothing animates layout or filters per frame, except blur fixed on static elements.
  - About 20 dust elements at most, and the ambient layers are purely decorative (`aria-hidden`, `pointer-events: none`).
- **Browser support:** browsers without View Transitions just change instantly, as today.
- **Code conventions:** the existing Tailwind 4 setup. The animation keyframes go in `app/globals.css` (the `@theme` block or plain CSS).

## Approaches considered

1. **Built-in tools only (chosen).** CSS animations for the ambience, entrance and button sheen. A tiny count-up hook. React's built-in `<ViewTransition>`, supported by the Next.js 16 App Router out of the box (see `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`), for tab changes, game rows entering and leaving, and page-to-page transitions. No new dependencies.
2. **Motion animation library.** One toolkit with springs and exit animations. It adds about 35 KB, and the kitchen doesn't need its strengths. **Revisit for the game table**, where weight and dragging matter.
3. **Particle-engine background (dropped).** Richer dust and light, but heavy on phones for little gain over CSS. It can be added later just for the dust if the CSS version feels thin.

The user chose approach 1, with dust as a feature.

## Design

- **`RoomBackdrop`** (`lib/ui/RoomBackdrop.tsx`) gains an `ambient` option, on for the kitchen. It renders:
  - the drifting photo layer;
  - the candle-glow layer (a radial gradient near the chandelier, with an opacity flicker);
  - the light shaft (a soft diagonal gradient band, slowly breathing in opacity);
  - the dust layer (about 20 absolutely positioned motes with randomised size, start position, duration and delay, generated deterministically so server and client match);
  - the existing vignette.

  Other pages that use `RoomBackdrop` can opt in later.
- **Entrance:** each home panel gets a staggered "settle in" animation class (translateY 12px → 0, opacity 0 → 1, about 500 ms, around 90 ms apart, in visual order). It plays on first render only.
- **Count-up:** a small client hook animates numeric stat tiles from 0 to their value over about 800 ms with ease-out. Values that aren't numbers, like "—", render as-is.
- **Buttons:** `LampButton` and the Play button get a periodic sheen (a pseudo-element sweep every few seconds, staggered so they don't sync) and a hover/press lift (`translateY(-1px)`, deeper shadow; pressed 0).
- **Leaderboard tabs:** the list is wrapped so switching tabs crossfades and slides slightly (`<ViewTransition>` keyed by tab).
- **Game rows:** each row is wrapped in `<ViewTransition>` keyed by game id, so new rows slide in and abandoned or deleted rows slide out after the page refreshes.
- **Page transitions:** a subtle crossfade with a slight rise on navigation between the kitchen and other routes, using `<ViewTransition>` with the default enter/exit. The table page keeps its own layout; only the outgoing and incoming fade applies.
- **Reduced motion:** one global `@media (prefers-reduced-motion: reduce)` block disables all of the above. The count-up hook checks the same media query.

## Left to the builder

- Exact timings, easings, colours of the glow and shaft, and mote counts and sizes within the limits above. Tune by eye against the real backdrop.
- Where the light shaft sits relative to the window in `room-home.jpg`.
- Whether the page transition needs a named element. The default crossfade is fine unless something obvious, like the header, should stay fixed.

## Testing

- Unit test the count-up hook (final value, reduced motion shows the final value immediately, non-numbers pass through).
- Unit test that the dust generator is deterministic.
- Check visually at desktop and phone width with sample data, including a pass with reduced motion turned on.
- Check animation smoothness in a performance trace on a throttled CPU, aiming for no long frames from the ambience.
