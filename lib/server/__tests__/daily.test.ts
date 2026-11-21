import { describe, it, expect, vi } from 'vitest';
import { dailyClient, roomNameFor } from '../daily';

type Call = { method: string; url: string; body?: unknown };

function fakeFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = responses.shift();
    if (!r) throw new Error('unexpected fetch');
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe('roomNameFor', () => {
  it('is stable per match and within Daily naming limits', () => {
    const n = roomNameFor('3f2b9c1e-1234-4abc-9def-0123456789ab');
    expect(n).toBe('kortn-3f2b9c1e12344abc9def0123456789ab');
    expect(n).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('dailyClient', () => {
  it('reuses an existing room', async () => {
    const f = fakeFetch([{ status: 200, body: { name: 'r1', url: 'https://x.daily.co/r1' } }]);
    const room = await dailyClient('KEY', f.fn).getOrCreateRoom('r1');
    expect(room.url).toBe('https://x.daily.co/r1');
    expect(f.calls).toEqual([{ method: 'GET', url: 'https://api.daily.co/v1/rooms/r1', body: undefined }]);
    expect((f.fn as any).mock.calls[0][1].headers.Authorization).toBe('Bearer KEY');
  });

  it('creates a private room when it does not exist yet', async () => {
    const f = fakeFetch([
      { status: 404, body: { error: 'not-found' } },
      { status: 200, body: { name: 'r1', url: 'https://x.daily.co/r1' } },
    ]);
    const room = await dailyClient('KEY', f.fn).getOrCreateRoom('r1');
    expect(room.url).toBe('https://x.daily.co/r1');
    expect(f.calls[1]).toMatchObject({ method: 'POST', url: 'https://api.daily.co/v1/rooms', body: { name: 'r1', privacy: 'private' } });
  });

  it('survives a race where another player created the room first', async () => {
    const f = fakeFetch([
      { status: 404, body: { error: 'not-found' } },
      { status: 400, body: { error: 'invalid-request-error', info: 'a room named r1 already exists' } },
      { status: 200, body: { name: 'r1', url: 'https://x.daily.co/r1' } },
    ]);
    const room = await dailyClient('KEY', f.fn).getOrCreateRoom('r1');
    expect(room.url).toBe('https://x.daily.co/r1');
    expect(f.calls.map((c) => c.method)).toEqual(['GET', 'POST', 'GET']);
  });

  it('issues a meeting token scoped to the room, user and expiry', async () => {
    const f = fakeFetch([{ status: 200, body: { token: 'TOK' } }]);
    const token = await dailyClient('KEY', f.fn).createToken({ roomName: 'r1', userId: 'seat-2', userName: 'Ines', exp: 123 });
    expect(token).toBe('TOK');
    expect(f.calls[0]).toEqual({
      method: 'POST', url: 'https://api.daily.co/v1/meeting-tokens',
      body: { properties: { room_name: 'r1', user_id: 'seat-2', user_name: 'Ines', exp: 123 } },
    });
  });

  it('surfaces API errors', async () => {
    const f = fakeFetch([{ status: 401, body: { error: 'authorization-header-error' } }]);
    await expect(dailyClient('BAD', f.fn).getOrCreateRoom('r1')).rejects.toThrow(/401/);
  });
});
