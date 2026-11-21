'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { leaveTableAction } from './actions/lobby';

/** A guest leaves a table that hasn't been dealt (just them — the table carries on). */
export function LeaveTableButton({ matchId, className }: { matchId: string; className: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        if (!confirm('Leave this table?')) return;
        start(async () => {
          const r = await leaveTableAction(matchId);
          if (!r.ok) alert(r.reason ?? 'Couldn’t leave the table');
          router.refresh();
        });
      }}
    >
      {pending ? 'leaving…' : 'leave'}
    </button>
  );
}
