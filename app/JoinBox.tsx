'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinTableAction } from './actions/lobby';
import { Framed } from '../lib/ui/Framed';
import { LampButton } from '../lib/ui/LampButton';

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
    <div id="join" className="mt-8 max-w-sm mx-auto">
      <Framed title="Pull up a chair">
        <form action={action} className="flex flex-col gap-3 p-1">
          <input name="joinCode" placeholder="TABLE CODE" maxLength={4}
            className="rounded border border-brass bg-bone/90 px-3 py-2 text-center uppercase tracking-widest text-ink" />
          <LampButton type="submit">Join</LampButton>
          {error && <p className="text-maroon text-sm text-center">{error}</p>}
        </form>
      </Framed>
    </div>
  );
}
