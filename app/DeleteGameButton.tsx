'use client';
import { deleteMatchAction } from './actions/lobby';
import { SECONDARY_ACTION } from './EndGameButton';

export function DeleteGameButton({ matchId }: { matchId: string }) {
  return (
    <form
      action={deleteMatchAction}
      onSubmit={(e) => {
        if (!confirm('Delete this game? This can’t be undone.')) e.preventDefault();
      }}
    >
      <input type="hidden" name="matchId" value={matchId} />
      <button
        type="submit"
        title="Delete game"
        className={`w-full ${SECONDARY_ACTION}`}
      >
        Delete
      </button>
    </form>
  );
}
