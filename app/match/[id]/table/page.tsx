import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db, getMatch } from '../../../../lib/db';
import { resolveSeat, redactStateFor } from '../../../../lib/server';
import { loadGameState, listPlayersWithNames } from '../../../../lib/db';
import { TableView } from '../../../../lib/ui/table/TableView';

export default async function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const { id } = await params;
  const match = await getMatch(db, id);
  if (!match) redirect('/');
  if (match.status === 'lobby') redirect(`/match/${id}/lobby`);
  const seat = await resolveSeat(db, id, userId);
  if (seat === null) redirect('/');
  const loaded = await loadGameState(db, id);
  if (!loaded) redirect('/');
  const players = await listPlayersWithNames(db, id);
  const names: (string | null)[] = [];
  for (const p of players) names[p.seatIndex] = p.displayName;
  const initial = redactStateFor(loaded.state, seat, names);
  return <TableView matchId={id} initial={initial} />;
}
