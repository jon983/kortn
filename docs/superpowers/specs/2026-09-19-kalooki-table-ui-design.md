# Kalooki Table / Play UI (Phase 5) — Design Spec

**Date:** 2026-09-19
**Status:** Approved design, pre-implementation-plan
**Builds on:** engine (`lib/kalooki`), persistence (`lib/db`), server (`lib/server` + SSE routes), lobby UI (Phase 4) — all complete.

## 1. Overview

Phase 5 is the **playable game table** — the screen at `/match/[id]/table` (currently a placeholder). It renders the live, per-seat redacted state from the SSE stream and lets the current player act through the authoritative action route. The engine and server already enforce all rules; this phase is **presentation + interaction**, reusing the faded-parlour skin and the `table-surface.jpg` / card-back art.

The deliverable is a fully playable match end-to-end (create → lobby → deal → play rounds → match end) in the browser. Interaction details for the fiddly flows are specified with concrete defaults and refined via playtesting.

### Scope
- IN: the table screen — your hand (drag-reorder + sort + tap-select), opponents, stock/discard, melds on the felt, contextual action bar; the full action set (draw stock/discard, meld & open, lay off, replace joker, discard, go out); round/match-end summaries; rebuy prompt; live SSE updates + reconnect; card rendering with pack colours + card-back art.
- OUT: turn timer (post-launch); spectators; animations beyond simple transitions; E2E tests + launch hardening (Phase 6).

## 2. Interaction model (from brainstorming)

- **Hybrid input:** drag-and-drop to **rearrange your own hand** (purely client-side/cosmetic; order persisted client-side per match). **Tap-to-select + contextual action buttons** for all plays. A **Sort** button auto-arranges the hand (group by rank, then suit-runs). Discard may also be performed by dragging a card onto the discard pile.
- **Legality-driven UI:** the shared pure engine (`lib/kalooki`) previews legality client-side so action buttons enable/disable and illegal selections are blocked *before* submission; the server re-validates every action (authoritative). The client never trusts itself — a rejected action surfaces the server's reason.

## 3. Layout

Viewer is always anchored at the **bottom**; opponents are distributed around the felt using the same adaptive geometry as the lobby (`TableShape`: square 2–4, pentagon 5), rotated so the viewer occupies the bottom edge and opponents fill the remaining edges in seat order.

- **Status strip (top):** round number, "40 to open" reminder, whose turn (highlighted), pot (bits).
- **Felt centre:** stock (face-down stack showing count) + discard pile (top card face-up, pile inspectable); **melds laid on the felt**, each rendered with the engine's **layout discipline** (`layoutMeld` — R-B-R for sets), grouped/owned per player.
- **Opponents:** name, face-down mini-fan sized to card count, card-count + running score, an "opened" badge, and their melds beside them. Current turn highlighted.
- **Your area (bottom):** your hand as a fan of face-up cards (each marked with a small blue/red **pack** indicator), the **action bar** above it, and a one-line contextual hint.

## 4. Card rendering

