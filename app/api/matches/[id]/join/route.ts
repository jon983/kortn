import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getProdDeps } from '../../../../../lib/server/prod-deps';
import { joinLobby } from '../../../../../lib/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  const user = await currentUser();
  const displayName = user?.username ?? user?.firstName ?? 'Player';
  const { joinCode } = await req.json();
  const res = await joinLobby(getProdDeps(), { userId, displayName, joinCode });
  return NextResponse.json({ ok: true, ...res });
}
