# Deli Game Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the game table in the kitchen's deli language and add motion at the key moments, without changing behaviour or slowing a turn. That covers the header, name plates, pills, card backs, receipt, order pad, ticket and winner sign.

**Architecture:** Restyle in place. Change markup and classes in `TableView` (header, your spot, the Scores overlay), `OpponentSeat`, `ActionBar`, `MeldPile`, `overlays.tsx` and `CardBack`.
- **New CSS** for the moments goes in `app/globals.css`, each with a reduced-motion fallback.
- **One small hook** handles the receipt's line-by-line print.
- **Card backs** become an inline SVG component.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4 (`@theme` deli tokens), Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-21-deli-table-design.md`

## Global Constraints

- **Deli language only:** tokens `deli-green` `#1d5446`, `deli-cream` `#f6efdc`, `deli-red` `#c8402f`, `deli-gold` `#e2bd4f`; fonts `font-cond`, `font-mark`, `font-script`, `font-sans-deli`; classes `deli-pill` (`--green`, `--outline`, `--red`), `deli-ribbon`, `deli-paper`, `deli-swing`, `btn-lift`. No heavy bordered panels.
- **Card faces are unchanged.** Game rules, server, layout and seat geometry are unchanged.
- **Exact copy:**
  - your turn: `Your move`;
  - someone else's turn: `{name}'s move`;
  - your spot: `{n} cards · {pts} pts` (no name);
  - Scores overlay heading: `Scores`;
  - winner sign: `{Name} takes the pot`;
  - buy-back ticket: keeps `Buy back in for 4 bits and re-enter at the current top score?` and the buttons `Buy back in` and `Decline`.
- **Nothing blocks input.** In-play motion is under 300 ms, the deal keeps today's timing, and the receipt can be tapped to finish.
- **Reduced motion:** every new animation has `@media (prefers-reduced-motion: reduce)` → `animation: none`. The receipt prints instantly when `matchMedia('(prefers-reduced-motion: reduce)').matches`.
- **390 px phones:** no horizontal scroll, and the header is no taller than today's.
- **Tests that assert on old text** ("Your turn", "Scorecard", the png back url) are updated, not deleted.

## Review Focus

1. **Long names at 390 px** (for example "Bartholomew-Featherstonehaugh") wrap inside the cream plate and don't push cards or the header sideways (Task 3 test asserts `[overflow-wrap:anywhere]`; Task 8 screenshot with a long name).
2. **A stream update during the receipt** (a new `view` object, same hand) must not restart the print or hide "Next hand" again (Task 5 test).
3. **Reduced motion:** the receipt appears whole, with "Next hand" available immediately (Task 5 test).
4. **A player who's out** sees the receipt with "Waiting for the next hand… n/N ready" and no pill (Task 5 test).
5. **An abandoned game** shows "Game ended" with no winner sign and no "takes the pot" (Task 7, existing test kept).

---

### Task 1: Deli card backs (two packs)

**Files:**
- Modify: `lib/ui/table/CardBack.tsx`
- Delete: `public/art/card-back-blue.png`, `public/art/card-back-red.png`
- Test: `lib/ui/table/__tests__/card.test.tsx` (replace the "references the pack art url" test)

**Interfaces:**
- Produces: `CardBack({ pack: Pack; size?: 'sm' | 'md' })`. It has the same props and sizes as today (`sm` = `w-10 h-14`, `md` = `w-24 h-32`). The root has `data-pack={pack}` and contains an inline `<svg>`.
  - Pack A is green: a `#1d5446` field.
  - Pack B is tomato red: a `#c8402f` field.
  - Both have a cream border, a fine repeating print `<pattern>` and a centred K monogram medallion. The monogram is `<text>` "K" or a path; if it's a path it needs `aria-hidden` and a `<title>`.
  - Pattern ids must be unique per instance (`useId()`), because many backs render at once.

