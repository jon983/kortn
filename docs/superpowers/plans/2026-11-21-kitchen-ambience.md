# Kitchen Ambience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the kitchen to life: an ambient room (drift, candle flicker, light shaft, dust), panels settling in, counting-up stats, gleaming buttons, and smooth tab, row and page transitions.

**Architecture:** CSS keyframes in `app/globals.css` drive all continuous and entrance motion. A deterministic dust generator feeds an ambient layer in `RoomBackdrop`. A small count-up hook animates numbers. React's built-in `<ViewTransition>` (exported by Next 16's bundled React; the import already type-checks) handles leaderboard tabs, game rows and page changes. These only animate updates made inside a transition (navigation, `startTransition`, `router.refresh`).

**Tech Stack:** Next.js 16 App Router, React 19 (`ViewTransition`, `startTransition`), Tailwind 4, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-21-kitchen-ambience-design.md`

## Global Constraints

- Animate only `transform` and `opacity` per frame. Blur only on static elements.
- At most ~20 dust motes. All ambient layers have `aria-hidden` and `pointer-events: none`.
- `@media (prefers-reduced-motion: reduce)`: no ambient motion, no entrance, no sheen or lift, no count-up (show final values), no view-transition animation.
- Entrance plays once per page visit and never loops. Panels rise 12px → 0 and opacity 0 → 1, ~500 ms each, ~90 ms apart, in visual order.
- Count-up: 0 → value over ~800 ms, ease-out.
- Photo drift: a slow zoom over ~30 s, alternating.
- No new npm dependencies, no new artwork (use `/art/room-home.jpg`), no sound.
- The waiting room and game table are unchanged except for the shared page transition and reduced-motion rules.

## Review Focus

1. **Hydration:** dust positions must be identical on server and client. Random values must come from a seeded generator, not `Math.random()` at render (Task 1 test).
2. **Reduced motion:** a device set to reduce motion shows final stat values immediately and a still room (Task 2 test for the count-up; Task 5 visual check for the CSS).
3. **Number formats survive counting:** `1.36×` keeps 2 decimals while counting, `+64` and `-12` keep their sign and `75%` its suffix, and a non-numeric `—` renders untouched (Task 2 tests).
4. **No View Transitions support** (and jsdom): switching leaderboard tabs must still switch instantly (Task 4 test).
5. **Revisiting the kitchen** via back navigation replays the entrance once and doesn't stack or loop (Task 5 visual check).

---

### Task 1: Ambient room (drift, candle glow, light shaft, dust)

**Files:**
- Create: `lib/ui/ambient/motes.ts`, `lib/ui/ambient/AmbientRoom.tsx`
- Modify: `app/globals.css` (keyframes and classes, plus the reduced-motion block), `lib/ui/RoomBackdrop.tsx` (add an `ambient` prop), `app/HomeView.tsx` (pass `ambient`)
- Test: `lib/ui/__tests__/motes.test.ts`

**Interfaces:**
- Produces: `interface Mote { left: number; top: number; size: number; blur: number; duration: number; delay: number; driftX: number }` (left/top in %, size/blur/driftX in px, duration/delay in s); `makeMotes(count: number, seed: number): Mote[]`; `<AmbientRoom plate: string />`; `RoomBackdrop` props gain `ambient?: boolean` (default `false`).
- CSS classes produced (used only here): `.amb-drift`, `.amb-glow`, `.amb-shaft`, `.amb-mote`.

- [ ] **Step 1: Write the failing test** `lib/ui/__tests__/motes.test.ts`
  - `makeMotes(20, 7)` deep-equals a second `makeMotes(20, 7)` (deterministic), and differs from `makeMotes(20, 8)`.
  - Its length is 20. Every mote has `left` in [0, 100] and `top` in [40, 100] (they start in the lower part of the room), `size` in [1.5, 4.5], `duration` in [9, 22], `delay` in [0, 22], and `driftX` in [-40, 40].
- [ ] **Step 2: Run** `npx vitest run lib/ui/__tests__/motes.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `makeMotes`** in `lib/ui/ambient/motes.ts` with a small seeded PRNG (mulberry32 or similar) mapped into the ranges above. Never call `Math.random()`.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Add the CSS** to `app/globals.css`:
  - `amb-drift` (scale 1.05 → 1.14 with a slight translate, ~30 s ease-in-out infinite alternate, on an `inset:-6%` photo layer);
  - `amb-glow` (radial warm gradient near the top centre, opacity flicker ~3.2 s, `mix-blend-mode: screen`);
  - `amb-shaft` (a soft diagonal light band from the window side, opacity breathing ~12 s);
  - `amb-mote` (rises with `translate(var(--dx), -70vh)`, fading in and out, duration and delay from inline CSS variables).

  Also add one `@media (prefers-reduced-motion: reduce)` block that sets `animation: none` on all `amb-*` classes and on later tasks' classes (`settle`, `btn-sheen`, `btn-lift` transitions), and sets `::view-transition-group(*)`, `::view-transition-old(*)`, `::view-transition-new(*) { animation: none }`.
