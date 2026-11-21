'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loadSavedVolume, playYourTurn, unlockAudioOnce } from '../lib/ui/table/sounds';

type LiveGame = { id: string; status: 'lobby' | 'active'; yourTurn?: boolean };

/**
 * Keeps the kitchen current without a live connection: re-renders the page on a timer
 * (quicker while a table is being set up; not at all with no tables), pauses while the tab
 * is hidden, and chimes when a table you're waiting at is dealt or a game becomes your move.
 * Renders nothing.
 */
export function KitchenLive({ games }: { games: LiveGame[] }) {
  const router = useRouter();
  const cadence = games.some((g) => g.status === 'lobby') ? 4000 : games.length > 0 ? 15000 : null;

  useEffect(() => {
    if (cadence === null) return;
    const refresh = () => { if (!document.hidden) router.refresh(); };
    const id = setInterval(refresh, cadence);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh); };
  }, [cadence, router]);

  // Respect the volume chosen at the table, and arm the unlock (browsers block sound until a tap).
  useEffect(() => { loadSavedVolume(); unlockAudioOnce(); }, []);

  // Chime once per change worth stepping in for — never for what was already showing on load.
  const seen = useRef<Set<string> | null>(null);
  const key = games.flatMap((g) => [...(g.status === 'active' ? [`dealt:${g.id}`] : []), ...(g.yourTurn ? [`turn:${g.id}`] : [])]).join(',');
  useEffect(() => {
    const now = new Set(key ? key.split(',') : []);
    if (seen.current && [...now].some((k) => !seen.current!.has(k))) playYourTurn();
    seen.current = now;
  }, [key]);

  return null;
}
