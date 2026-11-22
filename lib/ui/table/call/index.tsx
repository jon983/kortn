'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  DailyProvider, DailyAudio, DailyVideo, useDaily, useLocalSessionId, useParticipantIds,
  useVideoTrack, useAudioTrack, useActiveSpeakerId,
} from '@daily-co/daily-react';
import type { DailyCall, DailyParticipant } from '@daily-co/daily-js';
import { seatUserId } from '../../../call-ids';

type CallState = 'idle' | 'joining' | 'joined' | 'error';
type Credentials = { ok: true; url: string; token: string } | { ok: false; reason: string };

interface CallApi {
  state: CallState;
  error: string | null;
  join(): Promise<void>;
  leave(): Promise<void>;
}
const CallCtx = createContext<CallApi>({ state: 'idle', error: null, join: async () => {}, leave: async () => {} });
export const useCall = () => useContext(CallCtx);

/** Joined last time on this device → rejoin automatically next time. */
const AUTO_KEY = 'kortn:call:auto';
const remember = (on: boolean) => { try { localStorage.setItem(AUTO_KEY, on ? '1' : '0'); } catch { /* storage blocked */ } };
const remembered = () => { try { return localStorage.getItem(AUTO_KEY) === '1'; } catch { return false; } };

/**
 * Owns the game's Daily call: created only when the player taps to join (or
 * rejoins automatically if they were in the call last time on this device).
 */
