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
