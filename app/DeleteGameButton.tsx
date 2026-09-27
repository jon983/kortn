'use client';
import { deleteMatchAction } from './actions/lobby';

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
        aria-label="Delete game"
        title="Delete game"
        className="rounded px-1.5 text-sm font-bold text-maroon/70 hover:bg-maroon/10 hover:text-maroon"
      >
        ✕
      </button>
    </form>
  );
}
