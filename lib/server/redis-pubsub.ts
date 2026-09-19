import { createClient, type RedisClientType } from 'redis';
import type { PubSub } from './pubsub';

export class RedisPubSub implements PubSub {
  private url: string;
  private publisherPromise: Promise<RedisClientType> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  private async getPublisher(): Promise<RedisClientType> {
    if (!this.publisherPromise) {
      const client = createClient({ url: this.url });
      this.publisherPromise = client.connect().then(() => client);
    }
    return this.publisherPromise;
  }

  async publish(channel: string, message: unknown): Promise<void> {
    const pub = await this.getPublisher();
    await pub.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, handler: (message: unknown) => void): Promise<() => Promise<void>> {
    const base = await this.getPublisher();
    const sub: RedisClientType = base.duplicate();
    await sub.connect();
    await sub.subscribe(channel, (raw) => {
      handler(JSON.parse(raw));
    });
    return async () => {
      await sub.unsubscribe(channel);
      await sub.quit();
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