export function CallProvider({ fetchCredentials, enabled = true, volume = 1, children }: {
  fetchCredentials: () => Promise<Credentials>;
  enabled?: boolean;
  /** How loud the other players are, 0..1 (0 mutes them). The video slider in the volume control. */
  volume?: number;
  children: ReactNode;
}) {
  const [call, setCall] = useState<DailyCall | null>(null);
  const [state, setState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const callRef = useRef<DailyCall | null>(null);

  const teardown = useCallback(async () => {
    const co = callRef.current;
    callRef.current = null;
    setCall(null);
    if (co && !co.isDestroyed()) {
      await co.leave().catch(() => {});
      await co.destroy().catch(() => {});
    }
  }, []);

  const join = useCallback(async () => {
    if (callRef.current) return;
    setState('joining');
    setError(null);
    try {
      const creds = await fetchCredentials();
      if (!creds.ok) throw new Error(creds.reason);
      const Daily = (await import('@daily-co/daily-js')).default;
      const co = Daily.getCallInstance() ?? Daily.createCallObject();
      callRef.current = co;
      setCall(co);
      co.on('left-meeting', () => { if (callRef.current === co) { void teardown(); setState('idle'); } });
      co.on('error', (ev) => { setError(ev?.errorMsg ?? 'Call error'); setState('error'); void teardown(); });
      await co.join({ url: creds.url, token: creds.token });
      setState('joined');
      remember(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t join the call');
      setState('error');
      await teardown();
    }
  }, [fetchCredentials, teardown]);

  const leave = useCallback(async () => {
    remember(false);
    setState('idle');
    await teardown();
  }, [teardown]);

  useEffect(() => {
    if (enabled && remembered()) void join();
    return () => { void teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per table mount
  }, []);

  useEffect(() => { if (!enabled && callRef.current) void leave(); }, [enabled, leave]);

  return (
    <CallCtx.Provider value={{ state, error, join, leave }}>
      <DailyProvider callObject={call}>
        {children}
        {state === 'joined' && <CallAudio volume={volume} />}
      </DailyProvider>
    </CallCtx.Provider>
  );
}

/**
 * The other players' voices, at the chosen level. DailyAudio adds and swaps its
 * audio elements as people join and speak, so new ones get the level too.
 * (iPhones ignore an audio element's volume; there only 0 = muted takes effect.)
 */
function CallAudio({ volume }: { volume: number }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const v = Math.max(0, Math.min(1, volume));
    const apply = () => el.querySelectorAll('audio').forEach((a) => { a.volume = v; a.muted = v === 0; });
    apply();
    const watch = new MutationObserver(apply);
    watch.observe(el, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [volume]);
  return <div ref={box} data-call-audio><DailyAudio /></div>;
}

/** Small line icons (stroke = currentColor) so the call buttons match the deli header tags. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden className="block">
      {children}
    </svg>
  );
}
const VideoIcon = ({ off = false }: { off?: boolean }) => (
  <Icon>
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="m16 10.5 5-3v9l-5-3" />
    {off && <path d="M3 3l18 18" />}
  </Icon>
);
const MicIcon = ({ off = false }: { off?: boolean }) => (
  <Icon>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" />
    {off && <path d="M3 3l18 18" />}
  </Icon>
);
const LeaveIcon = () => <Icon><path d="M18 6 6 18M6 6l12 12" /></Icon>;

const ctrl = 'flex items-center justify-center rounded-full border px-2 py-[3px] hover:bg-deli-cream/10 disabled:opacity-50';

/** Status-bar controls: 📹 to join; once in, mic / camera toggles and leave. */
export function CallControls() {
  const { state, error, join, leave } = useCall();
  const daily = useDaily();
  const localId = useLocalSessionId();
  const mic = useAudioTrack(localId ?? '');
  const cam = useVideoTrack(localId ?? '');

  if (state !== 'joined') {
    return (
      <button
        type="button"
        onClick={() => void join()}
        disabled={state === 'joining'}
        aria-label="Join video call"
        title={error ? `Video call: ${error} — tap to retry` : 'Join the video call'}
        className={`${ctrl} ${state === 'error' ? 'border-deli-red bg-deli-red/25 text-deli-cream' : 'border-deli-cream/50 text-deli-cream'}`}
      >
        {state === 'joining' ? <span className="block h-4 w-4 animate-pulse text-center leading-4">…</span> : <VideoIcon />}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        aria-label={mic.isOff ? 'Unmute' : 'Mute'}
        aria-pressed={!mic.isOff}
        onClick={() => daily?.setLocalAudio(mic.isOff)}
        className={`${ctrl} ${mic.isOff ? 'border-deli-red bg-deli-red/25 text-deli-cream' : 'border-deli-gold text-deli-gold'}`}
      >
        <MicIcon off={mic.isOff} />
      </button>
      <button
        type="button"
        aria-label={cam.isOff ? 'Turn camera on' : 'Turn camera off'}
        aria-pressed={!cam.isOff}
        onClick={() => daily?.setLocalVideo(cam.isOff)}
        className={`${ctrl} ${cam.isOff ? 'border-deli-red bg-deli-red/25 text-deli-cream' : 'border-deli-gold text-deli-gold'}`}
      >
        <VideoIcon off={cam.isOff} />
      </button>
      <button type="button" aria-label="Leave video call" onClick={() => void leave()} className={`${ctrl} border-deli-red bg-deli-red text-deli-cream`}>
        <LeaveIcon />
      </button>
    </span>
  );
}

/**
 * A seat's live video circle, or nothing (the seat's avatar shows instead) when
 * that player isn't in the call or has their camera off.
 */
export function SeatVideo({ seat, className = '' }: { seat: number; className?: string }) {
  const filter = useCallback((p: DailyParticipant) => p.user_id === seatUserId(seat), [seat]);
  const [id] = useParticipantIds({ filter });
  if (!id) return null;
  return <SeatVideoTile id={id} className={className} />;
}

function SeatVideoTile({ id, className }: { id: string; className: string }) {
  const video = useVideoTrack(id);
  const audio = useAudioTrack(id);
  const speaker = useActiveSpeakerId();
  // Only once frames can actually play — a loading/blocked track would be an empty ring.
  if (video.state !== 'playable') return null;
  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      <span className={`block h-full w-full overflow-hidden rounded-full shadow-lg ring-2 ${speaker === id && !audio.isOff ? 'ring-deli-gold' : 'ring-deli-cream/80'}`}>
        <DailyVideo sessionId={id} fit="cover" automirror className="h-full w-full object-cover" />
      </span>
      {audio.isOff && (
        <span aria-label="Muted" className="absolute -bottom-0.5 -right-0.5 rounded-full bg-black/80 px-1 text-[10px]">🔇</span>
      )}
    </span>
  );
}
