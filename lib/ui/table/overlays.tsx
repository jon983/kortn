'use client';
import { Fragment } from 'react';
import Link from 'next/link';
import type { ClientView } from '../../server';

function Scrim({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6">
    <div className={`${wide ? 'max-w-3xl p-8' : 'max-w-sm p-6'} w-full rounded-xl border-2 border-brass bg-[#2a1c12] text-center text-bone shadow-2xl`}>{children}</div>
  </div>;
}

/**
 * The full hand-by-hand scorepad: one row per completed hand, four columns per
 * player (hand points, running total, hand bits, running bits). The bottom row
 * shows the current authoritative totals.
 */
export function ScorePad({ view }: { view: ClientView }) {
  const seats = [
    { seat: view.you.seat, name: `${view.seatNames[view.you.seat]} (you)`, score: view.you.score, bits: view.you.bits },
    ...view.opponents.map((o) => ({ seat: o.seat, name: view.seatNames[o.seat], score: o.score, bits: o.bits })),
  ].sort((a, b) => a.seat - b.seat);
  const order = seats.map((s) => s.seat);
  const history = view.history ?? [];
  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const mark = (t: string) => (t === 'treasure' ? '★' : t === 'kalooki' ? '◆' : '');
  return (
    <div className="mt-4 max-h-[50vh] overflow-auto rounded-lg border border-brass/30">
      <table className="w-full text-right text-xs tabular-nums">
        <thead className="sticky top-0 z-10 bg-[#2a1c12]">
          <tr className="text-[#c9b48a]">
            <th className="px-2 py-1 text-left font-normal" rowSpan={2}>Hand</th>
            {seats.map((s) => (
              <th key={s.seat} colSpan={3} className="border-l border-brass/20 px-2 py-1 text-center font-bold text-bone">{s.name}</th>
            ))}
          </tr>
          <tr className="text-[10px] uppercase tracking-wide text-[#c9b48a]">
            {seats.map((s) => (
              <Fragment key={s.seat}>
                <th className="border-l border-brass/20 px-1.5 py-0.5 font-normal">Pts</th>
                <th className="px-1.5 py-0.5 font-normal">Tot</th>
                <th className="px-1.5 py-0.5 font-normal">Bits</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.length === 0 && (
            <tr><td colSpan={1 + seats.length * 3} className="px-2 py-3 text-center text-[#c9b48a]">First hand — no history yet.</td></tr>
          )}
          {history.map((h) => (
            <tr key={h.roundNumber} className="border-t border-white/5">
              <td className="px-2 py-1 text-left">
                {h.roundNumber}
                {h.goOutType !== 'normal' && <span className="ml-1 text-brass">{mark(h.goOutType)}</span>}
              </td>
              {order.map((seat) => (
                <Fragment key={seat}>
                  <td className={`border-l border-brass/20 px-1.5 py-1 ${seat === h.winnerSeat ? 'font-bold text-brass' : ''}`}>{h.handPoints[seat]}</td>
                  <td className="px-1.5 py-1">{h.scores[seat]}</td>
                  <td className="px-1.5 py-1">{fmt(h.handBits[seat])}</td>
                </Fragment>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 border-brass/50 font-bold text-brass">
            <td className="px-2 py-1 text-left">Now</td>
            {seats.map((s) => (
              <Fragment key={s.seat}>
                <td className="border-l border-brass/20 px-1.5 py-1 text-[#c9b48a]">·</td>
                <td className="px-1.5 py-1">{s.score}</td>
                <td className="px-1.5 py-1">{fmt(s.bits)}</td>
              </Fragment>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function RoundSummary({ view, onReady }: { view: ClientView; onReady: () => void }) {
  const seats = [
    { seat: view.you.seat, score: view.you.score, bits: view.you.bits, status: view.you.status, you: true },
    ...view.opponents.map((o) => ({ seat: o.seat, score: o.score, bits: o.bits, status: o.status, you: false })),
  ].sort((a, b) => a.seat - b.seat);
  const participants = seats.filter((s) => s.status === 'active');
  const readyCount = participants.filter((s) => view.readyNext[s.seat]).length;
  const youParticipate = view.you.status === 'active';
  const youReady = view.readyNext[view.seat];
  return <Scrim wide>
    <h3 className="font-[family-name:var(--font-display)] text-3xl text-brass">Hand over</h3>
    <p className="mt-3 text-lg">{(() => {
      const who = view.roundWinnerSeat !== null ? view.seatNames[view.roundWinnerSeat] : 'Someone';
      if (view.goOutType === 'treasure') return `${who} got Treasure!`;
      if (view.goOutType === 'kalooki') return `${who} got Kalooki!`;
      return `${who} went out!`;
    })()}</p>
    <ScorePad view={view} />
    <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-[#c9b48a]">
      {seats.map((r) => (
        <span key={r.seat} className={r.seat === view.roundWinnerSeat ? 'font-bold text-brass' : ''}>
          {view.seatNames[r.seat]}{r.you ? ' (you)' : ''}: {r.status !== 'active' ? 'out' : view.readyNext[r.seat] ? 'ready ✓' : 'not ready ·'}
        </span>
      ))}
    </div>
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

export function RebuyPrompt({ canRebuy = true, onRebuy, onDecline }: { canRebuy?: boolean; onRebuy: () => void; onDecline: () => void }) {
  return <Scrim>
    <h3 className="font-[family-name:var(--font-display)] text-2xl text-brass">You're out — over 150</h3>
    {canRebuy ? (
      <>
        <p className="mt-2 text-sm">Buy back in for 4 bits and re-enter at the current top score?</p>
        <div className="mt-4 flex justify-center gap-3">
          <button type="button" className="rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-4 py-2 font-bold" onClick={onRebuy}>Buy back in</button>
          <button type="button" className="rounded-md border-2 border-sage-deep bg-[linear-gradient(180deg,#c6d0b3,#a6b589)] px-4 py-2 font-bold text-ink" onClick={onDecline}>Decline</button>
        </div>
      </>
    ) : (
      <>
        <p className="mt-2 text-sm">Too few players remain under 150 to buy back in — this one&apos;s a wrap.</p>
        <div className="mt-4 flex justify-center">
          <button type="button" className="rounded-md border-2 border-sage-deep bg-[linear-gradient(180deg,#c6d0b3,#a6b589)] px-4 py-2 font-bold text-ink" onClick={onDecline}>OK</button>
        </div>
      </>
    )}
  </Scrim>;
}

export function MatchSummary({ view }: { view: ClientView }) {
  return <Scrim>
    <h3 className="font-[family-name:var(--font-display)] text-2xl text-brass">Winner!</h3>
    <p className="mt-2">{view.matchWinnerSeat !== null ? view.seatNames[view.matchWinnerSeat] : 'The winner'} takes the pot of {view.pot} bits.</p>
    <Link href="/" className="mt-4 inline-block rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-5 py-2 font-bold">Back to the front room</Link>
  </Scrim>;
}
