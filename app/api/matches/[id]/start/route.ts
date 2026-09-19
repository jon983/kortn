import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getProdDeps } from '../../../../../lib/server/prod-deps';
import { startGame } from '../../../../../lib/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const res = await startGame(getProdDeps(), { matchId: id, userId });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
