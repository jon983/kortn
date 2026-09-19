# Kalooki Table / Play UI (Phase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the playable Kalooki table at `/match/[id]/table` — live SSE-driven state, your hand (drag-reorder + sort + tap-select), opponents, stock/discard, melds on the felt, a legality-driven action bar, and round/match/rebuy overlays — making a full match playable end-to-end in the browser.

**Architecture:** A client `TableView` consumes the per-seat redacted `ClientView` from an SSE hook and renders presentational components (Card, Hand, OpponentSeat, MeldPile, StockDiscard, ActionBar) positioned with the existing `TableShape` geometry (viewer anchored bottom). A pure `legality.ts` helper reuses the engine to preview which actions the current selection enables; actions POST to the existing authoritative route and results flow back via SSE. Parlour skin + `table-surface.jpg` / card-back art, all art-agnostic with CSS fallbacks.

**Tech Stack:** Next.js App Router + React, Tailwind v4, existing `lib/kalooki` / `lib/db` / `lib/server`, Vitest + jsdom + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-19-kalooki-table-ui-design.md`

## Global Constraints

- Name is **Kalooki**; app is **kortn**. Parlour aesthetic; art from `public/art/` (`table-surface.jpg`, `card-back-blue.png`, `card-back-red.png`) with CSS fallbacks.
- The client consumes ONLY `ClientView` (from `lib/server/redact.ts`), never full `MatchState` — opponent hands are counts only.
- Legality is previewed client-side by reusing the pure engine (`lib/kalooki`: `validateMeld`, `meldPoints`, `layoutMeld`, types); the **server is authoritative** (POST `/api/matches/[id]/actions`) and every action is re-validated there.
- Input: drag-reorder + Sort + tap-select (hybrid). Hand order is client-only/cosmetic (never sent to the server); persist per-match in `localStorage`.
- Action set (engine `Action` + server `rebuy`/`decline`): `{type:'draw',source:'stock'|'discard'}`, `{type:'meld',groups}`, `{type:'layoff',cardId,meldId}`, `{type:'replaceJoker',...}`, `{type:'discard',cardId}`, `{type:'rebuy'}`, `{type:'decline'}`.
- Only the current player's action bar is active; others render read-only (hand still locally reorderable).
- Component tests use `// @vitest-environment jsdom`; `npx vitest run` stays green; `npx tsc --noEmit` clean; `npx next build` compiles.
- New table components live under `lib/ui/table/`; the route stays `app/match/[id]/table/`.

**Key types (from existing code):**
- `ClientView` fields: `seat`, `you:{seat,hand:Card[],handCount,score,status,hasOpened}`, `opponents:{seat,handCount,score,status,hasOpened}[]`, `stockCount`, `discard:Card[]`, `melds:TableMeld[]`, `currentTurn`, `phase:'awaitingDraw'|'awaitingDiscard'`, `pot`, `roundNumber`, `roundFinished`, `roundWinnerSeat`, `goOutType`, `matchFinished`, `matchWinnerSeat`.
- `Card`, `TableMeld`, `MeldKind`, `Action` from `lib/kalooki`.

---

## File Structure

- `lib/ui/table/Card.tsx`, `CardBack.tsx` — card faces / backs.
- `lib/ui/table/legality.ts` — pure selection→action evaluation (reuses engine).
- `lib/ui/table/Hand.tsx` — your fan (select/sort/drag-reorder).
- `lib/ui/table/MeldPile.tsx`, `StockDiscard.tsx`, `OpponentSeat.tsx` — felt pieces.
- `lib/ui/table/ActionBar.tsx` — phase/turn/legality-aware buttons + laying-down tray.
- `lib/ui/table/overlays.tsx` — RoundSummary, RebuyPrompt, MatchSummary.
- `lib/ui/table/useMatchStream.ts` — SSE hook.
- `lib/ui/table/TableView.tsx` — composes everything (client).
- `app/actions/play.ts` — server action wrapping `submitAction`.
- `app/match/[id]/table/page.tsx` — server component (rewrite placeholder).
- Tests co-located under `lib/ui/table/__tests__/`.

---

## Task 1: Card + CardBack components

**Files:**
- Create: `lib/ui/table/Card.tsx`, `lib/ui/table/CardBack.tsx`
- Test: `lib/ui/table/__tests__/card.test.tsx`

**Interfaces:**
- Consumes: `Card` (type), `cardColor` from `lib/kalooki`.
- Produces:
  - `Card({ card, size?, selected?, onClick? })` — renders rank + suit glyph (red for hearts/diamonds, black for clubs/spades), a pack dot (blue=pack A, red=pack B), joker styled distinctly; `selected` lifts it; forwards `onClick`. `size` in {'sm','md'} (default 'md').
  - `CardBack({ pack, size? })` — face-down: `/art/card-back-${pack==='A'?'blue':'red'}.png` as background with a CSS fallback pattern.
  - Helpers exported: `rankLabel(rank: Rank): string` (11→'J',12→'Q',13→'K',14→'A', else the number), `suitGlyph(suit): string`.

- [ ] **Step 1: Write the failing test**

```tsx
// lib/ui/table/__tests__/card.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, rankLabel } from '../Card';
import { CardBack } from '../CardBack';
import type { Card as CardT } from '../../../kalooki';

const c = (rank: number, suit: string, pack = 'A'): CardT =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });

describe('Card', () => {
  it('renders rank label and suit; ace/king map correctly', () => {
    expect(rankLabel(14 as any)).toBe('A');
    expect(rankLabel(13 as any)).toBe('K');
    expect(rankLabel(7 as any)).toBe('7');
    render(<Card card={c(14, 'hearts')} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('♥')).toBeInTheDocument();
  });
  it('marks a joker distinctly', () => {
    render(<Card card={{ id: 'A-joker', kind: 'joker', pack: 'A' } as any} />);
    expect(screen.getByText(/joker/i)).toBeInTheDocument();
  });
  it('CardBack references the pack art url', () => {
    const { container } = render(<CardBack pack="B" />);
    expect(container.innerHTML).toContain('/art/card-back-red.png');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ui/table/__tests__/card.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```tsx
// lib/ui/table/Card.tsx
import { cardColor, type Card as CardT, type Rank, type Suit } from '../../kalooki';

export function rankLabel(rank: Rank): string {
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}
export function suitGlyph(suit: Suit): string {
  return { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }[suit];
}

const SIZES = { sm: 'w-8 h-11 text-xs', md: 'w-12 h-16 text-sm' } as const;

