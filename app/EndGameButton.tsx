'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { endGameAction } from './actions/lobby';

export const END_GAME_CONFIRM =
  'End this game for everyone? Nobody wins and buy-ins are returned — bits won hand-by-hand stand.';

/** Ends a stalled game for everyone (marked abandoned). Any seated player can use it. */
export function EndGameButton({ matchId, className = '', label = 'End' }: { matchId: string; className?: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="End game"
      className={className || 'rounded px-1.5 text-[10px] font-bold uppercase tracking-wide text-maroon/70 hover:bg-maroon/10 hover:text-maroon disabled:opacity-40'}
      onClick={() => {
        if (!confirm(END_GAME_CONFIRM)) return;
        start(async () => {
          const res = await endGameAction(matchId);
          if (!res.ok) alert(res.reason ?? 'Could not end the game');
          router.refresh();
        });
      }}
    >
      {pending ? 'Ending…' : label}
    </button>
  );
}
