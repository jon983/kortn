import { describe, it, expect } from 'vitest';
import { InMemoryPubSub } from '../pubsub';

describe('InMemoryPubSub', () => {
  it('delivers published messages to subscribers of the same channel', async () => {
    const ps = new InMemoryPubSub();
    const got: unknown[] = [];
    await ps.subscribe('match:1', (m) => got.push(m));
    await ps.publish('match:1', { v: 1 });
    await ps.publish('match:1', { v: 2 });
    expect(got).toEqual([{ v: 1 }, { v: 2 }]);
  });

  it('does not deliver across channels', async () => {
    const ps = new InMemoryPubSub();
    const got: unknown[] = [];
    await ps.subscribe('match:1', (m) => got.push(m));
    await ps.publish('match:2', { v: 1 });
    expect(got).toEqual([]);
  });

  it('unsubscribe stops delivery', async () => {
    const ps = new InMemoryPubSub();
    const got: unknown[] = [];
    const off = await ps.subscribe('match:1', (m) => got.push(m));
    off();
    await ps.publish('match:1', { v: 1 });
    expect(got).toEqual([]);
  });
});
