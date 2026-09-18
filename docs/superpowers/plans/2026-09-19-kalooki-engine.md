# Kalooki Rules Engine (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, dependency-free TypeScript Kalooki rules engine in `/lib/kalooki` — cards, meld validation, game state, action application, and scoring — exhaustively unit-tested via TDD.

**Architecture:** A pure functional core with no I/O, no network, no React. State is an immutable plain object; `applyAction(state, seat, action)` returns either a new state or a typed rejection. A seedable RNG makes shuffles deterministic so tests and (later) move-replay are reproducible.

**Tech Stack:** TypeScript, Vitest. No runtime dependencies in `/lib/kalooki`.

**Spec:** `docs/superpowers/specs/2026-09-19-kalooki-online-design.md`

## Global Constraints

- Name is **Kalooki** everywhere (never "Kaluki").
- `/lib/kalooki/*` is **pure**: no imports of Node, network, React, DB, or `Math.random` — randomness only via the injected seedable RNG.
- Deck = 106 cards: two full 52-card packs (pack `A` = blue back, pack `B` = red back) + 2 jokers (`A-joker`, `B-joker`).
- Rank order low→high: `2,3,4,5,6,7,8,9,10,J,Q,K,A` — Ace **high** only. Runs are same-suit sequences up to `…Q K A`; no `A 2 3`, no wraparound.
- Meld point values (when melding/opening): number = pip value (2–10), court (J,Q,K) = 10, Ace = 11, joker = value of the card it represents.
- In-hand point values (round-end scoring): same, except **joker = 15**.
- Opening meld threshold: **40 points**, may be spread across multiple melds laid the same turn.
- Match bust threshold: a player **surpasses 150** (i.e. score > 150) to be out.
- All state objects are treated as immutable; actions return new objects (structural sharing is fine, but never mutate inputs).

**Rank encoding:** ranks are stored as integers `2..14` where `11=J, 12=Q, 13=K, 14=A`. This makes run-sequence checks arithmetic and keeps Ace high naturally (14 is the max).

---

## File Structure

- `lib/kalooki/rng.ts` — seedable deterministic RNG + shuffle.
- `lib/kalooki/cards.ts` — card types, deck construction, point-value helpers.
- `lib/kalooki/melds.ts` — set/run validation, joker resolution, meld point value.
- `lib/kalooki/layout.ts` — presentation-only meld ordering (R-B-R discipline).
- `lib/kalooki/state.ts` — game/match/round state types, deal & setup.
- `lib/kalooki/actions.ts` — `applyAction` entry point and all action handlers.
- `lib/kalooki/scoring.ts` — round scoring, bit payments, match bust/rebuy/pot.
- `lib/kalooki/index.ts` — public re-exports.
- Tests co-located under `lib/kalooki/__tests__/*.test.ts`.

---

## Task 1: RNG and deck

**Files:**
- Create: `lib/kalooki/rng.ts`
- Create: `lib/kalooki/cards.ts`
- Test: `lib/kalooki/__tests__/cards.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'`
  - `type Pack = 'A' | 'B'`
  - `type Rank = 2|3|4|5|6|7|8|9|10|11|12|13|14`
  - `interface NaturalCard { id: string; kind: 'natural'; rank: Rank; suit: Suit; pack: Pack }`
  - `interface JokerCard { id: string; kind: 'joker'; pack: Pack }`
  - `type Card = NaturalCard | JokerCard`
  - `function makeDeck(): Card[]` — 106 unique cards.
  - `function meldPoints(rank: Rank): number` — 2–10 → pip, 11–13 → 10, 14 → 11.
  - `function cardColor(card: Card): 'red' | 'black'` — red = hearts/diamonds; jokers use pack (`A`→red? no) — see note.
  - `function makeRng(seed: number): () => number` — returns float in [0,1).
  - `function shuffle<T>(items: T[], rng: () => number): T[]` — pure Fisher-Yates, returns a new array.

**Card color note:** `cardColor` reflects *suit* color for naturals (hearts/diamonds = red, clubs/spades = black). Jokers have no suit; `cardColor` returns `'red'` for a joker only as a fallback and layout code handles jokers explicitly — do not rely on joker color for game logic. Pack (blue/red *back*) is separate from face color and is carried on `card.pack` for the UI only.

- [ ] **Step 1: Write the failing test**

```ts
// lib/kalooki/__tests__/cards.test.ts
import { describe, it, expect } from 'vitest';
import { makeDeck, meldPoints, makeRng, shuffle } from '../cards';
import { makeRng as rngFromRng } from '../rng';

describe('makeDeck', () => {
  it('builds 106 unique cards: 2 packs of 52 + 2 jokers', () => {
    const deck = makeDeck();
    expect(deck).toHaveLength(106);
    expect(new Set(deck.map((c) => c.id)).size).toBe(106);
    expect(deck.filter((c) => c.kind === 'joker')).toHaveLength(2);
    expect(deck.filter((c) => c.kind === 'natural')).toHaveLength(104);
    // each pack contributes exactly 52 naturals + 1 joker
    for (const pack of ['A', 'B'] as const) {
      expect(deck.filter((c) => c.pack === pack)).toHaveLength(53);
    }
  });
});

describe('meldPoints', () => {
  it('scores pips, courts as 10, ace as 11', () => {
    expect(meldPoints(2)).toBe(2);
    expect(meldPoints(10)).toBe(10);
    expect(meldPoints(11)).toBe(10); // J
    expect(meldPoints(13)).toBe(10); // K
    expect(meldPoints(14)).toBe(11); // A
  });
});

describe('shuffle', () => {
  it('is deterministic for a given seed and preserves multiset', () => {
    const deck = makeDeck();
    const a = shuffle(deck, rngFromRng(42));
    const b = shuffle(deck, rngFromRng(42));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(new Set(a.map((c) => c.id))).toEqual(new Set(deck.map((c) => c.id)));
    // different seed → (almost certainly) different order
    const c = shuffle(deck, rngFromRng(7));
    expect(a.map((x) => x.id)).not.toEqual(c.map((x) => x.id));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/kalooki/__tests__/cards.test.ts`
Expected: FAIL — modules not found / functions undefined.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/kalooki/rng.ts
// Mulberry32: small, fast, deterministic PRNG.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

```ts
// lib/kalooki/cards.ts
export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Pack = 'A' | 'B';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface NaturalCard {
  id: string;
  kind: 'natural';
  rank: Rank;
  suit: Suit;
  pack: Pack;
}
export interface JokerCard {
  id: string;
  kind: 'joker';
  pack: Pack;
}
export type Card = NaturalCard | JokerCard;

const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function makeDeck(): Card[] {
  const cards: Card[] = [];
  for (const pack of ['A', 'B'] as Pack[]) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank, suit, pack });
      }
    }
    cards.push({ id: `${pack}-joker`, kind: 'joker', pack });
  }
  return cards;
}

export function meldPoints(rank: Rank): number {
  if (rank <= 10) return rank;
  if (rank <= 13) return 10;
  return 11; // Ace
}

export function cardColor(card: Card): 'red' | 'black' {
  if (card.kind === 'joker') return 'red';
  return card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black';
}

// Re-export RNG helpers so cards' consumers have one import site.
export { makeRng, shuffle } from './rng';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/kalooki/__tests__/cards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/kalooki/rng.ts lib/kalooki/cards.ts lib/kalooki/__tests__/cards.test.ts
git commit -m "feat(kalooki): deck, card model, seedable shuffle"
```

---

## Task 2: Meld validation — sets

**Files:**
- Create: `lib/kalooki/melds.ts`
- Test: `lib/kalooki/__tests__/melds-set.test.ts`

**Interfaces:**
- Consumes: `Card, NaturalCard, Rank, Suit, meldPoints` from `cards.ts`.
- Produces:
  - `type MeldKind = 'set' | 'run'`
  - `interface ResolvedCard { card: Card; rank: Rank; suit: Suit | null }` — for jokers, the rank/suit they represent (`suit` may be `null` in a set where the suit is unconstrained).
  - `interface ValidMeld { valid: true; kind: MeldKind; resolved: ResolvedCard[]; points: number }`
  - `interface InvalidMeld { valid: false; reason: string }`
  - `type MeldResult = ValidMeld | InvalidMeld`
  - `function validateSet(cards: Card[]): MeldResult`

