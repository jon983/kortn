import { auth } from '@clerk/nextjs/server';
import { getProdDeps } from '../../../../../lib/server/prod-deps';
import { resolveSeat, redactStateFor } from '../../../../../lib/server';
import { loadGameState, listPlayersWithNames } from '../../../../../lib/db';
import type { MatchState } from '../../../../../lib/kalooki';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response('unauthorized', { status: 401 });
  const { id } = await params;
  const deps = getProdDeps();
  const seat = await resolveSeat(deps.db, id, userId);
  if (seat === null) return new Response('forbidden', { status: 403 });

  // Seat→name map (fixed for the life of the match) so every pushed view carries names.
  const players = await listPlayersWithNames(deps.db, id);
  const names: (string | null)[] = [];
  const avatars: (string | null)[] = [];
  for (const p of players) { names[p.seatIndex] = p.displayName; avatars[p.seatIndex] = p.avatarUrl; }

  const encoder = new TextEncoder();
  let cleanup: (() => Promise<void>) | null = null;
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(chunk)); } catch { closed = true; }
      };
      const send = (view: unknown) => write(`data: ${JSON.stringify(view)}\n\n`);

      // Subscribe BEFORE the catch-up read, so a move published in between is
      // never lost (it arrives as a message; the catch-up is at least as new).
      const off = await deps.pubsub.subscribe('match:' + id, (msg) => {
        if (msg != null && typeof msg === 'object' && 'round' in (msg as Record<string, unknown>)) {
          // full MatchState → always redact per this client's seat
          send(redactStateFor(msg as MatchState, seat, names, avatars));
        } else {
          // lobby ping / non-state message (carries no hands)
          send(msg);
        }
      });

      // initial catch-up
      const cur = await loadGameState(deps.db, id);
      if (cur) send(redactStateFor(cur.state, seat, names, avatars));

      // Keep-alive comment so idle connections (players thinking) aren't dropped
      // by proxies / mobile networks. EventSource ignores comment lines.
      const ping = setInterval(() => write(': ping\n\n'), 25_000);

      cleanup = async () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        await off();
        try { controller.close(); } catch { /* already closed */ }
      };
      _req.signal.addEventListener('abort', () => { void cleanup?.(); });
    },
    cancel() { void cleanup?.(); },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
