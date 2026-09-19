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

/** Every still-active seat has clicked "Next hand". */
function allActiveReady(state: MatchState): boolean {
  const ready = state.readyNext ?? [];
  return state.statuses.every((s, i) => s !== 'active' || ready[i] === true);
}

/**
 * Given a settled, paused between-hands state, decide whether to advance:
 * - null  → stay paused (waiting on rebuy decisions or "Next hand" clicks)
 * - state → the advanced state (next round dealt, or match ended)
 */
function nextAfterReady(state: MatchState, rng: () => number): MatchState | null {
  if (anyPendingRebuy(state)) return null;
  const winnerSeat = matchWinner(state);
  if (winnerSeat !== null) return awardPot(state); // finished === true
  if (!allActiveReady(state)) return null;
  const nextRound = dealRound({
    seats: state.seats,
    dealerSeat: (state.round.dealerSeat + 1) % state.seats,
    rng,
  });
  return {
    ...state,
    round: nextRound,
    roundNumber: state.roundNumber + 1,
    readyNext: new Array(state.seats).fill(false),
  };
}

async function applyMatchEnd(deps: RuntimeDeps, matchId: string, done: MatchState): Promise<void> {
  const players = await listPlayers(deps.db, matchId);
  const wUser = players.find((p) => p.seatIndex === done.winnerSeat)?.userId ?? null;
  if (wUser) await setMatchWinner(deps.db, matchId, wUser);
  for (const p of players) await incrementUserStats(deps.db, p.userId, { gamesPlayed: 1 });
}

/**
 * Persist a paused between-hands state, advancing to the next round / match end
 * when everyone is ready. Returns the state that should be published.
 */
async function persistAdvance(deps: RuntimeDeps, matchId: string, base: MatchState): Promise<MatchState> {
  const advanced = nextAfterReady(base, deps.rng);
  if (!advanced) return persist(deps, matchId, base);
  if (advanced.finished) await applyMatchEnd(deps, matchId, advanced);
  return persist(deps, matchId, advanced);
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
  // 4. busts, then pause between hands (the finished round stays current so the
  //    scorecard shows) until every active player clicks "Next hand".
  const busted = applyBusts(settled);
  const paused: MatchState = { ...busted, readyNext: new Array(busted.seats).fill(false) };
  return persistAdvance(deps, matchId, paused);
}

export async function submitAction(
  deps: RuntimeDeps,
  input: { matchId: string; userId: string; action: ServerAction },
): Promise<SubmitResult> {
  const seat = await resolveSeat(deps.db, input.matchId, input.userId);
  if (seat === null) return { ok: false, reason: 'Not a player in this match' };

  // Handle server-level between-hands actions (rebuy / decline / readyNext) before engine call
  if (input.action.type === 'rebuy' || input.action.type === 'decline' || input.action.type === 'readyNext') {
    const actionType = input.action.type;
    for (let attempt = 0; attempt < 2; attempt++) {
      const loaded = await loadGameState(deps.db, input.matchId);
      if (!loaded) return { ok: false, reason: 'No active game' };
      const st = loaded.state;
      const ready = (st.readyNext ?? new Array(st.seats).fill(false)).slice();
      let updated: MatchState;
      if (actionType === 'readyNext') {
        if (!st.round.finished) return { ok: false, reason: 'No finished hand to advance' };
        ready[seat] = true;
        updated = { ...st, readyNext: ready };
      } else {
        if (st.statuses[seat] !== 'busted' || st.rebought[seat]) {
          return { ok: false, reason: 'No rebuy pending for you' };
        }
        ready[seat] = true; // a rebuy/decline also counts as "ready to continue"
        if (actionType === 'rebuy') {
          updated = { ...engineRebuy(st, seat), readyNext: ready };
        } else {
          // decline: mark rebought=true so the seat is permanently out and no longer pending
          const rebought = st.rebought.slice(); rebought[seat] = true;
          updated = { ...st, rebought, readyNext: ready };
        }
      }
      // Mark + advance decision are saved in one optimistic write so concurrent
      // "Next hand" clicks from different seats merge correctly (retry re-reads).
      const advanced = nextAfterReady(updated, deps.rng);
      const toSave = advanced ?? updated;
      try {
        await saveGameState(deps.db, input.matchId, loaded.version, toSave);
      } catch (e) {
        if (e instanceof OptimisticLockError) continue; // reload + retry once
        throw e;
      }
      if (advanced?.finished) await applyMatchEnd(deps, input.matchId, advanced);
      await deps.pubsub.publish('match:' + input.matchId, toSave);
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
