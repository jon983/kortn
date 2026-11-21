'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTableAction } from './actions/lobby';

const CHAIRS = [2, 3, 4, 5];

/**
 * "Set the table": opens in place into a chair picker. Setting the table keeps
 * you in the kitchen — the new table's ticket appears in Today's tables.
 */
export function SetTablePill() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [seats, setSeats] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setTable() {
    setError(null); setBusy(true);
    try {
      const fd = new FormData();
      fd.set('seats', String(seats));
      await createTableAction(fd);
      setOpen(false);
      router.refresh();
    } catch {
      setError('Couldn’t set the table just now — try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="deli-pill deli-pill--green btn-lift">Set the table</button>;
  }
  return (
    <div className="flex flex-col items-center gap-1.5" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      <span className="font-script text-[19px] text-deli-red">How many chairs?</span>
      <div className="flex gap-2" role="group" aria-label="Chairs at the table">
        {CHAIRS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={seats === n}
            onClick={() => setSeats(n)}
            className={`h-11 w-11 rounded-full font-cond text-[22px] font-black transition-colors ${
              seats === n ? 'bg-deli-green text-deli-cream' : 'text-deli-green shadow-[inset_0_0_0_2.5px_var(--color-deli-green)] hover:bg-deli-green/10'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => void setTable()} disabled={busy} className="deli-pill deli-pill--green btn-lift mt-1">
        {busy ? '…' : 'Deal us in'}
      </button>
      {error && <p role="alert" className="font-sans-deli text-sm font-medium text-deli-red">{error}</p>}
      <button type="button" onClick={() => setOpen(false)} className="font-script text-[17px] text-deli-green/70 hover:underline">cancel</button>
    </div>
  );
}
