import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db, listMatchesForUser, listPlayersWithNames, loadGameState, getUserStats } from '../lib/db';
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

  // Pull player names + live scores for each active game so the list is informative.
  const summaries = await Promise.all(
    active.map(async (m) => {
      const [players, game] = await Promise.all([
        listPlayersWithNames(db, m.id),
        m.status === 'active' ? loadGameState(db, m.id) : Promise.resolve(null),
      ]);
      const scores = game?.state.scores ?? null;
      return {
        match: m,
        players: players
          .sort((a, b) => a.seatIndex - b.seatIndex)
          .map((p) => ({
            name: p.userId === userId ? 'You' : p.displayName,
            score: scores?.[p.seatIndex] ?? null,
          })),
      };
    }),
  );

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
            {summaries.length === 0 && <p className="text-sm text-ink/70 p-2">No games yet — set the table.</p>}
            {summaries.map(({ match: m, players }) => (
              <Link key={m.id} href={`/match/${m.id}/${m.status === 'lobby' ? 'lobby' : 'table'}`}
                className="block p-2 text-sm border-b border-dotted border-[#b0a98f] hover:bg-black/5">
                <div className="flex justify-between">
                  <span>{m.status === 'lobby' ? 'Lobby' : 'Game'} · {players.length}/{m.seats} seats</span>
                  <span className="uppercase text-[10px] tracking-wide text-maroon">{m.status} ▸</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink/70">
                  {players.length === 0 ? (
                    <span>No players yet</span>
                  ) : (
                    players.map((p, i) => (
                      <span key={i}>
                        {p.name}{p.score !== null ? <b className="text-walnut"> {p.score}</b> : ''}
                      </span>
                    ))
                  )}
                </div>
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
