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
