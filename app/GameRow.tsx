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
    // Phone: names span the full width, details + buttons share the line below.
    // Wider: names over details on the left, buttons on the right.
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-dotted border-[#b0a98f] px-2 py-2">
      <Link href={href} className="col-span-2 min-w-0 rounded hover:bg-black/5 sm:col-span-1">
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-lg leading-tight text-ink">
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
      </Link>
      <div className="min-w-0 text-[11px] uppercase tracking-wide text-ink/55 sm:col-start-1">{meta}</div>
      <div className="flex shrink-0 items-center gap-1.5 sm:col-start-2 sm:row-span-2 sm:row-start-1">
        <Link
          href={href}
          className="rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-3 py-1 text-center text-xs font-bold uppercase tracking-wider text-bone shadow hover:brightness-110"
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