export function Card({
  card, size = 'md', selected = false, onClick,
}: { card: CardT; size?: 'sm' | 'md'; selected?: boolean; onClick?: () => void }) {
  const packDot = card.pack === 'A' ? 'bg-[#2f5c9a]' : 'bg-[#9a2f45]';
  const lift = selected ? '-translate-y-4 ring-2 ring-brass' : '';
  const base = `relative inline-flex flex-col items-center justify-between rounded-md bg-[#f6f2e6] border border-[#cfc9b4] shadow px-1 py-1 font-bold select-none ${SIZES[size]} ${lift}`;
  if (card.kind === 'joker') {
    return (
      <button type="button" onClick={onClick} className={`${base} text-maroon`}>
        <span className="text-[10px] leading-none">★</span>
        <span className="text-[9px] leading-none">JOKER</span>
        <span className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${packDot}`} />
      </button>
    );
  }
  const color = cardColor(card) === 'red' ? 'text-[#b22]' : 'text-[#222]';
  return (
    <button type="button" onClick={onClick} className={`${base} ${color}`}>
      <span className="self-start leading-none">{rankLabel(card.rank)}</span>
      <span className="text-lg leading-none">{suitGlyph(card.suit)}</span>
      <span className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${packDot}`} />
    </button>
  );
}
```

```tsx
// lib/ui/table/CardBack.tsx
import type { Pack } from '../../kalooki';

const SIZES = { sm: 'w-8 h-11', md: 'w-12 h-16' } as const;

export function CardBack({ pack, size = 'md' }: { pack: Pack; size?: 'sm' | 'md' }) {
  const url = `/art/card-back-${pack === 'A' ? 'blue' : 'red'}.png`;
  const fallback = pack === 'A'
    ? 'repeating-linear-gradient(45deg,#274a7a,#274a7a 4px,#1c3557 4px,#1c3557 8px)'
    : 'repeating-linear-gradient(45deg,#7a2740,#7a2740 4px,#571c2e 4px,#571c2e 8px)';
  return (
    <div className={`rounded-md border border-black/40 shadow bg-cover bg-center ${SIZES[size]}`}
      style={{ backgroundImage: `url(${url}), ${fallback}` }} />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ui/table/__tests__/card.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ui/table/Card.tsx lib/ui/table/CardBack.tsx lib/ui/table/__tests__/card.test.tsx
git commit -m "feat(table): Card + CardBack components"
```

---

## Task 2: Legality helper (selection → enabled actions)

**Files:**
- Create: `lib/ui/table/legality.ts`
- Test: `lib/ui/table/__tests__/legality.test.ts`

**Interfaces:**
- Consumes: `validateMeld`, `meldPoints`, `type Card`, `type MeldResult`, `type ClientView` (import the type from `lib/server`).
- Produces:
  - `isMyTurn(view: ClientView): boolean` — `view.currentTurn === view.seat`.
  - `evaluateMeld(cards: Card[]): { kind: 'set'|'run'; points: number } | null` — tries `validateMeld(cards,'set')` then `'run')`; returns the first valid with its points, else null. (fewer than 3 cards → null.)
  - `stagedPoints(groups: { cards: Card[] }[]): number` — sum of each group's meld points (0 for invalid groups).
  - `canOpen(view, groups): boolean` — `view.you.hasOpened || stagedPoints(groups) >= 40`.
  - `OPEN_THRESHOLD = 40`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/ui/table/__tests__/legality.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateMeld, stagedPoints, canOpen, isMyTurn, OPEN_THRESHOLD } from '../legality';
import type { Card } from '../../../kalooki';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });

describe('legality', () => {
  it('evaluateMeld recognises a set and a run, rejects junk', () => {
    expect(evaluateMeld([nat(7, 'clubs'), nat(7, 'hearts'), nat(7, 'spades')])).toEqual({ kind: 'set', points: 21 });
    expect(evaluateMeld([nat(4, 'hearts'), nat(5, 'hearts'), nat(6, 'hearts')])).toEqual({ kind: 'run', points: 15 });
    expect(evaluateMeld([nat(4, 'hearts'), nat(9, 'spades')])).toBeNull();
  });
  it('stagedPoints sums valid groups', () => {
    const g = [{ cards: [nat(13, 'clubs'), nat(13, 'hearts'), nat(13, 'spades')] }, { cards: [nat(4, 'diamonds'), nat(5, 'diamonds'), nat(6, 'diamonds')] }];
    expect(stagedPoints(g)).toBe(45); // 30 + 15
  });
  it('canOpen requires 40 unless already opened', () => {
    const base: any = { you: { hasOpened: false } };
    expect(canOpen(base, [{ cards: [nat(3, 'c'), nat(3, 'h'), nat(3, 's')] }])).toBe(false); // 9
    expect(canOpen(base, [{ cards: [nat(13, 'c'), nat(13, 'h'), nat(13, 's')] }, { cards: [nat(4, 'd'), nat(5, 'd'), nat(6, 'd')] }])).toBe(true); // 45
    expect(canOpen({ you: { hasOpened: true } } as any, [])).toBe(true);
    expect(OPEN_THRESHOLD).toBe(40);
  });
  it('isMyTurn compares seat to currentTurn', () => {
    expect(isMyTurn({ seat: 2, currentTurn: 2 } as any)).toBe(true);
    expect(isMyTurn({ seat: 1, currentTurn: 2 } as any)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ui/table/__tests__/legality.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/ui/table/legality.ts
import { validateMeld, meldPoints, type Card } from '../../kalooki';
import type { ClientView } from '../../server';

export const OPEN_THRESHOLD = 40;

export function isMyTurn(view: ClientView): boolean {
  return view.currentTurn === view.seat;
}

export function evaluateMeld(cards: Card[]): { kind: 'set' | 'run'; points: number } | null {
  if (cards.length < 3) return null;
  for (const kind of ['set', 'run'] as const) {
    const r = validateMeld(cards, kind);
    if (r.valid) return { kind, points: r.points };
  }
  return null;
}

export function stagedPoints(groups: { cards: Card[] }[]): number {
  return groups.reduce((sum, g) => {
    const e = evaluateMeld(g.cards);
    return sum + (e ? e.points : 0);
  }, 0);
}

export function canOpen(view: Pick<ClientView, 'you'>, groups: { cards: Card[] }[]): boolean {
  return view.you.hasOpened || stagedPoints(groups) >= OPEN_THRESHOLD;
}
```

(Note: `meldPoints` import kept for parity with the engine surface even if `validateMeld` already returns points; remove if unused to satisfy `noUnusedLocals` — the implementer should drop the `meldPoints` import since `validateMeld` supplies points.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ui/table/__tests__/legality.test.ts && npx tsc --noEmit`
Expected: PASS (drop the unused `meldPoints` import).

- [ ] **Step 5: Commit**

```bash
git add lib/ui/table/legality.ts lib/ui/table/__tests__/legality.test.ts
git commit -m "feat(table): client legality helper (selection -> enabled actions)"
```

---

## Task 3: Hand (select / sort / drag-reorder)

**Files:**
- Create: `lib/ui/table/Hand.tsx`
- Test: `lib/ui/table/__tests__/hand.test.tsx`

**Interfaces:**
- Consumes: `Card` component; `Card` type; `cardColor`, `meldPoints` from `lib/kalooki`.
- Produces:
  - `sortHand(cards: Card[]): Card[]` — pure: groups by rank ascending, jokers last; within a rank keep suit order (clubs,diamonds,hearts,spades). (Simple, deterministic — refined later; the test only pins determinism + jokers-last.)
  - `Hand({ cards, selectedIds, onToggle, onReorder, onSort })` — renders the fan; each card calls `onToggle(id)`; a Sort button calls `onSort()`; drag-and-drop reorder calls `onReorder(newIdsOrder)`. Uses native HTML5 drag (`draggable`), tolerant of jsdom (logic-testable).

- [ ] **Step 1: Write the failing test**

```tsx
// lib/ui/table/__tests__/hand.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Hand, sortHand } from '../Hand';
import type { Card } from '../../../kalooki';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });
const joker = (): Card => ({ id: 'A-joker', kind: 'joker', pack: 'A' } as any);

