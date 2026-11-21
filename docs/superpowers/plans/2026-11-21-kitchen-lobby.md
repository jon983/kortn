# Kitchen Lobby Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up and wait for tables entirely in the kitchen. Choose the chairs in place, show setting-up tickets (code with Share, who's seated, Deal or leave), keep the kitchen live, and remove the create page and waiting room.

**Architecture:**
- **Server:** gains `leaveLobby` (plus the `removePlayer` repo function and a `leaveTableAction` action).
- **Kitchen (client):** small components: `SetTablePill` (chair picker), `LobbyTicket` parts (`ShareCode`, `DealButton`), and `KitchenLive` (timed `router.refresh()` and the turn chime).
- **Data:** `page.tsx` passes `joinCode`, `hostName` and `seats` for lobby games.
- **Old routes:** `/create` and `/match/[id]/lobby` redirect to `/`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, Drizzle + PGlite tests, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-21-kitchen-lobby-design.md`

## Global Constraints

- **Chair choices:** 2, 3, 4, 5 (default 4). **No buy-in text.**
- **Joiners are not auto-navigated when the host deals.** The host is taken to `/match/{id}/table` after a successful Deal.
- **Refresh cadence:** 4000 ms while any lobby ticket is listed, otherwise 15000 ms. Paused while `document.hidden`; refresh immediately on becoming visible.
- **Chime:** `playYourTurn()` from `lib/ui/table/sounds.ts`, once per game id per transition into `yourTurn`. Not on first render, so loading the page never chimes.
- **Leaving:** lobby status only, seated non-host only. The host gets "delete" (existing `DeleteGameButton`).
- **Deal pill:** disabled until `players.length === seats`.
- **Look:** deli classes and components (`deli-pill`, condensed caps, script quiet links), as in `app/GameRow.tsx`.

## Review Focus

1. **The host leaving** must be refused server-side; the UI never shows "leave" to the host (Task 1 test, Task 3 test).
2. **Chime on page load:** loading the kitchen while a game is already Your move must not chime; only a later flip does (Task 4 test).
3. **No share sheet:** desktop browsers without `navigator.share` fall back to the clipboard and show "Copied!" (Task 3 test).
4. **A player joins while the host's Deal button is showing:** after the next refresh, Deal enables only when the table is full (Task 3 test via props).
5. **Old links:** `/match/{id}/lobby` and `/create` bookmarks land on the kitchen, not a 404 (Task 5 check).

---

### Task 1: Leave a table that hasn't been dealt

**Files:**
- Modify: `lib/db/repositories/players.ts` (add `removePlayer`), `lib/server/matches.ts` (add `leaveLobby`), `app/actions/lobby.ts` (add `leaveTableAction`)
- Test: `lib/server/__tests__/leave-lobby.test.ts`

**Interfaces:**
- Produces:
  - `removePlayer(db: DB, matchId: string, userId: string): Promise<void>`
  - `leaveLobby(deps: RuntimeDeps, input: { matchId: string; userId: string }): Promise<SubmitResult>`, which publishes `{ type: 'lobby', matchId }` on success
  - `leaveTableAction(matchId: string): Promise<{ ok: boolean; reason?: string }>`, which calls `revalidatePath('/')` on success

- [ ] **Step 1: Write failing tests:**
  - a seated non-host leaves a lobby: `ok: true`, their row is gone, the host stays;
  - the host is refused;
  - someone not seated is refused;
  - an `active` match is refused.
- [ ] **Step 2: Run** `npx vitest run lib/server/__tests__/leave-lobby.test.ts`. Expected: FAIL (`leaveLobby` not exported).
- [ ] **Step 3: Implement** `removePlayer`, `leaveLobby` and `leaveTableAction`.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(server): leave a table before it's dealt`.

### Task 2: Choose the chairs in place, and join without leaving the kitchen

**Files:**
- Create: `app/SetTablePill.tsx` (client)
- Modify: `app/HomeView.tsx` (use `SetTablePill` instead of the `/create` link), `app/JoinPill.tsx` (success: `router.refresh()` and collapse, instead of `router.push(lobby)`)
- Test: `lib/ui/__tests__/set-table-pill.test.tsx`, `lib/ui/__tests__/join-pill.test.tsx` (update the success assertion)

**Interfaces:**
- Consumes: `createTableAction(formData)` from `app/actions/lobby`.
- Produces: `<SetTablePill />`.
  - **Collapsed:** a green pill, "Set the table".
  - **Open:** "How many chairs?" in script, four choice buttons (`aria-pressed`, default 4), a green "Deal us in" pill, and a script "cancel".
  - Submitting calls `createTableAction` with `seats`, then `router.refresh()`, then collapses. An error shows inline (`role="alert"`) and is never stuck busy (try/finally, as in `JoinPill`).

- [ ] **Step 1: Write failing tests.**
  - **SetTablePill:** opening shows four chair buttons with 4 pressed. Choosing 3 and clicking "Deal us in" calls the mocked action with `seats=3` and then `refresh`. A thrown action shows the alert, with the button re-enabled.
  - **JoinPill:** success now calls `refresh` (not `push`) and collapses back to "Join with a code".
- [ ] **Step 2: Run** `npx vitest run lib/ui/__tests__/set-table-pill.test.tsx lib/ui/__tests__/join-pill.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `SetTablePill`, the `JoinPill` change and the `HomeView` swap.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(home): choose the chairs in place; joining keeps you in the kitchen`.

### Task 3: Setting-up tickets (code and Share, who's seated, Deal or leave)