- [ ] **Step 6: Implement `AmbientRoom`**, a server-safe component. It renders the drift photo layer, glow, shaft, and `makeMotes(20, 11)` as `<i className="amb-mote">` elements with inline `left/top/width/height/filter` and CSS vars `--dur/--delay/--dx`. It's `aria-hidden`, and the wrapper has `pointer-events-none absolute inset-0`. **`RoomBackdrop`:** when `ambient` is true, render `<AmbientRoom plate={plate} />` in place of the static photo layer, keeping the fallback gradient and vignette. **`HomeView`:** pass `ambient`.
- [ ] **Step 7: Verify.** `npx tsc --noEmit` passes, `npx vitest run` is all green, and a temporary preview of `HomeView` with sample data shows drift, flicker, shaft and rising dust. Remove the preview afterwards.
- [ ] **Step 8: Commit** with the message `feat(home): ambient room — drift, candle glow, light shaft, dust`.

### Task 2: Panels settle in and stats count up

**Files:**
- Create: `lib/ui/useCountUp.ts`, `lib/ui/CountUp.tsx`
- Modify: `app/globals.css` (`.settle` keyframes), `app/HomeView.tsx` (stagger classes on panels; `Tile` uses `CountUp`)
- Test: `lib/ui/__tests__/count-up.test.tsx`

**Interfaces:**
- Produces:
  - `useCountUp(target: number, durationMs = 800): number`, which returns the current animated value and jumps to `target` when reduced motion is requested.
  - `<CountUp value={number} decimals?={number} prefix?={string} suffix?={string} signed?={boolean} />`, which renders a formatted string. `signed` adds `+` to positives.
  - The CSS class `.settle`, with an `animationDelay` set per panel (inline style).

- [ ] **Step 1: Write the failing tests** `lib/ui/__tests__/count-up.test.tsx`, using fake timers and `requestAnimationFrame` driven by `vi.advanceTimersByTime`:
  - `CountUp value={64} signed` ends at the text `+64`; mid-animation it shows a number strictly between `+0` and `+64`.
  - `CountUp value={1.36} decimals={2} suffix="×"` ends at `1.36×` and always shows 2 decimals.
  - `CountUp value={-12}` ends at `-12`.
  - `CountUp value={75} suffix="%"` ends at `75%`.
  - With `matchMedia('(prefers-reduced-motion: reduce)')` stubbed to `matches: true`, the first render already shows `+64`.
