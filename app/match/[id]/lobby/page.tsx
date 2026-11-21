import { redirect } from 'next/navigation';
import { db, getMatch } from '../../../../lib/db';

/** The waiting room is gone — tables wait in the kitchen. Old links go to the table if it's dealt, else the kitchen. */
export default async function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await getMatch(db, id);
  redirect(match?.status === 'active' ? `/match/${id}/table` : '/');
}
