'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTableAction } from '../actions/lobby';
import { LampButton } from '../../lib/ui/LampButton';

export function CreateForm() {
  const router = useRouter();
  const [seats, setSeats] = useState(4);
  async function submit() {
    const fd = new FormData();
    fd.set('seats', String(seats));
    const { matchId } = await createTableAction(fd);
    router.push(`/match/${matchId}/lobby`);
  }
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-widest text-[#8a7f66] mb-3">Chairs at the table</div>
      <div className="flex justify-center gap-3">
        {[2, 3, 4, 5].map((n) => (
          <button key={n} aria-pressed={seats === n} onClick={() => setSeats(n)}
            className={`w-16 rounded-lg border-2 py-3 font-[family-name:var(--font-display)] text-2xl
              ${seats === n ? 'border-walnut bg-[linear-gradient(180deg,#c6d0b3,#a6b589)] text-walnut' : 'border-[#cbbf9c] bg-[#efe9d8] text-walnut/80'}`}>
            {n}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink/70">Buy-in: <b className="text-maroon">4 bits</b> each into the pot</p>
      <div className="mt-4"><LampButton onClick={submit}>Deal us in ▸</LampButton></div>
      <p className="mt-3 text-xs italic text-ink/60">You'll get a code to send round — nobody's dealt until everyone's seated.</p>
    </div>
  );
}
