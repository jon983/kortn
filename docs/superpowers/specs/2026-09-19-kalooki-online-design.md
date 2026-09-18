# Kalooki Online — Design Spec

**Date:** 2026-09-19
**Status:** Approved design, pre-implementation-plan

## 1. Overview

Kalooki Online is an online multiplayer implementation of Kalooki, a contract-rummy
card game for 2–4 players. Players sign in, create or join a match via a shareable
code, and play rounds over a realtime connection until one player remains at or
below 150 points. Accounts, match results/stats, full move history, and
in-progress games are persisted.

The build prioritizes a **pure, exhaustively-tested rules engine** as the source of
truth, an **authoritative server** that clients cannot cheat against, and a
**dark-themed React table UI**.

### Scope for v1
- Online multiplayer, 2–4 human players (no AI bots yet).
- Clerk accounts; Neon Postgres persistence of stats, in-progress state, and full move history.
- Ephemeral join-by-code lobby.
- No turn timer / auto-forfeit (noted as future work).

## 2. The Rules (authoritative)

**Objective:** Be the last player at or below 150 points while all others have
surpassed 150.

**Players:** 2–4. **Deck:** 106 cards = two full 52-card packs + 2 jokers.
The two packs are visually distinct: **pack A is blue-backed, pack B is red-backed.**

**Rank:** low 2 … King, **Ace high**. Runs are same-suit sequences `…Q K A`; there
is no `A 2 3` and no wraparound.

**Buy-in:** each player buys in for **4 bits** at match start; bits form the pot.

**The deal:** shuffle all 106 cards, deal **13** to each player. Remaining cards
form a face-down stock; flip the top card to start the discard pile. Eldest hand
(left of dealer) goes first. Play proceeds clockwise.

**Melds — two types:**
- **Set:** 3–4 cards of the same rank, all different suits. A 4-card set is
  **closed** — it cannot be extended and its jokers cannot be replaced.
  - A set of 3 **may** be 2 jokers + 1 natural card. The single natural defines the
    rank; the jokers remain unassigned to a suit until replaced.
- **Run:** 3+ cards of the same suit in sequence, Ace high only.

**Jokers:** represent any card needed to complete a meld, taking that card's value.
Once a meld containing a joker is on the table, an opponent (who has completed their
opening meld) may replace the joker:
  - **In a run:** provide the natural card the joker represents.
  - **In a set of 3:** provide a natural of the set's rank in a suit **not already
    present** in the set (the rule: "both cards not already in the set"; with a
    2-joker set the replacer provides a natural in any absent suit).
  - The player must **immediately create a meld** with the freed joker, in the same
    turn. Replacing/laying off requires having opened; this may occur in the same
    turn as opening.

**The play — each turn:**
1. **Draw**, player's choice each turn:
   - from the **stock** (top, face-down), or
   - from the **discard** (top). Taking the discard **obligates** the player to use
     that exact card immediately in a **new meld** laid down this turn — never a
     lay-off, and it cannot be drawn then discarded. A not-yet-opened player may
     take the discard only if that turn's melds satisfy the 40-point opening.
2. **Meld / lay off / replace jokers** (subject to opening rules below).
3. **Discard** exactly one card onto the discard pile (unless going out empties the
   hand).

**Opening meld:** to go down the first time, a player must lay **40+ points**,
possibly across multiple melds in the same turn. Point values when melding:
number = rank, court = 10, Ace = 11, joker = value of the card it represents. After
meeting 40 (even in that same turn) the player may lay off onto others' melds and
replace jokers.

**Continuing play:** once opened, a player may take the top discard at the start of
their turn (still under the "new meld" obligation) and may lay off cards onto any
player's melds (hand the card over; it's added to the meld).

**Going out:** first player to empty their hand (melding/laying off everything, with
a final discard, or melding all 13) ends the round.
- **Kalooki:** going out by going down with all 13 cards in one go.
- **Treasure:** a Kalooki done without adding to other players' melds. Only **one
  Treasure per game**; subsequent ones count as Kalooki.

**Scoring (round end):** the player who went out scores **0**. Others score the
points of cards left in hand: number = rank, court = 10, Ace = 11, **joker = 15**.

