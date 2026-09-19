'use client';
import Link from 'next/link';
import type { ClientView } from '../../server';

function Scrim({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6">
    <div className="max-w-sm rounded-xl border-2 border-brass bg-[#2a1c12] p-6 text-center text-bone shadow-2xl">{children}</div>
  </div>;
}

export function RoundSummary({ view, onContinue }: { view: ClientView; onContinue: () => void }) {
  const rows = [
    { seat: view.you.seat, score: view.you.score, bits: view.you.bits, you: true },
    ...view.opponents.map((o) => ({ seat: o.seat, score: o.score, bits: o.bits, you: false })),
  ].sort((a, b) => a.seat - b.seat);
  const fmtBits = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return <Scrim>
    <h3 className="font-[family-name:var(--font-display)] text-2xl text-brass">Round over</h3>
    <p className="mt-2">Seat {view.roundWinnerSeat} went out{view.goOutType ? ` — ${view.goOutType}` : ''}.</p>
    <table className="mt-4 w-full text-sm">
      <thead>
        <tr className="text-[#c9b48a]">
          <th className="text-left font-normal">Player</th>
          <th className="text-right font-normal">Points</th>
          <th className="text-right font-normal">Bits</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.seat} className={r.seat === view.roundWinnerSeat ? 'text-brass' : ''}>
            <td className="text-left">Seat {r.seat}{r.you ? ' (you)' : ''}</td>
            <td className="text-right tabular-nums">{r.score}</td>
            <td className="text-right tabular-nums">{fmtBits(r.bits)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <button type="button" className="mt-4 rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-5 py-2 font-bold" onClick={onContinue}>Continue</button>
  </Scrim>;
}

export function RebuyPrompt({ onRebuy, onDecline }: { onRebuy: () => void; onDecline: () => void }) {
  return <Scrim>
    <h3 className="font-[family-name:var(--font-display)] text-2xl text-brass">You're out — over 150</h3>
    <p className="mt-2 text-sm">Buy back in for 4 bits and re-enter at the current top score?</p>
    <div className="mt-4 flex justify-center gap-3">
      <button type="button" className="rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-4 py-2 font-bold" onClick={onRebuy}>Buy back in</button>
      <button type="button" className="rounded-md border-2 border-sage-deep bg-[linear-gradient(180deg,#c6d0b3,#a6b589)] px-4 py-2 font-bold text-ink" onClick={onDecline}>Decline</button>
    </div>
  </Scrim>;
}

export function MatchSummary({ view }: { view: ClientView }) {
  return <Scrim>
    <h3 className="font-[family-name:var(--font-display)] text-2xl text-brass">Winner!</h3>
    <p className="mt-2">Seat {view.matchWinnerSeat} takes the pot of {view.pot} bits.</p>
    <Link href="/" className="mt-4 inline-block rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-5 py-2 font-bold">Back to the front room</Link>
  </Scrim>;
}
