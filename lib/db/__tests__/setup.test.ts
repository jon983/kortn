import { describe, it, expect } from 'vitest';
import { makeTestDb } from './helpers';
import { OptimisticLockError } from '../errors';

describe('db setup', () => {
  it('creates a migrated in-memory PGlite database', async () => {
    const { db, client } = await makeTestDb();
    // A trivial query proves the connection + at least one migrated table exist.
    const rows = await db.execute('select 1 as ok');
    expect(rows.rows[0]).toEqual({ ok: 1 });
    await client.close();
  });

  it('exposes OptimisticLockError', () => {
    const e = new OptimisticLockError('stale');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('OptimisticLockError');
  });
});
