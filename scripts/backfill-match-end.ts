/**
 * One-off backfill for the match-end fixes (Nov 2026).
 *
 *  1. Finished matches that predate the pot payout: settle the ante / rebuys /
 *     pot into state.bits (recorded in state.payout, so re-running is a no-op).
 *  2. Active matches stuck waiting on a rebuy that can't be taken (fewer than
 *     two seats still in): resolve it and finish the match, as the runtime now does.
 *
 * Who actually bought back isn't stored on old matches (`rebought` also covers
 * declines), so it's inferred from the scorepad: a rebuy resets a busted seat's
 * score DOWN to the highest active score, so a seat whose score drops after
 * going over 150 bought back. Cross-checked against the pot; mismatches are skipped.
 *
 * Usage (dry run by default):
 *   node --env-file=.env.local --import tsx scripts/backfill-match-end.ts [--apply]
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db, listPlayers, setMatchWinner, incrementUserStats } from '../lib/db';
import { matches, gameStates } from '../lib/db/schema';
import { resolveImpossibleRebuys, matchWinner, awardPot, potPayout, ANTE, type MatchState } from '../lib/kalooki';

const apply = process.argv.includes('--apply');

function inferBoughtBack(st: MatchState): boolean[] | null {
  if (st.boughtBack) return st.boughtBack;
  const rebuys = (st.pot - st.seats * ANTE) / ANTE;
  const bb = new Array(st.seats).fill(false);
  const h = st.history ?? [];
  for (let k = 0; k + 1 < h.length; k++) {
    for (let s = 0; s < st.seats; s++) {
      // Score going into hand k+1 (its total minus the points it added). A rebuy
      // resets it, so it no longer matches the total after hand k.
      const prior = h[k + 1].scores[s] - (h[k + 1].handPoints?.[s] ?? 0);
      if (h[k].scores[s] > 150 && prior !== h[k].scores[s]) bb[s] = true;
    }
  }
  return bb.filter(Boolean).length === rebuys ? bb : null;
}

const pendingRebuy = (st: MatchState) => st.statuses.some((s, i) => s === 'busted' && !st.rebought[i]);

async function main() {
  const rows = await db
    .select({ id: matches.id, status: matches.status, createdAt: matches.createdAt, state: gameStates.state, version: gameStates.version })
    .from(matches)
    .innerJoin(gameStates, eq(gameStates.matchId, matches.id))
    .where(inArray(matches.status, ['finished', 'active']))
    .orderBy(matches.createdAt);

  type Plan = { id: string; label: string; version: number; next: MatchState; finishes: boolean };
  const plans: Plan[] = [];
  const skipped: string[] = [];

  for (const r of rows) {
    const st = r.state;
    const label = `${r.createdAt.toISOString().slice(0, 10)} ${r.id.slice(0, 8)} ${st.seats}p`;
    if (r.status === 'finished') {
      if (st.payout) continue; // already settled
      if (st.winnerSeat === null) { skipped.push(`${label}: finished but no winnerSeat`); continue; }
      const bb = inferBoughtBack(st);
      if (!bb) { skipped.push(`${label}: can't tell who bought back (pot ${st.pot})`); continue; }
      const payout = potPayout({ ...st, boughtBack: bb }, st.winnerSeat);
      const bits = st.bits.map((b, s) => b + payout[s]);
      plans.push({ id: r.id, label, version: r.version, finishes: false, next: { ...st, boughtBack: bb, payout, bits } });
    } else {
      if (st.finished || !st.round.finished) continue;
      const resolved = resolveImpossibleRebuys(st);
      if (pendingRebuy(resolved) || matchWinner(resolved) === null) continue; // genuinely still in play
      const bb = inferBoughtBack(resolved);
      if (!bb) { skipped.push(`${label}: decided but can't tell who bought back (pot ${st.pot})`); continue; }
      const done = awardPot({ ...resolved, boughtBack: bb });
      plans.push({ id: r.id, label, version: r.version, finishes: true, next: done });
    }
  }

  console.log(`${plans.length} match(es) to update${apply ? '' : ' (dry run — pass --apply to write)'}:\n`);
  for (const p of plans) {
    const before = rows.find((r) => r.id === p.id)!.state;
    console.log(`${p.label}${p.finishes ? '  [FINISH: stuck on impossible rebuy]' : ''}`);
    console.log(`  pot ${p.next.pot}, winner seat ${p.next.winnerSeat}, bought back ${JSON.stringify(p.next.boughtBack)}`);
    console.log(`  bits ${JSON.stringify(before.bits)} + payout ${JSON.stringify(p.next.payout)} = ${JSON.stringify(p.next.bits)}`);
  }
  if (skipped.length) console.log(`\nSkipped:\n  ${skipped.join('\n  ')}`);
  if (!apply) return;

  for (const p of plans) {
    const updated = await db
      .update(gameStates)
      .set({ state: p.next, version: p.version + 1 })
      .where(and(eq(gameStates.matchId, p.id), eq(gameStates.version, p.version)))
      .returning({ v: gameStates.version });
    if (updated.length === 0) { console.log(`! ${p.label}: changed underneath us, skipped`); continue; }
    if (p.finishes) {
      const players = await listPlayers(db, p.id);
      const winner = players.find((pl) => pl.seatIndex === p.next.winnerSeat)?.userId;
      if (winner) await setMatchWinner(db, p.id, winner);
      for (const pl of players) await incrementUserStats(db, pl.userId, { gamesPlayed: 1 });
    }
    console.log(`✓ ${p.label}`);
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
