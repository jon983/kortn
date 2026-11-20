import Link from 'next/link';
import { DeleteGameButton } from './DeleteGameButton';
import { EndGameButton } from './EndGameButton';
import { timeAgo } from '../lib/ui/time-ago';

export interface GameRowProps {
  id: string;
  status: 'lobby' | 'active';
  number: number;
  seats: number;
  lastActiveAt: Date;
  players: { name: string; score: number | null }[];
  isHost: boolean;
  now?: Date;
}

/** One game in the front-room list: who's playing + scores up top, details below, actions on the right. */
export function GameRow({ id, status, number, seats, lastActiveAt, players, isHost, now }: GameRowProps) {
  const href = `/match/${id}/${status === 'lobby' ? 'lobby' : 'table'}`;
  const meta = [
    `Game #${number}`,
    status === 'lobby' ? `waiting · ${players.length}/${seats} seated` : `${seats} players`,
    `${status === 'lobby' ? 'set up' : 'played'} ${timeAgo(lastActiveAt, now)}`,
  ].join(' · ');
  return (
    <div className="flex items-center gap-3 border-b border-dotted border-[#b0a98f] px-2 py-3">
      <Link href={href} className="min-w-0 flex-1 rounded hover:bg-black/5">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-lg leading-tight text-ink">
          {players.length === 0 ? (
            <span className="text-ink/60">No players yet</span>
          ) : (
            players.map((p, i) => (
              <span key={i} className="whitespace-nowrap">
                {p.name}{p.score !== null && <b className="ml-1.5 tabular-nums text-walnut">{p.score}</b>}
              </span>
            ))
          )}
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-wide text-ink/55">{meta}</div>
      </Link>
      <div className="flex w-24 shrink-0 flex-col items-stretch gap-1.5">
        <Link
          href={href}
          className="rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-bone shadow hover:brightness-110"
        >
          {status === 'lobby' ? 'Open' : 'Play'}
        </Link>
        {status === 'lobby' && isHost
          ? <DeleteGameButton matchId={id} />
          : <EndGameButton matchId={id} label="Abandon" />}
      </div>
    </div>
  );
}
