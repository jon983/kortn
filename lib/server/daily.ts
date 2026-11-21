/** Minimal Daily REST client: one private room per game, a meeting token per player. */
const API = 'https://api.daily.co/v1';

export interface DailyRoom { name: string; url: string }
export interface TokenRequest { roomName: string; userId: string; userName: string; exp: number }
export interface DailyClient {
  getOrCreateRoom(name: string): Promise<DailyRoom>;
  createToken(req: TokenRequest): Promise<string>;
}

/** Stable, URL-safe room name for a match (Daily limits room names; a bare uuid fits). */
export function roomNameFor(matchId: string): string {
  return `kortn-${matchId.replace(/-/g, '').toLowerCase()}`;
}

export function dailyClient(apiKey: string, fetchImpl: typeof fetch = fetch): DailyClient {
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, json };
  };
  const fail = (what: string, r: { status: number; json: Record<string, unknown> }) =>
    new Error(`Daily ${what} failed: ${r.status} ${String(r.json.error ?? '')} ${String(r.json.info ?? '')}`.trim());

  const getRoom = async (name: string): Promise<DailyRoom | null> => {
    const r = await call('GET', `/rooms/${encodeURIComponent(name)}`);
    if (r.status === 404) return null;
    if (r.status !== 200) throw fail('get room', r);
    return { name: String(r.json.name), url: String(r.json.url) };
  };

  return {
    async getOrCreateRoom(name) {
      const existing = await getRoom(name);
      if (existing) return existing;
      const r = await call('POST', '/rooms', { name, privacy: 'private' });
      if (r.status === 200) return { name: String(r.json.name), url: String(r.json.url) };
      // Another player created it between our GET and POST.
      if (r.status === 400 && /already exists/i.test(String(r.json.info ?? ''))) {
        const again = await getRoom(name);
        if (again) return again;
      }
      throw fail('create room', r);
    },
    async createToken({ roomName, userId, userName, exp }) {
      const r = await call('POST', '/meeting-tokens', {
        properties: { room_name: roomName, user_id: userId, user_name: userName, exp },
      });
      if (r.status !== 200 || typeof r.json.token !== 'string') throw fail('create token', r);
      return r.json.token;
    },
  };
}
