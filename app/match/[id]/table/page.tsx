import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db, getMatch } from '../../../../lib/db';
import { loadClientView } from '../../../../lib/server';
import { listRecentChatMessages } from '../../../../lib/db';
import { TableView } from '../../../../lib/ui/table/TableView';

export default async function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const { id } = await params;
  const match = await getMatch(db, id);
  if (!match) redirect('/');
  if (match.status === 'lobby') redirect('/');
  const initial = await loadClientView(db, id, userId);
  if (!initial) redirect('/');
  const chatRows = await listRecentChatMessages(db, id);
  const initialChat = chatRows.map((m) => ({
    id: m.id,
    seat: m.seatIndex,
    body: m.body,
    at: (m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt)).toISOString(),
  }));
  return <TableView matchId={id} initial={initial} initialChat={initialChat} />;
}