- **Card** component renders rank + suit (red/black by suit), rounded, with a small **pack dot** (blue = pack A, red = pack B) so duplicate cards read as distinct. Jokers render distinctly.
- **Card backs:** face-down cards (stock, opponents' hands) use the art `card-back-blue.png` / `card-back-red.png` per pack; a CSS fallback pattern if art is missing.
- **Meld cards** on the felt reuse the Card component at a smaller size, ordered by `layoutMeld`.

## 5. Action flows (concrete defaults, playtest-refinable)

The action bar is **phase-aware** (from the redacted `phase`: `awaitingDraw` / `awaitingDiscard`) and **turn-aware** (only the current player's bar is active).

- **Draw (awaitingDraw):** "Draw stock" and "Take discard (<top>)" buttons. Taking the discard triggers the **obligation** (§5a).
- **Meld / open (awaitingDiscard):** select cards → **Meld** stages a validated group into a **laying-down tray** (a strip above the hand). Multiple groups can be staged; a running **points total vs. 40** shows for a not-yet-opened player. **Lay down** commits all staged groups in one turn (this is how a player opens across several melds). Before opening, Lay down is disabled until staged total ≥ 40.
- **Lay off (awaitingDiscard, opened only):** select a hand card → eligible table melds highlight → tap a meld to lay off onto it. (A card taken from the discard cannot be laid off — only melded in a new group, per the rules.)
- **Replace joker (awaitingDiscard, opened only):** tap a joker in a table meld → prompted to supply the natural it represents (run: the exact card; set-of-3: a rank card in an absent suit) → the freed joker is auto-staged and must be committed into a new meld this turn.
- **Discard (awaitingDiscard):** tap a hand card → **Discard** (or drag onto the pile). Disabled while a **draw-obligation** is unmet. Discarding your last card ends the round (go-out).
- **Go out:** detected automatically; when the player's remaining hand can be fully laid down/off with a final discard (or all 13 in one go), completing it ends the round. Kalooki / Treasure detection is server-side; the summary announces it.

### 5a. Draw-from-discard obligation
Taking the discard places the card in the hand, highlighted, and sets a UI lock: the only path forward is to **stage a new meld that includes that card** (for a not-yet-opened player, the staged melds must also reach 40). Discard/End-turn stays disabled until satisfied; a "Cancel" reverts only if the server hasn't been called (the draw is a committed server action, so cancel is not offered post-draw — the client guides completion).

## 6. Realtime, submission & resume

- **Subscribe** to `/api/matches/[id]/stream` (SSE). Each redacted `ClientView` re-renders the table. On connect, the initial state catches you up (reconnect-safe).
- **Submit** actions by POST to `/api/matches/[id]/actions`. On `{ok:false, reason}`, surface the reason inline (rare — the client pre-validates). On success, the resulting state arrives via SSE for all players.
- **Optimistic feel:** the acting client may show a lightweight pending state; the SSE update is the source of truth (no optimistic mutation of authoritative state).
- **Whose-turn gating:** non-current players see the table read-only (their hand still drag-reorderable/sortable locally).

## 7. Round & match end

- **Round-end summary** (modal/overlay): who went out, go-out type (normal / Kalooki / Treasure), each player's hand points added, bit payments, updated cumulative scores. "Continue" dismisses; the next round deals automatically (server) and the table updates via SSE.
- **Rebuy prompt:** a busted player (score > 150) sees "Buy back in for 4 bits — re-enter at the current top score" / "Decline". Wired to the existing `rebuy` / `decline` server actions. Resolved before the match awards.
- **Match-end summary:** the winner, final standings, pot awarded. Link back to home.

## 8. Components (new, under `lib/ui/table/` + `app/match/[id]/table/`)

- `Card.tsx` — one card (rank/suit/pack dot/joker); `CardBack.tsx` — face-down (art + fallback).
- `Hand.tsx` — your fan: drag-reorder (client state persisted per match), tap-select, Sort.
- `OpponentSeat.tsx` — opponent summary + mini-fan + melds.
- `MeldPile.tsx` — a meld rendered via `layoutMeld`.
- `StockDiscard.tsx` — centre piles.
- `ActionBar.tsx` — phase/turn-aware buttons + laying-down tray + points-to-open.
- `TableView.tsx` (client) — composes the above from a `ClientView`, positions seats via `TableShape` geometry (viewer at bottom), holds selection/tray state, submits actions.
- `RoundSummary.tsx`, `RebuyPrompt.tsx`, `MatchSummary.tsx` — overlays.
- `useMatchStream.ts` — SSE subscription hook returning the latest `ClientView`.
- `app/actions/play.ts` — thin server action(s) wrapping `submitAction` (auth-derived seat), or reuse the existing action route via fetch.
- `app/match/[id]/table/page.tsx` — server component: auth-gate + membership, initial redacted state, renders `TableView`.

Client legality preview reuses `lib/kalooki` directly (pure, safe in the browser).

## 9. Testing

- **Component unit (jsdom + RTL):** Card (suit colour, pack dot, joker), CardBack (art + fallback), Hand (select toggles, Sort orders by rank/run, drag-reorder updates order), MeldPile (layoutMeld order), ActionBar (buttons enable/disable by phase/turn/legality; laying-down tray totals toward 40).
- **Interaction logic (pure, unit-tested):** a client-side `legalActions(view, selection)` helper that maps a selection to enabled actions using the engine — tested against representative states (can-open, can't-open-<40, discard-obligation-active, layoff-eligible).
- **TableView integration (RTL, mocked stream + action submit):** renders a `ClientView`, selecting cards enables Meld, submitting calls the action endpoint; read-only when not your turn; round-summary/rebuy overlays render from terminal states.
- **Redaction trust:** TableView only ever consumes `ClientView` (never full `MatchState`) — a test asserts opponent hands are counts only in the props it receives.
- **E2E (Playwright):** deferred to Phase 6 (a full scripted round to a go-out).

## 10. Art
Uses `public/art/table-surface.jpg` behind the felt and `card-back-blue.png` / `card-back-red.png` for face-down cards; CSS fallbacks when absent (layout is art-agnostic). frontend-design skill applied during implementation for polish.

## 11. Future work (out of Phase 5)
- Turn timer / auto-forfeit; spectators; richer animations; sound. E2E + launch hardening (Phase 6): Clerk production keys + kortn.com DNS, deploy config, npm-audit pass.