- [ ] **Step 1: Write failing tests** in `card.test.tsx`:
  - **`'CardBack draws pack A in deli green and pack B in tomato red'`:** render both. Expect `[data-pack="A"] svg` to have an element with `fill="#1d5446"`, and `[data-pack="B"] svg` one with `fill="#c8402f"`.
  - **`'CardBack carries the K monogram and no image url'`:** `container.innerHTML` doesn't contain `card-back-`, and the svg contains the text `K` (or a `<title>` of `K`).
  - **`'two CardBacks do not share pattern ids'`:** render two. The `id`s of their `<pattern>` elements differ.
- [ ] **Step 2: Run** `npx vitest run lib/ui/table/__tests__/card.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `CardBack` as above and delete the two pngs. Run `grep -rn "card-back-" app lib public` and expect no hits.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(table): deli card backs — green and tomato-red packs with a K monogram`.

### Task 2: Deli header and the "Your move" ribbon

**Files:**
- Modify: `lib/ui/table/TableView.tsx` (the sticky top bar, around lines 466–548)
- Modify: `app/globals.css` (add `.deli-ribbon-drop`)
- Test: `lib/ui/table/__tests__/table-view.test.tsx`

**Interfaces:**
- Produces:
  - the header uses `bg-deli-green text-deli-cream`. Kitchen, refresh, video, chat, volume and Scores are compact `deli-pill` / tag elements with today's handlers, the unread badge (in `deli-red`), the volume popover (restyled cream paper) and `CallControls`;
  - Hand and Pot become small printed tags: `Hand {n}` and `Pot {n} bits`;
  - centre, on your turn: `<span className="deli-ribbon deli-ribbon-drop …">Your move</span>`;
  - centre, otherwise: `<span className="font-script …">{name}'s move</span>`. The pulse animation is removed;
  - CSS: `.deli-ribbon-drop`, a one-shot 260 ms drop-in (translateY(-8px) → 0, with an opacity fade), and `animation: none` under reduced motion.

