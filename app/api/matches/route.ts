import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getProdDeps } from '../../../lib/server/prod-deps';
import { createLobby } from '../../../lib/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  const user = await currentUser();
  const displayName = user?.username ?? user?.firstName ?? 'Player';
  const { seats } = await req.json();
  let res;
  try {
    res = await createLobby(getProdDeps(), { userId, displayName, seats: Number(seats) });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ...res });
}
