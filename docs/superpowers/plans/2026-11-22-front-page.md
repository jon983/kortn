# Front Page, Logo and Favicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Logged-out visitors to `/` get a one-screen deli front page (big green KORTN sign over the dining room, two buttons), and every brand surface uses the new logo and a cream-sign "K" favicon.

**Architecture:**
- One shared `KortnSign` component (the green hanging sign) is used by the front page and the sign-in/up pages.
- `app/page.tsx` renders `FrontPage` when signed out, and the kitchen otherwise.
- `proxy.ts` makes `/` and the generated image routes public.
- Icons, the link preview and `/logo.png` are generated with `ImageResponse` from `next/og`. They use a committed Archivo Black TTF.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, Clerk (`@clerk/nextjs`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-22-front-page-design.md`

## Global Constraints

- Read the docs in `node_modules/next/dist/docs/` before writing Next-specific code (AGENTS.md):
  - `01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`
  - `01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`
- Brand colours: green `#1d5446`, cream `#f6efdc`, red `#c8402f`, gold `#e2bd4f` (CSS tokens `deli-green`, `deli-cream`, `deli-red`, `deli-gold`).
- Copy is fixed by the spec:
  - Tagline: `Kalooki with the family, wherever they are.`
  - Buttons: `Pull up a chair` (to `/sign-up`) and `Sign in` (to `/sign-in`).
  - Closing line: `Video on, kettle on, let's deal.`
  - Footer: `KORTN · Kalooki online`.
- There's no "how it plays" section. The front page is one screen with no scrolling sections.
- Signed-in players at `/` see the kitchen exactly as today.
- The front page reads no data and never writes to the database.
- The font comes from a file committed in the repo (Archivo Black, SIL OFL), never fetched at runtime.

## Review Focus

1. Logged-out visitors and link-preview crawlers must get the icon and share images. Next serves them at `/icon…`, `/apple-icon…` and `/opengraph-image…`, which the proxy matcher catches, so they must be public. The Task 2 test pins this.
2. A signed-in player at `/` must see the kitchen and never the front page. The Task 2 page test pins this.
3. Private routes must stay private: `/create` and `/match/abc` still redirect logged-out visitors. Clerk's nested sign-in steps (`/sign-in/factor-one`) stay public. The Task 2 test pins this.
4. On a 390px-wide phone the sign, tagline, both buttons and the closing line fit on one screen without horizontal scroll. The Task 2 visual check covers this.
5. The 32px tab icon must still read as a K on a cream sign: the border is thickened at 32px. The Task 4 visual check covers this.

---

### Task 1: The KORTN sign component

**Files:**
- Create: `lib/ui/deli/KortnSign.tsx`
- Modify: `lib/ui/deli/index.ts` (export it)
- Test: `lib/ui/__tests__/kortn-sign.test.tsx`

**Interfaces:**
- Produces: `KortnSign({ size = 'lg', chains = false, className = '' }: { size?: 'lg' | 'md'; chains?: boolean; className?: string }): ReactElement`. The green sign with a cream inner outline (`outline: 2px solid cream; outline-offset: -8px`) holds the wordmark: `KORTN` in `font-mark`, and `THE`/`CARD`/`TABLE` stacked beside it, cream.
  - `lg`: the front page. KORTN about 84px on desktop, scaling down on phones with a `clamp()`.
  - `md`: above the sign-in box. KORTN about 34px.
  - `chains`: draws the two gold chains above the sign, using the same repeating gradient as `ShopSign`.
  - Root element: `data-kortn-sign`, `role="img"`, `aria-label="KORTN, the card table"`.

- [ ] **Step 1: Write the failing test** `kortn-sign.test.tsx`:
  - `it('is one labelled image reading KORTN, the card table')`: renders `<KortnSign />`, then `screen.getByRole('img', { name: 'KORTN, the card table' })`.
  - `it('draws chains only when asked')`: `container.querySelectorAll('[data-chain]')` has length 0 without the prop and 2 with `chains`.
  - `it('md is the small size')`: the `md` root className contains `text-[34px]` on the KORTN span, or a `data-size="md"` attribute. Pick one and assert it.
- [ ] **Step 2: Run** `npx vitest run lib/ui/__tests__/kortn-sign.test.tsx`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `KortnSign` as specified in Interfaces. Reuse `font-mark`, and the chain gradient from `lib/ui/deli/ShopSign.tsx`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(brand): the green KORTN sign component`.

### Task 2: Front page at `/` for logged-out visitors

**Files:**
- Create: `app/FrontPage.tsx`
- Create: `lib/public-routes.ts`
- Modify: `app/page.tsx:11-12` (signed out: render the front page instead of redirecting)
- Modify: `proxy.ts:3` (use `PUBLIC_ROUTES`)
- Test: `lib/ui/__tests__/front-page.test.tsx`, `lib/server/__tests__/public-routes.test.ts`, `lib/ui/__tests__/home-route.test.tsx`

**Interfaces:**
- Consumes: `KortnSign` (Task 1); `RoomBackdrop` from `lib/ui/RoomBackdrop`.
- Produces:
  - `FrontPage(): ReactElement`
  - `PUBLIC_ROUTES: string[]` in `lib/public-routes.ts`, equal to `['/', '/sign-in(.*)', '/sign-up(.*)', '/api/(.*)', '/icon(.*)', '/apple-icon(.*)', '/opengraph-image(.*)']`. `/logo.png` contains a dot, so the proxy matcher already skips it.

- [ ] **Step 1: Write the failing tests.**
  - `front-page.test.tsx`:
    - `it('shows the sign, the tagline, both buttons and the closing line')`:
      - `getByRole('img', { name: 'KORTN, the card table' })`
      - `getByText('Kalooki with the family, wherever they are.')`
      - `getByRole('link', { name: 'Pull up a chair' })` has `href` `/sign-up`
      - `getByRole('link', { name: 'Sign in' })` has `href` `/sign-in`
      - `getByText("Video on, kettle on, let's deal.")`
      - `getByText('KORTN · Kalooki online')`
    - `it('has no how-it-plays section')`: `queryByText(/how it plays/i)` is null.
  - `public-routes.test.ts` (node environment): build `const isPublic = createRouteMatcher(PUBLIC_ROUTES)` and test with `new NextRequest('https://kortn.com' + path)`:
    - Public: `/`, `/sign-in`, `/sign-in/factor-one`, `/sign-up`, `/icon`, `/apple-icon`, `/opengraph-image`, `/opengraph-image-abc123`, `/api/x`.
    - Not public: `/create`, `/match/abc`, `/iconic`. Check how createRouteMatcher treats `/icon(.*)`. If `/iconic` matches, accept that and drop the case (harmless), recording a ruling.
  - `home-route.test.tsx`: mock `@clerk/nextjs/server`:
    - `auth` resolves `{ userId: null }`, or `{ userId: 'u1' }` per test
    - `currentUser` resolves `{ username: 'ruth', hasImage: false }`

    Also mock `../../../app/HomeView` to render `<p>kitchen</p>`, and mock `../../db` (or the path `app/page.tsx` imports) with resolved empty data for every function it calls.
    - `it('signed out: the front page')`: `render(await Home())`, then `getByText('Kalooki with the family, wherever they are.')`.
    - `it('signed in: the kitchen, never the front page')`: `getByText('kitchen')`, and `queryByText('Kalooki with the family, wherever they are.')` is null.
- [ ] **Step 2: Run** `npx vitest run lib/ui/__tests__/front-page.test.tsx lib/server/__tests__/public-routes.test.ts lib/ui/__tests__/home-route.test.tsx`. Expected: FAIL, modules missing, or the redirect thrown for signed out.
- [ ] **Step 3: Implement.**
  - `FrontPage`, per the spec's front-page section and option B of `.superpowers/brainstorm/*/content/front-page-layouts.html`:
    - `<RoomBackdrop plate="room-home" kitchenLink={false} ambient>` with no header.
    - `KortnSign size="lg" chains` hanging from the top of the screen.
    - Then the tagline: `font-script`, cream, with a text shadow.
    - Then the buttons, as Next `Link`s styled `.deli-pill`:
      - Pull up a chair: green with a cream ring.
      - Sign in: cream outline with cream text.
    - Then the closing line: script, cream.
    - Footer pinned to the bottom of the screen in small `font-sans-deli`.
    - Centre everything vertically in `min-h-[100svh]`. On screens below `sm`, stack the buttons full-width.
    - The sign and buttons use the existing `settle` classes.
  - `app/page.tsx`: `if (!userId) return <FrontPage />;`, removing the redirect and its import if unused.
  - `proxy.ts`: `createRouteMatcher(PUBLIC_ROUTES)`.
- [ ] **Step 4: Run** the Step 2 command. Expected: PASS. Then run `npx vitest run`, expecting all tests to pass, and `npx tsc --noEmit`, expecting it to be clean.
- [ ] **Step 5: Visual check.**
  - Run `next dev` on port 3123 and open `/` logged out.
  - Take screenshots at 1512×838 and 390×844.
  - Expected:
    - Matches option B.
    - At 390, everything fits on one screen, there's no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), and the buttons are stacked.
- [ ] **Step 6: Commit** `feat(front-page): a front page for logged-out visitors at /`.

### Task 3: Sign-in and sign-up wear the new logo

**Files:**
- Create: `app/(auth)/AuthShell.tsx`
- Modify: `app/(auth)/sign-in/[[...rest]]/page.tsx`, `app/(auth)/sign-up/[[...rest]]/page.tsx`
- Test: `lib/ui/__tests__/auth-shell.test.tsx`

**Interfaces:**
- Consumes: `KortnSign` (Task 1).
- Produces: `AuthShell({ children }: { children: ReactNode }): ReactElement`, which renders:
  - the room backdrop (`room-home`, as today);
  - a `← kortn.com` link to `/`;
  - `KortnSign size="md"` centred above the children.

  Both pages render `<AuthShell><SignIn appearance={{ layout: { logoPlacement: 'none' } }} /></AuthShell>`, with `SignUp` on the sign-up page.

- [ ] **Step 1: Write the failing test** `auth-shell.test.tsx`:
  - `it('hangs the KORTN sign above the box, with a way back to the front page')`:
    - render `<AuthShell><div data-testid="box" /></AuthShell>`
    - the sign img exists
    - `getByRole('link', { name: '← kortn.com' })` has `href` `/`
    - the sign comes before the box in document order (`sign.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING`)
- [ ] **Step 2: Run** `npx vitest run lib/ui/__tests__/auth-shell.test.tsx`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `AuthShell`, and update both pages as in Interfaces (`logoPlacement: 'none'` hides Clerk's dashboard logo).
- [ ] **Step 4: Run** the Step 2 command, expecting PASS. Then `npx tsc --noEmit`, expecting it to be clean.
- [ ] **Step 5: Visual check.** Open `/sign-in` at 1512×838. Expected: the green sign above the Clerk box, no Clerk logo inside it, and the back link visible.
- [ ] **Step 6: Commit** `feat(auth): the KORTN sign above the sign-in box; Clerk's old logo hidden`.

### Task 4: Favicon, home-screen icon, link preview and /logo.png

**Files:**
- Create: `lib/brand/ArchivoBlack-Regular.ttf` and `lib/brand/OFL.txt`
  - Download from `https://github.com/google/fonts/raw/main/ofl/archivoblack/ArchivoBlack-Regular.ttf` and `https://github.com/google/fonts/raw/main/ofl/archivoblack/OFL.txt`.
- Create: `lib/brand/images.tsx`
- Create: `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`, `app/logo.png/route.tsx`
- Modify: `app/layout.tsx:9-17` (remove `icons` and `openGraph.images`; set `openGraph.description` and the root `description` to the tagline)
- Delete: `public/art/favicon.svg`, `public/art/apple-touch-icon.png`, `public/art/vercel-avatar.png` (only `app/layout.tsx` references them)
- Test: `lib/server/__tests__/brand-images.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks. The JSX here is plain `ImageResponse` markup, not Tailwind.
- Produces, in `lib/brand/images.tsx`:
  - `markFont(): Promise<Buffer>`: reads the TTF with `readFile(join(process.cwd(), 'lib/brand/ArchivoBlack-Regular.ttf'))`.
  - `iconImage(px: number): Promise<ImageResponse>`: a green Archivo Black "K" on cream, with a green rounded border. Border width is `max(3, px * 0.09)`, so it's thicker at 32. The corner radius is `px * 0.2`.
  - `signImage(width: number, height: number, opts?: { photo?: boolean }): Promise<ImageResponse>`: the green KORTN sign, centred. When `photo` is set, it sits over `public/art/room-home.jpg` (embedded as a base64 data URL) with a `rgba(20,16,10,.25)` darkening; otherwise it's on a transparent background.
- Route files:
  - `app/icon.tsx`: `size = { width: 32, height: 32 }`, `contentType = 'image/png'`, default `() => iconImage(32)`.
  - `app/apple-icon.tsx`: 180×180, using `iconImage(180)`.
  - `app/opengraph-image.tsx`: `size = { width: 1200, height: 630 }`, `alt = 'KORTN, the card table'`, using `signImage(1200, 630, { photo: true })`.
  - `app/logo.png/route.tsx`: `GET` returns `signImage(800, 260)`.

- [ ] **Step 1: Write the failing test** `brand-images.test.ts` (`// @vitest-environment node`):
  - `it('the tab icon is a 32px PNG')`: `const res = await iconImage(32)`, then `res.headers.get('content-type')` is `image/png`. Read the PNG width and height from bytes 16–23 (`DataView` `getUint32`), expecting 32×32.
  - `it('the home-screen icon is 180px')`: as above, expecting 180×180.
  - `it('the link preview is 1200×630 over the room')`: `signImage(1200, 630, { photo: true })` gives 1200×630.
- [ ] **Step 2: Run** `npx vitest run lib/server/__tests__/brand-images.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Download** the font and licence into `lib/brand/`, then implement `lib/brand/images.tsx`, the four route files and the layout clean-up, and delete the three old files.
  - If `ImageResponse` can't render under Vitest (wasm), record a ruling, keep the test for the header only, and rely on Step 5.
- [ ] **Step 4: Run** the Step 2 command, expecting PASS. Then `npx vitest run`, expecting all to pass, and `npx tsc --noEmit`, expecting it to be clean.
- [ ] **Step 5: Verify in the browser** with `next dev`, logged out:
  - `/icon`, `/apple-icon`, `/opengraph-image` and `/logo.png` each return 200 with `image/png`, with no redirect to sign-in.
  - Screenshot each; they match `logo-favicon.html` option 3 and the logo.
  - The page's `<head>` links `/icon` and `/apple-icon`, and `og:image` points to `/opengraph-image`.
  - Run `npx next build`, expecting exit 0.
- [ ] **Step 6: Commit** `feat(brand): generated favicon, home-screen icon, link preview and /logo.png; old images removed`.
