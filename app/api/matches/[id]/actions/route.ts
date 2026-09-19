import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getProdDeps } from '../../../../../lib/server/prod-deps';
import { submitAction } from '../../../../../lib/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const action = await req.json();
  const res = await submitAction(getProdDeps(), { matchId: id, userId, action });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
