'use client';
import { Fragment } from 'react';
import Link from 'next/link';
import type { ClientView } from '../../server';
import { usePrint } from './usePrint';
import { signTone } from '../signTone';

/** A dim layer over the table; the overlay itself brings its own paper (receipt, ticket, sign). */
function Scrim({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-y-auto bg-black/60 p-4 sm:p-6">{children}</div>;
}
/** Plain cream panel (until each overlay gets its own deli treatment). */
const PANEL = 'deli-paper w-full max-w-sm rounded-md p-6 text-center text-deli-green shadow-2xl';

/**
 * The full hand-by-hand scorepad: one row per completed hand, four columns per
 * player (hand points, running total, hand bits, running bits). The bottom row
 * shows the current authoritative totals.
 */
export function ScorePad({ view }: { view: ClientView }) {
  const seats = [
    { seat: view.you.seat, name: view.seatNames[view.you.seat], score: view.you.score, bits: view.you.bits },
    ...view.opponents.map((o) => ({ seat: o.seat, name: view.seatNames[o.seat], score: o.score, bits: o.bits })),
  ].sort((a, b) => a.seat - b.seat);
  const order = seats.map((s) => s.seat);
  const history = view.history ?? [];
  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const mark = (t: string) => (t === 'treasure' ? '★' : t === 'kalooki' ? '◆' : '');
  const head = 'font-sans-deli text-[9.5px] font-semibold uppercase tracking-[.14em] text-deli-green/70';
  const fig = 'font-script text-[17px] leading-[24px]';
  return (
    <div data-order-pad className="order-pad mt-3 max-h-[55vh] overflow-auto rounded-sm text-deli-green">
      <table className="w-full text-right tabular-nums">
        <thead className="sticky top-0 z-10 bg-deli-cream">
          <tr>
            <th className={`${head} px-2 py-1 text-left`} rowSpan={2}>Hand</th>
            {seats.map((s) => (
              <th key={s.seat} colSpan={3} className="border-l border-deli-green/20 px-2 py-1 text-center font-cond text-[14px] font-extrabold uppercase tracking-[.04em] [overflow-wrap:anywhere]">{s.name}</th>
            ))}
          </tr>
          <tr>
            {seats.map((s) => (
              <Fragment key={s.seat}>
                <th className={`${head} border-l border-deli-green/20 px-1.5 py-0.5`}>Pts</th>
                <th className={`${head} px-1.5 py-0.5`}>Tot</th>
                <th className={`${head} px-1.5 py-0.5`}>Bits</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.length === 0 && (
            <tr><td colSpan={1 + seats.length * 3} className="px-2 py-3 text-center font-script text-[18px] opacity-70">First hand — no history yet.</td></tr>
          )}
          {history.map((h) => (
            <tr key={h.roundNumber}>
              <td className={`${fig} px-2 text-left`}>
                {h.roundNumber}
                {h.goOutType !== 'normal' && <span className="ml-1 font-sans-deli text-[12px] text-deli-red">{mark(h.goOutType)}</span>}
              </td>
              {order.map((seat) => (
                <Fragment key={seat}>
                  <td className={`${fig} border-l border-deli-green/20 px-1.5 ${seat === h.winnerSeat ? 'text-deli-red' : ''}`}>{h.handPoints[seat]}</td>
                  <td className={`${fig} px-1.5`}>{h.scores[seat]}</td>
                  <td className={`${fig} px-1.5 ${signTone(h.handBits[seat])}`}>{fmt(h.handBits[seat])}</td>
                </Fragment>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 border-double border-deli-red/60 font-cond font-extrabold">
            <td className="px-2 py-1 text-left text-[13px] uppercase tracking-[.08em]">Now</td>
            {seats.map((s) => (
              <Fragment key={s.seat}>
                <td className="border-l border-deli-green/20 px-1.5 py-1 opacity-40">·</td>
                <td className="px-1.5 py-1 text-[16px]">{s.score}</td>
                <td className={`px-1.5 py-1 text-[16px] ${signTone(s.bits)}`}>{fmt(s.bits)}</td>
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
    { seat: view.you.seat, score: view.you.score, status: view.you.status },
    ...view.opponents.map((o) => ({ seat: o.seat, score: o.score, status: o.status })),
  ].sort((a, b) => a.seat - b.seat);
  const participants = seats.filter((s) => s.status === 'active');
  const readyCount = participants.filter((s) => view.readyNext?.[s.seat]).length;
  const youParticipate = view.you.status === 'active';
  const youReady = view.readyNext?.[view.seat];
  const last = view.history?.at(-1);
  const winner = view.roundWinnerSeat;
  const who = winner !== null ? view.seatNames[winner] : 'Someone';
  const ended = view.goOutType === 'treasure' ? `${who} got Treasure!` : view.goOutType === 'kalooki' ? `${who} got Kalooki!` : `${who} went out`;
  const won = winner !== null && last ? last.handBits[winner] : null;

  // The receipt, one printed line at a time.
  const lines: React.ReactNode[] = [
    <div key="head" className="text-center">
      <div className="font-mark text-[26px] leading-none tracking-[.04em]">KORTN</div>
      <div className="mt-1 font-sans-deli text-[10px] font-semibold uppercase tracking-[.18em] opacity-75">{`The card table · Hand No. ${view.roundNumber}`}</div>
    </div>,
    <div key="ended" className="border-y border-dashed border-deli-green/40 py-1.5 text-center font-script text-[21px] text-deli-red">{ended}</div>,
    ...seats.map((r) => {
      const out = r.status !== 'active';
      const pts = r.seat === winner ? 'WON' : last ? String(last.handPoints[r.seat]) : '–';
      return (
        <div key={`s${r.seat}`} className={`deli-leader !py-1 font-cond text-[17px] font-extrabold uppercase ${r.seat === winner ? 'text-deli-red' : ''} ${out ? 'opacity-50' : ''}`}>
          <span className="min-w-0 [overflow-wrap:anywhere]">{view.seatNames[r.seat]}</span>
          <span className="font-sans-deli text-[11px] font-semibold normal-case" title={out ? 'out' : view.readyNext?.[r.seat] ? 'ready' : 'not ready yet'}>
            {out ? 'out' : view.readyNext?.[r.seat] ? '✓' : '·'}
          </span>
          <span className="lead" />
          <span className="tabular-nums">{pts}</span>
          <span className="w-9 text-right font-sans-deli text-[10.5px] font-medium tabular-nums opacity-60">{r.score}</span>
        </div>
      );
    }),
    ...(won !== null ? [<div key="bits" className="border-t border-dashed border-deli-green/40 pt-1.5 text-center font-cond text-[16px] font-extrabold uppercase tracking-[.06em]">{`Bits to ${who} ${won > 0 ? '+' : ''}${won}`}</div>] : []),
    <div key="pot" className="text-center font-sans-deli text-[11px] font-semibold uppercase tracking-[.16em] opacity-75">{`Pot: ${view.pot} bits`}</div>,
    <div key="thanks" className="pt-1 text-center font-script text-[18px]">Thank you — deal again soon!</div>,
  ];
  const { shown, done, finish } = usePrint(lines.length, view.roundNumber);

  return <Scrim>
    <div role="document" aria-label="Receipt" onClick={finish}
      className="receipt-in deli-paper receipt-edge w-full max-w-[340px] cursor-default px-5 pb-6 pt-5 text-deli-green shadow-2xl">
      <div className="flex flex-col gap-1.5">
        {lines.map((line, i) => (
          <div key={i} className={i < shown ? 'receipt-line' : 'opacity-0'}>{line}</div>
        ))}
      </div>
    </div>
    {done && (youParticipate ? (
      <button type="button" disabled={youReady} onClick={onReady} className="settle deli-pill deli-pill--green btn-lift mt-5 !text-[16px]">
        {youReady ? `Waiting… ${readyCount}/${participants.length}` : 'Next hand'}
      </button>
    ) : (
      <p className="settle mt-5 font-script text-[18px] text-deli-cream">Waiting for the next hand… {readyCount}/{participants.length} ready</p>
    ))}
  </Scrim>;
}

export function RebuyPrompt({ canRebuy = true, onRebuy, onDecline }: { canRebuy?: boolean; onRebuy: () => void; onDecline: () => void }) {
  // A tear-off ticket: red stub, dashed perforation, cream body.
  return <Scrim>
    <div data-ticket className="settle flex w-full max-w-[380px] overflow-hidden rounded-md text-deli-green shadow-2xl">
      <div className="flex w-12 shrink-0 items-center justify-center bg-deli-red text-deli-cream">
        <span className="-rotate-90 whitespace-nowrap font-cond text-[15px] font-black uppercase tracking-[.2em]">Back in?</span>
      </div>
      <div className="deli-paper flex-1 border-l-[3px] border-dashed border-deli-red/60 px-5 py-4 text-center">
        <h3 className="font-cond text-[22px] font-black uppercase leading-none tracking-[.04em]">You&apos;re out — over 150</h3>
        {canRebuy ? (
          <>
            <p className="mt-2 font-sans-deli text-[13px]">Buy back in for 4 bits and re-enter at the current top score?</p>
            <div className="mt-4 flex justify-center gap-2.5">
              <button type="button" className="deli-pill deli-pill--red btn-lift !px-4 !py-2 !text-[14px]" onClick={onRebuy}>Buy back in</button>
              <button type="button" className="deli-pill deli-pill--outline btn-lift !px-4 !py-2 !text-[14px]" onClick={onDecline}>Decline</button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 font-sans-deli text-[13px]">Too few players remain under 150 to buy back in — this one&apos;s a wrap.</p>
            <div className="mt-4 flex justify-center">
              <button type="button" className="deli-pill deli-pill--outline btn-lift !px-5 !py-2 !text-[14px]" onClick={onDecline}>OK</button>
            </div>
          </>
        )}
      </div>
    </div>
  </Scrim>;
}

export function MatchSummary({ view }: { view: ClientView }) {
  const back = <Link href="/" className="deli-pill deli-pill--green btn-lift mt-5 !text-[15px]">Back to the kitchen</Link>;
  if (view.matchAbandoned) {
    return <Scrim><div className={`${PANEL} settle`}>
      <h3 className="font-cond text-[26px] font-black uppercase leading-none tracking-[.04em]">Game ended</h3>
      <p className="mt-2 font-sans-deli text-[13px]">This game was ended early — no winner. Buy-ins are returned; bits won hand-by-hand stand.</p>
      {back}
    </div></Scrim>;
  }
  const fmt = (b: number) => (b > 0 ? `+${b}` : String(b));
  const winner = view.matchWinnerSeat !== null ? view.seatNames[view.matchWinnerSeat] : 'The winner';
  const chain = 'absolute top-0 h-[30px] w-[2px] bg-[repeating-linear-gradient(180deg,#c9a24b_0_5px,#8a6a2a_5px_7px)]';
  // The winner's sign hangs on two chains and swings in once.
  return <Scrim>
    <div className="relative flex w-full max-w-[420px] flex-col items-center pt-[28px]">
      <span aria-hidden className={`${chain} left-[22%]`} />
      <span aria-hidden className={`${chain} right-[22%]`} />
      <div className="deli-paper deli-swing-in relative w-full rounded-2xl px-6 pb-5 pt-5 text-center text-deli-green shadow-[0_18px_36px_rgba(0,0,0,.45)]
        before:pointer-events-none before:absolute before:inset-[7px] before:rounded-[10px] before:border-2 before:border-deli-green
        after:pointer-events-none after:absolute after:inset-[11px] after:rounded-[7px] after:border after:border-deli-green/45">
        <h3 className="leading-none">
          <span className="block break-words font-cond text-[clamp(34px,10vw,56px)] font-black uppercase leading-[.9]">{winner}</span>{' '}
          <span className="mt-1 block font-script text-[28px] text-deli-red">takes the pot</span>
        </h3>
        <div className="mt-1 font-wide text-[10px] font-extrabold uppercase tracking-[.3em] [font-stretch:125%]">{`of ${view.pot} bits`}</div>
        {view.payout && (
          <ul className="relative mx-auto mt-3 max-w-[260px] text-left" aria-label="Pot payout">
            {view.payout.map((b, seat) => (
              <li key={seat} className="deli-leader !py-0.5 font-cond text-[15px] font-extrabold uppercase">
                <span className="min-w-0 [overflow-wrap:anywhere]">{view.seatNames[seat]}</span><span className="sr-only">: </span><span className="lead" /><span className={`tabular-nums ${signTone(b)}`}>{fmt(b)}</span> <span className="font-sans-deli text-[10px] font-semibold normal-case opacity-70">bits</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {back}
    </div>
  </Scrim>;
}