**Bit payments (into the pot):** losers each pay **1** for a normal go-out, **2**
for Kalooki, **4** for Treasure.

**Match end / winning:**
- A player who **surpasses 150** is out. They may **rebuy once** for 4 bits,
  re-entering with a score equal to the **current highest** score among still-active
  players. A player may only rebuy once.
- When only **one** player remains at ≤150, they win and take the entire pot.

### Additional interpretations (confirmed)
1. Stock empty → reshuffle the discard pile (except its current top card) into a new
   stock.
2. Discard top and full discard pile are public/inspectable; stock is a count only.
3. If the first card flipped to start the discard pile after the deal is a **joker**,
   the first player is offered the chance to take it into a new meld (as their draw).
   If they do not take it (cannot use it, or decline), the joker is shuffled back into
   the stock at a random position and the player instead draws from the top of the
   stock.

## 3. Architecture

Three cleanly separated layers.

### 3a. Rules engine — `/lib/kalooki` (pure TypeScript)
No I/O, no network, no React. Given a state + proposed action, returns the new state
or a typed rejection. This is the correctness core and is unit-tested first (TDD).

Units:
- **`cards.ts`** — card model. Card = `{id, rank, suit}` or `{id, joker: true}`;
  `id` is unique so duplicate cards (and the two packs) are distinguishable. `id`
  also encodes pack A/B → blue/red back. Deck construction, **seedable** shuffle
  (deterministic for tests + replay), point-value helper.
- **`melds.ts`** — meld validation:
  - Set: 3–4 same rank, distinct suits; 4-set is closed. 2-joker + 1-natural sets
    allowed.
  - Run: 3+ same suit in sequence, Ace high, no wraparound.
  - Joker resolution: compute the specific card each joker represents (for point
    value, lay-offs, replacement).
  - Point value: number = rank, court = 10, Ace = 11, joker = represented value.
- **`state.ts`** — game state shape: seats, hands, per-player `hasOpened`, table
  melds (owner + resolved joker info), stock, discard pile, current turn, phase
  (`awaitingDraw` / `awaitingAction` / `awaitingDiscard`), round + match status,
  scores, pot, rebuy tracking, Treasure-used flag.
- **`actions.ts`** — single entry point `applyAction(state, seat, action) → Result`.
  Enforces turn order, phase, the 40-point opening gate, the discard-draw
  "new meld this turn" obligation, lay-off legality, joker replacement (run vs.
  set-of-3 rules, then immediate re-meld), going out, Kalooki/Treasure detection.
- **`scoring.ts`** — round-end hand totals (joker = 15 in hand), bit payments
  (1/2/4), 150 bust, one-time rebuy at current-highest score, winner/pot resolution.

Action types (indicative): `draw`, `meld`, `layoff`, `replaceJoker`, `discard`,
`goOut`.

### 3b. Server / game runtime
- WebSocket endpoint on a Vercel Function (Fluid Compute,
  `experimental_upgradeWebSocket` from `@vercel/functions`). Players join a channel
  keyed by `match_id`.
- Authoritative loop per action:
  1. Client sends an action.
  2. Server loads `game_states.state` + `version`, checks it's the player's turn.
  3. Feeds action to the pure engine.
  4. On success: write new state at `version+1` (optimistic lock; reject if version
     moved), append to `moves`, broadcast a **redacted** view per player.
  5. On failure: reply the rejection reason to the acting player only.
- **Redaction:** each player sees their own hand fully; opponents' hands are counts;
  stock is a count; discard pile is public; table melds are public.
- **Reconnect/resume:** on (re)connect, server sends the full current redacted state
  from `game_states`. Match stays resumable while `status = active`; a cleanup job
  marks truly abandoned matches.
- **Bits/pot** computed and written server-side only.

### 3c. Client (React, Next.js App Router)
Renders the table, hand, melds, stock/discard; sends actions; receives redacted
updates. Contains **no** authoritative rules but reuses the pure engine to
**preview** legality (disable illegal moves with a reason) for instant UX. Server is
always the source of truth.

## 4. Data Model (Neon Postgres via Drizzle)

