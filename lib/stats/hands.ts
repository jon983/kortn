/**
 * Hand-level stats, computed from every recorded hand (rounds table) plus the
 * exact per-hand points in the game's scorepad (state.history) where it exists.
 * Pure, so the home page's leaderboards and "Your record" share one source.
 */

export interface HandRow {
  roundNumber: number;
  winnerSeat: number | null;
  goOutType: 'normal' | 'kalooki' | 'treasure' | null;
  /** Cumulative scores after the hand, per seat. */
  scores: number[] | null;
}

export interface MatchHands {
  players: { userId: string; name: string; seat: number }[];
  rounds: HandRow[];
  /** Scorepad entries (exact points per hand); absent on the earliest games. */
  history?: { roundNumber: number; handPoints: number[] }[];
}

export interface HandAggregate {
  userId: string;
  name: string;
  /** Hands actually played (not sat out after busting). */
  hands: number;
  wins: number;
  kalookis: number;
  treasures: number;
  /** Points taken, over `pointHands` hands whose points are known. */
  points: number;
  pointHands: number;
  /** Hands you'd expect to win by chance: Σ 1 / players in each hand. */
  parWins: number;
}

export function aggregateHands(matches: MatchHands[]): Map<string, HandAggregate> {
  const out = new Map<string, HandAggregate>();
  const get = (userId: string, name: string) => {
    let a = out.get(userId);
    if (!a) {
      a = { userId, name, hands: 0, wins: 0, kalookis: 0, treasures: 0, points: 0, pointHands: 0, parWins: 0 };
      out.set(userId, a);
    }
    return a;
  };

  for (const m of matches) {
    const scorepad = new Map((m.history ?? []).map((h) => [h.roundNumber, h.handPoints]));
    const rounds = [...m.rounds].sort((a, b) => a.roundNumber - b.roundNumber);
    let prev: number[] = [];
    for (const r of rounds) {
      if (r.winnerSeat === null || !r.scores) continue;
      const exact = scorepad.get(r.roundNumber);
      // Per seat: did they play this hand, and (if known) how many points did they take?
      const seats = m.players.map((p) => {
        const isWinner = p.seat === r.winnerSeat;
        if (exact) {
          const pts = exact[p.seat] ?? 0;
          // A losing hand always costs points; 0 without the win means the seat sat out.
          return { p, played: isWinner || pts > 0, pts: isWinner ? 0 : pts };
        }
        const diff = (r.scores![p.seat] ?? 0) - (prev[p.seat] ?? 0);
        if (isWinner) return { p, played: true, pts: 0 };
        if (diff > 0) return { p, played: true, pts: diff };
        if (diff < 0) return { p, played: true, pts: null }; // rebuy reset: played, points unknown
        return { p, played: false, pts: null };
      });
      const inHand = seats.filter((s) => s.played);
      for (const s of inHand) {
        const a = get(s.p.userId, s.p.name);
        a.hands++;
        a.parWins += 1 / inHand.length;
        if (s.p.seat === r.winnerSeat) {
          a.wins++;
          if (r.goOutType === 'kalooki') a.kalookis++;
          if (r.goOutType === 'treasure') a.treasures++;
        }
        if (s.pts !== null) {
          a.points += s.pts;
          a.pointHands++;
        }
      }
      prev = r.scores;
    }
  }
  return out;
}

export interface BoardEntry {
  userId: string;
  name: string;
  value: number;
  hands: number;
  /** Count behind the rate (wins, kalookis, …) for the "x / hands" hint. */
  count?: number;
}

export interface Leaderboards {
  vsPar: BoardEntry[];
  pointsPerHand: BoardEntry[];
  winsPer100: BoardEntry[];
  kalookisPer100: BoardEntry[];
  treasuresPer100: BoardEntry[];
}

export function rankLeaderboards(
  agg: Map<string, HandAggregate>,
  opts: { minHands: number; limit: number },
): Leaderboards {
  const qualified = [...agg.values()].filter((a) => a.hands >= opts.minHands);
  const board = (
    value: (a: HandAggregate) => number | null,
    dir: 'asc' | 'desc',
    count?: (a: HandAggregate) => number,
  ): BoardEntry[] =>
    qualified
      .map((a) => ({ a, v: value(a) }))
      .filter((x): x is { a: HandAggregate; v: number } => x.v !== null)
      .sort((x, y) => (dir === 'asc' ? x.v - y.v : y.v - x.v) || y.a.hands - x.a.hands)
      .slice(0, opts.limit)
      .map(({ a, v }) => ({ userId: a.userId, name: a.name, value: v, hands: a.hands, count: count?.(a) }));
  const per100 = (n: number, a: HandAggregate) => (100 * n) / a.hands;
  return {
    vsPar: board((a) => (a.parWins > 0 ? a.wins / a.parWins : null), 'desc', (a) => a.wins),
    pointsPerHand: board((a) => (a.pointHands > 0 ? a.points / a.pointHands : null), 'asc'),
    winsPer100: board((a) => per100(a.wins, a), 'desc', (a) => a.wins),
    kalookisPer100: board((a) => per100(a.kalookis, a), 'desc', (a) => a.kalookis),
    treasuresPer100: board((a) => per100(a.treasures, a), 'desc', (a) => a.treasures),
  };
}
