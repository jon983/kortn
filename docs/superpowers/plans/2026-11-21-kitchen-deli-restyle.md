# Kitchen Deli Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the kitchen as a corner deli: a green header with the KORTN wordmark, a swaying cream shop sign, and a hand-drawn menu board (dotted-leader record and an auto-rotating leaderboard, pill actions with inline join, deli-ticket games). The look is two-colour print, over the existing ambient room.

**Architecture:** Design tokens (colours, fonts via `next/font/google`, print utilities) go in `lib/ui/fonts.ts`, `app/layout.tsx` and `app/globals.css`. Small focused presentational components live in `lib/ui/deli/`. Client behaviour sits in small hooks or components: `useAutoRotate`, `RecordList` "More…", `JoinPill`. `HomeView`, `GameRow` and `LeaderboardTabs` are rewritten on top of them. `page.tsx` adds one data field, `yourTurn`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, `next/font/google`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-21-kitchen-deli-restyle-design.md`. The approved visual reference is `docs/superpowers/specs/2026-11-21-kitchen-deli-prototype.html`; match it by eye.

## Global Constraints

- **Palette:** green `#1d5446`, cream `#f6efdc`, red `#c8402f`, gold `#e2bd4f`.
- **Fonts:**

  | Role | Font | CSS variable |
  |---|---|---|
  | Wordmark | Archivo Black | `--font-mark` |
  | Condensed caps | Big Shoulders Display 700/800/900 | `--font-cond` |
  | Wide caps | Archivo, width 125, 700/800 | `--font-wide` |
  | Script | Yesteryear | `--font-script` |
  | Small print | Jost 400/500/600 | `--font-sans` |

  The existing `--font-display` and `--font-body` stay for other pages.
- No new npm dependencies, no new artwork files. The line art is inline SVG.
- Reduced motion: no sign swing and no leaderboard auto-rotation, on top of the existing rules.
- Auto-rotate:
  - advances every **6000 ms**, in the order vsPar → pointsPerHand → winsPer100 → kalookisPer100 → treasuresPer100, skipping empty lists;
  - pauses on hover or focus within the leaderboard and while `document.hidden`;
  - a manual pick stops rotation for the rest of the mount.
- "Your move": the Play pill is red and reads `Your move`; the meta line reads `your turn` in red. **No** hanging tag.
- Phones: the board stacks to one column, and Today's tables comes first.
- The kitchen stops using `Framed`, `LampButton` and the old `Tile` grid. `Framed` and `LampButton` stay for other pages.
- Existing tests must keep passing (game-row "out", leaderboard switching, count-up, motes).

## Review Focus

1. **A user with no games or stats.** The record shows its empty state ("No games played yet…") in deli style, and Today's tables shows its empty line. There are no `NaN` or "—" leaders except the intended "—" values (Task 3 test).
2. **Auto-rotate never moves a list out from under the user:** it pauses on hover or focus and stops after a manual pick (Task 5 tests).
3. **A long player name** (e.g. "Bartholomew") on the sign and on tickets doesn't overflow at 390 px. It scales or wraps (Task 6 visual).
4. **Inline join:** Enter submits; an error shows inline in red; Escape or the cancel link closes it (Task 3 test).
5. **"Your move" is only shown when** the game is active, its round isn't finished, it's the viewer's seat's turn, and the viewer is still in (Task 4 test on the pure helper).

---

### Task 1: Deli design tokens and fonts

**Files:**
- Modify: `lib/ui/fonts.ts` (add five font exports), `app/layout.tsx` (apply their `.variable`s), `app/globals.css` (tokens and utilities)

