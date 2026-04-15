import { Emitter } from './emitter';
import { PortError } from './errors';
import type { ChildPortConfig, EventHandler, PortMessage } from './types';
import { isPortMessage, PROTOCOL, randomId, VERSION } from './utils';

export interface ChildPort {
  ready(): void;
  emit(type: string, payload?: unknown): void;
  on(type: string, handler: EventHandler): void;
  respond(messageId: string, payload: unknown): void;
  reject(messageId: string, payload?: unknown): void;
  resize(height: number): void;
  destroy(): void;
}

export function createChildPort(config: ChildPortConfig): ChildPort {
  validateChildConfig(config);

  const emitter = new Emitter();
  let instanceId: string | null = null;
  let hostWindow: Window | null = null;
  const hostOrigin = config.allowedOrigin;

  const listener = (event: MessageEvent): void => {
    if (!isPortMessage(event.data)) {
      return;
    }

    const message = event.data;

    if (message.kind === 'system' && message.type === 'port:hello') {
      if (hostOrigin !== event.origin) {
        return;
      }

      instanceId = message.instanceId;
      hostWindow = event.source as Window;
      ready();
      return;
    }

    if (!instanceId || !hostWindow || message.instanceId !== instanceId) {
      return;
    }

    if (event.source !== hostWindow || event.origin !== hostOrigin) {
      return;
    }

    if (message.kind === 'event') {
      void emitter.emit(message.type, message.payload);
      return;
    }

    if (message.kind === 'request') {
      void emitter.emit(`request:${message.type}`, message);
    }
  };

  window.addEventListener('message', listener);

  function post(message: Pick<PortMessage, 'kind' | 'type' | 'payload' | 'replyTo'>): void {
    if (!instanceId || !hostWindow || !hostOrigin) {
      return;
    }

    hostWindow.postMessage(
      {
        protocol: PROTOCOL,
        version: VERSION,
        instanceId,
        messageId: randomId(),
        ...message
      } satisfies PortMessage,
      hostOrigin
    );
  }

  function ready(): void {
    post({ kind: 'system', type: 'port:ready' });
  }

  function emit(type: string, payload?: unknown): void {
    post({ kind: 'event', type, payload });
  }

  function on(type: string, handler: EventHandler): void {
    emitter.on(type, handler);
  }

  function respond(messageId: string, payload: unknown): void {
    post({ kind: 'response', type: 'port:response', payload, replyTo: messageId });
  }

  function reject(messageId: string, payload: unknown = 'Rejected'): void {
    post({ kind: 'error', type: 'port:error', payload, replyTo: messageId });
  }

  function resize(height: number): void {
    if (!Number.isFinite(height) || height < 0) {
      return;
    }
    post({ kind: 'event', type: 'port:resize', payload: height });
  }

  function destroy(): void {
    window.removeEventListener('message', listener);
  }

  return { ready, emit, on, respond, reject, resize, destroy };
}

function validateChildConfig(config: ChildPortConfig): void {
  if (!config.allowedOrigin) {
    throw new PortError('INVALID_CONFIG', 'allowedOrigin is required for child ports');
  }

  try {
    const parsed = new URL(config.allowedOrigin);
    if (parsed.origin !== config.allowedOrigin) {
      throw new Error('Origin must not include a path');
    }
  } catch {
    throw new PortError('INVALID_CONFIG', 'allowedOrigin must be an exact origin such as https://host.example.com');
  }
}
