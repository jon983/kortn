# Setting up tables in the kitchen (no waiting room)

**Date:** 2026-11-21 · **Status:** approved in conversation · **Size:** small project

## Intent

The waiting room is a separate screen that exists only to wait. The organiser should pick the table size and watch people join **from the kitchen**. Joiners wait in the kitchen too. When the host deals, everyone else's ticket flips to Play or Your move, with a chime, and they step in when they're ready. They're **not** pulled in automatically (user's choice).

## Goals

- **Set the table** (green pill) opens in place on the menu board: "How many chairs?" with the choices **2 · 3 · 4 · 5** (default 4), then **Deal us in** or "cancel". There's no buy-in reminder (user). Creating the table keeps you in the kitchen, and its ticket appears at the top of Today's tables.
- **The setting-up ticket** (a game in `lobby` status):
  - The **code** is shown big, with a **Share** button. It uses `navigator.share`, falling back to copy-to-clipboard with a brief "Copied!".
  - **Who's seated:** names in condensed caps (You first), plus "empty chair" placeholders.
  - **Host:** a **Deal** pill, disabled until every chair is filled. Dealing takes the host to the table. There's also a quiet "delete" link.
  - **Everyone else:** a meta line, "waiting for {host} to deal · n/m seated", and a quiet **leave** link that removes only themselves. Today non-hosts can only "abandon", which cancels the table for everyone.
- **Joining with a code** keeps you in the kitchen (`router.refresh()`), and your waiting ticket appears.
- **Live kitchen:**
  - While any setting-up ticket is listed, refresh every **4 s**; otherwise every **15 s**.
  - Pause while the tab is hidden, and refresh as soon as it's visible again.
  - When a ticket newly becomes **Your move**, play the existing turn chime (`playYourTurn`). Browsers may block sound until the user has interacted with the page; that's accepted.
- **Removed:** `/create` and `/match/[id]/lobby` now redirect to `/`, and the table page's lobby redirect goes to `/` too. `CreateForm`, `WaitingRoom` and their tests are deleted.

## Non-goals

- The game-table restyle (next project).
- Push notifications or anything outside the open kitchen page.
- Changing how seats are shuffled at the deal.

## Constraints

- Server-side rules are unchanged:
  - only the host deals;
  - dealing needs a full table;
  - joining needs `lobby` status and a free seat;
  - leaving is lobby-only and not for the host (the host deletes instead).
- The deli look and components from the kitchen restyle: `deli-pill`, `LeaderLine` style, condensed caps, script quiet links.
- Reduced motion: no new animation beyond what's already covered.

## Approaches

There was one sensible way. The kitchen re-renders on a timer (`router.refresh()` from a small client component) instead of opening one live connection per waiting table. The live stream route is built around game state for seated players and publishes every move, which is heavy for a list. A timer is simple, costs one server render every 4–15 s, and needs no new infrastructure.

## Left to the builder

- Exact ticket layout for setting-up games, within the deli ticket language.
- Chime de-duplication: chime once per game per transition into Your move, tracked across refreshes in the client.