**Interfaces:**
- Produces:
  - Tailwind colours `deli-green`, `deli-cream`, `deli-red` and `deli-gold` (`--color-deli-*` in `@theme`), and font families `font-mark`, `font-cond`, `font-wide`, `font-script` and `font-sans-deli`.
  - CSS classes:
    - `.deli-paper`: cream with a two-layer dot grain;
    - `.deli-ribbon`: green band, cream wide caps, notched ends via `clip-path`;
    - `.deli-leader`: a flex row whose `> .lead` child is a dotted rule;
    - `.deli-pill`, `.deli-pill--green`, `.deli-pill--outline`, `.deli-pill--red`: condensed caps, rounded-full, using the existing `btn-lift`;
    - `.deli-swing`: a `6s` ease-in-out ±0.8deg rotation with `transform-origin: 50% -30px`;
  - all of them disabled under reduced motion where they animate.

- [ ] **Step 1: Add fonts.** In `lib/ui/fonts.ts`, export `markFont` (`Archivo_Black`, weight 400, `--font-mark`), `condFont` (`Big_Shoulders_Display`, weights 700/800/900, `--font-cond`), `wideFont` (`Archivo`, weights 700/800, `axes: ['wdth']`, `--font-wide`), `scriptFont` (`Yesteryear`, weight 400, `--font-script`) and `sansFont` (`Jost`, weights 400/500/600, `--font-sans-deli`). Add all their `.variable` classes to `<html>` in `app/layout.tsx`.
- [ ] **Step 2: Add tokens and utilities** to `app/globals.css` as listed under Interfaces. `.deli-ribbon` uses `font-stretch: 125%` and `letter-spacing: .3em`. Add `.deli-swing` to the reduced-motion block.
- [ ] **Step 3: Verify.** `npx tsc --noEmit` passes, and `npx next build` compiles. Fonts resolve: in the build output, no `next/font` errors.
- [ ] **Step 4: Commit** with the message `feat(ui): deli design tokens and fonts`.

### Task 2: Deli building blocks (wordmark, shop sign, menu board, ribbon, leader line)

**Files:**
- Create: `lib/ui/deli/Wordmark.tsx`, `lib/ui/deli/ShopSign.tsx`, `lib/ui/deli/MenuBoard.tsx`, `lib/ui/deli/Ribbon.tsx`, `lib/ui/deli/LeaderLine.tsx`, `lib/ui/deli/index.ts`
- Test: `lib/ui/__tests__/deli-blocks.test.tsx`

**Interfaces:**
- Produces:
  - `<Wordmark />`: KORTN plus the stacked "THE / CARD / TABLE".
  - `<ShopSign name: string greeting?: string = 'Good evening,' tagline?: string = 'Card sharp · Est. 2026' />`: a cream `.deli-paper` sign with chains and `.deli-swing`. The name scales down when long, via `clamp()` font size plus `break-words`.
  - `<MenuBoard children className? />`: a wavy-frame SVG background with the frame paths from the prototype, `preserveAspectRatio="none"` and a drop shadow, plus corner line-art fanned cards (♠ top-left, ♥ bottom-right). It's `aria-hidden` art around normal-flow children.
  - `<Ribbon children />` renders `.deli-ribbon`.
  - `<LeaderLine label: ReactNode value: ReactNode tone?: 'default' | 'red' | 'muted' sub?: ReactNode />` renders a `.deli-leader` row.

- [ ] **Step 1: Write failing tests:**
  - `ShopSign` renders the name and the default greeting.
  - `LeaderLine` renders its label and value, and `tone="red"` puts a `text-deli-red` class on the value.
  - `MenuBoard` renders its children and an `aria-hidden` svg.
  - `Wordmark` has the text "KORTN".
