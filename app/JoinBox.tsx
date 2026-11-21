'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinTableAction } from './actions/lobby';
import { LampButton } from '../lib/ui/LampButton';

/** Join a game someone else set up, by its 4-letter table code. */
export function JoinBox() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function action(fd: FormData) {
    setError(null);
    const res = await joinTableAction(fd);
    if ('error' in res) setError(res.error);
    else router.push(`/match/${res.matchId}/lobby`);
  }
  return (
    <form action={action} className="flex flex-col gap-2 p-1">
      <p className="text-center text-xs text-ink/65">Got a table code from a friend?</p>
      <div className="flex gap-2">
        <input name="joinCode" placeholder="CODE" maxLength={4} aria-label="Table code"
          className="min-w-0 flex-1 rounded border border-brass bg-bone/90 px-3 py-2 text-center uppercase tracking-widest text-ink" />
        <LampButton type="submit" className="!px-4 !py-2" sheenDelay={1.8}>Join</LampButton>
      </div>
      {error && <p className="text-center text-sm text-maroon">{error}</p>}
    </form>
  );
}