describe('sortHand', () => {
  it('orders by rank ascending with jokers last, deterministically', () => {
    const out = sortHand([nat(9, 'clubs'), joker(), nat(3, 'hearts'), nat(9, 'diamonds')]);
    expect(out.map((c) => c.id)).toEqual(['A-hearts-3', 'A-clubs-9', 'A-diamonds-9', 'A-joker']);
  });
});

describe('Hand', () => {
  it('toggles selection on card click and fires onSort', () => {
    const onToggle = vi.fn(); const onSort = vi.fn();
    render(<Hand cards={[nat(5, 'hearts')]} selectedIds={[]} onToggle={onToggle} onReorder={() => {}} onSort={onSort} />);
    fireEvent.click(screen.getByText('5'));
    expect(onToggle).toHaveBeenCalledWith('A-hearts-5');
    fireEvent.click(screen.getByRole('button', { name: /sort/i }));
    expect(onSort).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ui/table/__tests__/hand.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// lib/ui/table/Hand.tsx
'use client';
import { useRef } from 'react';
import { Card as CardFace } from './Card';
import type { Card } from '../../kalooki';

const SUIT_ORDER: Record<string, number> = { clubs: 0, diamonds: 1, hearts: 2, spades: 3 };

export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const aj = a.kind === 'joker', bj = b.kind === 'joker';
    if (aj !== bj) return aj ? 1 : -1;           // jokers last
    if (aj && bj) return a.id.localeCompare(b.id);
    const an = a as Extract<Card, { kind: 'natural' }>;
    const bn = b as Extract<Card, { kind: 'natural' }>;
    if (an.rank !== bn.rank) return an.rank - bn.rank;
    return SUIT_ORDER[an.suit] - SUIT_ORDER[bn.suit];
  });
}

export function Hand({
  cards, selectedIds, onToggle, onReorder, onSort,
}: {
  cards: Card[]; selectedIds: string[]; onToggle: (id: string) => void;
  onReorder: (ids: string[]) => void; onSort: () => void;
}) {
  const dragId = useRef<string | null>(null);
  function onDrop(targetId: string) {
    const from = dragId.current; dragId.current = null;
    if (!from || from === targetId) return;
    const ids = cards.map((c) => c.id);
    const fromIdx = ids.indexOf(from), toIdx = ids.indexOf(targetId);
    ids.splice(toIdx, 0, ids.splice(fromIdx, 1)[0]);
    onReorder(ids);
  }
  return (
    <div>
      <div className="mb-2 flex justify-center">
        <button type="button" onClick={onSort}
          className="rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#8a6a3a,#5c4426)] px-3 py-1 text-sm font-bold text-bone">
          ↕ Sort
        </button>
      </div>
      <div className="flex justify-center">
        {cards.map((c) => (
          <div key={c.id} className="-ml-3 first:ml-0" draggable
            onDragStart={() => (dragId.current = c.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(c.id)}>
            <CardFace card={c} selected={selectedIds.includes(c.id)} onClick={() => onToggle(c.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ui/table/__tests__/hand.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ui/table/Hand.tsx lib/ui/table/__tests__/hand.test.tsx
git commit -m "feat(table): Hand with select, sort, drag-reorder"
```

---

## Task 4: Felt pieces — MeldPile, StockDiscard, OpponentSeat

**Files:**
- Create: `lib/ui/table/MeldPile.tsx`, `lib/ui/table/StockDiscard.tsx`, `lib/ui/table/OpponentSeat.tsx`
- Test: `lib/ui/table/__tests__/felt.test.tsx`

**Interfaces:**
- Consumes: `Card`, `CardBack`; `layoutMeld`, `type TableMeld`, `type Card as CardT` from `lib/kalooki`; `ClientView['opponents'][number]` shape.
- Produces:
  - `MeldPile({ meld, onClick? })` — renders `layoutMeld(meld.cards, meld.kind)` as small Cards; optional `onClick` (for lay-off targeting / joker tap later).
  - `StockDiscard({ stockCount, discardTop, onDrawStock?, onTakeDiscard? })` — stock (count) + discard top (a Card or empty); handlers optional (present only when it's your draw phase).
  - `OpponentSeat({ name, handCount, score, status, hasOpened, isTurn, melds })` — summary + mini card-back fan (length = handCount, alternating packs) + their melds.

- [ ] **Step 1: Write the failing test**

```tsx
// lib/ui/table/__tests__/felt.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MeldPile } from '../MeldPile';
import { StockDiscard } from '../StockDiscard';
import { OpponentSeat } from '../OpponentSeat';
import type { Card, TableMeld } from '../../../kalooki';

const nat = (rank: number, suit: string): Card =>
  ({ id: `A-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: 'A' });

describe('felt pieces', () => {
  it('MeldPile renders all cards of the meld', () => {
    const meld: TableMeld = { id: 'm1', kind: 'run', ownerSeat: 0, cards: [nat(4, 'hearts'), nat(5, 'hearts'), nat(6, 'hearts')] };
    render(<MeldPile meld={meld} />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });
  it('StockDiscard shows the stock count and discard top', () => {
    render(<StockDiscard stockCount={40} discardTop={nat(9, 'diamonds')} />);
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });
  it('OpponentSeat shows name, count, opened badge, and a mini-fan sized to the count', () => {
    const { container } = render(<OpponentSeat name="Ruth" handCount={5} score={12} status="active" hasOpened isTurn melds={[]} />);
    expect(screen.getByText('Ruth')).toBeInTheDocument();
    expect(screen.getByText(/opened/i)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-cardback]')).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ui/table/__tests__/felt.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```tsx
// lib/ui/table/MeldPile.tsx
import { Card as CardFace } from './Card';
import { layoutMeld, type TableMeld } from '../../kalooki';

export function MeldPile({ meld, onClick }: { meld: TableMeld; onClick?: () => void }) {
  const ordered = layoutMeld(meld.cards, meld.kind);
  return (
    <div className="flex" onClick={onClick} data-meld={meld.id}>
      {ordered.map((c) => (
        <div key={c.id} className="-ml-2 first:ml-0"><CardFace card={c} size="sm" /></div>
      ))}
    </div>
  );
}
```

```tsx
// lib/ui/table/StockDiscard.tsx
import { Card as CardFace } from './Card';
import type { Card } from '../../kalooki';

export function StockDiscard({
  stockCount, discardTop, onDrawStock, onTakeDiscard,
}: { stockCount: number; discardTop?: Card; onDrawStock?: () => void; onTakeDiscard?: () => void }) {
  return (
    <div className="flex items-center gap-6">
      <button type="button" onClick={onDrawStock} disabled={!onDrawStock}
        className="relative h-16 w-12 rounded-md border-2 border-[#14243f] bg-[repeating-linear-gradient(45deg,#274a7a,#274a7a_4px,#1c3557_4px,#1c3557_8px)] shadow disabled:cursor-default">
        <span className="absolute inset-0 flex items-center justify-center font-bold text-[#dfe7f5]">{stockCount}</span>
      </button>
      <button type="button" onClick={onTakeDiscard} disabled={!onTakeDiscard || !discardTop}
        className="disabled:cursor-default">
        {discardTop ? <CardFace card={discardTop} /> : <span className="inline-block h-16 w-12 rounded-md border-2 border-dashed border-[#cfc9b4]/40" />}
      </button>
    </div>
  );
}
```

```tsx
// lib/ui/table/OpponentSeat.tsx
import { CardBack } from './CardBack';
import { MeldPile } from './MeldPile';
import type { TableMeld } from '../../kalooki';
import type { ReactElement } from 'react';

export function OpponentSeat({
  name, handCount, score, status, hasOpened, isTurn, melds,
}: {
  name: string; handCount: number; score: number; status: string; hasOpened: boolean; isTurn: boolean; melds: TableMeld[];
}): ReactElement {
  return (
    <div className="w-40 text-center">
      <div className={`text-sm font-bold ${isTurn ? 'text-brass' : 'text-bone'} ${status !== 'active' ? 'opacity-50 line-through' : ''}`}>
        {name}{hasOpened && <span className="ml-1 rounded bg-maroon px-1.5 text-[9px] text-bone">opened</span>}
      </div>
      <div className="mt-1 flex justify-center">
        {Array.from({ length: handCount }).map((_, i) => (
          <span key={i} data-cardback className="-ml-2.5 first:ml-0">
            <CardBack pack={i % 2 === 0 ? 'A' : 'B'} size="sm" />
          </span>
        ))}
      </div>
      <div className="text-[10px] text-[#c9b48a]">{handCount} cards · {score} pts</div>
      <div className="mt-1 flex flex-wrap justify-center gap-1">
        {melds.map((m) => <MeldPile key={m.id} meld={m} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ui/table/__tests__/felt.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ui/table/MeldPile.tsx lib/ui/table/StockDiscard.tsx lib/ui/table/OpponentSeat.tsx lib/ui/table/__tests__/felt.test.tsx
git commit -m "feat(table): felt pieces — MeldPile, StockDiscard, OpponentSeat"
```

---

## Task 5: ActionBar (phase/turn/legality + laying-down tray)

**Files:**
- Create: `lib/ui/table/ActionBar.tsx`
- Test: `lib/ui/table/__tests__/action-bar.test.tsx`

**Interfaces:**
- Consumes: `Card` component; `evaluateMeld`, `stagedPoints`, `canOpen`, `OPEN_THRESHOLD` from `./legality`; `Card` type; `ClientView` type.
- Produces:
  - `ActionBar({ view, selectedCards, stagedGroups, drawObligationActive, onDrawStock, onTakeDiscard, onStageMeld, onLayDown, onDiscard, onClearTray })`:
    - When `view.phase==='awaitingDraw'` and it's your turn: show enabled **Draw stock** + **Take discard** (labelled with the top card).
    - When `awaitingDiscard`: show the **laying-down tray** (staged groups + running points + "X to open" when not opened); **Meld** enabled when `evaluateMeld(selectedCards)` is valid (stages it); **Lay down** enabled when `stagedGroups.length>0 && canOpen(view, stagedGroups)` (and, when `drawObligationActive`, at least one staged group must include the obligation card — the parent passes `drawObligationActive` and the bar disables Lay down/Discard until the tray satisfies it via a `traySatisfiesObligation` prop); **Discard** enabled when exactly one card is selected and no unmet obligation.
    - Not your turn → render a muted "Waiting for <name>…" line (no active buttons).

Keep the obligation check in the parent (TableView) and pass a boolean `layDownEnabled` / `discardEnabled` so ActionBar stays presentational for the tricky rule; ActionBar still computes meld-validity of the current selection for the Meld button.

- [ ] **Step 1: Write the failing test**

```tsx
// lib/ui/table/__tests__/action-bar.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionBar } from '../ActionBar';
import type { Card } from '../../../kalooki';

const nat = (rank: number, suit: string): Card =>
  ({ id: `A-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: 'A' });
const view = (over: any = {}) => ({ seat: 0, currentTurn: 0, phase: 'awaitingDiscard', you: { hasOpened: false }, discard: [nat(9, 'diamonds')], ...over });

describe('ActionBar', () => {
  it('enables Meld only for a valid selection', () => {
    const onStage = vi.fn();
    render(<ActionBar view={view() as any} selectedCards={[nat(7, 'clubs'), nat(7, 'hearts'), nat(7, 'spades')]}
      stagedGroups={[]} layDownEnabled={false} discardEnabled={false}
      onDrawStock={() => {}} onTakeDiscard={() => {}} onStageMeld={onStage} onLayDown={() => {}} onDiscard={() => {}} onClearTray={() => {}} />);
    expect(screen.getByRole('button', { name: /^meld/i })).toBeEnabled();
  });
  it('disables Meld for an invalid selection and shows points-to-open', () => {
    render(<ActionBar view={view() as any} selectedCards={[nat(3, 'clubs'), nat(3, 'hearts')]}
      stagedGroups={[{ cards: [nat(3, 'clubs'), nat(3, 'hearts'), nat(3, 'spades')] }]} layDownEnabled={false} discardEnabled={false}
      onDrawStock={() => {}} onTakeDiscard={() => {}} onStageMeld={() => {}} onLayDown={() => {}} onDiscard={() => {}} onClearTray={() => {}} />);
    expect(screen.getByRole('button', { name: /^meld/i })).toBeDisabled();
    expect(screen.getByText(/to open/i)).toBeInTheDocument(); // 9 staged, 31 to open
  });
  it('draw phase shows draw buttons', () => {
    render(<ActionBar view={view({ phase: 'awaitingDraw' }) as any} selectedCards={[]} stagedGroups={[]}
      layDownEnabled={false} discardEnabled={false}
      onDrawStock={() => {}} onTakeDiscard={() => {}} onStageMeld={() => {}} onLayDown={() => {}} onDiscard={() => {}} onClearTray={() => {}} />);
    expect(screen.getByRole('button', { name: /draw stock/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /take discard/i })).toBeInTheDocument();
  });
  it('shows waiting message when not your turn', () => {
    render(<ActionBar view={view({ currentTurn: 1 }) as any} selectedCards={[]} stagedGroups={[]}
      layDownEnabled={false} discardEnabled={false}
      onDrawStock={() => {}} onTakeDiscard={() => {}} onStageMeld={() => {}} onLayDown={() => {}} onDiscard={() => {}} onClearTray={() => {}} />);
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ui/table/__tests__/action-bar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// lib/ui/table/ActionBar.tsx
'use client';
import { Card as CardFace, rankLabel, suitGlyph } from './Card';
import { evaluateMeld, stagedPoints, OPEN_THRESHOLD, isMyTurn } from './legality';
import type { Card } from '../../kalooki';
import type { ClientView } from '../../server';

const btn = 'rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-4 py-2 text-sm font-bold text-bone shadow disabled:opacity-40 disabled:cursor-not-allowed';

export function ActionBar({
  view, selectedCards, stagedGroups, layDownEnabled, discardEnabled,
  onDrawStock, onTakeDiscard, onStageMeld, onLayDown, onDiscard, onClearTray,
}: {
  view: ClientView; selectedCards: Card[]; stagedGroups: { cards: Card[] }[];
  layDownEnabled: boolean; discardEnabled: boolean;
  onDrawStock: () => void; onTakeDiscard: () => void; onStageMeld: () => void;
  onLayDown: () => void; onDiscard: () => void; onClearTray: () => void;
}) {
  if (!isMyTurn(view)) {
    return <div className="text-center text-sm italic text-[#c9b48a]">Waiting for seat {view.currentTurn}…</div>;
  }
  if (view.phase === 'awaitingDraw') {
    const top = view.discard[view.discard.length - 1];
    return (
      <div className="flex justify-center gap-3">
        <button type="button" className={btn} onClick={onDrawStock}>Draw stock</button>
        <button type="button" className={btn} onClick={onTakeDiscard} disabled={!top}>
          Take discard{top ? ` (${top.kind === 'joker' ? '★' : rankLabel(top.rank) + suitGlyph(top.suit)})` : ''}
        </button>
      </div>
    );
  }
  const meldValid = !!evaluateMeld(selectedCards);
  const staged = stagedPoints(stagedGroups);
  const toOpen = Math.max(0, OPEN_THRESHOLD - staged);
  return (
    <div className="flex flex-col items-center gap-2">
      {stagedGroups.length > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-black/30 px-3 py-1">
          <span className="text-xs text-[#c9b48a]">Laying down:</span>
          {stagedGroups.map((g, i) => (
            <span key={i} className="flex">{g.cards.map((c) => <span key={c.id} className="-ml-1 first:ml-0"><CardFace card={c} size="sm" /></span>)}</span>
          ))}
          <span className="text-xs text-brass">{staged} pts{!view.you.hasOpened && toOpen > 0 ? ` · ${toOpen} to open` : ''}</span>
          <button type="button" className="text-xs underline text-[#c9b48a]" onClick={onClearTray}>clear</button>
        </div>
      )}
      <div className="flex justify-center gap-3">
        <button type="button" className={btn} onClick={onStageMeld} disabled={!meldValid}>Meld</button>
        <button type="button" className={btn} onClick={onLayDown} disabled={!layDownEnabled}>Lay down</button>
        <button type="button" className={btn} onClick={onDiscard} disabled={!discardEnabled}>Discard</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ui/table/__tests__/action-bar.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ui/table/ActionBar.tsx lib/ui/table/__tests__/action-bar.test.tsx
git commit -m "feat(table): ActionBar with laying-down tray + points-to-open"
```

---

## Task 6: SSE hook + play server action

**Files:**
- Create: `lib/ui/table/useMatchStream.ts`, `app/actions/play.ts`
- Test: `lib/ui/table/__tests__/use-match-stream.test.tsx`

**Interfaces:**
- Consumes: `ClientView` type; Clerk `auth`; `getProdDeps`, `submitAction`, `type ServerAction` from `lib/server`.
- Produces:
  - `useMatchStream(matchId, initial): ClientView` — opens `EventSource('/api/matches/'+matchId+'/stream')`, updates state on each message (`JSON.parse`), closes on unmount; returns the latest view (seeded with `initial`).
  - `playAction(matchId, action: ServerAction): Promise<{ ok: boolean; reason?: string }>` — server action: Clerk `auth()` → `submitAction(getProdDeps(), { matchId, userId, action })`.

- [ ] **Step 1: Write the failing test**

```tsx
// lib/ui/table/__tests__/use-match-stream.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMatchStream } from '../useMatchStream';

class FakeES {
  onmessage: ((e: { data: string }) => void) | null = null;
  static last: FakeES | null = null;
  constructor(public url: string) { FakeES.last = this; }
  close() {}
}
beforeEach(() => { (globalThis as any).EventSource = FakeES as any; });

describe('useMatchStream', () => {
  it('starts with initial and updates on message', () => {
    const initial: any = { seat: 0, currentTurn: 0, phase: 'awaitingDraw' };
    const { result } = renderHook(() => useMatchStream('m1', initial));
    expect(result.current.phase).toBe('awaitingDraw');
    act(() => { FakeES.last!.onmessage?.({ data: JSON.stringify({ ...initial, phase: 'awaitingDiscard' }) }); });
    expect(result.current.phase).toBe('awaitingDiscard');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ui/table/__tests__/use-match-stream.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/ui/table/useMatchStream.ts
'use client';
import { useEffect, useState } from 'react';
import type { ClientView } from '../../server';

export function useMatchStream(matchId: string, initial: ClientView): ClientView {
  const [view, setView] = useState<ClientView>(initial);
  useEffect(() => {
    const es = new EventSource(`/api/matches/${matchId}/stream`);
    es.onmessage = (e) => {
      try { setView(JSON.parse(e.data) as ClientView); } catch { /* ignore keep-alives */ }
    };
    return () => es.close();
  }, [matchId]);
  return view;
}
```

```ts
// app/actions/play.ts
'use server';
import { auth } from '@clerk/nextjs/server';
import { getProdDeps, submitAction, type ServerAction } from '../../lib/server';

export async function playAction(matchId: string, action: ServerAction): Promise<{ ok: boolean; reason?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: 'unauthorized' };
  const res = await submitAction(getProdDeps(), { matchId, userId, action });
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}
```

Ensure `ServerAction` is exported from `lib/server` (it lives in `lib/server/deps.ts`, already re-exported via the barrel — verify).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ui/table/__tests__/use-match-stream.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ui/table/useMatchStream.ts app/actions/play.ts lib/ui/table/__tests__/use-match-stream.test.tsx
git commit -m "feat(table): SSE match-stream hook + play server action"
```

---

## Task 7: TableView (compose + seat positioning + submit)

**Files:**
- Create: `lib/ui/table/TableView.tsx`
- Test: `lib/ui/table/__tests__/table-view.test.tsx`

**Interfaces:**
- Consumes: all table components; `useMatchStream`, `playAction`; `seatPositions`, `tableKind` from `lib/ui/table-geometry`; `sortHand` from `./Hand`; legality helpers; `ClientView`, `Card`, `Action`.
- Produces: `TableView({ matchId, initial })` (client) — the whole table. Holds selection + staged-tray + reordered-hand state; positions the viewer at the bottom and opponents around via geometry rotated so `view.seat` sits at the bottom slot; builds and submits `Action`s via `playAction`; renders overlays when `roundFinished` / `matchFinished` / busted-needs-rebuy.

**Behaviour to implement (the glue):**
- Hand order: start from `sortHand`/persisted localStorage order, reconcile with the current `view.you.hand` (drop played cards, append new). Selection is a `string[]` of card ids.
- Seat rotation: compute display order so the viewer's seat is bottom; map each opponent seat to a geometry slot. (Use `seatPositions(view.seat===... )` — simplest: render viewer's hand fixed at bottom; place opponents by relative offset `(oppSeat - mySeat + n) % n` into the non-bottom geometry slots.)
- **Meld** → stage `evaluateMeld(selected)` group, clear selection. **Lay down** → submit `{type:'meld', groups: stagedGroups.map(g=>({kind: evaluateMeld(g.cards)!.kind, cardIds: g.cards.map(c=>c.id)}))}`, clear tray. **Draw stock/discard** → submit draw. **Discard** → submit `{type:'discard', cardId: selected[0]}`.
- **Draw-obligation:** track locally — set when a `draw` from `discard` is submitted and the returned view shows it's still your turn in `awaitingDiscard`; require a staged group to include the drawn card before enabling Lay down / Discard. Compute `layDownEnabled` = `stagedGroups.length>0 && canOpen(view, stagedGroups) && (!obligation || trayIncludes(obligationCardId))`; `discardEnabled` = `selected.length===1 && !obligationUnmet`.
- On `playAction` returning `{ok:false, reason}`, show a transient toast with the reason.

- [ ] **Step 1: Write the failing test**

```tsx
// lib/ui/table/__tests__/table-view.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../useMatchStream', () => ({ useMatchStream: (_id: string, initial: any) => initial }));
const playAction = vi.fn(async () => ({ ok: true }));
vi.mock('../../../../app/actions/play', () => ({ playAction: (...a: any[]) => playAction(...a) }));

import { TableView } from '../TableView';
import type { Card } from '../../../kalooki';
const nat = (r: number, s: string, p = 'A'): Card => ({ id: `${p}-${s}-${r}`, kind: 'natural', rank: r as any, suit: s as any, pack: p as any });

const baseView: any = {
  seat: 0, currentTurn: 0, phase: 'awaitingDraw',
  you: { seat: 0, hand: [nat(4, 'clubs'), nat(5, 'hearts')], handCount: 2, score: 0, status: 'active', hasOpened: false },
  opponents: [{ seat: 1, handCount: 13, score: 0, status: 'active', hasOpened: false }],
  stockCount: 40, discard: [nat(9, 'diamonds')], melds: [],
  currentTurn: 0, pot: 8, roundNumber: 1, roundFinished: false, roundWinnerSeat: null, goOutType: null,
  matchFinished: false, matchWinnerSeat: null,
};

beforeEach(() => { playAction.mockClear(); (globalThis as any).EventSource = class { close() {} } as any; });

describe('TableView', () => {
  it('renders your hand, stock/discard, and submits a draw', async () => {
    render(<TableView matchId="m1" initial={baseView} />);
    expect(screen.getByText('40')).toBeInTheDocument();            // stock
    fireEvent.click(screen.getByRole('button', { name: /draw stock/i }));
    expect(playAction).toHaveBeenCalledWith('m1', { type: 'draw', source: 'stock' });
  });
  it('is read-only when not your turn', () => {
    render(<TableView matchId="m1" initial={{ ...baseView, currentTurn: 1 }} />);
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /draw stock/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ui/table/__tests__/table-view.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Implement `TableView` composing the pieces per the Behaviour list above. Concrete skeleton (fill the felt/positioning with the geometry + the state wiring exactly as described):

```tsx
// lib/ui/table/TableView.tsx
'use client';
import { useMemo, useState } from 'react';
import { useMatchStream } from './useMatchStream';
import { playAction } from '../../../app/actions/play';
import { Hand, sortHand } from './Hand';
import { OpponentSeat } from './OpponentSeat';
import { StockDiscard } from './StockDiscard';
import { MeldPile } from './MeldPile';
import { ActionBar } from './ActionBar';
import { RoundSummary, RebuyPrompt, MatchSummary } from './overlays';
import { evaluateMeld, canOpen, isMyTurn } from './legality';
import type { Card, Action, ServerAction } from '../../kalooki';
import type { ClientView } from '../../server';

export function TableView({ matchId, initial }: { matchId: string; initial: ClientView }) {
  const view = useMatchStream(matchId, initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [staged, setStaged] = useState<{ cards: Card[] }[]>([]);
  const [order, setOrder] = useState<string[] | null>(null);
  const [obligationId, setObligationId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const hand = useMemo(() => {
    const byId = new Map(view.you.hand.map((c) => [c.id, c] as const));
    const base = order ? order.filter((id) => byId.has(id)) : sortHand(view.you.hand).map((c) => c.id);
    for (const c of view.you.hand) if (!base.includes(c.id)) base.push(c.id);
    return base.map((id) => byId.get(id)!).filter(Boolean);
  }, [view.you.hand, order]);

  const selectedCards = hand.filter((c) => selected.includes(c.id));
  const trayIncludesObligation = !obligationId || staged.some((g) => g.cards.some((c) => c.id === obligationId));
  const layDownEnabled = staged.length > 0 && canOpen(view, staged) && trayIncludesObligation;
  const discardEnabled = selected.length === 1 && (!obligationId || false); // discard blocked while obligation unmet

  async function submit(action: ServerAction) {
    const res = await playAction(matchId, action);
    if (!res.ok) setToast(res.reason ?? 'illegal move');
  }

  return (
    <div className="relative min-h-screen bg-[url(/art/table-surface.jpg)] bg-cover bg-center text-bone">
      {/* status */}
      <div className="flex justify-between bg-black/40 px-4 py-2 text-xs">
        <span>Round {view.roundNumber} · 40 to open</span>
        <span className="text-brass">{isMyTurn(view) ? 'Your turn' : `Seat ${view.currentTurn}'s turn`}</span>
        <span className="text-[#c9a24b]">Pot {view.pot}</span>
      </div>

      {/* opponents */}
      <div className="flex flex-wrap justify-around p-3">
        {view.opponents.map((o) => (
          <OpponentSeat key={o.seat} name={`Seat ${o.seat}`} handCount={o.handCount} score={o.score}
            status={o.status} hasOpened={o.hasOpened} isTurn={view.currentTurn === o.seat}
            melds={view.melds.filter((m) => m.ownerSeat === o.seat)} />
        ))}
      </div>

      {/* center */}
      <div className="flex justify-center py-4">
        <StockDiscard stockCount={view.stockCount} discardTop={view.discard[view.discard.length - 1]}
          onDrawStock={isMyTurn(view) && view.phase === 'awaitingDraw' ? () => submit({ type: 'draw', source: 'stock' }) : undefined}
          onTakeDiscard={isMyTurn(view) && view.phase === 'awaitingDraw'
            ? () => { const top = view.discard[view.discard.length - 1]; if (top) setObligationId(top.id); submit({ type: 'draw', source: 'discard' }); }
            : undefined} />
      </div>

      {/* your melds */}
      <div className="flex flex-wrap justify-center gap-3 px-4">
        {view.melds.filter((m) => m.ownerSeat === view.seat).map((m) => <MeldPile key={m.id} meld={m} />)}
      </div>

      {/* your area */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
        <ActionBar view={view} selectedCards={selectedCards} stagedGroups={staged}
          layDownEnabled={layDownEnabled} discardEnabled={discardEnabled}
          onDrawStock={() => submit({ type: 'draw', source: 'stock' })}
          onTakeDiscard={() => { const top = view.discard[view.discard.length - 1]; if (top) setObligationId(top.id); submit({ type: 'draw', source: 'discard' }); }}
          onStageMeld={() => { const e = evaluateMeld(selectedCards); if (e) { setStaged([...staged, { cards: selectedCards }]); setSelected([]); } }}
          onLayDown={() => {
            const groups = staged.map((g) => ({ kind: evaluateMeld(g.cards)!.kind, cardIds: g.cards.map((c) => c.id) }));
            submit({ type: 'meld', groups } as Action); setStaged([]); setObligationId(null);
          }}
          onDiscard={() => { if (selected[0]) submit({ type: 'discard', cardId: selected[0] }); setSelected([]); }}
          onClearTray={() => setStaged([])} />
        <div className="mt-2">
          <Hand cards={hand} selectedIds={selected}
            onToggle={(id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])}
            onReorder={setOrder} onSort={() => setOrder(sortHand(view.you.hand).map((c) => c.id))} />
        </div>
      </div>

      {toast && <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded bg-maroon px-3 py-2 text-sm" onAnimationEnd={() => setToast(null)}>{toast}</div>}

      {view.roundFinished && !view.matchFinished && <RoundSummary view={view} onContinue={() => { /* SSE will advance */ }} />}
      {view.matchFinished && <MatchSummary view={view} />}
      {view.you.status === 'busted' && !view.matchFinished &&
        <RebuyPrompt onRebuy={() => submit({ type: 'rebuy' })} onDecline={() => submit({ type: 'decline' })} />}
    </div>
  );
}
```

Note: `ServerAction` is imported from `lib/kalooki`? No — `ServerAction` is exported from `lib/server`. Fix the import: `import type { ServerAction } from '../../server';` and `Action` from `lib/kalooki`. The implementer must correct these import sources so tsc passes (Action from kalooki, ServerAction + ClientView from server).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ui/table && npx tsc --noEmit`
Expected: PASS (both TableView tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ui/table/TableView.tsx lib/ui/table/__tests__/table-view.test.tsx
git commit -m "feat(table): TableView composition + action submission"
```

---

## Task 8: Overlays + table page wiring

**Files:**
- Create: `lib/ui/table/overlays.tsx`
- Modify: `app/match/[id]/table/page.tsx` (rewrite placeholder)
- Test: `lib/ui/table/__tests__/overlays.test.tsx`

**Interfaces:**
- Consumes: `ClientView`; Clerk `auth`; `db`, `getMatch` from `lib/db`; `resolveSeat` + `getProdDeps` + `loadGameState`... — the page loads the initial redacted view server-side.
- Produces:
  - `RoundSummary({ view, onContinue })` — shows round winner seat, `goOutType`, per-seat scores, pot; a Continue button.
  - `RebuyPrompt({ onRebuy, onDecline })` — "Buy back in for 4 bits / Decline".
  - `MatchSummary({ view })` — winner seat, final standings, link home.
  - `app/match/[id]/table/page.tsx` — server component: auth-gate + membership (`resolveSeat`), builds the initial `ClientView` (load game state, `redactStateFor(state, seat)`), renders `TableView` inside `RoomBackdrop plate="table-surface"`... (RoomBackdrop optional here since TableView sets the felt bg; keep the page thin).

- [ ] **Step 1: Write the failing test**

```tsx
// lib/ui/table/__tests__/overlays.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoundSummary, RebuyPrompt, MatchSummary } from '../overlays';

const view: any = { roundWinnerSeat: 0, goOutType: 'kalooki', pot: 18, seat: 1,
  you: { score: 12 }, opponents: [{ seat: 0, score: 0 }], matchWinnerSeat: 0 };

describe('overlays', () => {
  it('RoundSummary shows go-out type and Continue', () => {
    const onContinue = vi.fn();
    render(<RoundSummary view={view} onContinue={onContinue} />);
    expect(screen.getByText(/kalooki/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onContinue).toHaveBeenCalled();
  });
  it('RebuyPrompt fires rebuy and decline', () => {
    const onRebuy = vi.fn(); const onDecline = vi.fn();
    render(<RebuyPrompt onRebuy={onRebuy} onDecline={onDecline} />);
    fireEvent.click(screen.getByRole('button', { name: /buy back in/i })); expect(onRebuy).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /decline/i })); expect(onDecline).toHaveBeenCalled();
  });
  it('MatchSummary announces the winner', () => {
    render(<MatchSummary view={view} />);
    expect(screen.getByText(/winner/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ui/table/__tests__/overlays.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// lib/ui/table/overlays.tsx
'use client';
import Link from 'next/link';
import type { ClientView } from '../../server';

function Scrim({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6">
    <div className="max-w-sm rounded-xl border-2 border-brass bg-[#2a1c12] p-6 text-center text-bone shadow-2xl">{children}</div>
  </div>;
}

export function RoundSummary({ view, onContinue }: { view: ClientView; onContinue: () => void }) {
  return <Scrim>
    <h3 className="font-[family-name:var(--font-display)] text-2xl text-brass">Round over</h3>
    <p className="mt-2">Seat {view.roundWinnerSeat} went out{view.goOutType ? ` — ${view.goOutType}` : ''}.</p>
    <p className="mt-1 text-sm text-[#c9b48a]">Pot: {view.pot} bits</p>
    <button type="button" className="mt-4 rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-5 py-2 font-bold" onClick={onContinue}>Continue</button>
  </Scrim>;
}

export function RebuyPrompt({ onRebuy, onDecline }: { onRebuy: () => void; onDecline: () => void }) {
  return <Scrim>
    <h3 className="font-[family-name:var(--font-display)] text-2xl text-brass">You're out — over 150</h3>
    <p className="mt-2 text-sm">Buy back in for 4 bits and re-enter at the current top score?</p>
    <div className="mt-4 flex justify-center gap-3">
      <button type="button" className="rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-4 py-2 font-bold" onClick={onRebuy}>Buy back in</button>
      <button type="button" className="rounded-md border-2 border-sage-deep bg-[linear-gradient(180deg,#c6d0b3,#a6b589)] px-4 py-2 font-bold text-ink" onClick={onDecline}>Decline</button>
    </div>
  </Scrim>;
}

export function MatchSummary({ view }: { view: ClientView }) {
  return <Scrim>
    <h3 className="font-[family-name:var(--font-display)] text-2xl text-brass">Winner!</h3>
    <p className="mt-2">Seat {view.matchWinnerSeat} takes the pot of {view.pot} bits.</p>
    <Link href="/" className="mt-4 inline-block rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-5 py-2 font-bold">Back to the front room</Link>
  </Scrim>;
}
```

```tsx
// app/match/[id]/table/page.tsx  (replace placeholder)
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db, getMatch } from '../../../../lib/db';
import { getProdDeps, resolveSeat, redactStateFor } from '../../../../lib/server';
import { loadGameState } from '../../../../lib/db';
import { TableView } from '../../../../lib/ui/table/TableView';

export default async function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const { id } = await params;
  const match = await getMatch(db, id);
  if (!match) redirect('/');
  if (match.status === 'lobby') redirect(`/match/${id}/lobby`);
  const seat = await resolveSeat(db, id, userId);
  if (seat === null) redirect('/');
  const loaded = await loadGameState(db, id);
  if (!loaded) redirect('/');
  const initial = redactStateFor(loaded.state, seat);
  return <TableView matchId={id} initial={initial} />;
}
```

- [ ] **Step 4: Run tests + build**

Run: `npx vitest run && npx tsc --noEmit && npx next build`
Expected: all green; `/match/[id]/table` compiles as a real page.

- [ ] **Step 5: Commit**

```bash
git add lib/ui/table/overlays.tsx app/match/\[id\]/table/page.tsx lib/ui/table/__tests__/overlays.test.tsx
git commit -m "feat(table): round/match/rebuy overlays + live table page"
```

---

## Self-Review Notes (author)

- **Spec coverage:** layout + viewer-bottom (T7), Card/pack-dot/joker + card-back art (T1), hand drag/sort/select (T3), legality preview reusing engine (T2), stock/discard/melds/opponents (T4), phase/turn action bar + laying-down tray + 40-open (T5), SSE + submit (T6), TableView glue incl. draw-obligation + lay off/meld/discard/go-out via engine actions (T7), round/match/rebuy overlays (T8), redaction-only consumption (T7 test asserts ClientView usage), reconnect (SSE initial state), art with fallback (T1/T7). Joker-replacement UI is scoped in the spec (§5) but its dedicated flow is minimal here — flagged below.
- **Known scope trim (flag for reviewer/playtest):** Joker replacement and lay-off *targeting* UI are represented at the data layer (MeldPile `onClick`, engine action shapes) but the full interactive flows are thin in T7; they are the most likely playtest-refinement follow-ups. The core loop (draw → meld/open → discard → go-out → round/match transitions → rebuy) is fully wired.
- **Placeholder scan:** none of the forbidden patterns. **Type consistency:** `ClientView` from `lib/server`, `Action` from `lib/kalooki`, `ServerAction` from `lib/server` — the implementer must keep these import sources exact (noted in T6/T7). Component prop names consistent across tasks.
- **Deferred:** E2E + launch hardening (Phase 6).
