'use client';
import Link from 'next/link';
import type { ClientView } from '../../server';

function Scrim({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6">
    <div className={`${wide ? 'max-w-xl p-8' : 'max-w-sm p-6'} w-full rounded-xl border-2 border-brass bg-[#2a1c12] text-center text-bone shadow-2xl`}>{children}</div>
  </div>;
}

export function RoundSummary({ view, onReady }: { view: ClientView; onReady: () => void }) {
  const seats = [
    { seat: view.you.seat, score: view.you.score, bits: view.you.bits, status: view.you.status, you: true },
    ...view.opponents.map((o) => ({ seat: o.seat, score: o.score, bits: o.bits, status: o.status, you: false })),
  ].sort((a, b) => a.seat - b.seat);
  const fmtBits = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const participants = seats.filter((s) => s.status === 'active');
  const readyCount = participants.filter((s) => view.readyNext[s.seat]).length;
  const youParticipate = view.you.status === 'active';
  const youReady = view.readyNext[view.seat];
  return <Scrim wide>
    <h3 className="font-[family-name:var(--font-display)] text-3xl text-brass">Hand over</h3>
    <p className="mt-3 text-lg">{view.roundWinnerSeat !== null ? view.seatNames[view.roundWinnerSeat] : 'Someone'} went out{view.goOutType ? ` — ${view.goOutType}` : ''}.</p>
    <table className="mt-6 w-full text-base">
      <thead>
        <tr className="border-b border-brass/30 text-sm uppercase tracking-wide text-[#c9b48a]">
          <th className="py-2 text-left font-normal">Player</th>
          <th className="py-2 text-right font-normal">Points</th>
          <th className="py-2 text-right font-normal">Bits</th>
          <th className="py-2 text-right font-normal">Ready</th>
        </tr>
      </thead>
      <tbody>
        {seats.map((r) => (
          <tr key={r.seat} className={`border-b border-white/5 ${r.seat === view.roundWinnerSeat ? 'font-bold text-brass' : ''}`}>
            <td className="py-2.5 text-left">{view.seatNames[r.seat]}{r.you ? ' (you)' : ''}</td>
            <td className="py-2.5 text-right tabular-nums">{r.score}</td>
            <td className="py-2.5 text-right tabular-nums">{fmtBits(r.bits)}</td>
            <td className="py-2.5 text-right text-lg">{r.status !== 'active' ? '—' : view.readyNext[r.seat] ? '✓' : '·'}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {youParticipate ? (
      <button
        type="button"
        disabled={youReady}
        className="mt-6 rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-6 py-3 text-lg font-bold disabled:opacity-50"
        onClick={onReady}
      >
        {youReady ? `Waiting… ${readyCount}/${participants.length}` : 'Next hand'}
      </button>
    ) : (
      <p className="mt-6 text-sm text-[#c9b48a]">Waiting for the next hand… {readyCount}/{participants.length} ready</p>
    )}
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
    <p className="mt-2">{view.matchWinnerSeat !== null ? view.seatNames[view.matchWinnerSeat] : 'The winner'} takes the pot of {view.pot} bits.</p>
    <Link href="/" className="mt-4 inline-block rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-5 py-2 font-bold">Back to the front room</Link>
  </Scrim>;
}