- [ ] **Step 2: Run** `npx vitest run lib/ui/__tests__/count-up.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `useCountUp` (a requestAnimationFrame loop, ease-out cubic, cancelled on unmount, starting at the final value when reduced motion matches or `matchMedia` is unavailable) and `CountUp` (formats with `toFixed(decimals)`, plus prefix, sign and suffix).
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Wire into HomeView.**
  - Add `.settle` keyframes (translateY 12px → 0, opacity 0 → 1, 500 ms ease-out, `both`) to `app/globals.css`.
  - Give the five panels in `HomeView` the class `settle` with `style={{ animationDelay: `${i * 90}ms` }}` in visual order (record, leaderboards, create, join, rejoin), using `Framed`'s `className` and a `style` passthrough. Add a `style?: CSSProperties` prop to `Framed` if needed.
  - Change `Tile` to take `value: ReactNode` and render `CountUp` for win rate (`suffix="%"`), vs par (`decimals={2} suffix="×"`, or `—` when null), avg pts/hand (`decimals={1}`, or `—`), net bits (`signed`), and the "More stats" counts. Keep the `—` cases as plain text.
- [ ] **Step 6: Verify.** `tsc` passes, the full test suite is green, and the preview shows panels settling in order and numbers counting up.
- [ ] **Step 7: Commit** with the message `feat(home): panels settle in; stats count up`.

### Task 3: Brass buttons gleam and lift

**Files:**
- Modify: `app/globals.css` (`.btn-sheen`, `.btn-lift`), `lib/ui/LampButton.tsx`, `app/GameRow.tsx` (the Play link)

**Interfaces:**
- Produces: the CSS classes `.btn-sheen` (an `::after` sweep every ~4.5 s, with a delay from `--sheen-delay` so buttons don't sync; needs `position:relative; overflow:hidden`) and `.btn-lift` (a transition on transform and box-shadow; hover `translateY(-1px)` with a deeper shadow; active `translateY(0)`).

- [ ] **Step 1: Add the CSS** for `.btn-sheen` and `.btn-lift` in `app/globals.css`.
- [ ] **Step 2: Apply the classes.** `LampButton` always gets `btn-sheen btn-lift` and sets `--sheen-delay` from an optional `sheenDelay?: number` prop (default 0). The GameRow Play link gets the same classes, with `--sheen-delay` set from the row index (pass `index` into `GameRow` as an optional prop, `index?: number`, default 0). The existing `className` overrides stay working.
- [ ] **Step 3: Verify.** `tsc` passes, and `npx vitest run` is green (existing `kit.test.tsx` covers `LampButton`). The preview shows staggered sheens and a hover lift, and disabled buttons don't lift (`.btn-lift:disabled` gets no transform).
- [ ] **Step 4: Commit** with the message `feat(ui): brass buttons gleam and lift`.

### Task 4: Smooth leaderboard tabs, game rows and page changes

**Files:**
- Modify: `app/LeaderboardTabs.tsx`, `app/HomeView.tsx` (wrap rows), `app/layout.tsx` (page transition), `app/globals.css` (view-transition rules)
- Test: `lib/ui/__tests__/leaderboard-tabs.test.tsx`

**Interfaces:**
- Consumes: `ViewTransition` and `startTransition` from `react`.
- Produces: the CSS view-transition classes `vt-slide` (tabs: old fades out and slides left 8px, new slides in from the right) and `vt-row` (rows: enter slides from 8px below and fades in; exit fades and collapses), plus a root crossfade with a 6px rise for page changes.

- [ ] **Step 1: Write the failing test** `lib/ui/__tests__/leaderboard-tabs.test.tsx`. Render `LeaderboardTabs` with boards where `vsPar` lists Jonathan and `winsPer100` lists Ines first. Click the "Wins" tab, then the panel shows Ines first and `aria-selected` moves to Wins. jsdom has no View Transitions; the switch must still happen.
- [ ] **Step 2: Run** `npx vitest run lib/ui/__tests__/leaderboard-tabs.test.tsx`. Expected: PASS today. This is a regression guard; keep it passing through the change.
- [ ] **Step 3: Tabs.** Switch tabs inside `startTransition(() => setTab(key))`, and wrap the `<ol>` (and the empty-state `<p>`) in `<ViewTransition key={tab} enter="vt-slide" exit="vt-slide">`. Check the prop names against `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` before writing.
- [ ] **Step 4: Rows.** In `HomeView`, wrap each `GameRow` in `<ViewTransition key={g.id} enter="vt-row" exit="vt-row">`. Abandon and Delete already call `router.refresh()` or `revalidatePath`, which run as transitions, so removed rows animate out.
- [ ] **Step 5: Pages.** In `app/layout.tsx`, wrap `{children}` in `<ViewTransition>` and add CSS for `::view-transition-old(root)` and `::view-transition-new(root)`: a 220 ms crossfade, with new content rising 6px.
- [ ] **Step 6: Run the tests and typecheck.** `npx vitest run` and `npx tsc --noEmit` pass.
- [ ] **Step 7: Commit** with the message `feat(ui): smooth tab, row and page transitions`.

### Task 5: Visual, reduced-motion and performance verification

**Files:** none committed. Temporary preview route only, removed after.

- [ ] **Step 1: Preview.** Add a temporary `app/(auth)/sign-in/zz-preview/page.tsx` rendering `HomeView` with sample data (as earlier this session). Screenshot it at 1000px and 390px in headless Chrome (`playwright-core`, channel `chrome`). Expected: dust is visible but subtle, panels are aligned, and nothing overlaps.
- [ ] **Step 2: Reduced motion.** Repeat with `page.emulateMedia({ reducedMotion: 'reduce' })`. Expected: two screenshots 3 s apart are pixel-identical (no motion), and the stats show their final values.
- [ ] **Step 3: Revisit.** Navigate preview → `/sign-in` → back. Expected: the panels settle once and don't loop.
- [ ] **Step 4: Performance.** Record a 6 s trace with CPU throttling (4×) via `page.tracing` or the DevTools protocol. Expected: no long tasks (>50 ms) attributable to the ambient layer, and frame rate around 60fps on desktop.
- [ ] **Step 5: Clean up.** Remove the preview route, `.next/dev` and `.playwright-mcp`, and revert `next-env.d.ts`. Then run `npx tsc --noEmit && npx vitest run && npx next build` and confirm all three pass.
- [ ] **Step 6: Push and open a PR** to `main` with a summary and screenshots described in the body.
