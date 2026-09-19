import { createClient, type RedisClientType } from 'redis';
import type { PubSub } from './pubsub';

export class RedisPubSub implements PubSub {
  private url: string;
  private publisher: RedisClientType | null = null;

  constructor(url: string) {
    this.url = url;
  }

  private async getPublisher(): Promise<RedisClientType> {
    if (!this.publisher) {
      this.publisher = createClient({ url: this.url });
      await this.publisher.connect();
    }
    return this.publisher;
  }

  async publish(channel: string, message: unknown): Promise<void> {
    const pub = await this.getPublisher();
    await pub.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, handler: (message: unknown) => void): Promise<() => Promise<void>> {
    const sub: RedisClientType = createClient({ url: this.url });
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
    if (this.publisher) {
      await this.publisher.quit();
      this.publisher = null;
    }
  }
}
