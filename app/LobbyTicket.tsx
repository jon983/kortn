import { DeleteGameButton } from './DeleteGameButton';
import { ShareCode } from './ShareCode';
import { DealButton } from './DealButton';
import { LeaveTableButton } from './LeaveTableButton';

const QUIET_LINK = 'font-script text-[16px] text-deli-green/55 hover:text-deli-red hover:underline disabled:opacity-40';

/**
 * A table being set up (not dealt yet), as a deli ticket: the code to share,
 * who's seated and the empty chairs, and Deal (host) or leave (guests).
 */
export function LobbyTicket({ id, number, seats, players, joinCode, hostName, isHost }: {
  id: string; number: number; seats: number; players: { name: string; score: number | null }[];
  joinCode: string; hostName: string; isHost: boolean;
}) {
  const empty = Math.max(0, seats - players.length);
  const full = empty === 0;
  return (
    <div className="flex items-center gap-3 border-b border-dashed border-deli-green/30 px-1 py-3 last:border-b-0 sm:gap-3.5 sm:px-1.5">
      <div aria-label={`Game number ${number}`} className="grid h-12 w-12 flex-none place-items-center rounded-full bg-deli-red text-center text-deli-cream shadow-[inset_0_0_0_3px_var(--color-deli-red),inset_0_0_0_5px_var(--color-deli-cream)] sm:h-[58px] sm:w-[58px]">
        <span className="leading-none">
          <small className="block font-sans-deli text-[8px] font-semibold tracking-[.2em]">NO.</small>
          <b className="font-cond text-[22px] font-black leading-[.85] sm:text-[26px]">{number}</b>
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-sans-deli text-[10px] font-semibold uppercase tracking-[.2em] opacity-70">Code</span>
          <span className="font-cond text-[26px] font-black tracking-[.18em] text-deli-red sm:text-[30px]">{joinCode}</span>
          <ShareCode code={joinCode} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 font-cond text-[19px] font-extrabold uppercase leading-[.95] sm:text-[21px]">
          {players.map((p, i) => <span key={i} className="min-w-0 [overflow-wrap:anywhere]">{p.name}</span>)}
          {Array.from({ length: empty }, (_, i) => <span key={`e${i}`} className="opacity-35">empty chair</span>)}
        </div>
        <div className="mt-0.5 font-sans-deli text-[10.5px] font-medium uppercase tracking-[.14em] opacity-70">
          {isHost
            ? (full ? 'everyone’s seated — deal when ready' : `waiting for ${empty} more · ${players.length}/${seats} seated`)
            : `waiting for ${hostName} to deal · ${players.length}/${seats} seated`}
        </div>
      </div>

      <div className="flex flex-none flex-col items-center gap-0.5">
        {isHost ? (
          <>
            <DealButton matchId={id} disabled={!full} />
            <DeleteGameButton matchId={id} label="delete" className={QUIET_LINK} />
          </>
        ) : (
          <LeaveTableButton matchId={id} className={QUIET_LINK} />
        )}
      </div>
    </div>
  );
}
