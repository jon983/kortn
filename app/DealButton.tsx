'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startGameAction } from './actions/match';

/** The host deals once every chair is filled — and goes straight to the table. */
export function DealButton({ matchId, disabled }: { matchId: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function deal() {
    setBusy(true); setError(null);
    try {
      const r = await startGameAction(matchId);
      if (r.ok) router.push(`/match/${matchId}/table`);
      else setError(r.reason);
    } catch {
      setError('Couldn’t deal just now — try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="flex flex-col items-center">
      <button type="button" disabled={disabled || busy} onClick={() => void deal()} title={disabled ? 'Waiting for every chair to be filled' : undefined}
        className="deli-pill deli-pill--red btn-lift !px-5 !py-2 !text-[15px]">
        {busy ? '…' : 'Deal'}
      </button>
      {error && <span role="alert" className="mt-0.5 font-sans-deli text-[11px] text-deli-red">{error}</span>}
    </span>
  );
}
