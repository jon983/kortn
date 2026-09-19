// lib/server/redact.ts
import {
  layoutMeld,
  type MatchState, type Card, type TableMeld, type Phase, type GoOutType, type SeatStatus,
} from '../kalooki';

export interface SelfView {
  seat: number; hand: Card[]; handCount: number; score: number; bits: number; status: SeatStatus; hasOpened: boolean;
  /** If you took the discard this turn and haven't melded it yet, its card id — else null. */
  drawObligationId: string | null;
  /** Whether you've resolved a bust (rebought or declined). */
  rebought: boolean;
}
export interface OpponentView {
  seat: number; handCount: number; score: number; bits: number; status: SeatStatus; hasOpened: boolean;
}
export interface ClientView {
  seat: number;
  /** Display name per seat index (falls back to "Seat N" when unknown). */
  seatNames: string[];
  you: SelfView;
  opponents: OpponentView[];
  stockCount: number;
  discard: Card[];
  melds: TableMeld[];
  currentTurn: number;
  phase: Phase;
  pot: number;
  roundNumber: number;
  roundFinished: boolean;
  roundWinnerSeat: number | null;
  goOutType: GoOutType | null;
  matchFinished: boolean;
  matchWinnerSeat: number | null;
  /** Between hands: which seats have clicked "Next hand" (seat-indexed). */
  readyNext: boolean[];
}

export function redactStateFor(state: MatchState, seat: number, names: (string | null)[] = []): ClientView {
  const round = state.round;
  const seatNames = Array.from({ length: state.seats }, (_, i) => names[i] || `Seat ${i}`);
  const self = round.players[seat];
  const you: SelfView = {
    seat,
    hand: self.hand.slice(),
    handCount: self.hand.length,
    score: state.scores[seat],
    bits: state.bits?.[seat] ?? 0,
    status: state.statuses[seat],
    hasOpened: self.hasOpened,
    drawObligationId: round.turn === seat ? (round.drawObligation?.id ?? null) : null,
    rebought: state.rebought[seat] ?? false,
  };
  const opponents: OpponentView[] = round.players
    .filter((p) => p.seat !== seat)
    .map((p) => ({
      seat: p.seat,
      handCount: p.hand.length,
      score: state.scores[p.seat],
      bits: state.bits?.[p.seat] ?? 0,
      status: state.statuses[p.seat],
      hasOpened: p.hasOpened,
    }));
  const melds: TableMeld[] = round.melds.map((m) => ({ ...m, cards: layoutMeld(m.cards, m.kind) }));
  return {
    seat,
    seatNames,
    you,
    opponents,
    stockCount: round.stock.length,
    discard: round.discard.slice(),
    melds,
    currentTurn: round.turn,
    phase: round.phase,
    pot: state.pot,
    roundNumber: state.roundNumber,
    roundFinished: round.finished,
    roundWinnerSeat: round.winnerSeat,
    goOutType: round.goOutType,
    matchFinished: state.finished,
    matchWinnerSeat: state.winnerSeat,
    readyNext: Array.from({ length: state.seats }, (_, i) => state.readyNext?.[i] ?? false),
  };
}
