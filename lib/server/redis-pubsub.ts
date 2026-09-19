import { createClient, type RedisClientType } from 'redis';
import type { PubSub } from './pubsub';

// node-redis client options tuned for long-lived pub/sub connections:
// - pingInterval keeps an otherwise-idle connection alive (prevents server-side idle drops / read ETIMEDOUT)
// - reconnectStrategy retries with capped backoff so a dropped socket recovers (node-redis re-subscribes on reconnect)
// - an 'error' listener is REQUIRED: without it, connection errors surface as uncaught exceptions.
function makeClient(url: string): RedisClientType {
  const client: RedisClientType = createClient({
    url,
    pingInterval: 15000,
    socket: {
      keepAlive: true,
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
  });
  client.on('error', (err) => {
    console.error('[redis] client error:', (err as Error).message);
  });
  return client;
}

export class RedisPubSub implements PubSub {
  private url: string;
  private publisherPromise: Promise<RedisClientType> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  private async getPublisher(): Promise<RedisClientType> {
    if (!this.publisherPromise) {
      const client = makeClient(this.url);
      this.publisherPromise = client.connect().then(() => client);
    }
    return this.publisherPromise;
  }

  async publish(channel: string, message: unknown): Promise<void> {
    const pub = await this.getPublisher();
    await pub.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, handler: (message: unknown) => void): Promise<() => Promise<void>> {
    // A dedicated connection per subscription (node-redis requires this for SUBSCRIBE),
    // sharing the same tuned options + error handling as the publisher.
    const sub = makeClient(this.url);
    await sub.connect();
    await sub.subscribe(channel, (raw) => {
      try {
        handler(JSON.parse(raw));
      } catch {
        /* ignore malformed payloads */
      }
    });
    return async () => {
      try {
        await sub.unsubscribe(channel);
      } finally {
        await sub.quit();
      }
    };
  }

  async close(): Promise<void> {
    if (this.publisherPromise) {
      const client = await this.publisherPromise;
      await client.quit();
      this.publisherPromise = null;
    }
  }
}
