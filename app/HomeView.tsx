import { RoomBackdrop } from '../lib/ui/RoomBackdrop';
import { JoinPill } from './JoinPill';
import { SetTablePill } from './SetTablePill';
import { KitchenLive } from './KitchenLive';
import { ShopSign, MenuBoard, Ribbon } from '../lib/ui/deli';
import { RecordList } from '../lib/ui/deli/RecordList';
import { GameRow, type GameRowProps } from './GameRow';
import { HomeHeader } from './HomeHeader';
import { LeaderboardTabs } from './LeaderboardTabs';
import { ViewTransition } from 'react';
import type { UserStats } from '../lib/db';
import type { Leaderboards } from '../lib/stats/hands';

export interface HomeViewProps {
  userId: string;
  myName: string;
  stats: UserStats;
  boards: Leaderboards;
  minHands: number;
  games: Omit<GameRowProps, 'now'>[];
}

/** The kitchen as a corner deli: a hanging shop sign, then the menu board (record, leaderboard, actions, today's tables). */
export function HomeView({ userId, myName, stats, boards, minHands, games }: HomeViewProps) {
  return (
    <RoomBackdrop plate="room-home" kitchenLink={false} ambient>
      <KitchenLive games={games} />
      <HomeHeader name={myName} />
      <main className="mx-auto max-w-[860px] px-3 pb-12 sm:px-5">
        <ShopSign name={myName} className="settle pb-2" />

        <MenuBoard className="settle mt-2 [animation-delay:90ms]">
          {/* Phones: today's tables come first (the common case); wider screens lead with the record. */}
          <div className="flex flex-col">
            <div className="grid gap-8 md:grid-cols-2 md:gap-[34px]">
              <section>
                <Ribbon>Your record</Ribbon>
                <RecordList stats={stats} />
              </section>
              <section>
                <Ribbon>The leaderboard</Ribbon>
                <LeaderboardTabs boards={boards} meId={userId} minHands={minHands} />
              </section>
            </div>

            <div className="mb-2 mt-7 flex flex-wrap items-start justify-center gap-3.5">
              <SetTablePill />
              <JoinPill />
            </div>

            <section className="order-first mb-8 md:order-none md:mb-0 md:mt-6">
              <Ribbon>Today&apos;s tables</Ribbon>
              {games.length === 0 && (
                <p className="px-1 py-3 font-sans-deli text-sm text-deli-green/75">No tables yet — set one, or join with a code.</p>
              )}
              {games.map((g, i) => (
                // Rows slide in; an abandoned/deleted row slides out while the rest glide up into its place.
                <ViewTransition key={g.id} enter="vt-row-in" exit="vt-row-out" update="vt-row-move" default="none">
                  <div><GameRow {...g} index={i} /></div>
                </ViewTransition>
              ))}
            </section>
          </div>
        </MenuBoard>
      </main>
    </RoomBackdrop>
  );
}