**Set rules:** 3–4 cards; all naturals share one rank; naturals occupy distinct suits; jokers allowed; a set of 3 may contain up to 2 jokers (needs ≥1 natural to define rank); total cards ≤ 4 (4 distinct suits max). Points = sum of `meldPoints(rank)` for every card (jokers score the set's rank).

- [ ] **Step 1: Write the failing test**

```ts
// lib/kalooki/__tests__/melds-set.test.ts
import { describe, it, expect } from 'vitest';
import { validateSet } from '../melds';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });
const joker = (pack = 'A'): Card => ({ id: `${pack}-joker`, kind: 'joker', pack: pack as any });

describe('validateSet', () => {
  it('accepts three distinct-suit naturals of same rank', () => {
    const r = validateSet([nat(7, 'clubs'), nat(7, 'hearts'), nat(7, 'spades')]);
    expect(r.valid).toBe(true);
    if (r.valid) { expect(r.kind).toBe('set'); expect(r.points).toBe(21); }
  });

  it('accepts a set of 3 with two jokers and one natural', () => {
    const r = validateSet([nat(9, 'clubs'), joker('A'), joker('B')]);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.points).toBe(27); // 9 * 3
  });

  it('accepts a four-card set (all four suits)', () => {
    const r = validateSet([nat(5, 'clubs'), nat(5, 'diamonds'), nat(5, 'hearts'), nat(5, 'spades')]);
    expect(r.valid).toBe(true);
  });

  it('rejects duplicate suits among naturals', () => {
    const r = validateSet([nat(7, 'clubs'), nat(7, 'clubs', 'B'), nat(7, 'hearts')]);
    expect(r.valid).toBe(false);
  });

  it('rejects mixed ranks', () => {
    expect(validateSet([nat(7, 'clubs'), nat(8, 'hearts'), nat(7, 'spades')]).valid).toBe(false);
  });

  it('rejects fewer than 3 or more than 4 cards', () => {
    expect(validateSet([nat(7, 'clubs'), nat(7, 'hearts')]).valid).toBe(false);
    expect(validateSet([nat(7, 'clubs'), nat(7, 'diamonds'), nat(7, 'hearts'), nat(7, 'spades'), joker()]).valid).toBe(false);
  });

  it('rejects an all-joker "set" (no natural to define rank)', () => {
    expect(validateSet([joker('A'), joker('B'), nat(2, 'clubs')]).valid).toBe(true);
    expect(validateSet([joker('A'), joker('B')]).valid).toBe(false); // too few anyway
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/kalooki/__tests__/melds-set.test.ts`
Expected: FAIL — `validateSet` undefined.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/kalooki/melds.ts
import { Card, NaturalCard, Rank, Suit, meldPoints } from './cards';

export type MeldKind = 'set' | 'run';
export interface ResolvedCard { card: Card; rank: Rank; suit: Suit | null }
export interface ValidMeld { valid: true; kind: MeldKind; resolved: ResolvedCard[]; points: number }
export interface InvalidMeld { valid: false; reason: string }
export type MeldResult = ValidMeld | InvalidMeld;

const naturals = (cards: Card[]) => cards.filter((c): c is NaturalCard => c.kind === 'natural');

export function validateSet(cards: Card[]): MeldResult {
  if (cards.length < 3 || cards.length > 4) return { valid: false, reason: 'A set must have 3 or 4 cards.' };
  const nats = naturals(cards);
  if (nats.length === 0) return { valid: false, reason: 'A set needs at least one natural card to define its rank.' };
  const rank = nats[0].rank;
  if (!nats.every((c) => c.rank === rank)) return { valid: false, reason: 'All cards in a set must share one rank.' };
  const suits = nats.map((c) => c.suit);
  if (new Set(suits).size !== suits.length) return { valid: false, reason: 'A set cannot repeat a suit.' };
  const resolved: ResolvedCard[] = cards.map((c) =>
    c.kind === 'natural' ? { card: c, rank: c.rank, suit: c.suit } : { card: c, rank, suit: null },
  );
  const points = resolved.reduce((sum, r) => sum + meldPoints(r.rank), 0);
  return { valid: true, kind: 'set', resolved, points };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/kalooki/__tests__/melds-set.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/kalooki/melds.ts lib/kalooki/__tests__/melds-set.test.ts
git commit -m "feat(kalooki): set meld validation"
```

---

## Task 3: Meld validation — runs (with joker resolution)

**Files:**
- Modify: `lib/kalooki/melds.ts`
- Test: `lib/kalooki/__tests__/melds-run.test.ts`

**Interfaces:**
- Consumes: types from Task 2.
- Produces:
  - `function validateRun(cards: Card[]): MeldResult` — cards given in intended sequence order (low→high). Same suit for all naturals; consecutive ranks; Ace high only (max rank 14, no wraparound, no Ace-low); jokers fill gaps taking the rank of their slot; a run cannot start below rank 2 or extend past 14; no two cards may resolve to the same rank.
  - `function validateMeld(cards: Card[], kind: MeldKind): MeldResult` — dispatch helper.

**Run resolution:** given cards in order, assign each position a rank starting from the first natural's rank minus its index, then verify every natural matches its computed slot rank, every slot rank is in `2..14`, and jokers get the slot rank/suit (suit = the run's suit). Reject if fewer than 3 cards, if naturals span >1 suit, or if any joker would need to represent an out-of-range rank.

- [ ] **Step 1: Write the failing test**

```ts
// lib/kalooki/__tests__/melds-run.test.ts
import { describe, it, expect } from 'vitest';
import { validateRun } from '../melds';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });
const joker = (pack = 'A'): Card => ({ id: `${pack}-joker`, kind: 'joker', pack: pack as any });

