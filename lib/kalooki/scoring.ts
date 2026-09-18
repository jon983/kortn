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
