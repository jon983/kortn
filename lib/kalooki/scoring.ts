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
  const scores = match.scores.slice();
  scores[seat] = highest;
  const statuses = match.statuses.slice();
  statuses[seat] = 'active';
  const rebought = match.rebought.slice();
  rebought[seat] = true;
  return { ...match, scores, statuses, rebought, pot: match.pot + 4 };
}

export function matchWinner(match: MatchState): number | null {
  const active = match.statuses
    .map((s, i) => (s === 'active' ? i : -1))
    .filter((i) => i >= 0);
  return active.length === 1 ? active[0] : null;
}

export function awardPot(match: MatchState): MatchState {
  const winner = matchWinner(match);
  return { ...match, finished: winner !== null, winnerSeat: winner };
}
