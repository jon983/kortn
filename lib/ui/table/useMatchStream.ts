'use client';
import { useEffect, useState } from 'react';
import type { ClientView } from '../../server';

export interface ChatLine {
  id: string;
  seat: number;
  body: string;
  at: string;
}

export function useMatchStream(
  matchId: string,
  initial: ClientView,
  initialChat: ChatLine[] = [],
): { view: ClientView; chat: ChatLine[] } {
  const [view, setView] = useState<ClientView>(initial);
  const [chat, setChat] = useState<ChatLine[]>(initialChat);
  useEffect(() => {
    const es = new EventSource(`/api/matches/${matchId}/stream`);
    es.onmessage = (e) => {
      let data: unknown;
      try { data = JSON.parse(e.data); } catch { return; } // ignore keep-alives
      if (!data || typeof data !== 'object') return;
      const rec = data as Record<string, unknown>;
      if (rec.type === 'chat') {
        const line: ChatLine = { id: String(rec.id), seat: Number(rec.seat), body: String(rec.body), at: String(rec.at) };
        setChat((c) => (c.some((m) => m.id === line.id) ? c : [...c, line]));
      } else if ('you' in rec) {
        setView(data as ClientView);
      }
    };
    return () => es.close();
  }, [matchId]);
  return { view, chat };
}
