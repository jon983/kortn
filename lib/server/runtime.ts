import type { RuntimeDeps, SubmitResult } from './deps';
import { resolveSeat } from './seats';
import { loadGameState, saveGameState, appendMove, listMoves, OptimisticLockError } from '../db';
import { applyAction, type Action } from '../kalooki';

export async function submitAction(
  deps: RuntimeDeps,
  input: { matchId: string; userId: string; action: Action },
): Promise<SubmitResult> {
  const seat = await resolveSeat(deps.db, input.matchId, input.userId);
  if (seat === null) return { ok: false, reason: 'Not a player in this match' };

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

    await deps.pubsub.publish('match:' + input.matchId, result.match);
    return { ok: true };
  }
  return { ok: false, reason: 'conflict' };
}
