export interface PubSub {
  publish(channel: string, message: unknown): Promise<void>;
  subscribe(channel: string, handler: (message: unknown) => void): Promise<() => void | Promise<void>>;
}

export class InMemoryPubSub implements PubSub {
  private channels = new Map<string, Set<(message: unknown) => void>>();

  async publish(channel: string, message: unknown): Promise<void> {
    const handlers = this.channels.get(channel);
    if (!handlers) return;
    for (const h of [...handlers]) h(message);
  }

  async subscribe(channel: string, handler: (message: unknown) => void): Promise<() => void> {
    let set = this.channels.get(channel);
    if (!set) { set = new Set(); this.channels.set(channel, set); }
    set.add(handler);
    return () => {
      const s = this.channels.get(channel);
      if (s) { s.delete(handler); if (s.size === 0) this.channels.delete(channel); }
    };
  }
}
