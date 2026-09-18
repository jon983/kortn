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
