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
  /** `out`: busted / no longer in this game — shown greyed with "out" instead of points. */
  players: { name: string; score: number | null; out?: boolean }[];
  isHost: boolean;
  now?: Date;
  /** Position in the list (reserved for staggered effects). */
  index?: number;
  /** It's the viewer's move in this game. */
  yourTurn?: boolean;
}

/** Muted text link for the ticket's secondary action (abandon / delete). */
const QUIET_LINK = 'font-script text-[16px] text-deli-green/55 hover:text-deli-red hover:underline disabled:opacity-40';

/** One game as a deli queue ticket: stamped number, who's playing, a dotted leader to Play. */
export function GameRow({ id, status, number, seats, lastActiveAt, players, isHost, now, yourTurn = false }: GameRowProps) {
  const href = `/match/${id}/${status === 'lobby' ? 'lobby' : 'table'}`;
  const meta = status === 'lobby'
    ? `waiting · ${players.length}/${seats} seated`
    : yourTurn ? 'your turn' : `played ${timeAgo(lastActiveAt, now)}`;
  const action = status === 'lobby' ? 'Open' : yourTurn ? 'Your move' : 'Play';
  return (
    <div className="flex items-center gap-3 border-b border-dashed border-deli-green/30 px-1 py-3 last:border-b-0 sm:gap-3.5 sm:px-1.5">
      {/* Stamped deli-ticket number */}
      <div aria-label={`Game number ${number}`} className="grid h-12 w-12 flex-none place-items-center rounded-full bg-deli-red text-center text-deli-cream shadow-[inset_0_0_0_3px_var(--color-deli-red),inset_0_0_0_5px_var(--color-deli-cream)] sm:h-[58px] sm:w-[58px]">
        <span className="leading-none">
          <small className="block font-sans-deli text-[8px] font-semibold tracking-[.2em]">NO.</small>
          <b className="font-cond text-[22px] font-black leading-[.85] sm:text-[26px]">{number}</b>
        </span>
      </div>

      <Link href={href} className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 font-cond text-[21px] font-extrabold uppercase leading-[.95] sm:text-[25px]">
          {players.length === 0 ? (
            <span className="opacity-60">No players yet</span>
          ) : (
            players.map((p, i) => (
              <span key={i} data-player className={`whitespace-nowrap ${p.out ? 'opacity-40' : ''}`}>
                {p.name}
                {p.out
                  ? <span className="ml-1 font-sans-deli text-[10px] font-semibold tracking-[.14em]">out</span>
                  : p.score !== null && <b className="ml-1 text-deli-red">{p.score}</b>}
              </span>
            ))
          )}
        </div>
        <div className={`mt-0.5 font-sans-deli text-[10.5px] font-medium uppercase tracking-[.14em] ${yourTurn ? 'text-deli-red' : 'opacity-70'}`}>{meta}</div>
      </Link>

      <span aria-hidden className="hidden min-w-6 flex-1 self-center border-b-[2.5px] border-dotted border-current opacity-35 sm:block" />

      <div className="flex flex-none flex-col items-center gap-0.5">
        <Link href={href} className={`deli-pill btn-lift !px-4 !py-2 !text-[15px] sm:!px-5 ${yourTurn ? 'deli-pill--red' : 'deli-pill--green'}`}>
          {action}
        </Link>
        {status === 'lobby' && isHost
          ? <DeleteGameButton matchId={id} label="delete" className={QUIET_LINK} />
          : <EndGameButton matchId={id} label="abandon" className={QUIET_LINK} />}
      </div>
    </div>
  );
}
