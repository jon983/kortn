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
  turnStartHandSize?: number;
  openedAtTurnStart?: boolean;
}
export interface MatchState {
  seats: number;
  pot: number;
  treasureUsed: boolean;
  scores: number[];
  /** Running bit balance per seat: losers pay the hand winner each round (pot is separate, for antes/rebuys). */
  bits: number[];
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
    bits: new Array(opts.seats).fill(0),
    statuses: new Array(opts.seats).fill('active'),
    rebought: new Array(opts.seats).fill(false),
    round: dealRound({ seats: opts.seats, dealerSeat: 0, rng }),
    roundNumber: 1,
    finished: false,
    winnerSeat: null,
  };
}