- [ ] **Step 2: Run** `npx vitest run lib/ui/__tests__/deli-blocks.test.tsx`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement the components** (server-safe, no hooks).
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(ui): deli building blocks`.

### Task 3: Header, sign, board, record and inline join wired into HomeView

**Files:**
- Create: `lib/ui/deli/RecordList.tsx` (client), `app/JoinPill.tsx` (client)
- Modify: `app/HomeView.tsx` (new composition), `app/HomeHeader.tsx` (green bar with `Wordmark` centred and avatar right)
- Delete: `app/JoinBox.tsx`, once nothing imports it
- Test: `lib/ui/__tests__/record-list.test.tsx`, `lib/ui/__tests__/join-pill.test.tsx`

**Interfaces:**
- Consumes: Task 2 blocks, the existing `CountUp`, and `joinTableAction(formData)` from `app/actions/lobby`.
- Produces:
  - `<RecordList stats: UserStats />`: empty state when `gamesPlayed === 0 && roundsWon === 0`. Otherwise four `LeaderLine`s (Win rate `CountUp %`, Hands vs par `CountUp ×` or "—", Points a hand `CountUp .1` or "—", Net bits `CountUp signed`, red when > 0) and a script "More…" toggle revealing Games played, Games won, Hands won, Kalookis, Treasures and Pot winnings.
  - `<JoinPill />`: collapsed, it's an outline pill "Join with a code". Expanded, it's a form with a `CODE` input (maxLength 4, uppercase, autofocus), a green "Join" pill and a script "cancel" link. On error it shows the message in red inline. On success it navigates to `/match/{id}/lobby`. Escape collapses it.

- [ ] **Step 1: Write failing tests.**
  - **RecordList:** empty stats show "No games played yet". With stats, "Win rate" and "Net bits" show; "Kalookis" is hidden until "More…" is clicked.
  - **JoinPill:** clicking "Join with a code" shows the code input. Typing and submitting calls the mocked `joinTableAction` with `joinCode`. A mocked `{ error: 'No such match' }` shows that text. Escape collapses back to the button.
- [ ] **Step 2: Run** `npx vitest run lib/ui/__tests__/record-list.test.tsx lib/ui/__tests__/join-pill.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement `RecordList`, `JoinPill` and the new `HomeHeader`.**
- [ ] **Step 4: Recompose `HomeView`.** Order: `HomeHeader` → `ShopSign name={myName}` → `MenuBoard` containing:
  - a two-column grid (`md:grid-cols-2`, gap 34px): [Ribbon "Your record" + `RecordList`] and [Ribbon "The leaderboard" + `LeaderboardTabs`];
  - the actions row ([green pill link "Set the table" → `/create`] and [`JoinPill`]);
  - the Today's tables section ([Ribbon "Today's tables" + tickets or the empty line "No tables yet — set one, or join with a code."]);
  - the script sign-off.

  Keep the `ViewTransition` row wrappers and the `settle` entrance: the sign gets delay 0, the board gets [animation-delay:90ms]. On phones, Today's tables gets `order-first` inside the board.
- [ ] **Step 5: Run the full suite.** `npx vitest run` is green. Update `game-row`/home selectors only if a test referenced removed markup, and record any such change as a ruling.
- [ ] **Step 6: Commit** with the message `feat(home): deli header, shop sign, menu board, record and inline join`.

### Task 4: Deli tickets with "Your move"

**Files:**
- Create: `lib/ui/deli/yourTurn.ts`
- Modify: `app/GameRow.tsx` (ticket markup), `app/page.tsx` (pass `yourTurn`)
- Test: `lib/ui/__tests__/your-turn.test.ts`, `lib/ui/__tests__/game-row.test.tsx` (extend)

**Interfaces:**
- Produces:
  - `isYourTurn(state: { finished: boolean; statuses: string[]; round: { finished: boolean; turn: number } } | null, mySeat: number | null): boolean`.
  - `GameRowProps` gains `yourTurn?: boolean`.
  - Ticket markup: a red stamped circle "NO." with the number; players in condensed caps, keeping `data-player` and the "out" behaviour; a meta line; a dotted lead; a Play/Open pill; a muted "abandon"/"delete" text link (reusing `EndGameButton`/`DeleteGameButton` with a `variant="link"` style prop).

- [ ] **Step 1: Write failing tests.**
  - `isYourTurn` is true only for an active match whose round isn't finished, where `turn === mySeat` and `statuses[mySeat] === 'active'`. It's false for a finished match, a finished round, someone else's turn, the viewer busted, or a `null` state or seat.
  - `GameRow` with `yourTurn` shows a button or link named "Your move" and the text "your turn". Without it, it shows "Play" and the time-ago line.
