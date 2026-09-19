import type { RuntimeDeps, SubmitResult, ServerAction } from './deps';
import { resolveSeat } from './seats';
import { loadGameState, saveGameState, appendMove, listMoves, OptimisticLockError, recordRound, incrementUserStats, setMatchWinner, listPlayers } from '../db';
import { applyAction, settleRound, applyBusts, matchWinner, awardPot, rebuy as engineRebuy, dealRound, type MatchState } from '../kalooki';

async function userIdForSeat(deps: RuntimeDeps, matchId: string, seat: number): Promise<string | null> {
  const players = await listPlayers(deps.db, matchId);
  return players.find((p) => p.seatIndex === seat)?.userId ?? null;
}

async function persist(deps: RuntimeDeps, matchId: string, next: MatchState): Promise<MatchState> {
  const cur = await loadGameState(deps.db, matchId);
  if (!cur) throw new Error('game state vanished');
  await saveGameState(deps.db, matchId, cur.version, next);
  return next;
}

function anyPendingRebuy(state: MatchState): boolean {
  return state.statuses.some((s, i) => s === 'busted' && !state.rebought[i]);
}

export async function finishRoundTransition(
  deps: RuntimeDeps,
  matchId: string,
  state: MatchState,
): Promise<MatchState> {
  // 1. settle
  const settled = settleRound(state);
  // 2. record round
  await recordRound(deps.db, {
    matchId,
    roundNumber: state.roundNumber,
    dealerSeat: state.round.dealerSeat,
    winnerSeat: state.round.winnerSeat!,
    goOutType: state.round.goOutType!,
    scores: settled.scores,
  });
  // 3. round-winner stat
  const winnerUser = await userIdForSeat(deps, matchId, state.round.winnerSeat!);
  if (winnerUser) await incrementUserStats(deps.db, winnerUser, { roundsWon: 1 });
  // 4. busts
  const busted = applyBusts(settled);
  // 5. match end?
  const winnerSeat = matchWinner(busted);
  if (winnerSeat !== null) {
    const done = awardPot(busted);
    const players = await listPlayers(deps.db, matchId);
    const wUser = players.find((p) => p.seatIndex === winnerSeat)?.userId ?? null;
    if (wUser) await setMatchWinner(deps.db, matchId, wUser);
    for (const p of players) await incrementUserStats(deps.db, p.userId, { gamesPlayed: 1 });
    return persist(deps, matchId, done);
  }
  // 6. rebuy window: pause for explicit rebuy/decline decisions
  if (anyPendingRebuy(busted)) {
    return persist(deps, matchId, busted);
  }
  // 7. deal next round
  const nextRound = dealRound({
    seats: busted.seats,
    dealerSeat: (state.round.dealerSeat + 1) % busted.seats,
    rng: deps.rng,
  });
  const next: MatchState = { ...busted, round: nextRound, roundNumber: busted.roundNumber + 1 };
  return persist(deps, matchId, next);
}

export async function submitAction(
  deps: RuntimeDeps,
  input: { matchId: string; userId: string; action: ServerAction },
): Promise<SubmitResult> {
  const seat = await resolveSeat(deps.db, input.matchId, input.userId);
  if (seat === null) return { ok: false, reason: 'Not a player in this match' };

  // Handle server-level rebuy/decline actions before engine call
  if (input.action.type === 'rebuy' || input.action.type === 'decline') {
    for (let attempt = 0; attempt < 2; attempt++) {
      const loaded = await loadGameState(deps.db, input.matchId);
      if (!loaded) return { ok: false, reason: 'No active game' };
      const st = loaded.state;
      if (st.statuses[seat] !== 'busted' || st.rebought[seat]) {
        return { ok: false, reason: 'No rebuy pending for you' };
      }
      let updated: MatchState;
      if (input.action.type === 'rebuy') {
        updated = engineRebuy(st, seat);
      } else {
        // decline: mark rebought=true so the seat is permanently out and no longer pending
        const rebought = st.rebought.slice(); rebought[seat] = true;
        updated = { ...st, rebought };
      }
      try {
        await saveGameState(deps.db, input.matchId, loaded.version, updated);
      } catch (e) {
        if (e instanceof OptimisticLockError) continue; // reload + retry once
        throw e;
      }
      // once no seat is pending, deal the next round or end the match
      let toPublish: MatchState = updated;
      if (!anyPendingRebuy(updated)) {
        try {
          const winnerSeat = matchWinner(updated);
          if (winnerSeat !== null) {
            const done = awardPot(updated);
            const players = await listPlayers(deps.db, input.matchId);
            const wUser = players.find((p) => p.seatIndex === winnerSeat)?.userId ?? null;
            if (wUser) await setMatchWinner(deps.db, input.matchId, wUser);
            for (const p of players) await incrementUserStats(deps.db, p.userId, { gamesPlayed: 1 });
            toPublish = await persist(deps, input.matchId, done);
          } else {
            const nextRound = dealRound({ seats: updated.seats, dealerSeat: (updated.round.dealerSeat + 1) % updated.seats, rng: deps.rng });
            toPublish = await persist(deps, input.matchId, { ...updated, round: nextRound, roundNumber: updated.roundNumber + 1 });
          }
        } catch (e) {
          if (e instanceof OptimisticLockError) return { ok: false, reason: 'conflict' };
          throw e;
        }
      }
      await deps.pubsub.publish('match:' + input.matchId, toPublish);
      return { ok: true };
    }
    return { ok: false, reason: 'conflict' };
  }

  // Engine action path (action is narrowed to EngineAction after early returns above)
  for (let attempt = 0; attempt < 2; attempt++) {
    const loaded = await loadGameState(deps.db, input.matchId);
    if (!loaded) return { ok: false, reason: 'No active game' };

    const result = applyAction(loaded.state, seat, input.action, deps.rng);
    if (!result.ok) return { ok: false, reason: result.reason };

    try {
      await saveGameState(deps.db, input.matchId, loaded.version, result.match);
    } catch (e) {
      if (e instanceof OptimisticLockError) continue; // reload + retry once
      throw e;
    }

    const existing = await listMoves(deps.db, input.matchId);
    await appendMove(deps.db, {
      matchId: input.matchId,
      roundNumber: loaded.state.roundNumber,
      seatIndex: seat,
      sequence: existing.length + 1,
      action: input.action,
    });

    let toPublish: MatchState = result.match;
    if (result.match.round.finished) {
      toPublish = await finishRoundTransition(deps, input.matchId, result.match);
    }
    await deps.pubsub.publish('match:' + input.matchId, toPublish);
    return { ok: true };
  }
  return { ok: false, reason: 'conflict' };
}
