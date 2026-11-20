import { Card, meldPoints } from './cards';
import type { MatchState } from './state';

export function handScore(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + (c.kind === 'joker' ? 15 : meldPoints(c.rank)), 0);
}

const BIT_COST: Record<string, number> = { normal: 1, kalooki: 2, treasure: 4 };
/** Every seat antes this many bits into the pot at the start; a rebuy costs the same again. */
export const ANTE = 4;

/**
 * Tally hand-point penalties and bit payments for the round that just ended.
 *
 * CALL-ORDER INVARIANT (not self-enforced by the engine):
 * settleRound MUST be called at round end BEFORE applyBusts, while every seat
 * that was dealt into the round is still 'active'. The function only processes
 * seats currently marked 'active' — non-active seats are silently skipped.
 * Callers must NOT flip any seat to 'busted' before settling the round that
 * seat played; doing so will silently drop that seat's hand-point penalties.
 *
 * Correct sequence:
 *   1. settleRound  — scores hand points, collects bit payments
 *   2. applyBusts   — marks seats that now exceed 150 points as 'busted'
 *   3. rebuy()      — (optional) re-enters each busted seat that chooses to rebuy
 *   4. awardPot / matchWinner — determines if the match is over
 */
export function settleRound(match: MatchState): MatchState {
  const round = match.round;
  if (!round.finished || round.winnerSeat === null) throw new Error('Round not finished.');
  const cost = BIT_COST[round.goOutType ?? 'normal'];
  const scores = match.scores.slice();
  const bits = (match.bits ?? new Array(match.seats).fill(0)).slice();
  const prevScores = match.scores.slice();
  const prevBits = (match.bits ?? new Array(match.seats).fill(0)).slice();
  for (const p of round.players) {
    if (p.seat === round.winnerSeat) continue;
    if (match.statuses[p.seat] !== 'active') continue;
    scores[p.seat] += handScore(p.hand);
    // Each active loser pays `cost` bits directly to the hand winner (not the pot).
    bits[p.seat] -= cost;
    bits[round.winnerSeat] += cost;
  }
  const entry: import('./state').RoundHistoryEntry = {
    roundNumber: match.roundNumber,
    dealerSeat: round.dealerSeat,
    winnerSeat: round.winnerSeat,
    goOutType: round.goOutType ?? 'normal',
    handPoints: scores.map((s, i) => s - prevScores[i]),
    scores: scores.slice(),
    handBits: bits.map((b, i) => b - prevBits[i]),
    bits: bits.slice(),
  };
  return { ...match, scores, bits, history: [...(match.history ?? []), entry] };
}

export function applyBusts(match: MatchState): MatchState {
  const statuses = match.statuses.slice();
  for (let s = 0; s < match.seats; s++) {
    if (statuses[s] === 'active' && match.scores[s] > 150) statuses[s] = 'busted';
  }
  return { ...match, statuses };
}

const activeCount = (match: MatchState): number =>
  match.statuses.filter((s) => s === 'active').length;

/**
 * A busted seat may buy back in (once) only while at least two seats are still
 * in — otherwise the match is already decided.
 */
export function canRebuy(match: MatchState, seat: number): boolean {
  return match.statuses[seat] === 'busted' && !match.rebought[seat] && activeCount(match) >= 2;
}

/**
 * Close out every pending rebuy decision that can't be taken (fewer than two
 * seats still in), so the match can end without waiting on a busted player.
 */
export function resolveImpossibleRebuys(match: MatchState): MatchState {
  if (activeCount(match) >= 2) return match;
  const rebought = match.rebought.map((r, s) => r || match.statuses[s] === 'busted');
  return { ...match, rebought };
}

