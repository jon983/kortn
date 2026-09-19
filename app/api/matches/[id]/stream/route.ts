import { auth } from '@clerk/nextjs/server';
import { getProdDeps } from '../../../../../lib/server/prod-deps';
import { resolveSeat, redactStateFor } from '../../../../../lib/server';
import { loadGameState } from '../../../../../lib/db';
import type { MatchState } from '../../../../../lib/kalooki';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response('unauthorized', { status: 401 });
  const { id } = await params;
  const deps = getProdDeps();
  const seat = await resolveSeat(deps.db, id, userId);
  if (seat === null) return new Response('forbidden', { status: 403 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (view: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(view)}\n\n`));

      // initial catch-up
      const cur = await loadGameState(deps.db, id);
      if (cur) send(redactStateFor(cur.state, seat));

      const off = await deps.pubsub.subscribe('match:' + id, (msg) => {
        if (msg != null && typeof msg === 'object' && 'round' in (msg as Record<string, unknown>)) {
          // full MatchState → always redact per this client's seat
          send(redactStateFor(msg as MatchState, seat));
        } else {
          // lobby ping / non-state message (carries no hands)
          send(msg);
        }
      });
      // close handling
      _req.signal.addEventListener('abort', async () => {
        await off();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