Engine state is stored as **JSON** (owned by the engine); aggregates are normalized
for querying.

- **`users`** — mirror of Clerk identity (Clerk id, display name, avatar), synced via
  webhook. Cumulative stats (games played, rounds won, bits net) here or in a derived
  view.
- **`matches`** — `id`, `status` (`lobby`/`active`/`finished`/`abandoned`),
  `created_by`, `created_at`, `finished_at`, `winner_user_id`, `pot`,
  `settings` (JSON: player count, etc.).
- **`match_players`** — `match_id`, `user_id`, `seat_index`, `score`, `bits_paid`,
  `rebought` (bool), `status` (`active`/`busted`/`left`), `final_placing`.
- **`rounds`** — `id`, `match_id`, `round_number`, `dealer_seat`, `winner_seat`,
  `go_out_type` (`normal`/`kalooki`/`treasure`), `finished_at`; per-player round
  scores in a child table or JSON.
- **`game_states`** — `match_id` (unique), `state` (JSON engine snapshot),
  `version` (int optimistic lock), `updated_at`. Enables resume.
- **`moves`** — append-only: `id`, `match_id`, `round_number`, `seat_index`,
  `sequence`, `action` (JSON), `created_at`. Full replay log; snapshot is derivable
  but stored separately for fast resume.

## 5. Client, UI & Lobby

- **Auth & entry:** Clerk sign-in. Home shows create match, join by code, and active/
  resumable matches + stats.
- **Lobby:** creator picks 2–4 players, gets a shareable code/link; players appear as
  they join; creator starts when seats fill; 4-bit buy-in recorded, pot shown.
- **Table (dark theme):**
  - Opponents around top/sides: name, card count, cumulative score, their melds.
  - Center: stock (face-down count) + discard (top visible, pile inspectable).
  - Your hand at bottom: selectable/draggable cards; **blue vs. red backs** mark the
    two packs.
  - Contextual controls per phase: Draw (stock/discard), Meld (live-validated, shows
    point total + 40-opening status), Lay off, Replace joker, Discard, Go out.
  - Live legality preview via the shared pure engine; server re-validates.
  - Status: whose turn, opening met, round/match scores, pot, end-of-round/match
    summaries incl. Kalooki/Treasure call-outs.
- **Meld layout discipline (presentation only):** the engine stores a meld as an
  unordered card set; the renderer arranges it.
  - **Sets:** alternate card colors as evenly and symmetrically as possible — odd
    color out sits in the **middle** (`R-B-R` / `B-R-B`), never clumped; 4-sets
    alternate `R-B-R-B`. Jokers placed to preserve alternation. Implemented as a
    deterministic layout function, unit-tested.
  - **Runs:** kept in sequence order.
- **Responsiveness:** desktop-first; usable on tablet; phone best-effort for v1.
- **Look & feel:** frontend-design skill applied during implementation for a polished,
  non-generic dark table aesthetic.

## 6. Testing Strategy

- **Rules engine — exhaustive unit tests (TDD, Vitest):** meld validation (sets incl.
  2-joker sets, runs, Ace-high boundaries, closed 4-sets), point values, 40-point
  opening gate (incl. multi-meld single-turn opening), discard-draw obligation,
  lay-off rules, joker replacement (run vs. set-of-3 with immediate re-meld), going
  out, Kalooki/Treasure (incl. one-per-game), scoring, bit payments, 150 bust,
  one-time rebuy at current-highest score, pot award. Deterministic seeded RNG.
- **Move-replay property test:** replaying a match's `moves` reproduces the stored
  `game_states` snapshot.
- **Meld-layout tests:** the R-B-R discipline rule.
- **Server/integration tests:** action → validate → persist → redacted broadcast;
  optimistic-lock rejection on racing actions; reconnect restores correct redacted
  state.
- **E2E (light, Playwright):** create → join → play a short scripted round to a
  go-out. Happy-path only; engine tests carry the correctness load.

## 7. Future work (out of v1 scope)
- Turn timer / auto-forfeit.
- AI bots to fill empty seats.
- Phone-optimized layout.
- Leaderboards / richer profiles beyond basic stats.
