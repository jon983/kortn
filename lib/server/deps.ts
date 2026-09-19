import type { DB } from '../db';
import type { PubSub } from './pubsub';
import type { Action as EngineAction } from '../kalooki';

export interface RuntimeDeps {
  db: DB;
  pubsub: PubSub;
  rng: () => number;
}

export type SubmitResult = { ok: true } | { ok: false; reason: string };

export type ServerAction = EngineAction | { type: 'rebuy' } | { type: 'decline' } | { type: 'readyNext' };
