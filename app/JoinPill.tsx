'use client';
import { useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { joinTableAction } from './actions/lobby';

/**
 * "Join with a code": an outlined pill that opens, in place, into a code box and
 * a Join button. Enter submits, Escape (or "cancel") closes, errors show inline.
 */
export function JoinPill() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function submit(fd: FormData) {
    setError(null); setBusy(true);
    const res = await joinTableAction(fd);
    setBusy(false);
    if ('error' in res) { setError(res.error); input.current?.select(); }
    else router.push(`/match/${res.matchId}/lobby`);
  }
  const close = () => { setOpen(false); setError(null); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="deli-pill deli-pill--outline btn-lift">
        Join with a code
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(new FormData(e.currentTarget)); }}
      className="flex flex-col items-center gap-1"
    >
      <div className="flex items-center gap-2">
        <input
          ref={input}
          name="joinCode"
          aria-label="Table code"
          placeholder="CODE"
          maxLength={4}
          autoFocus
          autoComplete="off"
          onKeyDown={onKey}
          className="w-32 rounded-full border-[2.5px] border-deli-green bg-deli-cream px-4 py-[9px] text-center font-cond text-[18px] font-extrabold uppercase tracking-[.35em] text-deli-green outline-none placeholder:text-deli-green/35 focus:ring-2 focus:ring-deli-gold"
        />
        <button type="submit" disabled={busy} className="deli-pill deli-pill--green btn-lift">{busy ? '…' : 'Join'}</button>
      </div>
      {error && <p role="alert" className="font-sans-deli text-sm font-medium text-deli-red">{error}</p>}
      <button type="button" onClick={close} className="font-script text-[17px] text-deli-green/70 hover:underline">cancel</button>
    </form>
  );
}
