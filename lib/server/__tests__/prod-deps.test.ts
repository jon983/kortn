import { describe, it, expect, beforeEach } from 'vitest';

describe('getProdDeps', () => {
  beforeEach(() => { process.env.REDIS_URL = 'redis://localhost:6379'; });
  it('builds runtime deps with a pubsub and rng', async () => {
    const { getProdDeps } = await import('../prod-deps');
    const deps = getProdDeps();
    expect(typeof deps.rng).toBe('function');
    expect(deps.pubsub).toBeDefined();
    expect(deps.rng()).toBeGreaterThanOrEqual(0);
  });
});
