// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Fake Daily: participants keyed by session id, each with user_id + track states.
const fake = {
  participants: {} as Record<string, { user_id: string; video: boolean; audio: boolean }>,
  localId: '',
  speaker: null as string | null,
  daily: { setLocalAudio: vi.fn(), setLocalVideo: vi.fn() },
};
vi.mock('@daily-co/daily-react', () => ({
  DailyProvider: ({ children }: any) => <>{children}</>,
  DailyAudio: () => null,
  DailyVideo: ({ sessionId }: any) => <video data-testid={`video-${sessionId}`} />,
  useDaily: () => fake.daily,
  useLocalSessionId: () => fake.localId,
  useParticipantIds: ({ filter }: any) =>
    Object.entries(fake.participants).filter(([, p]) => filter(p)).map(([id]) => id),
  useVideoTrack: (id: string) => ({ isOff: !fake.participants[id]?.video, state: fake.participants[id]?.video ? 'playable' : 'off' }),
  useAudioTrack: (id: string) => ({ isOff: !fake.participants[id]?.audio }),
  useActiveSpeakerId: () => fake.speaker,
}));
const join = vi.fn(async () => {});
const createCallObject = vi.fn(() => ({ on: vi.fn(), join, leave: vi.fn(async () => {}), destroy: vi.fn(async () => {}), isDestroyed: () => false }));
vi.mock('@daily-co/daily-js', () => ({ default: { createCallObject, getCallInstance: () => undefined } }));

import { CallProvider, CallControls, SeatVideo } from '../call';

// Node 25's own (flag-gated) localStorage shadows jsdom's; use a simple in-memory one.
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; }, clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
  };
}

beforeEach(() => {
  fake.participants = {};
  fake.localId = '';
  fake.speaker = null;
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', memoryStorage());
});

describe('SeatVideo', () => {
  it('renders nothing when that seat is not in the call (avatar shows instead)', () => {
    const { container } = render(<SeatVideo seat={1} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('renders the seat’s video when their camera is on', () => {
    fake.participants = { s1: { user_id: 'seat-1', video: true, audio: true }, s2: { user_id: 'seat-2', video: true, audio: true } };
    render(<SeatVideo seat={1} />);
    expect(screen.getByTestId('video-s1')).toBeInTheDocument();
    expect(screen.queryByTestId('video-s2')).toBeNull();
  });
  it('falls back (renders nothing) when their camera is off, and shows a muted badge when mic is off', () => {
    fake.participants = { s1: { user_id: 'seat-1', video: false, audio: true } };
    const { container, rerender } = render(<SeatVideo seat={1} />);
    expect(container).toBeEmptyDOMElement();
    fake.participants = { s1: { user_id: 'seat-1', video: true, audio: false } };
    rerender(<SeatVideo seat={1} />);
    expect(screen.getByLabelText('Muted')).toBeInTheDocument();
  });
});

describe('CallControls', () => {
  it('joins with server-issued credentials, then offers mute / camera / leave', async () => {
    const creds = vi.fn(async () => ({ ok: true as const, url: 'https://x.daily.co/r', token: 'T' }));
    fake.localId = 'me';
    fake.participants = { me: { user_id: 'seat-0', video: true, audio: true } };
    render(<CallProvider fetchCredentials={creds}><CallControls /></CallProvider>);
    fireEvent.click(screen.getByRole('button', { name: /join video call/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /leave video call/i })).toBeInTheDocument());
    expect(join).toHaveBeenCalledWith({ url: 'https://x.daily.co/r', token: 'T' });
    expect(localStorage.getItem('kortn:call:auto')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: /^mute$/i }));
    expect(fake.daily.setLocalAudio).toHaveBeenCalledWith(false);
  });

  it('shows the reason and lets you retry when joining is refused', async () => {
    const creds = vi.fn(async () => ({ ok: false as const, reason: 'Not a player in this game' }));
    render(<CallProvider fetchCredentials={creds}><CallControls /></CallProvider>);
    fireEvent.click(screen.getByRole('button', { name: /join video call/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /join video call/i }).getAttribute('title')).toMatch(/Not a player/));
    expect(createCallObject).not.toHaveBeenCalled();
  });

  it('rejoins automatically if you were in the call last time on this device', async () => {
    localStorage.setItem('kortn:call:auto', '1');
    const creds = vi.fn(async () => ({ ok: true as const, url: 'u', token: 't' }));
    render(<CallProvider fetchCredentials={creds}><CallControls /></CallProvider>);
    await waitFor(() => expect(creds).toHaveBeenCalled());
  });
});