describe('validateRun', () => {
  it('accepts three consecutive same-suit cards', () => {
    const r = validateRun([nat(4, 'hearts'), nat(5, 'hearts'), nat(6, 'hearts')]);
    expect(r.valid).toBe(true);
    if (r.valid) { expect(r.kind).toBe('run'); expect(r.points).toBe(15); }
  });

  it('accepts Q-K-A (ace high)', () => {
    const r = validateRun([nat(12, 'spades'), nat(13, 'spades'), nat(14, 'spades')]);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.points).toBe(31); // 10 + 10 + 11
  });

  it('resolves a joker filling an interior gap', () => {
    const r = validateRun([nat(4, 'clubs'), joker(), nat(6, 'clubs')]);
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.resolved[1].rank).toBe(5);
      expect(r.resolved[1].suit).toBe('clubs');
      expect(r.points).toBe(15); // 4 + 5 + 6
    }
  });

  it('rejects wraparound K-A-2', () => {
    expect(validateRun([nat(13, 'hearts'), nat(14, 'hearts'), nat(2, 'hearts')]).valid).toBe(false);
  });

  it('rejects Ace-low A-2-3', () => {
    expect(validateRun([nat(14, 'hearts'), nat(2, 'hearts'), nat(3, 'hearts')]).valid).toBe(false);
  });

  it('rejects mixed suits', () => {
    expect(validateRun([nat(4, 'hearts'), nat(5, 'spades'), nat(6, 'hearts')]).valid).toBe(false);
  });

  it('rejects non-consecutive naturals', () => {
    expect(validateRun([nat(4, 'hearts'), nat(6, 'hearts'), nat(7, 'hearts')]).valid).toBe(false);
  });

  it('rejects fewer than 3 cards', () => {
    expect(validateRun([nat(4, 'hearts'), nat(5, 'hearts')]).valid).toBe(false);
  });

  it('rejects a joker that would resolve above the Ace', () => {
    expect(validateRun([nat(13, 'hearts'), nat(14, 'hearts'), joker()]).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/kalooki/__tests__/melds-run.test.ts`
Expected: FAIL — `validateRun` undefined.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to lib/kalooki/melds.ts
export function validateRun(cards: Card[]): MeldResult {
  if (cards.length < 3) return { valid: false, reason: 'A run must have at least 3 cards.' };
  const nats = naturals(cards);
  if (nats.length === 0) return { valid: false, reason: 'A run needs at least one natural card.' };
  const suit = nats[0].suit;
  if (!nats.every((c) => c.suit === suit)) return { valid: false, reason: 'All cards in a run must share one suit.' };

  // Anchor slot ranks off the first natural's position.
  const anchorIdx = cards.findIndex((c) => c.kind === 'natural');
  const startRank = (cards[anchorIdx] as NaturalCard).rank - anchorIdx;
  const resolved: ResolvedCard[] = [];
  for (let i = 0; i < cards.length; i++) {
    const slotRank = startRank + i;
    if (slotRank < 2 || slotRank > 14) return { valid: false, reason: 'Run extends outside 2..Ace.' };
    const c = cards[i];
    if (c.kind === 'natural') {
      if (c.rank !== slotRank) return { valid: false, reason: 'Run cards are not consecutive.' };
      resolved.push({ card: c, rank: c.rank, suit: c.suit });
    } else {
      resolved.push({ card: c, rank: slotRank as Rank, suit });
    }
  }
  const points = resolved.reduce((sum, r) => sum + meldPoints(r.rank), 0);
  return { valid: true, kind: 'run', resolved, points };
}

export function validateMeld(cards: Card[], kind: MeldKind): MeldResult {
  return kind === 'set' ? validateSet(cards) : validateRun(cards);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/kalooki/__tests__/melds-run.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/kalooki/melds.ts lib/kalooki/__tests__/melds-run.test.ts
git commit -m "feat(kalooki): run meld validation with joker resolution"
```

---

## Task 4: Meld layout discipline (presentation)

**Files:**
- Create: `lib/kalooki/layout.ts`
- Test: `lib/kalooki/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: `Card, cardColor` from `cards.ts`; `MeldKind` from `melds.ts`.
- Produces: `function layoutMeld(cards: Card[], kind: MeldKind): Card[]` — returns display order.
  - Runs: unchanged (sequence order is preserved as given).
  - Sets: reorder so colors alternate as evenly and symmetrically as possible, with the minority color centered (`R-B-R`, `B-R-B`, `R-B-R-B`), never clumped. Jokers are treated as fillers placed to preserve alternation (a joker takes whichever color slot keeps the pattern; if ambiguous it fills from the center outward). Deterministic for a given input.

- [ ] **Step 1: Write the failing test**

```ts
// lib/kalooki/__tests__/layout.test.ts
import { describe, it, expect } from 'vitest';
import { layoutMeld } from '../layout';
import { cardColor } from '../cards';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });

describe('layoutMeld sets', () => {
  it('centers the odd-color-out for a 3-set (two red, one black -> R-B-R)', () => {
    const out = layoutMeld([nat(7, 'hearts'), nat(7, 'diamonds'), nat(7, 'clubs')], 'set');
    const colors = out.map(cardColor);
    expect(colors).toEqual(['red', 'black', 'red']);
  });

  it('centers the odd-color-out (two black, one red -> B-R-B)', () => {
    const out = layoutMeld([nat(7, 'clubs'), nat(7, 'spades'), nat(7, 'hearts')], 'set');
    expect(out.map(cardColor)).toEqual(['black', 'red', 'black']);
  });

  it('alternates a 4-set as R-B-R-B', () => {
    const out = layoutMeld([nat(7, 'hearts'), nat(7, 'diamonds'), nat(7, 'clubs'), nat(7, 'spades')], 'set');
    const colors = out.map(cardColor);
    expect(colors[0]).not.toBe(colors[1]);
    expect(colors[1]).not.toBe(colors[2]);
    expect(colors[2]).not.toBe(colors[3]);
  });

  it('leaves runs in given order', () => {
    const run = [nat(4, 'hearts'), nat(5, 'hearts'), nat(6, 'hearts')];
    expect(layoutMeld(run, 'run').map((c) => c.id)).toEqual(run.map((c) => c.id));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/kalooki/__tests__/layout.test.ts`
Expected: FAIL — `layoutMeld` undefined.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/kalooki/layout.ts
import { Card, cardColor } from './cards';
import type { MeldKind } from './melds';

export function layoutMeld(cards: Card[], kind: MeldKind): Card[] {
  if (kind === 'run') return cards.slice();

  const jokers = cards.filter((c) => c.kind === 'joker');
  const reds = cards.filter((c) => c.kind === 'natural' && cardColor(c) === 'red');
  const blacks = cards.filter((c) => c.kind === 'natural' && cardColor(c) === 'black');

  // Majority color anchors the ends; minority sits centered; jokers fill remaining slots.
  const [maj, min] = reds.length >= blacks.length ? [reds, blacks] : [blacks, reds];
  const n = cards.length;
  const slots: (Card | null)[] = new Array(n).fill(null);

  // Place majority on even indices (0,2,4...), minority on odd indices (1,3...).
  const evens = [...Array(n).keys()].filter((i) => i % 2 === 0);
  const odds = [...Array(n).keys()].filter((i) => i % 2 === 1);
  const majQ = maj.slice();
  const minQ = min.slice();
  for (const i of evens) if (majQ.length) slots[i] = majQ.shift()!;
  for (const i of odds) if (minQ.length) slots[i] = minQ.shift()!;

  // Any leftover naturals (color imbalance) and jokers fill remaining nulls, center-out.
  const leftovers: Card[] = [...majQ, ...minQ, ...jokers];
  const order = [...Array(n).keys()].sort(
    (a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2),
  );
  for (const i of order) {
    if (slots[i] === null && leftovers.length) slots[i] = leftovers.shift()!;
  }
  return slots.filter((c): c is Card => c !== null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/kalooki/__tests__/layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/kalooki/layout.ts lib/kalooki/__tests__/layout.test.ts
git commit -m "feat(kalooki): meld layout discipline"
```

---

## Task 5: State types, deal & setup

**Files:**
- Create: `lib/kalooki/state.ts`
- Test: `lib/kalooki/__tests__/state.test.ts`

**Interfaces:**
- Consumes: `Card, makeDeck, shuffle` from `cards.ts`; RNG from `rng.ts`.
- Produces:
  - `type Phase = 'awaitingDraw' | 'awaitingDiscard'`
  - `interface TableMeld { id: string; kind: MeldKind; ownerSeat: number; cards: Card[] }`
  - `interface PlayerState { seat: number; hand: Card[]; hasOpened: boolean; score: number; status: 'active' | 'busted' | 'left'; rebought: boolean }`
  - `interface RoundState { players: PlayerState[]; stock: Card[]; discard: Card[]; turn: number; dealerSeat: number; phase: Phase; drawObligation: Card | null; addedToOpponentThisTurn: boolean; finished: boolean; winnerSeat: number | null; goOutType: 'normal' | 'kalooki' | 'treasure' | null }`
  - `interface MatchState { seats: number; pot: number; treasureUsed: boolean; scores: number[]; statuses: ('active' | 'busted' | 'left')[]; rebought: boolean[]; round: RoundState; roundNumber: number; finished: boolean; winnerSeat: number | null }`
  - `function dealRound(opts: { seats: number; dealerSeat: number; rng: () => number; carryScores?: number[] }): RoundState` — deals 13 each, sets stock + discard. If the flipped discard is a joker, it is reshuffled into the stock at a random position and the next stock card is flipped instead (per spec interpretation #3; the first player still gets the *option* dynamic later in actions — here we only guarantee the initial discard is a non-joker unless the stock is all jokers, which is impossible). **Correction:** the spec says the *first player* is offered the joker; model this by leaving the joker as the discard and letting `applyAction` handle the offer. For setup, simply leave whatever is flipped; joker handling lives in Task 6.
  - `function startMatch(opts: { seats: number; seed: number }): MatchState`

**Note on the joker-first-discard rule:** setup leaves the flipped card as-is (even if a joker). The "offer then reshuffle into stock" behavior is a *draw-phase* concern and is implemented in Task 6, because it depends on whether the first player can/chooses to use it.

- [ ] **Step 1: Write the failing test**

```ts
// lib/kalooki/__tests__/state.test.ts
import { describe, it, expect } from 'vitest';
import { startMatch, dealRound } from '../state';
import { makeRng } from '../rng';

describe('dealRound', () => {
  it('deals 13 to each seat and seeds stock + discard', () => {
    const r = dealRound({ seats: 4, dealerSeat: 0, rng: makeRng(1) });
    expect(r.players).toHaveLength(4);
    for (const p of r.players) expect(p.hand).toHaveLength(13);
    expect(r.discard).toHaveLength(1);
    // 106 - 4*13 - 1 discard = 53 in stock
    expect(r.stock).toHaveLength(53);
    expect(r.phase).toBe('awaitingDraw');
    expect(r.turn).toBe(1); // eldest hand = left of dealer
  });

  it('no card is lost or duplicated across all zones', () => {
    const r = dealRound({ seats: 2, dealerSeat: 0, rng: makeRng(9) });
    const all = [...r.stock, ...r.discard, ...r.players.flatMap((p) => p.hand)];
    expect(all).toHaveLength(106);
    expect(new Set(all.map((c) => c.id)).size).toBe(106);
  });
});

describe('startMatch', () => {
  it('sets buy-in pot to 4 * seats and zero scores', () => {
    const m = startMatch({ seats: 3, seed: 5 });
    expect(m.pot).toBe(12);
    expect(m.scores).toEqual([0, 0, 0]);
    expect(m.treasureUsed).toBe(false);
    expect(m.round.players).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/kalooki/__tests__/state.test.ts`
Expected: FAIL — module/functions undefined.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/kalooki/state.ts
import { Card, makeDeck } from './cards';
import { makeRng, shuffle } from './rng';
import type { MeldKind } from './melds';

export type Phase = 'awaitingDraw' | 'awaitingDiscard';
export type SeatStatus = 'active' | 'busted' | 'left';
export type GoOutType = 'normal' | 'kalooki' | 'treasure';

export interface TableMeld { id: string; kind: MeldKind; ownerSeat: number; cards: Card[] }
export interface PlayerState {
  seat: number; hand: Card[]; hasOpened: boolean;
}
export interface RoundState {
  players: PlayerState[];
  melds: TableMeld[];
  stock: Card[];
  discard: Card[];
  turn: number;
  dealerSeat: number;
  phase: Phase;
  drawObligation: Card | null;
  addedToOpponentThisTurn: boolean;
  finished: boolean;
  winnerSeat: number | null;
  goOutType: GoOutType | null;
}
export interface MatchState {
  seats: number;
  pot: number;
  treasureUsed: boolean;
  scores: number[];
  statuses: SeatStatus[];
  rebought: boolean[];
  round: RoundState;
  roundNumber: number;
  finished: boolean;
  winnerSeat: number | null;
}

export function dealRound(opts: { seats: number; dealerSeat: number; rng: () => number }): RoundState {
  const deck = shuffle(makeDeck(), opts.rng);
  const players: PlayerState[] = [];
  let idx = 0;
  for (let s = 0; s < opts.seats; s++) {
    players.push({ seat: s, hand: deck.slice(idx, idx + 13), hasOpened: false });
    idx += 13;
  }
  const discard = [deck[idx]]; idx += 1;
  const stock = deck.slice(idx);
  return {
    players, melds: [], stock, discard,
    turn: (opts.dealerSeat + 1) % opts.seats,
    dealerSeat: opts.dealerSeat,
    phase: 'awaitingDraw', drawObligation: null, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
  };
}

export function startMatch(opts: { seats: number; seed: number }): MatchState {
  const rng = makeRng(opts.seed);
  return {
    seats: opts.seats,
    pot: opts.seats * 4,
    treasureUsed: false,
    scores: new Array(opts.seats).fill(0),
    statuses: new Array(opts.seats).fill('active'),
    rebought: new Array(opts.seats).fill(false),
    round: dealRound({ seats: opts.seats, dealerSeat: 0, rng }),
    roundNumber: 1,
    finished: false,
    winnerSeat: null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/kalooki/__tests__/state.test.ts`
Expected: PASS. (Note: `PlayerState` in the test only reads `.hand`/`.seat`; scores/status live on `MatchState`.)

- [ ] **Step 5: Commit**

```bash
git add lib/kalooki/state.ts lib/kalooki/__tests__/state.test.ts
git commit -m "feat(kalooki): game/match state types, deal and setup"
```

---

## Task 6: Actions — draw (stock, discard, joker-first-discard)

**Files:**
- Create: `lib/kalooki/actions.ts`
- Test: `lib/kalooki/__tests__/actions-draw.test.ts`

**Interfaces:**
- Consumes: `RoundState, MatchState` from `state.ts`; `Card` from `cards.ts`; RNG.
- Produces:
  - `type Action = { type: 'draw'; source: 'stock' | 'discard' } | { type: 'drawJokerDecline' } | { type: 'meld'; groups: { kind: MeldKind; cardIds: string[] }[] } | { type: 'layoff'; cardId: string; meldId: string } | { type: 'replaceJoker'; meldId: string; jokerId: string; naturalCardId: string; newMeld: { kind: MeldKind; cardIds: string[] } } | { type: 'discard'; cardId: string }`
  - `interface Ok { ok: true; match: MatchState }`
  - `interface Err { ok: false; reason: string }`
  - `type ActionResult = Ok | Err`
  - `function applyAction(match: MatchState, seat: number, action: Action, rng: () => number): ActionResult`

**Draw rules implemented here:**
- Must be the acting seat's turn and phase `awaitingDraw`; otherwise reject.
- `draw` from `stock`: move top stock card to hand; if stock empty first, reshuffle discard (except top) into stock using `rng`; phase → `awaitingDiscard`; no obligation.
- `draw` from `discard`: only allowed if the resulting play can use the card in a **new meld** this turn — enforced by setting `drawObligation = card`; move discard top to hand; phase → `awaitingDiscard`. (The obligation is *discharged* by the `meld` handler in Task 7; `discard`/end-of-turn checks in Task 10 reject if the obligation card was never melded.)
- Joker-first-discard offer: only on the very first draw of the round (round has no melds yet, no prior turns taken) when `discard` top is a joker. The first player may `draw` `discard` (taking the joker under obligation), or `drawJokerDecline` — which reshuffles the joker into the stock at a random position (via `rng`), flips nothing new to discard (discard becomes empty), and forces a stock draw in the same action. Model `drawJokerDecline`: remove joker from discard, insert into stock at `floor(rng()*stock.length)`, then draw top of stock to hand, phase → `awaitingDiscard`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/kalooki/__tests__/actions-draw.test.ts
import { describe, it, expect } from 'vitest';
import { startMatch } from '../state';
import { applyAction } from '../actions';
import { makeRng } from '../rng';

describe('draw', () => {
  it('draws from stock and advances to awaitingDiscard', () => {
    const m = startMatch({ seats: 2, seed: 3 });
    const seat = m.round.turn;
    const before = m.round.players[seat].hand.length;
    const r = applyAction(m, seat, { type: 'draw', source: 'stock' }, makeRng(1));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.players[seat].hand.length).toBe(before + 1);
      expect(r.match.round.phase).toBe('awaitingDiscard');
    }
  });

  it('rejects a draw when it is not your turn', () => {
    const m = startMatch({ seats: 2, seed: 3 });
    const notTurn = (m.round.turn + 1) % 2;
    const r = applyAction(m, notTurn, { type: 'draw', source: 'stock' }, makeRng(1));
    expect(r.ok).toBe(false);
  });

  it('rejects drawing again after already drawing', () => {
    const m = startMatch({ seats: 2, seed: 3 });
    const seat = m.round.turn;
    const r1 = applyAction(m, seat, { type: 'draw', source: 'stock' }, makeRng(1));
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      const r2 = applyAction(r1.match, seat, { type: 'draw', source: 'stock' }, makeRng(1));
      expect(r2.ok).toBe(false);
    }
  });

  it('taking the discard sets a draw obligation', () => {
    const m = startMatch({ seats: 2, seed: 3 });
    const seat = m.round.turn;
    // Force a known non-joker discard for determinism of intent:
    const top = m.round.discard[m.round.discard.length - 1];
    const r = applyAction(m, seat, { type: 'draw', source: 'discard' }, makeRng(1));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.drawObligation?.id).toBe(top.id);
      expect(r.match.round.players[seat].hand.map((c) => c.id)).toContain(top.id);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/kalooki/__tests__/actions-draw.test.ts`
Expected: FAIL — `applyAction` undefined.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/kalooki/actions.ts
import { Card } from './cards';
import { MatchState, RoundState } from './state';
import type { MeldKind } from './melds';
import { shuffle } from './rng';

export type Action =
  | { type: 'draw'; source: 'stock' | 'discard' }
  | { type: 'drawJokerDecline' }
  | { type: 'meld'; groups: { kind: MeldKind; cardIds: string[] }[] }
  | { type: 'layoff'; cardId: string; meldId: string }
  | { type: 'replaceJoker'; meldId: string; jokerId: string; naturalCardId: string; newMeld: { kind: MeldKind; cardIds: string[] } }
  | { type: 'discard'; cardId: string };

export interface Ok { ok: true; match: MatchState }
export interface Err { ok: false; reason: string }
export type ActionResult = Ok | Err;

// Shallow-clone helpers keep inputs immutable.
const cloneRound = (r: RoundState): RoundState => ({
  ...r,
  players: r.players.map((p) => ({ ...p, hand: p.hand.slice() })),
  melds: r.melds.map((m) => ({ ...m, cards: m.cards.slice() })),
  stock: r.stock.slice(),
  discard: r.discard.slice(),
});
const withRound = (m: MatchState, round: RoundState): MatchState => ({ ...m, round });

function ensureStock(round: RoundState, rng: () => number): void {
  if (round.stock.length === 0 && round.discard.length > 1) {
    const top = round.discard.pop()!;
    round.stock = shuffle(round.discard, rng);
    round.discard = [top];
  }
}

export function applyAction(match: MatchState, seat: number, action: Action, rng: () => number): ActionResult {
  const round = match.round;
  if (round.finished) return { ok: false, reason: 'Round is over.' };
  if (seat !== round.turn) return { ok: false, reason: 'Not your turn.' };

  switch (action.type) {
    case 'draw': {
      if (round.phase !== 'awaitingDraw') return { ok: false, reason: 'You have already drawn.' };
      const next = cloneRound(round);
      if (action.source === 'stock') {
        ensureStock(next, rng);
        if (next.stock.length === 0) return { ok: false, reason: 'Stock is empty.' };
        next.players[seat].hand.push(next.stock.shift()!);
        next.phase = 'awaitingDiscard';
        return { ok: true, match: withRound(match, next) };
      } else {
        if (next.discard.length === 0) return { ok: false, reason: 'Discard pile is empty.' };
        const card = next.discard.pop()!;
        next.players[seat].hand.push(card);
        next.drawObligation = card;
        next.phase = 'awaitingDiscard';
        return { ok: true, match: withRound(match, next) };
      }
    }
    case 'drawJokerDecline': {
      if (round.phase !== 'awaitingDraw') return { ok: false, reason: 'You have already drawn.' };
      const top = round.discard[round.discard.length - 1];
      if (!top || top.kind !== 'joker') return { ok: false, reason: 'Top of discard is not a joker.' };
      const next = cloneRound(round);
      next.discard.pop();
      const pos = Math.floor(rng() * (next.stock.length + 1));
      next.stock.splice(pos, 0, top);
      next.players[seat].hand.push(next.stock.shift()!);
      next.phase = 'awaitingDiscard';
      return { ok: true, match: withRound(match, next) };
    }
    default:
      return { ok: false, reason: 'Action not handled yet.' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/kalooki/__tests__/actions-draw.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/kalooki/actions.ts lib/kalooki/__tests__/actions-draw.test.ts
git commit -m "feat(kalooki): draw action (stock, discard, joker decline)"
```

---

## Task 7: Actions — meld & the 40-point opening gate

**Files:**
- Modify: `lib/kalooki/actions.ts`
- Test: `lib/kalooki/__tests__/actions-meld.test.ts`

**Interfaces:**
- Consumes: `validateMeld` from `melds.ts`; `Action` from Task 6.
- Produces: `meld` handling inside `applyAction`. Behavior:
  - Only in phase `awaitingDiscard` (i.e. after drawing) and on your turn.
  - Each group in `action.groups` must reference cards currently in the player's hand (by id), validate via `validateMeld`, and the referenced ids must be disjoint across groups.
  - **Opening gate:** if `player.hasOpened` is false, the *sum of points of all groups laid this turn* must be ≥ 40; if it is, set `hasOpened = true`. If < 40, reject (can't partially open).
  - If a `drawObligation` is set, at least one group must include the obligation card's id; else reject. Clear the obligation once satisfied.
  - On success: remove melded cards from hand, append `TableMeld`s (ids like `m${roundNumber}-${seq}`), keep phase `awaitingDiscard` (player still owes a discard unless they've emptied their hand — go-out handled in Task 10).

- [ ] **Step 1: Write the failing test**

```ts
// lib/kalooki/__tests__/actions-meld.test.ts
import { describe, it, expect } from 'vitest';
import { applyAction } from '../actions';
import type { MatchState } from '../state';
import type { Card } from '../cards';

// Build a controlled match state by hand for deterministic melding.
function fixture(hand: Card[]): MatchState {
  const round = {
    players: [{ seat: 0, hand, hasOpened: false }, { seat: 1, hand: [], hasOpened: false }],
    melds: [], stock: [{ id: 'S1', kind: 'natural', rank: 2, suit: 'clubs', pack: 'A' } as Card],
    discard: [], turn: 0, dealerSeat: 1, phase: 'awaitingDiscard' as const,
    drawObligation: null, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
  };
  return {
    seats: 2, pot: 8, treasureUsed: false, scores: [0, 0],
    statuses: ['active', 'active'], rebought: [false, false],
    round, roundNumber: 1, finished: false, winnerSeat: null,
  };
}
const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });

describe('meld / opening gate', () => {
  it('rejects opening below 40 points', () => {
    const hand = [nat(3, 'clubs'), nat(3, 'hearts'), nat(3, 'spades')]; // 9 pts
    const m = fixture(hand);
    const r = applyAction(m, 0, { type: 'meld', groups: [{ kind: 'set', cardIds: hand.map((c) => c.id) }] }, () => 0.5);
    expect(r.ok).toBe(false);
  });

  it('opens with 40+ across multiple melds in one turn', () => {
    const setK = [nat(13, 'clubs'), nat(13, 'hearts'), nat(13, 'spades')]; // 30
    const run = [nat(4, 'diamonds'), nat(5, 'diamonds'), nat(6, 'diamonds')]; // 15 => 45 total
    const hand = [...setK, ...run];
    const m = fixture(hand);
    const r = applyAction(m, 0, {
      type: 'meld',
      groups: [
        { kind: 'set', cardIds: setK.map((c) => c.id) },
        { kind: 'run', cardIds: run.map((c) => c.id) },
      ],
    }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.players[0].hasOpened).toBe(true);
      expect(r.match.round.melds).toHaveLength(2);
      expect(r.match.round.players[0].hand).toHaveLength(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/kalooki/__tests__/actions-meld.test.ts`
Expected: FAIL — meld returns "not handled yet".

- [ ] **Step 3: Write minimal implementation**

```ts
// in lib/kalooki/actions.ts: add import and a case
// import { validateMeld } from './melds';

// inside the switch, replace default handling for 'meld':
case 'meld': {
  if (round.phase !== 'awaitingDiscard') return { ok: false, reason: 'Draw before melding.' };
  const next = cloneRound(round);
  const player = next.players[seat];
  const handById = new Map(player.hand.map((c) => [c.id, c] as const));
  const usedIds = new Set<string>();
  const built: { kind: MeldKind; cards: Card[]; points: number }[] = [];
  for (const g of action.groups) {
    const cards: Card[] = [];
    for (const id of g.cardIds) {
      if (usedIds.has(id)) return { ok: false, reason: 'A card was used in two melds.' };
      const c = handById.get(id);
      if (!c) return { ok: false, reason: 'Card not in hand.' };
      usedIds.add(id);
      cards.push(c);
    }
    const v = validateMeld(cards, g.kind);
    if (!v.valid) return { ok: false, reason: v.reason };
    built.push({ kind: g.kind, cards, points: v.points });
  }
  const total = built.reduce((s, b) => s + b.points, 0);
  if (!player.hasOpened && total < 40) return { ok: false, reason: 'Opening meld must be at least 40 points.' };

  if (next.drawObligation) {
    if (!usedIds.has(next.drawObligation.id)) return { ok: false, reason: 'The card taken from the discard must be used in a new meld this turn.' };
    next.drawObligation = null;
  }

  player.hand = player.hand.filter((c) => !usedIds.has(c.id));
  let seq = next.melds.length;
  for (const b of built) {
    next.melds.push({ id: `m${match.roundNumber}-${seq++}`, kind: b.kind, ownerSeat: seat, cards: b.cards });
  }
  if (!player.hasOpened) player.hasOpened = true;
  return { ok: true, match: withRound(match, next) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/kalooki/__tests__/actions-meld.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/kalooki/actions.ts lib/kalooki/__tests__/actions-meld.test.ts
git commit -m "feat(kalooki): meld action and 40-point opening gate"
```

---

## Task 8: Actions — lay off onto existing melds

**Files:**
- Modify: `lib/kalooki/actions.ts`
- Test: `lib/kalooki/__tests__/actions-layoff.test.ts`

**Interfaces:**
- Consumes: `validateMeld`.
- Produces: `layoff` handling. Behavior:
  - Phase `awaitingDiscard`, your turn, and `player.hasOpened === true` (else reject).
  - The laid-off card must be in hand and must NOT be the `drawObligation` card (a discard-drawn card can only go into a *new* meld).
  - Adding the card to the target meld's cards must still `validateMeld` as the same kind. For sets, reject if the target is already 4 cards (closed). Insert the card and re-validate; on success move the card from hand to the meld.
  - Track `addedToOpponentThisTurn = true` if `meld.ownerSeat !== seat` (needed for Treasure detection).

- [ ] **Step 1: Write the failing test**

```ts
// lib/kalooki/__tests__/actions-layoff.test.ts
import { describe, it, expect } from 'vitest';
import { applyAction } from '../actions';
import type { MatchState } from '../state';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });

function fixtureWithMeld(): MatchState {
  const run = [nat(4, 'hearts'), nat(5, 'hearts'), nat(6, 'hearts')];
  const round = {
    players: [{ seat: 0, hand: [nat(7, 'hearts')], hasOpened: true }, { seat: 1, hand: [], hasOpened: true }],
    melds: [{ id: 'm1-0', kind: 'run' as const, ownerSeat: 0, cards: run }],
    stock: [nat(2, 'clubs')], discard: [], turn: 0, dealerSeat: 1,
    phase: 'awaitingDiscard' as const, drawObligation: null, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
  };
  return { seats: 2, pot: 8, treasureUsed: false, scores: [0, 0], statuses: ['active', 'active'],
    rebought: [false, false], round, roundNumber: 1, finished: false, winnerSeat: null };
}

describe('layoff', () => {
  it('extends a run with a valid card', () => {
    const m = fixtureWithMeld();
    const r = applyAction(m, 0, { type: 'layoff', cardId: 'A-hearts-7', meldId: 'm1-0' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.melds[0].cards).toHaveLength(4);
      expect(r.match.round.players[0].hand).toHaveLength(0);
    }
  });

  it('rejects layoff before opening', () => {
    const m = fixtureWithMeld();
    m.round.players[0].hasOpened = false;
    const r = applyAction(m, 0, { type: 'layoff', cardId: 'A-hearts-7', meldId: 'm1-0' }, () => 0.5);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/kalooki/__tests__/actions-layoff.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```ts
// add case 'layoff' inside applyAction's switch:
case 'layoff': {
  if (round.phase !== 'awaitingDiscard') return { ok: false, reason: 'Draw before laying off.' };
  const player = round.players[seat];
  if (!player.hasOpened) return { ok: false, reason: 'You must open before laying off.' };
  if (round.drawObligation && round.drawObligation.id === action.cardId)
    return { ok: false, reason: 'A card taken from the discard must go into a new meld.' };
  const card = player.hand.find((c) => c.id === action.cardId);
  if (!card) return { ok: false, reason: 'Card not in hand.' };
  const meld = round.melds.find((m) => m.id === action.meldId);
  if (!meld) return { ok: false, reason: 'Meld not found.' };
  if (meld.kind === 'set' && meld.cards.length >= 4) return { ok: false, reason: 'That set is closed.' };

  const next = cloneRound(round);
  const nMeld = next.melds.find((m) => m.id === action.meldId)!;
  const candidate = [...nMeld.cards, card];
  // Runs: re-sort by resolved rank is non-trivial with jokers; require caller to append at an end.
  const v = validateMeld(candidate, nMeld.kind);
  if (!v.valid) {
    // try prepending for runs
    const v2 = validateMeld([card, ...nMeld.cards], nMeld.kind);
    if (!v2.valid) return { ok: false, reason: v.reason };
    nMeld.cards = [card, ...nMeld.cards];
  } else {
    nMeld.cards = candidate;
  }
  next.players[seat].hand = next.players[seat].hand.filter((c) => c.id !== action.cardId);
  if (nMeld.ownerSeat !== seat) next.addedToOpponentThisTurn = true;
  return { ok: true, match: withRound(match, next) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/kalooki/__tests__/actions-layoff.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/kalooki/actions.ts lib/kalooki/__tests__/actions-layoff.test.ts
git commit -m "feat(kalooki): lay off onto existing melds"
```

---

## Task 9: Actions — replace a joker

**Files:**
- Modify: `lib/kalooki/actions.ts`
- Test: `lib/kalooki/__tests__/actions-replace-joker.test.ts`

**Interfaces:**
- Consumes: `validateMeld`.
- Produces: `replaceJoker` handling. Behavior:
  - Phase `awaitingDiscard`, your turn, `player.hasOpened === true`.
  - Target meld must contain the joker id and must not be a closed 4-card set.
  - The `naturalCardId` must be in hand. Replacing must keep the meld valid:
    - **Run:** the natural must be the exact card the joker represents (same suit, same slot rank). Re-validate meld with the natural swapped in.
    - **Set (of 3):** the natural must be the set's rank in a suit not already present. Re-validate.
  - On success: swap natural into the meld, remove it from hand, and the freed joker goes to hand **but the player must immediately meld it** — enforce by requiring `action.newMeld` that includes the joker id and validates (and, if not yet counted, does not need to meet 40 since player already opened). Remove newMeld cards (incl. joker + any other hand cards) from hand, append the new `TableMeld`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/kalooki/__tests__/actions-replace-joker.test.ts
import { describe, it, expect } from 'vitest';
import { applyAction } from '../actions';
import type { MatchState } from '../state';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });
const joker = (pack = 'A'): Card => ({ id: `${pack}-joker`, kind: 'joker', pack: pack as any });

function fixture(): MatchState {
  // Table run 4h-[joker as 5h]-6h owned by seat 1. Seat 0 holds the natural 5h
  // plus two more hearts (3h,7h... actually 5h natural + a fresh meld 9c/9d/9h to re-home joker).
  const tableRun = [nat(4, 'hearts', 'B'), joker('A'), nat(6, 'hearts', 'B')];
  const hand = [nat(5, 'hearts'), nat(9, 'clubs'), nat(9, 'diamonds')];
  const round = {
    players: [{ seat: 0, hand, hasOpened: true }, { seat: 1, hand: [], hasOpened: true }],
    melds: [{ id: 'm1-0', kind: 'run' as const, ownerSeat: 1, cards: tableRun }],
    stock: [nat(2, 'clubs')], discard: [], turn: 0, dealerSeat: 1,
    phase: 'awaitingDiscard' as const, drawObligation: null, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
  };
  return { seats: 2, pot: 8, treasureUsed: false, scores: [0, 0], statuses: ['active', 'active'],
    rebought: [false, false], round, roundNumber: 1, finished: false, winnerSeat: null };
}

describe('replaceJoker (run)', () => {
  it('swaps the natural in and re-melds the freed joker', () => {
    const m = fixture();
    const r = applyAction(m, 0, {
      type: 'replaceJoker',
      meldId: 'm1-0', jokerId: 'A-joker', naturalCardId: 'A-hearts-5',
      newMeld: { kind: 'set', cardIds: ['A-joker', 'A-clubs-9', 'A-diamonds-9'] },
    }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const run = r.match.round.melds.find((x) => x.id === 'm1-0')!;
      expect(run.cards.some((c) => c.id === 'A-hearts-5')).toBe(true);
      expect(run.cards.some((c) => c.kind === 'joker')).toBe(false);
      expect(r.match.round.melds.some((x) => x.cards.some((c) => c.id === 'A-joker'))).toBe(true);
    }
  });

  it('rejects if the freed joker is not immediately melded', () => {
    const m = fixture();
    const r = applyAction(m, 0, {
      type: 'replaceJoker', meldId: 'm1-0', jokerId: 'A-joker', naturalCardId: 'A-hearts-5',
      newMeld: { kind: 'set', cardIds: ['A-clubs-9', 'A-diamonds-9'] }, // no joker => invalid
    }, () => 0.5);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/kalooki/__tests__/actions-replace-joker.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```ts
// add case 'replaceJoker' inside applyAction's switch:
case 'replaceJoker': {
  if (round.phase !== 'awaitingDiscard') return { ok: false, reason: 'Draw before replacing a joker.' };
  const player = round.players[seat];
  if (!player.hasOpened) return { ok: false, reason: 'You must open before replacing jokers.' };
  const meld = round.melds.find((m) => m.id === action.meldId);
  if (!meld) return { ok: false, reason: 'Meld not found.' };
  if (meld.kind === 'set' && meld.cards.length >= 4) return { ok: false, reason: 'That set is closed.' };
  const jokerCard = meld.cards.find((c) => c.id === action.jokerId && c.kind === 'joker');
  if (!jokerCard) return { ok: false, reason: 'Joker not in that meld.' };
  const natural = player.hand.find((c) => c.id === action.naturalCardId);
  if (!natural || natural.kind !== 'natural') return { ok: false, reason: 'Natural card not in hand.' };

  // Build the meld with the natural swapped for the joker; must stay valid.
  const swapped = meld.cards.map((c) => (c.id === action.jokerId ? natural : c));
  const v = validateMeld(swapped, meld.kind);
  if (!v.valid) return { ok: false, reason: 'That card cannot replace the joker here.' };

  // The freed joker must be immediately melded via newMeld (which must include it).
  if (!action.newMeld.cardIds.includes(action.jokerId))
    return { ok: false, reason: 'The freed joker must be used immediately in a new meld.' };

  const next = cloneRound(round);
  const nMeld = next.melds.find((m) => m.id === action.meldId)!;
  nMeld.cards = nMeld.cards.map((c) => (c.id === action.jokerId ? natural : c));
  // remove natural from hand, add joker to a temporary pool for the new meld
  next.players[seat].hand = next.players[seat].hand.filter((c) => c.id !== action.naturalCardId);
  const pool = new Map<string, Card>([[jokerCard.id, jokerCard], ...next.players[seat].hand.map((c) => [c.id, c] as const)]);
  const newCards: Card[] = [];
  const used = new Set<string>();
  for (const id of action.newMeld.cardIds) {
    const c = pool.get(id);
    if (!c || used.has(id)) return { ok: false, reason: 'Invalid card in new meld.' };
    used.add(id); newCards.push(c);
  }
  const nv = validateMeld(newCards, action.newMeld.kind);
  if (!nv.valid) return { ok: false, reason: nv.reason };
  next.players[seat].hand = next.players[seat].hand.filter((c) => !used.has(c.id));
  next.melds.push({ id: `m${match.roundNumber}-${next.melds.length}`, kind: action.newMeld.kind, ownerSeat: seat, cards: newCards });
  return { ok: true, match: withRound(match, next) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/kalooki/__tests__/actions-replace-joker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/kalooki/actions.ts lib/kalooki/__tests__/actions-replace-joker.test.ts
git commit -m "feat(kalooki): joker replacement with immediate re-meld"
```

---

## Task 10: Actions — discard, go-out, Kalooki/Treasure

**Files:**
- Modify: `lib/kalooki/actions.ts`
- Test: `lib/kalooki/__tests__/actions-discard.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `discard` handling and turn advance + round end detection. Behavior:
  - Phase `awaitingDiscard`, your turn. Reject if `drawObligation` is still unmet.
  - Card must be in hand; move it to top of discard.
  - **Go-out:** if the player's hand is now empty, the round ends: set `finished = true`, `winnerSeat = seat`. Determine `goOutType`:
    - `kalooki` if the player laid all 13 in a single turn (tracked via a `wentDownAllThisTurn` flag — see note) — for v1, approximate: kalooki if the player had not opened before this turn but emptied the hand this turn. `treasure` if kalooki AND `addedToOpponentThisTurn === false` AND `match.treasureUsed === false`; then set `treasureUsed = true`. Otherwise `normal`.
  - If not going out: advance `turn` to next active seat, reset per-turn flags (`phase='awaitingDraw'`, `drawObligation=null`, `addedToOpponentThisTurn=false`).

**Kalooki-tracking note:** add a round field `openedThisTurnFromZero: boolean` set when a player opens while `hand` had 13 cards at turn start. To keep this task self-contained, track a simpler signal: record `handSizeAtTurnStart` on the round at draw time (Task 6 addition). If not present, default kalooki detection to `false` and refine in a follow-up. For this task, implement: `goOutType='normal'` unless the player emptied their entire 13-card hand in one turn — detect via a new round field `cardsPlayedFromHandThisTurn` incremented by meld/layoff/replace and compared to 13.

To avoid retrofitting many handlers, this task adds a minimal counter: set `round.turnStartHandSize` in the `draw`/`drawJokerDecline` handlers (edit Task 6 code) to the player's hand size *before* the draw. Kalooki = went out this turn AND `turnStartHandSize === 13` AND player was not opened at turn start. Add an `openedAtTurnStart` snapshot similarly.

- [ ] **Step 1: Write the failing test**

```ts
// lib/kalooki/__tests__/actions-discard.test.ts
import { describe, it, expect } from 'vitest';
import { applyAction } from '../actions';
import type { MatchState } from '../state';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });

function fixture(hand: Card[]): MatchState {
  const round = {
    players: [{ seat: 0, hand, hasOpened: true }, { seat: 1, hand: [nat(2, 'clubs')], hasOpened: false }],
    melds: [], stock: [nat(3, 'clubs')], discard: [nat(4, 'clubs')], turn: 0, dealerSeat: 1,
    phase: 'awaitingDiscard' as const, drawObligation: null, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
    turnStartHandSize: 2, openedAtTurnStart: true,
  };
  return { seats: 2, pot: 8, treasureUsed: false, scores: [0, 0], statuses: ['active', 'active'],
    rebought: [false, false], round: round as any, roundNumber: 1, finished: false, winnerSeat: null };
}

describe('discard & go-out', () => {
  it('discards and advances the turn when hand remains', () => {
    const m = fixture([nat(5, 'clubs'), nat(6, 'clubs')]);
    const r = applyAction(m, 0, { type: 'discard', cardId: 'A-clubs-5' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.turn).toBe(1);
      expect(r.match.round.phase).toBe('awaitingDraw');
      expect(r.match.round.discard[r.match.round.discard.length - 1].id).toBe('A-clubs-5');
    }
  });

  it('ends the round when discarding empties the hand', () => {
    const m = fixture([nat(5, 'clubs')]);
    const r = applyAction(m, 0, { type: 'discard', cardId: 'A-clubs-5' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.finished).toBe(true);
      expect(r.match.round.winnerSeat).toBe(0);
      expect(r.match.round.goOutType).toBe('normal');
    }
  });

  it('rejects discarding while a draw obligation is unmet', () => {
    const m = fixture([nat(5, 'clubs'), nat(6, 'clubs')]);
    (m.round as any).drawObligation = nat(6, 'clubs');
    const r = applyAction(m, 0, { type: 'discard', cardId: 'A-clubs-5' }, () => 0.5);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/kalooki/__tests__/actions-discard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

First, extend the `RoundState` in `state.ts` with optional tracking fields:

```ts
// add to RoundState in state.ts
  turnStartHandSize?: number;
  openedAtTurnStart?: boolean;
```

In Task 6's `draw` and `drawJokerDecline` handlers, before mutating, set:

```ts
// at the top of each draw handler, after cloning:
next.turnStartHandSize = round.players[seat].hand.length;
next.openedAtTurnStart = round.players[seat].hasOpened;
```

Then add the discard case:

```ts
// add case 'discard' inside applyAction's switch:
case 'discard': {
  if (round.phase !== 'awaitingDiscard') return { ok: false, reason: 'You must draw first.' };
  if (round.drawObligation) return { ok: false, reason: 'The card taken from the discard must be melded this turn.' };
  const player = round.players[seat];
  const card = player.hand.find((c) => c.id === action.cardId);
  if (!card) return { ok: false, reason: 'Card not in hand.' };

  const next = cloneRound(round);
  next.players[seat].hand = next.players[seat].hand.filter((c) => c.id !== action.cardId);
  next.discard.push(card);

  if (next.players[seat].hand.length === 0) {
    next.finished = true;
    next.winnerSeat = seat;
    const kalooki = round.turnStartHandSize === 13 && round.openedAtTurnStart === false;
    let type: 'normal' | 'kalooki' | 'treasure' = 'normal';
    let out = withRound(match, next);
    if (kalooki) {
      if (!match.treasureUsed && !next.addedToOpponentThisTurn) {
        type = 'treasure';
        out = { ...out, treasureUsed: true };
      } else {
        type = 'kalooki';
      }
    }
    next.goOutType = type;
    return { ok: true, match: { ...out, round: next } };
  }

  // advance to next active seat
  let t = (seat + 1) % match.seats;
  while (match.statuses[t] !== 'active') t = (t + 1) % match.seats;
  next.turn = t;
  next.phase = 'awaitingDraw';
  next.drawObligation = null;
  next.addedToOpponentThisTurn = false;
  return { ok: true, match: withRound(match, next) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/kalooki/__tests__/actions-discard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/kalooki/actions.ts lib/kalooki/state.ts lib/kalooki/__tests__/actions-discard.test.ts
git commit -m "feat(kalooki): discard, go-out, Kalooki/Treasure detection"
```

---

## Task 11: Scoring — round end & bit payments

**Files:**
- Create: `lib/kalooki/scoring.ts`
- Test: `lib/kalooki/__tests__/scoring-round.test.ts`

**Interfaces:**
- Consumes: `Card, meldPoints` from `cards.ts`; `MatchState` from `state.ts`.
- Produces:
  - `function handScore(hand: Card[]): number` — number=pip, court=10, Ace=11, **joker=15**.
  - `function settleRound(match: MatchState): MatchState` — requires `match.round.finished`. For each active seat: winner scores +0; others add `handScore(hand)` to `match.scores[seat]`. Bit payments into pot: each loser pays 1 (normal) / 2 (kalooki) / 4 (treasure) based on `round.goOutType`. Returns a new `MatchState` with updated `scores` and `pot`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/kalooki/__tests__/scoring-round.test.ts
import { describe, it, expect } from 'vitest';
import { handScore, settleRound } from '../scoring';
import type { MatchState } from '../state';
import type { Card } from '../cards';

const nat = (rank: number, suit: string): Card =>
  ({ id: `A-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: 'A' });
const joker = (): Card => ({ id: 'A-joker', kind: 'joker', pack: 'A' });

describe('handScore', () => {
  it('scores pips, courts=10, ace=11, joker=15', () => {
    expect(handScore([nat(5, 'clubs'), nat(12, 'hearts'), nat(14, 'spades'), joker()])).toBe(5 + 10 + 11 + 15);
  });
});

describe('settleRound', () => {
  it('winner gets 0, losers add hand points, losers pay bits (normal=1)', () => {
    const round: any = {
      players: [
        { seat: 0, hand: [], hasOpened: true },
        { seat: 1, hand: [nat(9, 'clubs'), nat(10, 'clubs')], hasOpened: false },
      ],
      melds: [], stock: [], discard: [], turn: 0, dealerSeat: 1, phase: 'awaitingDraw',
      drawObligation: null, addedToOpponentThisTurn: false,
      finished: true, winnerSeat: 0, goOutType: 'normal',
    };
    const m: MatchState = { seats: 2, pot: 8, treasureUsed: false, scores: [0, 0],
      statuses: ['active', 'active'], rebought: [false, false], round, roundNumber: 1,
      finished: false, winnerSeat: null };
    const out = settleRound(m);
    expect(out.scores).toEqual([0, 19]);
    expect(out.pot).toBe(9); // one loser pays 1
  });

  it('kalooki charges 2, treasure charges 4', () => {
    const mk = (type: string, pot: number): MatchState => ({
      seats: 2, pot, treasureUsed: false, scores: [0, 0], statuses: ['active', 'active'],
      rebought: [false, false], roundNumber: 1, finished: false, winnerSeat: null,
      round: { players: [{ seat: 0, hand: [], hasOpened: true }, { seat: 1, hand: [nat(2, 'clubs')], hasOpened: true }],
        melds: [], stock: [], discard: [], turn: 0, dealerSeat: 1, phase: 'awaitingDraw',
        drawObligation: null, addedToOpponentThisTurn: false, finished: true, winnerSeat: 0, goOutType: type } as any,
    });
    expect(settleRound(mk('kalooki', 8)).pot).toBe(10);
    expect(settleRound(mk('treasure', 8)).pot).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/kalooki/__tests__/scoring-round.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/kalooki/scoring.ts
import { Card, meldPoints } from './cards';
import type { MatchState } from './state';

export function handScore(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + (c.kind === 'joker' ? 15 : meldPoints(c.rank)), 0);
}

const BIT_COST: Record<string, number> = { normal: 1, kalooki: 2, treasure: 4 };

export function settleRound(match: MatchState): MatchState {
  const round = match.round;
  if (!round.finished || round.winnerSeat === null) throw new Error('Round not finished.');
  const cost = BIT_COST[round.goOutType ?? 'normal'];
  const scores = match.scores.slice();
  let pot = match.pot;
  for (const p of round.players) {
    if (p.seat === round.winnerSeat) continue;
    if (match.statuses[p.seat] !== 'active') continue;
    scores[p.seat] += handScore(p.hand);
    pot += cost;
  }
  return { ...match, scores, pot };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/kalooki/__tests__/scoring-round.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/kalooki/scoring.ts lib/kalooki/__tests__/scoring-round.test.ts
git commit -m "feat(kalooki): round scoring and bit payments"
```

---

## Task 12: Scoring — match bust, rebuy, winner & pot award

**Files:**
- Modify: `lib/kalooki/scoring.ts`
- Test: `lib/kalooki/__tests__/scoring-match.test.ts`

**Interfaces:**
- Consumes: `MatchState`.
- Produces:
  - `function applyBusts(match: MatchState): MatchState` — mark any active seat with `score > 150` as `status='busted'`.
  - `function rebuy(match: MatchState, seat: number): MatchState` — only if that seat is `busted` and `rebought[seat] === false`; set score to the current **highest** score among still-active seats, `status='active'`, `rebought=true`, `pot += 4`. Throws if illegal.
  - `function matchWinner(match: MatchState): number | null` — if exactly one seat is `active`, return it; else null.
  - `function awardPot(match: MatchState): MatchState` — set `finished=true`, `winnerSeat=matchWinner`. (Pot transfer to the user's bit balance is a persistence concern handled later; engine just records the winner.)

- [ ] **Step 1: Write the failing test**

```ts
// lib/kalooki/__tests__/scoring-match.test.ts
import { describe, it, expect } from 'vitest';
import { applyBusts, rebuy, matchWinner, awardPot } from '../scoring';
import type { MatchState } from '../state';

const base = (scores: number[], statuses: any[], pot = 12, rebought?: boolean[]): MatchState => ({
  seats: scores.length, pot, treasureUsed: false, scores, statuses,
  rebought: rebought ?? scores.map(() => false),
  round: {} as any, roundNumber: 1, finished: false, winnerSeat: null,
});

describe('match end', () => {
  it('busts a player over 150', () => {
    const m = applyBusts(base([160, 40, 90], ['active', 'active', 'active']));
    expect(m.statuses[0]).toBe('busted');
  });

  it('rebuy re-enters at current highest active score and adds 4 to pot', () => {
    const m = rebuy(base([151, 40, 90], ['busted', 'active', 'active'], 12), 0);
    expect(m.scores[0]).toBe(90); // highest active is 90
    expect(m.statuses[0]).toBe('active');
    expect(m.rebought[0]).toBe(true);
    expect(m.pot).toBe(16);
  });

  it('rejects a second rebuy', () => {
    expect(() => rebuy(base([151, 40], ['busted', 'active'], 12, [true, false]), 0)).toThrow();
  });

  it('declares the last active player the winner', () => {
    const m = base([160, 40, 200], ['busted', 'active', 'busted']);
    expect(matchWinner(m)).toBe(1);
    const done = awardPot(m);
    expect(done.finished).toBe(true);
    expect(done.winnerSeat).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/kalooki/__tests__/scoring-match.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to lib/kalooki/scoring.ts
export function applyBusts(match: MatchState): MatchState {
  const statuses = match.statuses.slice();
  for (let s = 0; s < match.seats; s++) {
    if (statuses[s] === 'active' && match.scores[s] > 150) statuses[s] = 'busted';
  }
  return { ...match, statuses };
}

export function rebuy(match: MatchState, seat: number): MatchState {
  if (match.statuses[seat] !== 'busted') throw new Error('Only a busted seat can rebuy.');
  if (match.rebought[seat]) throw new Error('A seat may only rebuy once.');
  const activeScores = match.scores.filter((_, s) => match.statuses[s] === 'active');
  const highest = activeScores.length ? Math.max(...activeScores) : 0;
  const scores = match.scores.slice(); scores[seat] = highest;
  const statuses = match.statuses.slice(); statuses[seat] = 'active';
  const rebought = match.rebought.slice(); rebought[seat] = true;
  return { ...match, scores, statuses, rebought, pot: match.pot + 4 };
}

export function matchWinner(match: MatchState): number | null {
  const active = match.statuses.map((s, i) => (s === 'active' ? i : -1)).filter((i) => i >= 0);
  return active.length === 1 ? active[0] : null;
}

export function awardPot(match: MatchState): MatchState {
  const winner = matchWinner(match);
  return { ...match, finished: winner !== null, winnerSeat: winner };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/kalooki/__tests__/scoring-match.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/kalooki/scoring.ts lib/kalooki/__tests__/scoring-match.test.ts
git commit -m "feat(kalooki): match bust, rebuy, winner and pot award"
```

---

## Task 13: Public API & replay determinism

**Files:**
- Create: `lib/kalooki/index.ts`
- Test: `lib/kalooki/__tests__/replay.test.ts`

**Interfaces:**
- Consumes: all modules.
- Produces:
  - `index.ts` re-exports the public surface: card types & helpers, meld validation, layout, state types + `startMatch`/`dealRound`, `Action`/`applyAction`/`ActionResult`, scoring functions.
  - Replay test: a sequence of actions applied from a seeded start reproduces an identical final state when replayed — guarding determinism (the persistence layer relies on this).

- [ ] **Step 1: Write the failing test**

```ts
// lib/kalooki/__tests__/replay.test.ts
import { describe, it, expect } from 'vitest';
import { startMatch, applyAction, makeRng } from '../index';
import type { Action } from '../index';

function playScript(seed: number, actions: { seat: number; action: Action }[]) {
  let m = startMatch({ seats: 2, seed });
  const rng = makeRng(seed + 1000);
  for (const step of actions) {
    const r = applyAction(m, step.seat, step.action, rng);
    if (r.ok) m = r.match;
  }
  return m;
}

describe('replay determinism', () => {
  it('same seed + same actions => identical state', () => {
    const seat = startMatch({ seats: 2, seed: 11 }).round.turn;
    const script = [{ seat, action: { type: 'draw', source: 'stock' } as Action }];
    const a = playScript(11, script);
    const b = playScript(11, script);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/kalooki/__tests__/replay.test.ts`
Expected: FAIL — `../index` missing exports.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/kalooki/index.ts
export * from './cards';
export { makeRng, shuffle } from './rng';
export * from './melds';
export * from './layout';
export * from './state';
export * from './actions';
export * from './scoring';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/kalooki/__tests__/replay.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full engine suite and commit**

```bash
npx vitest run lib/kalooki
git add lib/kalooki/index.ts lib/kalooki/__tests__/replay.test.ts
git commit -m "feat(kalooki): public API and replay determinism test"
```

---

## Self-Review Notes (author)

- **Spec coverage:** deck/packs (T1), sets incl. 2-joker (T2), runs + Ace-high (T3), layout discipline (T4), deal & buy-in (T5), draw incl. joker-first-discard decline (T6), 40-opening across multiple melds (T7), lay-off (T8), joker replacement + immediate re-meld (T9), go-out + Kalooki/Treasure one-per-game (T10), round scoring + bits (T11), 150 bust + one-time rebuy at highest + winner/pot (T12), replay determinism (T13). Redaction, WebSockets, persistence, auth, and UI are **later phases**, intentionally out of this plan.
- **Known approximation flagged for the executor:** Kalooki detection in T10 uses `turnStartHandSize === 13 && !openedAtTurnStart`. This correctly captures "went down all 13 in one go." Confirm against edge cases (e.g. going out by lay-offs only) during implementation; refine if a scenario test reveals a gap.
- **Immutability:** every handler clones before mutating; inputs are never modified.
```
