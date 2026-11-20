'use client';
import { useEffect, useRef, useState } from 'react';
import type { ClientView } from '../../server';

export interface ChatLine {
  id: string;
  seat: number;
  body: string;
  at: string;
}

export interface MatchStreamOptions {
  /** Fetch the current table from the server — used to re-sync after a gap. */
  fetchView?: () => Promise<ClientView | null>;
}

const CLOSED = 2; // EventSource.CLOSED (avoid touching the global in SSR)

/**
 * Live table updates over SSE, kept healthy:
 *  - If the browser gives up on the stream (a reconnect that got a non-200,
 *    e.g. an expired session after the tab slept), reopen it with backoff
 *    instead of leaving the table frozen until a manual refresh.
 *  - Whenever the stream (re)opens, or the tab comes back to the foreground /
 *    the network returns, re-fetch the current table so nothing missed in the
 *    gap is lost.
 */
export function useMatchStream(
  matchId: string,
  initial: ClientView,
  initialChat: ChatLine[] = [],
  opts: MatchStreamOptions = {},
): { view: ClientView; chat: ChatLine[]; connected: boolean } {
  const [view, setView] = useState<ClientView>(initial);
  const [chat, setChat] = useState<ChatLine[]>(initialChat);
  const [connected, setConnected] = useState(true);
  const fetchViewRef = useRef(opts.fetchView);
  fetchViewRef.current = opts.fetchView;

  useEffect(() => {
    let disposed = false;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const resync = async () => {
      const fetchView = fetchViewRef.current;
      if (!fetchView) return;
      try {
        const fresh = await fetchView();
        if (!disposed && fresh) setView(fresh);
      } catch { /* offline / transient — the stream or next resync will catch up */ }
    };

    const open = () => {
      if (disposed) return;
      es = new EventSource(`/api/matches/${matchId}/stream`);
      es.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      es.onerror = () => {
        setConnected(false);
        // readyState CLOSED means the browser won't retry on its own.
        if (es && es.readyState === CLOSED) scheduleReopen();
      };
      es.onmessage = (e) => {
        let data: unknown;
        try { data = JSON.parse(e.data); } catch { return; } // ignore keep-alives
        if (!data || typeof data !== 'object') return;
        const rec = data as Record<string, unknown>;
        if (rec.type === 'chat') {
          const line: ChatLine = { id: String(rec.id), seat: Number(rec.seat), body: String(rec.body), at: String(rec.at) };
          setChat((c) => (c.some((m) => m.id === line.id) ? c : [...c, line]));
        } else if ('you' in rec) {
          setConnected(true);
          setView(data as ClientView);
        }
      };
    };

    const scheduleReopen = () => {
      if (disposed || retryTimer) return;
      const delay = Math.min(1000 * 2 ** attempt, 15000);
      attempt++;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        es?.close();
        open();
        void resync();
      }, delay);
    };

    const onWake = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!es || es.readyState === CLOSED) {
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        attempt = 0;
        open();
      }
      void resync();
    };

    open();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', onWake);
    window.addEventListener('pageshow', onWake);
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', onWake);
      window.removeEventListener('pageshow', onWake);
    };
  }, [matchId]);

  return { view, chat, connected };
}