export function rebuy(match: MatchState, seat: number): MatchState {
  if (match.statuses[seat] !== 'busted') throw new Error('Only a busted seat can rebuy.');
  if (match.rebought[seat]) throw new Error('A seat may only rebuy once.');
  if (!canRebuy(match, seat)) throw new Error('Too few players remain to buy back in.');
  const activeScores = match.scores.filter((_, s) => match.statuses[s] === 'active');
  const highest = activeScores.length ? Math.max(...activeScores) : 0;
  const scores = match.scores.slice();
  scores[seat] = highest;
  const statuses = match.statuses.slice();
  statuses[seat] = 'active';
  const rebought = match.rebought.slice();
  rebought[seat] = true;
  const boughtBack = (match.boughtBack ?? new Array(match.seats).fill(false)).slice();
  boughtBack[seat] = true;
  return { ...match, scores, statuses, rebought, boughtBack, pot: match.pot + ANTE };
}

/**
 * Returns the winning seat index if exactly one seat is still 'active',
 * or null if the match is still ongoing.
 *
 * CALL-ORDER INVARIANT (not self-enforced by the engine):
 * A busted seat that still intends to rebuy must have rebuy() applied BEFORE
 * matchWinner / awardPot is called. Both functions treat a 'busted' seat as
 * permanently eliminated. Calling awardPot while a not-yet-rebuyed seat is
 * 'busted' can cause the match to be declared over prematurely (if only one
 * 'active' seat remains), which is incorrect when that seat would have rebuyed.
 */
export function matchWinner(match: MatchState): number | null {
  const active = match.statuses
    .map((s, i) => (s === 'active' ? i : -1))
    .filter((i) => i >= 0);
  return active.length === 1 ? active[0] : null;
}

/**
 * For matches begun before `boughtBack` was tracked (`rebought` also covers
 * declines): a rebuy resets a busted seat's score to the highest active score,
 * so a seat whose score going into a hand doesn't match its total after going
 * over 150 bought back. Cross-checked against the pot; if the scorepad can't
 * account for every rebuy, fall back to the seats marked `rebought` when that
 * count fits, else assume none.
 */
export function inferBoughtBack(match: MatchState): boolean[] {
  const rebuys = Math.round((match.pot - match.seats * ANTE) / ANTE);
  const none = new Array(match.seats).fill(false);
  if (rebuys <= 0) return none;
  const bb = none.slice();
  const h = match.history ?? [];
  for (let k = 0; k + 1 < h.length; k++) {
    for (let s = 0; s < match.seats; s++) {
      const prior = h[k + 1].scores[s] - (h[k + 1].handPoints?.[s] ?? 0);
      if (h[k].scores[s] > 150 && prior !== h[k].scores[s]) bb[s] = true;
    }
  }
  // A seat that's back in play after a rebuy decision paid to get there (declining
  // leaves it busted) — this also catches a rebuy after the last scored hand.
  for (let s = 0; s < match.seats; s++) {
    if (match.rebought[s] && match.statuses[s] === 'active') bb[s] = true;
  }
  if (bb.filter(Boolean).length === rebuys) return bb;
  const marked = match.rebought.slice();
  return marked.filter(Boolean).length === rebuys ? marked : none;
}

/**
 * Per-seat bit settlement at match end: every seat paid the ante, each rebuy
 * cost another ANTE, and the winner collects the whole pot. Sums to zero.
 */
export function potPayout(match: MatchState, winnerSeat: number): number[] {
  const boughtBack = match.boughtBack ?? [];
  return Array.from({ length: match.seats }, (_, s) =>
    -ANTE - (boughtBack[s] ? ANTE : 0) + (s === winnerSeat ? match.pot : 0));
}

/**
 * Marks the match finished if exactly one 'active' seat remains, records that
 * seat as the winner and pays out the pot (folded into `bits`, itemised in
 * `payout`). Returns the MatchState unchanged if the match is still ongoing.
 *
 * See matchWinner for the call-order invariant regarding rebuy and busted seats.
 */
export function awardPot(match: MatchState): MatchState {
  const winner = matchWinner(match);
  if (winner === null) return { ...match, finished: false, winnerSeat: null };
  const boughtBack = match.boughtBack ?? inferBoughtBack(match);
  const payout = potPayout({ ...match, boughtBack }, winner);
  const bits = (match.bits ?? new Array(match.seats).fill(0)).map((b, s) => b + payout[s]);
  return { ...match, finished: true, winnerSeat: winner, boughtBack, payout, bits };
}
