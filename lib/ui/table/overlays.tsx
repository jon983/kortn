// lib/ui/table/overlays.tsx
// Minimal stub overlays — Task 8 will expand these.
'use client';
import type { ClientView } from '../../server';

const scrim = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70';
const card = 'rounded-xl bg-[#2a1a0e] border border-[#8b5e3c] p-8 text-bone text-center shadow-2xl';
const btn = 'mt-4 rounded-md border-2 border-[#8b5e3c] bg-[#6b4a30] px-6 py-2 text-sm font-bold text-bone';

export function RoundSummary({ view, onContinue }: { view: ClientView; onContinue: () => void }) {
  const winner = view.roundWinnerSeat != null ? `Seat ${view.roundWinnerSeat}` : 'Nobody';
  return (
    <div className={scrim}>
      <div className={card}>
        <h2 className="text-2xl font-bold mb-2">Round {view.roundNumber} over</h2>
        <p>{winner} wins the round</p>
        <button type="button" className={btn} onClick={onContinue}>Continue</button>
      </div>
    </div>
  );
}

export function RebuyPrompt({ onRebuy, onDecline }: { onRebuy: () => void; onDecline: () => void }) {
  return (
    <div className={scrim}>
      <div className={card}>
        <h2 className="text-2xl font-bold mb-2">Busted!</h2>
        <p>Would you like to rebuy and continue?</p>
        <div className="flex gap-4 justify-center">
          <button type="button" className={btn} onClick={onRebuy}>Rebuy</button>
          <button type="button" className={btn} onClick={onDecline}>Decline</button>
        </div>
      </div>
    </div>
  );
}

export function MatchSummary({ view }: { view: ClientView }) {
  const winner = view.matchWinnerSeat != null ? `Seat ${view.matchWinnerSeat}` : 'Nobody';
  return (
    <div className={scrim}>
      <div className={card}>
        <h2 className="text-2xl font-bold mb-2">Match over</h2>
        <p>{winner} wins the match!</p>
      </div>
    </div>
  );
}
