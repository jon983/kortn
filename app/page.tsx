import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db, listMatchesForUser, listPlayersWithNames, loadGameState, getUserStats, getVsParLeaderboard } from '../lib/db';
import { RoomBackdrop } from '../lib/ui/RoomBackdrop';
import { Framed } from '../lib/ui/Framed';
import { LampButton } from '../lib/ui/LampButton';
import { JoinBox } from './JoinBox';
import { DeleteGameButton } from './DeleteGameButton';

export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const [matches, stats, leaderboard] = await Promise.all([
    listMatchesForUser(db, userId),
    getUserStats(db, userId),
    getVsParLeaderboard(db, { limit: 10 }),
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

        <div className="mt-10">
          <Framed title="At the table">
            {summaries.length === 0 && <p className="text-sm text-ink/70 p-2">No games yet — set the table.</p>}
            {summaries.map(({ match: m, players }) => (
              <div key={m.id} className="relative border-b border-dotted border-[#b0a98f]">
                <Link href={`/match/${m.id}/${m.status === 'lobby' ? 'lobby' : 'table'}`}
                  className="block p-2 pr-8 text-sm hover:bg-black/5">
                  <div className="flex justify-between">
                    <span>{m.status === 'lobby' ? 'Kitchen' : 'Game'} · {players.length}/{m.seats} seats</span>
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
                {m.createdBy === userId && (
                  <div className="absolute right-1 top-1.5">
                    <DeleteGameButton matchId={m.id} />
                  </div>
                )}
              </div>
            ))}
          </Framed>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <Framed title="Your record">
            <StatsPanel stats={stats} />
          </Framed>
          <Framed title="Leaderboard · hands vs par">
            <Leaderboard entries={leaderboard} meId={userId} />
          </Framed>
        </div>

        <JoinBox />
      </main>
    </RoomBackdrop>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'good' | 'bad' }) {
  const valueColor = accent === 'good' ? 'text-sage-deep' : accent === 'bad' ? 'text-maroon' : 'text-walnut';
  return (
    <div className="rounded-lg border border-[#b0a98f]/50 bg-black/[0.03] p-3 text-center">
      <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-ink/60">{label}</div>
      {sub && <div className="text-[10px] text-ink/45">{sub}</div>}
    </div>
  );
}

type Leaders = Awaited<ReturnType<typeof getVsParLeaderboard>>;

function Leaderboard({ entries, meId }: { entries: Leaders; meId: string }) {
  if (entries.length === 0) {
    return <p className="p-2 text-sm text-ink/70">No hands played yet — the leaderboard fills in as games are played.</p>;
  }
  return (
    <ol className="text-sm">
      {entries.map((e, i) => {
        const me = e.userId === meId;
        return (
          <li key={e.userId} className={`flex items-baseline gap-2 border-b border-dotted border-[#b0a98f] px-2 py-1.5 ${me ? 'bg-brass/10' : ''}`}>
            <span className="w-5 text-right text-ink/50 tabular-nums">{i + 1}</span>
            <span className="flex-1 truncate">{e.name}{me ? ' (you)' : ''}</span>
            <span className="text-[10px] text-ink/45 tabular-nums">{e.roundsWon}/{e.roundsPlayed}</span>
            <b className={`w-14 text-right tabular-nums ${e.vsPar >= 1 ? 'text-sage-deep' : 'text-maroon'}`}>{e.vsPar.toFixed(2)}×</b>
          </li>
        );
      })}
    </ol>
  );
}

type Stats = Awaited<ReturnType<typeof getUserStats>>;

function StatsPanel({ stats }: { stats: Stats }) {
  const pct = Math.round(stats.winRate * 100);
  const vsPar = stats.vsPar;
  const avg = stats.avgPointsPerRound;
  const fmtBits = (b: number) => (b > 0 ? `+${b}` : String(b));

  if (stats.gamesPlayed === 0 && stats.roundsWon === 0) {
    return <p className="p-2 text-sm text-ink/70">No games played yet — your record will fill in as you play.</p>;
  }

  return (
    <div className="p-1">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Win rate" value={`${pct}%`} sub={`${stats.gamesWon} of ${stats.gamesPlayed} games`} />
        <Tile
          label="Hands vs par"
          value={vsPar == null ? '—' : `${vsPar.toFixed(2)}×`}
          sub={`${stats.roundsWon} won · par ${stats.parWins.toFixed(1)}`}
          accent={vsPar == null ? undefined : vsPar >= 1 ? 'good' : 'bad'}
        />
        <Tile label="Avg pts / hand" value={avg == null ? '—' : avg.toFixed(1)} sub="lower is better" />
        <Tile label="Net bits" value={fmtBits(stats.netBits)} sub="all games" accent={stats.netBits > 0 ? 'good' : stats.netBits < 0 ? 'bad' : undefined} />
      </div>

      <details className="group mt-3">
        <summary className="cursor-pointer list-none text-center text-xs font-bold uppercase tracking-wide text-maroon hover:underline">
          <span className="group-open:hidden">More stats ▾</span>
          <span className="hidden group-open:inline">Fewer stats ▴</span>
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile label="Games played" value={String(stats.gamesPlayed)} />
          <Tile label="Games won" value={String(stats.gamesWon)} />
          <Tile label="Hands won" value={String(stats.roundsWon)} />
          <Tile label="Kalookis 🃏" value={String(stats.kalookis)} />
          <Tile label="Treasures ★" value={String(stats.treasures)} />
          <Tile label="Pot winnings" value={`${stats.potWinnings}`} sub="bits" />
        </div>
      </details>
    </div>
  );
}