- [ ] **Step 1: Write failing tests** in `table-view.test.tsx`, reusing that file's existing view fixture:
  - **`'shows the Your move ribbon on your turn'`:** expect `getByText('Your move')`, and expect no element matching `/your turn/i`.
  - **`'names whose move it is otherwise'`:** with `currentTurn` set to an opponent named `Ines`, expect `getByText("Ines's move")`.
  - **`'header shows hand and pot tags'`:** expect `getByText('Hand 8')` and `getByText('Pot 12 bits')` (use the fixture's values).
- [ ] **Step 2: Run** `npx vitest run lib/ui/table/__tests__/table-view.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the header restyle. Keep the phone wrapping order: the turn indicator takes its own full-width row on phones, as now. Keep the `aria-label`s and titles on icon buttons.
- [ ] **Step 4: Run** the table-view and call tests: `npx vitest run lib/ui/table/__tests__/table-view.test.tsx lib/ui/table/__tests__/call.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(table): deli header — printed tags and the Your move ribbon`.

### Task 3: Cream name plates, your plate, and the turn ribbon

**Files:**
- Modify: `lib/ui/table/OpponentSeat.tsx` (`SEAT_LABEL`, the name and count labels)
- Modify: `lib/ui/table/TableView.tsx` (your-spot label, around line 617)
- Modify: `app/globals.css` (add `.plate-ribbon-in`)
- Test: create `lib/ui/table/__tests__/name-plate.test.tsx`

**Interfaces:**
- Produces:
  - **opponent plate:** one cream plate (`bg-deli-cream text-deli-green`, a soft shadow, slight rounding) holding:
    - the name in `font-cond` uppercase with `[overflow-wrap:anywhere]`;
    - `{handCount} cards · {score} pts` in `font-sans-deli` small;
    - the avatar or media as now.

    When `isTurn`, a small red ribbon element `<span data-turn-ribbon className="plate-ribbon-in …">` sits on the plate. Out or sitting-out seats keep `opacity-60` and the line-through name;
  - **your plate:** the same plate style, with no name, the text `{n} cards · {pts} pts`, and `data-turn-ribbon` when it's your turn;
  - **CSS:** `.plate-ribbon-in` is a 220 ms slide-in from the left with a fade, and `animation: none` under reduced motion.

- [ ] **Step 1: Write failing tests** in `name-plate.test.tsx`, rendering `OpponentSeat` with minimal props (`name`, `handCount: 13`, `score: 43`, `status: 'active'`, `melds: []` and so on, as `table-view.test.tsx` passes them):
  - **`'shows the name and the count line on a cream plate'`:** `getByText(/ines/i)` and `getByText('13 cards · 43 pts')`.
  - **`'wears the turn ribbon only on their turn'`:** `isTurn: true` → `container.querySelector('[data-turn-ribbon]')` exists; `false` → it's null.
  - **`'long names can wrap'`:** the name element's class contains `[overflow-wrap:anywhere]`.
  - **`'your plate has no name'`:** in `table-view.test.tsx`, the you-seat (`[data-you-seat]`) contains the text `cards ·` and doesn't contain the viewer's own seat name.
- [ ] **Step 2: Run** `npx vitest run lib/ui/table/__tests__/name-plate.test.tsx lib/ui/table/__tests__/table-view.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the plates and the ribbon.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(table): cream name plates with a red ribbon for whose turn it is`.

### Task 4: Deli pills, and the meld settle

**Files:**
- Modify: `lib/ui/table/TableView.tsx` (`ctrlBtn`, line 25; any other walnut-gradient buttons in the file)
- Modify: `lib/ui/table/ActionBar.tsx` (`LayingDownTray` buttons, the return-discard and joker links)
- Modify: `lib/ui/table/MeldPile.tsx` (root gets `meld-land`)
- Modify: `app/globals.css` (add `.meld-land`)
- Test: `lib/ui/table/__tests__/action-bar.test.tsx`; create `lib/ui/table/__tests__/meld-pile.test.tsx`

**Interfaces:**
- Produces:
  - `ctrlBtn` = `'deli-pill deli-pill--outline btn-lift …'` for Sort and Add space;
  - the primary actions (Meld / lay down, Discard) use `deli-pill deli-pill--green btn-lift`;
  - the laying-down tray uses a cream paper strip (`deli-paper`-style) instead of `bg-black/75`, with the "clear" control in script;
  - the return-discard and joker prompts are cream tags with a script link;
  - disabled rules are unchanged;
  - **CSS:** `.meld-land` is a one-shot 260 ms settle (scale .94 → 1.02 → 1 with a fade), and `animation: none` under reduced motion.

- [ ] **Step 1: Write failing tests:**
  - **`action-bar.test.tsx` → `'laying-down tray uses deli pills'`:** the lay-down button's class contains `deli-pill`, and disabled behaviour is unchanged (reuse an existing case's setup).
  - **`meld-pile.test.tsx` → `'a meld settles in when it lands'`:** render `MeldPile` with a 3-card run meld. `container.querySelector('[data-meld]')` has class `meld-land`.
- [ ] **Step 2: Run** `npx vitest run lib/ui/table/__tests__/action-bar.test.tsx lib/ui/table/__tests__/meld-pile.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the pills, the tray, the prompts and `meld-land`.
- [ ] **Step 4: Run** `npx vitest run lib/ui/table`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(table): deli pills; melds settle in as they land`.

### Task 5: The receipt (end of hand)

**Files:**
- Create: `lib/ui/table/usePrint.ts`
- Modify: `lib/ui/table/overlays.tsx` (`RoundSummary`; restyle `Scrim` as a plain dim layer whose child supplies its own paper)
- Modify: `app/globals.css` (add `.receipt-line`, `.receipt-in`)
- Test: `lib/ui/table/__tests__/overlays.test.tsx`; create `lib/ui/table/__tests__/use-print.test.tsx`

**Interfaces:**
- Produces:
  - **`usePrint(lineCount: number, key: string | number, stepMs = 140): { shown: number; done: boolean; finish: () => void }`.** It reveals lines one at a time and restarts only when `key` changes, not on re-render or a new `lineCount` for the same key. `finish()` shows everything immediately. Under reduced motion it starts with `shown = lineCount` and `done = true`. `RoundSummary` passes `view.roundNumber` as `key`.
  - **`RoundSummary` keeps its props.** It renders a receipt (`role="document"`, `aria-label="Receipt"`) on cream paper. Clicking anywhere on the receipt calls `finish()`. The lines, in order:
    1. `KORTN` (`font-mark`), `The card table · Hand No. {roundNumber}`;
    2. how it ended: `{who} went out` / `{who} got Kalooki!` / `{who} got Treasure!`;
    3. one leader line per seat (`deli-leader`): name, a ready mark (`✓` if `readyNext[seat]`, `·` if not, `out` if not active), and this hand's points from `view.history.at(-1)?.handPoints[seat]` (`WON` for the winner). Running totals sit beside them in small type;
    4. `Bits to {winner} +{n}`, from `history.at(-1)?.handBits[winnerSeat]` (omitted if history is empty);
    5. `Pot: {pot} bits`;
    6. `Thank you — deal again soon!` in script.
  - **Below the receipt, once `done`:** for participants, the `deli-pill deli-pill--green` button `Next hand`, which reads `Waiting… {ready}/{n}` once ready, as today. For others: `Waiting for the next hand… {ready}/{n} ready`.
  - **CSS:**
    - `.receipt-in` is the paper sliding down, 400 ms;
    - `.receipt-line` fades or ticks in as each line is revealed;
    - both have `animation: none` under reduced motion.

- [ ] **Step 1: Write failing tests.** Extend the overlays fixture with `roundNumber: 8` and `history: [{ roundNumber: 8, winnerSeat: 0, goOutType: 'kalooki', handPoints: [0, 23], scores: [40, 77], handBits: [2, -2], dealerSeat: 1 }]`. Use fake timers.
  - **`use-print.test.tsx`:**
    - **`'reveals lines one by one, then is done'`:** `lineCount` 6 → `shown` 0 at the start, 6 and `done` after 6 × 140 ms.
    - **`'finish shows everything at once'`.**
    - **`'does not restart for the same key'`:** rerender with the same key after done → still done.
    - **`'reduced motion prints instantly'`:** stub `window.matchMedia` to `{ matches: true }` → done on the first render.
  - **`overlays.test.tsx`:** update `'RoundSummary shows go-out type and a Next hand ready button'` to advance timers by 2000 ms before clicking. Add:
    - **`'receipt reads hand number, points, bits and pot'`:** `getByText('The card table · Hand No. 8')`, `getByText('23')`, `getByText('Bits to Ruth +2')`, `getByText('Pot: 18 bits')`.
    - **`'Next hand waits for the print, and a tap finishes it'`:** no `Next hand` button at first. Click `getByRole('document', { name: 'Receipt' })` → the button is present.
    - **`'a stream update does not restart the print'`:** after done, rerender with a new view object for the same round → the `Next hand` button is still present.
    - **`'a player who is out sees the waiting line, not the pill'`:** with `you.status: 'out'`, after the print, `getByText(/Waiting for the next hand/)` appears and there's no `Next hand` button.
- [ ] **Step 2: Run** `npx vitest run lib/ui/table/__tests__/overlays.test.tsx lib/ui/table/__tests__/use-print.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `usePrint`, the receipt and the CSS.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(table): end of hand prints as a deli receipt`.

### Task 6: The order pad (scores)

**Files:**
- Modify: `lib/ui/table/overlays.tsx` (`ScorePad`)
- Modify: `lib/ui/table/TableView.tsx` (the Scores overlay, around lines 551–566: heading and panel)
- Test: `lib/ui/table/__tests__/table-view.test.tsx`; `overlays.test.tsx`

**Interfaces:**
- Produces:
  - **The Scores overlay panel** is a lined order pad: cream paper, faint ruled lines and a red margin rule. Its heading reads `Scores` (`font-cond`), and the close button is a script "close".
  - **`ScorePad` keeps its columns and data** (hand points, running total, hand bits, running bits per player). It has printed column heads (`font-sans-deli` small caps) and script figures (`font-script`). It scrolls inside the pad on phones (`overflow-x-auto`), never the page.

- [ ] **Step 1: Write failing tests:**
  - **`table-view.test.tsx` → `'Scores opens the order pad'`:** click the Scores control → `getByRole('heading', { name: 'Scores' })`, and no `Scorecard` text.
  - **`overlays.test.tsx` → `'order pad keeps every hand row'`:** render `ScorePad` with the fixture's one-hand history → `getAllByRole('row').length >= 2`.
- [ ] **Step 2: Run** `npx vitest run lib/ui/table/__tests__/table-view.test.tsx lib/ui/table/__tests__/overlays.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the order pad.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(table): scores as a deli order pad`.

### Task 7: The buy-back ticket and the hanging winner sign

**Files:**
- Modify: `lib/ui/table/overlays.tsx` (`RebuyPrompt`, `MatchSummary`)
- Modify: `app/globals.css` only if `deli-swing` needs a one-shot variant (`.deli-swing-in`)
- Test: `lib/ui/table/__tests__/overlays.test.tsx`

**Interfaces:**
- Produces:
  - **`RebuyPrompt` keeps its props and copy.** It's styled as a tear-off ticket: cream, a dashed perforation edge, and a red "ADMIT ONE"-style stub reading `Back in?`. The buttons are deli pills: `Buy back in` (red) and `Decline` (outline). The no-rebuy variant keeps its text with an `OK` pill.
  - **`MatchSummary` (won)** is a hanging sign in the `ShopSign` style: two strings and a cream sign that swings in once (`deli-swing-in`, a still fallback under reduced motion). It reads `{Name} takes the pot` as a heading (role heading), with `of {pot} bits` beneath. The payout list keeps `aria-label="Pot payout"` and its per-seat rows. The `Back to the kitchen` link becomes a green pill.
  - **`MatchSummary` (abandoned)** keeps "Game ended" and its text on cream paper, with no sign.

- [ ] **Step 1: Write failing tests** in `overlays.test.tsx`:
  - **`'RebuyPrompt keeps its price and choices'`:** `getByText(/Buy back in for 4 bits/)`, plus the existing click test.
  - **`'MatchSummary hangs a sign naming the winner'`:** `getByRole('heading', { name: 'Ruth takes the pot' })`. Update `'MatchSummary announces the winner'`, which matched `/winner/i`, to this heading.
  - Keep `'MatchSummary for an abandoned game says there is no winner'` unchanged (Review Focus 5).
- [ ] **Step 2: Run** `npx vitest run lib/ui/table/__tests__/overlays.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the ticket and the sign.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(table): buy-back ticket and a hanging winner sign`.

### Task 8: Verification

- [ ] **Step 1: Preview.** Add a temporary public route (and a temporary `proxy.ts` public matcher) rendering `TableView` with a fixture view:
  - 3 seats, one opponent named `Bartholomew-Featherstonehaugh`;
  - melds on the table;
  - your turn.

  Add variants with the receipt, order pad, ticket and winner sign open. Screenshot at 1200 px and 390 px.

  Expected:
  - the deli look throughout;
  - the green and red backs are distinct at the small size;
  - the long name wraps on its plate;
  - no horizontal scroll (`scrollWidth - innerWidth === 0`);
  - the header is no taller than the `main` version's at 390 px. Measure the header's `offsetHeight` on both.
- [ ] **Step 2: Reduced motion.** Emulate `prefers-reduced-motion: reduce`. The receipt shows whole with "Next hand" immediately, and the sign is still.
- [ ] **Step 3: Clean up and run every check.** Remove the preview, the proxy change, `.next/dev` and `.playwright-mcp`, and revert `next-env.d.ts`. Then `npx tsc --noEmit && npx vitest run && npx next build`. All must pass.
- [ ] **Step 4: Push and open a PR** to `main`.
