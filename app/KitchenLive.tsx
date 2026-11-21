'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { playYourTurn, unlockAudioOnce } from '../lib/ui/table/sounds';

/**
 * Keeps the kitchen current without a live connection: re-renders the page on a timer
 * (quicker while a table is being set up), pauses while the tab is hidden, and plays the
 * turn chime when a game newly becomes your move. Renders nothing.
 */
export function KitchenLive({ hasLobby, yourTurnIds }: { hasLobby: boolean; yourTurnIds: string[] }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => { if (!document.hidden) router.refresh(); };
    const id = setInterval(tick, hasLobby ? 4000 : 15000);
    const onVisible = () => { if (!document.hidden) router.refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [hasLobby, router]);

  // Browsers block sound until the page has been touched; arm the unlock once.
  useEffect(() => { unlockAudioOnce(); }, []);

  // Chime once per game as it flips to your move — never for what was already showing on load.
  const seen = useRef<Set<string> | null>(null);
  const key = yourTurnIds.join(',');
  useEffect(() => {
    const now = new Set(key ? key.split(',') : []);
    if (seen.current && [...now].some((id) => !seen.current!.has(id))) playYourTurn();
    seen.current = now;
  }, [key]);

  return null;
}
