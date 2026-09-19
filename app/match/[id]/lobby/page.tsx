import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db, getMatch } from '../../../../lib/db';
import { getLobbyState } from '../../../actions/match';
import { RoomBackdrop } from '../../../../lib/ui/RoomBackdrop';
import { WaitingRoom } from './WaitingRoom';

export default async function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const { id } = await params;
  const match = await getMatch(db, id);
  if (!match) redirect('/');
  if (match.status === 'active') redirect(`/match/${id}/table`);
  const initial = await getLobbyState(id);
  return (
    <RoomBackdrop plate="room-waiting">
      <WaitingRoom matchId={id} joinCode={match.joinCode} viewerId={userId} initial={initial} />
    </RoomBackdrop>
  );
}