- [ ] **Step 2: Run** `npx vitest run lib/ui/__tests__/your-turn.test.ts lib/ui/__tests__/game-row.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `isYourTurn`, the ticket `GameRow`, the `variant="link"` on `EndGameButton`/`DeleteGameButton` (muted script-style text link, same confirm behaviour), and `page.tsx` computing `yourTurn: isYourTurn(game?.state ?? null, mySeat)`.
- [ ] **Step 4: Run the tests and the full suite.** Expected: PASS, all green.
- [ ] **Step 5: Commit** with the message `feat(home): games as deli tickets, with a quiet "Your move"`.

### Task 5: Leaderboard in deli style, auto-rotating

**Files:**
- Create: `lib/ui/useAutoRotate.ts`
- Modify: `app/LeaderboardTabs.tsx` (deli markup: "Choice of:" script plus condensed tab links, `LeaderLine` rows, a progress line), `app/globals.css` (`.deli-progress` keyframe `6s linear`, paused via `[data-paused]`)
- Test: `lib/ui/__tests__/auto-rotate.test.tsx`, plus keep `lib/ui/__tests__/leaderboard-tabs.test.tsx` passing

**Interfaces:**
- Produces: `useAutoRotate<K extends string>(keys: K[], opts: { intervalMs: number; initial: K }): { current: K; select(k: K): void; pause(): void; resume(): void; paused: boolean; stopped: boolean }`.
  - `select` is a manual pick and sets `stopped`.
  - Rotation skips nothing itself; the caller passes only non-empty keys.
  - Disabled (stopped from the start) when reduced motion matches.
  - Paused while `document.hidden`.

- [ ] **Step 1: Write failing tests** with fake timers:
  - advances `vsPar → pointsPerHand` after 6000 ms, and wraps at the end;
  - `pause()` holds the current key past 6000 ms, and `resume()` restarts the countdown;
  - after `select('winsPer100')` it never changes again;
  - with reduced motion stubbed `true`, it never advances;
  - `LeaderboardTabs` with an empty `kalookisPer100` never shows the "Kalookis" list via rotation;
  - hovering the leaderboard (`mouseenter`) stops it advancing until `mouseleave`.
- [ ] **Step 2: Run** `npx vitest run lib/ui/__tests__/auto-rotate.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `useAutoRotate`, and the restyled `LeaderboardTabs`. Rotation and manual picks both go through `startTransition`, so the existing slide plays. Hover and focus handlers sit on the wrapper. The progress line is keyed by the current tab and gets `data-paused` when paused or stopped (hidden when stopped).
- [ ] **Step 4: Run the tests and the full suite.** Expected: PASS, all green, including `leaderboard-tabs.test.tsx`.
- [ ] **Step 5: Commit** with the message `feat(home): deli leaderboard that rotates every 6s`.

### Task 6: Visual verification, phones, long names and final checks

**Files:** none committed. Temporary preview route only, removed after.

- [ ] **Step 1: Preview.** Add a temporary `app/(auth)/sign-in/zz-preview/page.tsx` rendering `HomeView` with sample data: one `yourTurn` game, one with an out player, one waiting room, and a user named "Bartholomew Fitzwilliam". Take headless Chrome screenshots at 1200 px and 390 px. Expected: it matches the prototype's look; no overflow at 390 px; Today's tables first on phones.
- [ ] **Step 2: Empty user.** Render with zero stats and no games. Expected: the deli-styled empty states.
- [ ] **Step 3: Motion.** Sample the leaderboard over 13 s: it advances twice. Hover, then sample 7 s: unchanged. Under `reducedMotion: 'reduce'`: no rotation, and the sign doesn't rotate (computed transform stays the same).
- [ ] **Step 4: Clean up and run all checks.** Remove the preview, `.next/dev` and `.playwright-mcp`, and revert `next-env.d.ts`. Then `npx tsc --noEmit && npx vitest run && npx next build`, all passing.
- [ ] **Step 5: Push to PR #27** and update its description, adding the deli restyle section.
