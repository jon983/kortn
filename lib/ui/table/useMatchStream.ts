'use client';
import { useEffect, useState } from 'react';
import type { ClientView } from '../../server';

export function useMatchStream(matchId: string, initial: ClientView): ClientView {
  const [view, setView] = useState<ClientView>(initial);
  useEffect(() => {
    const es = new EventSource(`/api/matches/${matchId}/stream`);
    es.onmessage = (e) => {
      try { setView(JSON.parse(e.data) as ClientView); } catch { /* ignore keep-alives */ }
    };
    return () => es.close();
  }, [matchId]);
  return view;
}
