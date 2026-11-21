import Link from 'next/link';
import { RoomBackdrop } from '../lib/ui/RoomBackdrop';
import { Framed } from '../lib/ui/Framed';
import { LampButton } from '../lib/ui/LampButton';
import { JoinBox } from './JoinBox';
import { GameRow, type GameRowProps } from './GameRow';
import { HomeHeader } from './HomeHeader';
import { LeaderboardTabs } from './LeaderboardTabs';
import type { ReactNode } from 'react';
import type { UserStats } from '../lib/db';
import { CountUp } from '../lib/ui/CountUp';
import type { Leaderboards } from '../lib/stats/hands';

export interface HomeViewProps {
  userId: string;
  myName: string;
  stats: UserStats;
  boards: Leaderboards;
  minHands: number;
  games: Omit<GameRowProps, 'now'>[];
}

/** The front room: who you are, your stats, then create / join / rejoin. */
export function HomeView({ userId, myName, stats, boards, minHands, games }: HomeViewProps) {
  return (
    <RoomBackdrop plate="room-home" kitchenLink={false} ambient>
      <HomeHeader name={myName} />
      {/* Phones: rejoin comes first (the common case); wider screens lead with stats. */}
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 pb-12 pt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Framed tilt={false} title="Your record" className="settle" style={{ animationDelay: '0ms' }}>
            <StatsPanel stats={stats} />
          </Framed>
          <Framed tilt={false} title="Leaderboards" className="settle" style={{ animationDelay: '90ms' }}>
            <LeaderboardTabs boards={boards} meId={userId} minHands={minHands} />
          </Framed>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Framed tilt={false} title="Create a new game" className="settle" style={{ animationDelay: '180ms' }}>
            <div className="flex flex-col items-center gap-2 p-1">
              <p className="text-center text-xs text-ink/65">Set the table and send friends the code.</p>
              <Link href="/create" className="w-full"><LampButton className="w-full !py-2" sheenDelay={0.3}>Set the table</LampButton></Link>
            </div>
          </Framed>
          <Framed tilt={false} title="Join a new game" className="settle" style={{ animationDelay: '270ms' }}>
            <JoinBox />
          </Framed>
        </div>

        <Framed tilt={false} title="Rejoin an existing game" className="settle order-first md:order-none" style={{ animationDelay: '360ms' }}>
          {games.length === 0 && <p className="p-2 text-sm text-ink/70">No games in progress — create or join one above.</p>}
          {games.map((g, i) => <GameRow key={g.id} {...g} index={i} />)}
        </Framed>
      </main>
    </RoomBackdrop>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: string; accent?: 'good' | 'bad' }) {
  const valueColor = accent === 'good' ? 'text-sage-deep' : accent === 'bad' ? 'text-maroon' : 'text-walnut';
  return (
    <div className="rounded-lg border border-[#b0a98f]/50 bg-black/[0.03] p-3 text-center">
      <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-ink/60">{label}</div>
      {sub && <div className="text-[10px] text-ink/45">{sub}</div>}
    </div>
  );
}

type Stats = UserStats;

function StatsPanel({ stats }: { stats: Stats }) {
  const pct = Math.round(stats.winRate * 100);
  const vsPar = stats.vsPar;
  const avg = stats.avgPointsPerRound;

  if (stats.gamesPlayed === 0 && stats.roundsWon === 0) {
    return <p className="p-2 text-sm text-ink/70">No games played yet — your record will fill in as you play.</p>;
  }

  return (
    <div className="p-1">
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Win rate" value={<CountUp value={pct} suffix="%" />} sub={`${stats.gamesWon} of ${stats.gamesPlayed} games`} />
        <Tile
          label="Hands vs par"
          value={vsPar == null ? '—' : <CountUp value={vsPar} decimals={2} suffix="×" />}
          sub={`${stats.roundsWon} won · par ${stats.parWins.toFixed(1)}`}
          accent={vsPar == null ? undefined : vsPar >= 1 ? 'good' : 'bad'}
        />
        <Tile label="Avg pts / hand" value={avg == null ? '—' : <CountUp value={avg} decimals={1} />} sub="lower is better" />
        <Tile label="Net bits" value={<CountUp value={stats.netBits} signed />} sub="all games" accent={stats.netBits > 0 ? 'good' : stats.netBits < 0 ? 'bad' : undefined} />
      </div>

      <details className="group mt-3">
        <summary className="cursor-pointer list-none text-center text-xs font-bold uppercase tracking-wide text-maroon hover:underline">
          <span className="group-open:hidden">More stats ▾</span>
          <span className="hidden group-open:inline">Fewer stats ▴</span>
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile label="Games played" value={<CountUp value={stats.gamesPlayed} />} />
          <Tile label="Games won" value={<CountUp value={stats.gamesWon} />} />
          <Tile label="Hands won" value={<CountUp value={stats.roundsWon} />} />
          <Tile label="Kalookis 🃏" value={<CountUp value={stats.kalookis} />} />
          <Tile label="Treasures ★" value={<CountUp value={stats.treasures} />} />
          <Tile label="Pot winnings" value={<CountUp value={stats.potWinnings} />} sub="bits" />
        </div>
      </details>
    </div>
  );
}
