import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db, listMatchesForUser, getUserStats } from '../lib/db';
import { RoomBackdrop } from '../lib/ui/RoomBackdrop';
import { Framed } from '../lib/ui/Framed';
import { LampButton } from '../lib/ui/LampButton';
import { JoinBox } from './JoinBox';

export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const [matches, stats] = await Promise.all([
    listMatchesForUser(db, userId),
    getUserStats(db, userId),
  ]);
  const active = matches.filter((m) => m.status === 'lobby' || m.status === 'active');

  return (
    <RoomBackdrop plate="room-home">
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-display)] text-6xl text-brass drop-shadow">kortn</h1>
          <p className="italic text-bone/80">— sit, we were just about to deal —</p>
          <div className="mt-6 flex justify-center gap-4">
            <Link href="/create"><LampButton>Set the table</LampButton></Link>
            <Link href="#join"><LampButton className="!bg-[linear-gradient(180deg,#c6d0b3,#a6b589)] !text-ink !border-sage-deep">Pull up a chair</LampButton></Link>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <Framed title="At the table">
            {active.length === 0 && <p className="text-sm text-ink/70 p-2">No games yet — set the table.</p>}
            {active.map((m) => (
              <Link key={m.id} href={`/match/${m.id}/${m.status === 'lobby' ? 'lobby' : 'table'}`}
                className="flex justify-between p-2 text-sm border-b border-dotted border-[#b0a98f] hover:bg-black/5">
                <span>{m.status === 'lobby' ? 'Lobby' : 'Game'} · {m.seats} seats</span>
                <span className="uppercase text-[10px] tracking-wide text-maroon">{m.status} ▸</span>
              </Link>
            ))}
          </Framed>
          <Framed title="Your record">
            <Stat label="Games played" value={stats?.gamesPlayed ?? 0} />
            <Stat label="Rounds won" value={stats?.roundsWon ?? 0} />
            <Stat label="Bits, net" value={(stats?.bitsNet ?? 0) > 0 ? `+${stats?.bitsNet}` : String(stats?.bitsNet ?? 0)} />
          </Framed>
        </div>

        <JoinBox />
      </main>
    </RoomBackdrop>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between p-2 text-sm border-b border-dotted border-[#b0a98f]">
      <span>{label}</span><b className="text-walnut">{value}</b>
    </div>
  );
}
