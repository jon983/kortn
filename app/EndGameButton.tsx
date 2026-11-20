'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { endGameAction } from './actions/lobby';

export const END_GAME_CONFIRM =
  'Abandon this game for everyone? Nobody wins and buy-ins are returned — bits won hand-by-hand stand.';

/** Outlined, low-emphasis style shared by the list's secondary actions (Abandon / Delete). */
export const SECONDARY_ACTION =
  'rounded-md border border-maroon/50 px-4 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-maroon/80 hover:bg-maroon/10 hover:text-maroon disabled:opacity-40';

/** Ends a stalled game for everyone (marked abandoned). Any seated player can use it. */
export function EndGameButton({ matchId, className = '', label = 'End' }: { matchId: string; className?: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Abandon game"
      className={className || SECONDARY_ACTION}
      onClick={() => {
        if (!confirm(END_GAME_CONFIRM)) return;
        start(async () => {
          const res = await endGameAction(matchId);
          if (!res.ok) alert(res.reason ?? 'Could not end the game');
          router.refresh();
        });
      }}
    >
      {pending ? 'Abandoning…' : label}
    </button>
  );
}
