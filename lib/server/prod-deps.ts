import { db } from '../db';
import { RedisPubSub } from './redis-pubsub';
import type { RuntimeDeps } from './deps';

let cached: RuntimeDeps | null = null;

export function getProdDeps(): RuntimeDeps {
  if (!cached) {
    cached = {
      db,
      pubsub: new RedisPubSub(process.env.REDIS_URL ?? ''),
      rng: Math.random,
    };
  }
  return cached;
}