**Files:**
- Create: `app/LobbyTicket.tsx` (server-safe wrapper), `app/ShareCode.tsx` (client), `app/DealButton.tsx` (client), `app/LeaveTableButton.tsx` (client)
- Modify: `app/GameRow.tsx` (render `LobbyTicket` for `status === 'lobby'`; `GameRowProps` gains `joinCode?: string; hostName?: string`), `app/page.tsx` (pass `joinCode`, `hostName` = the host's display name, or "You" when the viewer is the host)
- Test: `lib/ui/__tests__/lobby-ticket.test.tsx`

**Interfaces:**
- Produces:
  - `<LobbyTicket id number seats players joinCode hostName isHost />`:
    - the stamped number, the code in big condensed caps, `<ShareCode code />`;
    - names plus `seats - players.length` "empty chair" placeholders;
    - **host:** `<DealButton matchId disabled={players.length < seats} />` and the quiet `DeleteGameButton` "delete";
    - **non-host:** the meta line "waiting for {hostName} to deal · {n}/{seats} seated" and `<LeaveTableButton matchId />` "leave".
  - `<ShareCode code />` uses `navigator.share({ title: 'Join my kortn table', text: 'Table code: ' + code })` when present, otherwise `navigator.clipboard.writeText(code)` and shows "Copied!" for 2 s.
  - `<DealButton matchId disabled />` calls `startGameAction`. On `ok` it does `router.push('/match/' + matchId + '/table')`; otherwise it shows the reason inline.
  - `<LeaveTableButton matchId />` asks `confirm('Leave this table?')` and calls `leaveTableAction`, then `router.refresh()`.

- [ ] **Step 1: Write failing tests:**
  - the host with 2/3 seated sees the code, one "empty chair", and a disabled "Deal";
  - the host with 3/3 sees "Deal" enabled, and clicking it calls the mocked `startGameAction` and pushes to the table;
  - a non-host sees "waiting for Jonathan to deal · 2/3 seated" and "leave", and no "Deal" or "delete";
  - Share without `navigator.share` writes the code to the mocked clipboard and shows "Copied!".
- [ ] **Step 2: Run** `npx vitest run lib/ui/__tests__/lobby-ticket.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the components, the `GameRow` branch and the `page.tsx` fields. Keep the existing `game-row` tests passing (they cover active games).
- [ ] **Step 4: Run the tests and the full suite.** Expected: PASS, all green.
- [ ] **Step 5: Commit** with the message `feat(home): setting-up tickets — code & share, who's seated, deal or leave`.

### Task 4: A live kitchen, with a chime for your move

**Files:**
- Create: `app/KitchenLive.tsx` (client)
- Modify: `app/HomeView.tsx` (render `<KitchenLive hasLobby yourTurnIds />`)
- Test: `lib/ui/__tests__/kitchen-live.test.tsx`

**Interfaces:**
- Produces: `<KitchenLive hasLobby: boolean yourTurnIds: string[] />`. It renders nothing. It runs a `setInterval(router.refresh, hasLobby ? 4000 : 15000)`, cleared and re-made when `hasLobby` changes; skips refreshes while `document.hidden`; and refreshes on `visibilitychange` to visible. It keeps the previous `yourTurnIds` in a ref and calls `playYourTurn()` once when an id appears that wasn't there before. It does **not** chime on first mount.

- [ ] **Step 1: Write failing tests** (fake timers; mocked `next/navigation` and `../../lib/ui/table/sounds`):
  - with `hasLobby` it refreshes after 4000 ms; without it, not at 4000 but at 15000;
  - with `document.hidden` stubbed true there's no refresh; the visibility event refreshes once;
  - mounting with `yourTurnIds=['a']` doesn't chime;
  - rerendering with `['a','b']` chimes once, and again with `['a','b']` doesn't.
- [ ] **Step 2: Run** `npx vitest run lib/ui/__tests__/kitchen-live.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `KitchenLive` and wire it into `HomeView` (`hasLobby = games.some(g => g.status === 'lobby')`, `yourTurnIds = games.filter(g => g.yourTurn).map(g => g.id)`).
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(home): the kitchen stays live and chimes when it's your move`.

### Task 5: Retire the create page and waiting room

**Files:**
- Modify: `app/create/page.tsx` (→ `redirect('/')`), `app/match/[id]/lobby/page.tsx` (→ `redirect('/')`), `app/match/[id]/table/page.tsx` (lobby status → `redirect('/')`)
- Delete: `app/create/CreateForm.tsx`, `app/match/[id]/lobby/WaitingRoom.tsx`, `lib/ui/__tests__/create-form.test.tsx`, `lib/ui/__tests__/waiting-room.test.tsx`; remove `getLobbyState` from `app/actions/match.ts` if it's then unused.

- [ ] **Step 1: Make the changes.** Grep for leftover references to `/create`, `/lobby`, `CreateForm`, `WaitingRoom` and `getLobbyState`, and fix them.
- [ ] **Step 2: Verify.** `npx tsc --noEmit`, `npx vitest run` and `npx next build` all pass.
- [ ] **Step 3: Commit** with the message `refactor: retire the create page and waiting room (tables are set up in the kitchen)`.

### Task 6: Verification

- [ ] **Step 1: Preview.** Add a temporary preview route (as in earlier sessions) rendering `HomeView` with:
  - a host lobby at 2/3;
  - a host lobby at 3/3;
  - a non-host lobby;
  - an active "Your move" game.

  Screenshot it at 1200 px and 390 px. Expected: deli-styled setting-up tickets, no overflow, Today's tables first on phones.
- [ ] **Step 2: Chair picker and join.** Open the chair picker and the join box in the preview, and take screenshots.
- [ ] **Step 3: Clean up and run all checks.** Remove the preview, `.next/dev` and `.playwright-mcp`, and revert `next-env.d.ts`. Then `npx tsc --noEmit && npx vitest run && npx next build`, all passing.
- [ ] **Step 4: Push and open a PR** to `main`.
