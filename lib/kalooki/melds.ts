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
