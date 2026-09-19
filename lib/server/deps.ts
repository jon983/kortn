import type { DB } from '../db';
import type { PubSub } from './pubsub';

export interface RuntimeDeps {
  db: DB;
  pubsub: PubSub;
  rng: () => number;
}

export type SubmitResult = { ok: true } | { ok: false; reason: string };
