# Kitchen restyle: the corner deli

**Date:** 2026-11-21 · **Status:** approved in conversation · **Size:** small project · **Builds on:** `2026-11-21-kitchen-ambience-design.md` (the same PR, #27)

## Intent

The kitchen's panels, fonts and buttons looked like 1990s web components: thick frames, everything boxed, small cramped text, bevelled buttons. The brief is **modern in technology and UX, old-fashioned and kitsch in styling**.

- **Starting points:** Wes Anderson ("a good stimulus zone"), then **Lox in a Box** (Sydney deli, Marrickville). Their identity is two-colour screen-print in forest green and cream with sage, condensed shop-sign capitals, small stacked words, ribbon-banner headers, dotted-leader menus, script accents, hand-drawn wavy borders and line art, and hanging price tags.
- **What the user picked:** the live prototype (`docs/superpowers/specs/2026-11-21-kitchen-deli-prototype.html`, which uses `/files/room-home.jpg` (swap in `/art/room-home.jpg`)) was approved ("looking good"). It's a cream shop sign hanging over a menu board, laid over the existing room. The user leaned towards "A, menu board over the room" and the cream shopfront sign, and rejected polaroids.

## Goals

- **Look**
  - **Palette:** forest green `#1d5446` and cream `#f6efdc` as the two print colours, tomato red `#c8402f` for accents and "your move", gold `#e2bd4f` for tags. A faint printed-paper grain on cream surfaces.
  - **Fonts, loaded through `next/font/google`:**

    | Role | Font | Used for |
    |---|---|---|
    | Wordmark | **Archivo Black** | KORTN |
    | Condensed caps | **Big Shoulders Display** 700/800/900 | names, numbers, buttons |
    | Wide letter-spaced caps | **Archivo** expanded (width 125, 700/800) | ribbon banners, small labels |
    | Script accents | **Yesteryear** | "Good evening", "Choice of:", the sign-off |
    | Small print | **Jost** 400/500/600 | meta text |

- **Page structure**
  - **Green header:** the **KORTN** wordmark centred, with "THE / CARD / TABLE" stacked small beside it. On the right, your name and the Clerk avatar (account menu).
  - **Hanging cream shop sign,** swaying gently on two brass chains: "Good evening," in red script, the player's name in big green condensed caps, and "CARD SHARP · EST. 2026" in wide caps underneath.
  - **The menu board:** one cream surface with a **hand-drawn wavy SVG frame**, a double green rule and line-art fanned cards in two corners. It holds:
    - **Your record:** a ribbon banner, then dotted-leader lines (Win rate, Hands vs par, Points a hand, Net bits in red when positive). The values count up as they do today. Extra stats (games, hands won, kalookis, treasures, pot winnings) sit behind a small script "*More…*" toggle.
    - **The leaderboard:** a ribbon banner, then "*Choice of:* vs par · pts · wins · kalookis · treasures", then dotted-leader rows showing rank · name, hint, and value.
    - **Actions:** a filled green pill, **Set the table** (→ `/create`), and an outlined pill, **Join with a code**. Tapping Join turns it into an inline code input with a Join button, so the separate join panel is gone.
    - **Today's tables:** a ribbon banner, then one **deli ticket** per game:
      - a red stamped circle ("NO." with the number), the players in condensed caps (you first, scores in red, out players greyed with "out"), and a meta line ("played two days ago", or "waiting · 1/3 seated");
      - a dotted leader to a **Play** pill (red **Your move** when it's your move) or **Open** for a waiting room;
      - a muted text link **abandon** (or **delete** for the host of a waiting room).
    - **Sign-off:** "Pull up a chair — there's always a seat at the table." in script.
- **Your turn** (user feedback: the swinging tag was dropped): on a game where it's the viewer's move, the Play pill turns red and reads **Your move**, and the meta line reads "your turn" in red.
- **Leaderboard auto-rotates** (user addition):
  - It advances to the next non-empty list every **6 s**, in order (vs par → pts → wins → kalookis → treasures), with the existing slide transition.
  - A thin red progress line fills under the active choice.
  - It **pauses** while hovered or focused and while the tab is hidden.
  - A **manual pick stops rotation for the rest of the visit.**
  - With reduced motion, it doesn't rotate.
- **Phones:** the sign narrows (the name scales down), the board's two columns stack, Today's tables comes first (as today), and tickets wrap cleanly.
- **Carried over unchanged:** the ambient room (drift, window sunlight, dust), count-up, button lift, view transitions (tabs, rows, pages), the reduced-motion rules, and the entrance (sign and board settle in).

## Non-goals

- Restyling the waiting room, create page or game table. They come next and will reuse these tokens and components.
- New illustration beyond simple SVG line art (fanned cards). A bespoke mascot is a later idea.
- Changing what the kitchen does or shows.

## Anti-goals

- **1990s construction creeping back:** thick frames, boxed tiles, bevels, cramped text.
- **Kitsch overload:** ornament is seasoning. One sign, one board, a couple of line-art accents.
- **Motion that pulls the eye while reading:** the swing is slow and small, and rotation pauses on hover.

## Constraints

- No new npm dependencies. Fonts come through `next/font/google`, alongside the existing `lib/ui/fonts.ts` exports, which other pages still use.
- Reduced motion: no swing, no auto-rotation (plus everything already covered).
- The existing behaviour tests keep passing: count-up, leaderboard switching, game-row "out", game ordering and view-transition structure.

## Approaches

There was one sensible way, so no real alternatives were considered. It extends the existing components and CSS, keeps the data flow in `page.tsx` → `HomeView`, and adds small focused components. A CSS-in-JS or component library would add dependencies for no gain, and a canvas or SVG-rendered page would lose accessibility and text selection.

## Left to the builder

- Exact spacing, the SVG frame path, and the line-art drawing, tuned by eye against the prototype.
- Where "your turn" comes from for the list. Load `round.turn` and the viewer's seat from game state, which `page.tsx` already loads for scores.
- Whether `Framed` remains for other pages. It does, because the create page uses it. The home page stops using it.
