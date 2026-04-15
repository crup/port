import type { PortMessage } from './types';

export const PROTOCOL = 'crup.port';
export const VERSION = '1';

export function randomId(prefix = 'msg'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isPortMessage(value: unknown): value is PortMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const data = value as Partial<PortMessage>;
  return (
    data.protocol === PROTOCOL &&
    data.version === VERSION &&
    typeof data.instanceId === 'string' &&
    typeof data.messageId === 'string' &&
    typeof data.kind === 'string' &&
    typeof data.type === 'string'
  );
}
