'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLobbyState, startGameAction, type LobbyState } from '../../../actions/match';
import { TableShape } from '../../../../lib/ui/TableShape';
import { PlaceCard } from '../../../../lib/ui/PlaceCard';
import { LampButton } from '../../../../lib/ui/LampButton';

export function WaitingRoom({
  matchId,
  joinCode,
  viewerId,
  initial,
}: {
  matchId: string;
  joinCode: string;
  viewerId: string;
  initial: LobbyState;
}) {
  const router = useRouter();
  const [state, setState] = useState<LobbyState>(initial);

  useEffect(() => {
    let closed = false;
    const es = new EventSource(`/api/matches/${matchId}/stream`);
    const refresh = async () => {
      const s = await getLobbyState(matchId);
      if (closed) return;
      setState(s);
      if (s.status === 'active') {
        closed = true;
        clearInterval(poll);
        es.close();
        router.push(`/match/${matchId}/table`);
      }
    };
    es.onmessage = refresh;
    // Polling backstop: SSE (Redis pub/sub) can miss a message across a reconnect,
    // so re-sync the lobby every few seconds until the game starts.
    const poll = setInterval(refresh, 4000);
    return () => {
      closed = true;
      clearInterval(poll);
      es.close();
    };
  }, [matchId, router]);

  const bySeat = new Map(state.players.map((p) => [p.seat, p]));
  const full = state.players.length === state.seats;
  const isHost = viewerId === state.hostUserId;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 text-center">
      <div className="inline-block rounded-lg border-2 border-dashed border-brass bg-[linear-gradient(180deg,#f6efd8,#e9dfbe)] px-6 py-3 shadow">
        <div className="text-[10px] uppercase tracking-widest text-[#8a7f5f]">Table code — send it round</div>
        <div className="font-[family-name:var(--font-display)] text-4xl tracking-[.4em] text-maroon">{joinCode}</div>
      </div>

      <div className="mt-6">
        <TableShape
          seats={state.seats}
          renderSeat={(seat) => {
            const p = bySeat.get(seat);
            return p ? <PlaceCard name={p.name} host={false} /> : <PlaceCard empty />;
          }}
        />
      </div>

      <div className="mt-4 text-bone">
        {state.players.length} of {state.seats} seated
      </div>
      {isHost && (
        <div className="mt-3">
          <LampButton
            disabled={!full}
            onClick={async () => {
              const r = await startGameAction(matchId);
              if (r.ok) router.push(`/match/${matchId}/table`);
            }}
          >
            {full ? 'Deal ▸' : 'Deal ▸ (waiting for a full table)'}
          </LampButton>
        </div>
      )}
    </div>
  );
}
