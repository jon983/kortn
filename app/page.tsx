import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { HomeView } from './HomeView';
import { db, listMatchesForUser, listPlayersWithNames, loadGameState, getUserStats, getHandAggregates, leaderboardsFrom, upsertUser } from '../lib/db';

const MIN_HANDS = 10;

export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Keep our copy of name + picture in step with the account, so other players
  // see your avatar at the table. (No uploaded picture → initials.)
  const me = await currentUser();
  const myName = me?.username ?? me?.firstName ?? 'Player';
  await upsertUser(db, { id: userId, displayName: myName, avatarUrl: me?.hasImage ? me.imageUrl : null });

  const [matches, hands] = await Promise.all([listMatchesForUser(db, userId), getHandAggregates(db)]);
  // One pass over every hand feeds both the leaderboards and your own record.
  const stats = await getUserStats(db, userId, hands.get(userId) ?? null);
  const boards = leaderboardsFrom(hands, { minHands: MIN_HANDS, limit: 10 });
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
    <HomeView
      userId={userId}
      myName={myName}
      stats={stats}
      boards={boards}
      minHands={MIN_HANDS}
      games={summaries.map(({ match: m, players }) => ({
        id: m.id,
        status: m.status as 'lobby' | 'active',
        number: m.number,
        seats: m.seats,
        lastActiveAt: m.lastActiveAt,
        players,
        isHost: m.createdBy === userId,
      }))}
    />
  );
}
