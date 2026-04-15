import type { EventHandler } from './types';

export class Emitter {
  private listeners = new Map<string, Set<EventHandler>>();

  on(type: string, handler: EventHandler): void {
    const set = this.listeners.get(type) ?? new Set<EventHandler>();
    set.add(handler);
    this.listeners.set(type, set);
  }

  off(type: string, handler: EventHandler): void {
    this.listeners.get(type)?.delete(handler);
  }

  async emit(type: string, payload: unknown): Promise<void> {
    const list = this.listeners.get(type);
    if (!list) {
      return;
    }
    await Promise.all([...list].map(async (handler) => handler(payload)));
  }
}
