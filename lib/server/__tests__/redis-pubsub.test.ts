import { describe, it, expect } from 'vitest';
import { RedisPubSub } from '../redis-pubsub';

const url = process.env.REDIS_URL;
const maybe = url ? describe : describe.skip;

maybe('RedisPubSub (smoke, requires REDIS_URL)', () => {
  it('round-trips a message', async () => {
    const ps = new RedisPubSub(url!);
    const got: unknown[] = [];
    const off = await ps.subscribe('match:test', (m) => got.push(m));
    await new Promise((r) => setTimeout(r, 100));
    await ps.publish('match:test', { hello: 'world' });
    await new Promise((r) => setTimeout(r, 200));
    expect(got).toEqual([{ hello: 'world' }]);
    await off();
    await ps.close();
  });
});

// Also assert the class is constructable without a connection (no network at import).
describe('RedisPubSub construction', () => {
  it('constructs without connecting', () => {
    const ps = new RedisPubSub('redis://localhost:6379');
    expect(ps).toBeInstanceOf(RedisPubSub);
  });
});
