import { Emitter } from './emitter';
import { PortError } from './errors';
import type { EventHandler, PortConfig, PortMessage, PortState } from './types';
import { isPortMessage, PROTOCOL, randomId, VERSION } from './utils';

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const DEFAULT_HANDSHAKE_TIMEOUT = 8_000;
const DEFAULT_CALL_TIMEOUT = 8_000;
const DEFAULT_IFRAME_LOAD_TIMEOUT = 8_000;

export interface Port {
  mount(): Promise<void>;
  open(): Promise<void>;
  close(): Promise<void>;
  destroy(): void;
  send(type: string, payload?: unknown): void;
  call<T = unknown>(type: string, payload?: unknown): Promise<T>;
  on(type: string, handler: EventHandler): void;
  off(type: string, handler: EventHandler): void;
  update(config: Partial<PortConfig>): void;
  getState(): PortState;
}

export function createPort(input: PortConfig): Port {
  validateConfig(input);

  const config: Required<
    Pick<PortConfig, 'mode' | 'handshakeTimeoutMs' | 'callTimeoutMs' | 'iframeLoadTimeoutMs' | 'minHeight' | 'maxHeight'>
  > &
    PortConfig = {
    ...input,
    mode: input.mode ?? 'inline',
    handshakeTimeoutMs: input.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT,
    callTimeoutMs: input.callTimeoutMs ?? DEFAULT_CALL_TIMEOUT,
    iframeLoadTimeoutMs: input.iframeLoadTimeoutMs ?? DEFAULT_IFRAME_LOAD_TIMEOUT,
    minHeight: input.minHeight ?? 0,
    maxHeight: input.maxHeight ?? Number.MAX_SAFE_INTEGER
  };

  const instanceId = randomId('port');
  const emitter = new Emitter();
  const pending = new Map<string, PendingCall>();
  let state: PortState = 'idle';
  let iframe: HTMLIFrameElement | null = null;
  let targetNode: HTMLElement | null = null;
  let modalRoot: HTMLDivElement | null = null;

  const listener = (event: MessageEvent): void => {
    if (!iframe?.contentWindow || event.source !== iframe.contentWindow) {
      return;
    }

    if (event.origin !== config.allowedOrigin) {
      return;
    }

    if (!isPortMessage(event.data)) {
      return;
    }

    const msg = event.data as PortMessage;
    if (msg.instanceId !== instanceId) {
      return;
    }

    if (msg.kind === 'system' && msg.type === 'port:ready') {
      if (state === 'handshaking') {
        state = 'ready';
      }
      return;
    }

    if (msg.kind === 'response' && msg.replyTo) {
      const call = pending.get(msg.replyTo);
      if (!call) {
        return;
      }
      clearTimeout(call.timeout);
      pending.delete(msg.replyTo);
      call.resolve(msg.payload);
      return;
    }

    if (msg.kind === 'error' && msg.replyTo) {
      const call = pending.get(msg.replyTo);
      if (!call) {
        return;
      }
      clearTimeout(call.timeout);
      pending.delete(msg.replyTo);
      call.reject(new PortError('MESSAGE_REJECTED', String(msg.payload ?? 'Rejected')));
      return;
    }

    if (msg.kind === 'event' && msg.type === 'port:resize') {
      applyResize(msg.payload);
      return;
    }

    if (msg.kind === 'event') {
      void emitter.emit(msg.type, msg.payload);
    }
  };

  window.addEventListener('message', listener);

  function ensureState(valid: PortState[], nextAction: string): void {
    if (!valid.includes(state)) {
      throw new PortError('INVALID_STATE', `Cannot ${nextAction} from state ${state}`);
    }
  }

  function resolveTarget(target: PortConfig['target']): HTMLElement {
    if (typeof target === 'string') {
      const node = document.querySelector<HTMLElement>(target);
      if (!node) {
        throw new PortError('INVALID_CONFIG', `Target ${target} was not found`);
      }
      return node;
    }
    return target;
  }

  async function mount(): Promise<void> {
    ensureState(['idle'], 'mount');
    state = 'mounting';

    targetNode = resolveTarget(config.target);
    iframe = document.createElement('iframe');
    iframe.src = config.url;
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.display = config.mode === 'modal' ? 'none' : 'block';

    if (config.mode === 'modal') {
      modalRoot = document.createElement('div');
      modalRoot.style.position = 'fixed';
      modalRoot.style.inset = '0';
      modalRoot.style.background = 'rgba(0,0,0,0.5)';
      modalRoot.style.display = 'none';
      modalRoot.style.alignItems = 'center';
      modalRoot.style.justifyContent = 'center';

      const container = document.createElement('div');
      container.style.width = 'min(900px, 95vw)';
      container.style.height = 'min(85vh, 900px)';
      container.style.background = '#fff';
      container.style.borderRadius = '8px';
      container.style.overflow = 'hidden';
      iframe.style.display = 'block';
      iframe.style.height = '100%';

      container.append(iframe);
      modalRoot.append(container);
      targetNode.append(modalRoot);

      modalRoot.addEventListener('click', (event) => {
        if (event.target === modalRoot) {
          void close();
        }
      });

      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && state === 'open') {
          void close();
        }
      });
    } else {
      targetNode.append(iframe);
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new PortError('IFRAME_LOAD_TIMEOUT', 'iframe did not load in time'));
      }, config.iframeLoadTimeoutMs);

      iframe?.addEventListener(
        'load',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
    });

    state = 'mounted';
    await handshake();
  }

  async function handshake(): Promise<void> {
    ensureState(['mounted'], 'handshake');
    if (!iframe?.contentWindow) {
      throw new PortError('INVALID_STATE', 'iframe is unavailable for handshake');
    }

    state = 'handshaking';
    post({ kind: 'system', type: 'port:hello' });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        clearInterval(poll);
        reject(new PortError('HANDSHAKE_TIMEOUT', 'handshake timed out'));
      }, config.handshakeTimeoutMs);

      const poll = setInterval(() => {
        if (state === 'ready') {
          clearTimeout(timer);
          clearInterval(poll);
          resolve();
        }
      }, 10);
    });

    if (config.mode === 'inline') {
      state = 'open';
    }
  }

  async function open(): Promise<void> {
    ensureState(['ready', 'closed'], 'open');
    if (config.mode !== 'modal') {
      state = 'open';
      return;
    }
    if (!modalRoot) {
      throw new PortError('INVALID_STATE', 'modal root missing');
    }
    modalRoot.style.display = 'flex';
    state = 'open';
  }

  async function close(): Promise<void> {
    ensureState(['open'], 'close');
    if (config.mode === 'modal' && modalRoot) {
      modalRoot.style.display = 'none';
    }
    state = 'closed';
  }

  function destroy(): void {
    if (state === 'destroyed') {
      return;
    }

    pending.forEach((entry) => {
      clearTimeout(entry.timeout);
      entry.reject(new PortError('PORT_DESTROYED', 'Port has been destroyed'));
    });
    pending.clear();

    window.removeEventListener('message', listener);
    iframe?.remove();
    modalRoot?.remove();
    iframe = null;
    modalRoot = null;
    targetNode = null;
    state = 'destroyed';
  }

  function post(message: Pick<PortMessage, 'kind' | 'type' | 'payload' | 'replyTo'>): void {
    if (!iframe?.contentWindow) {
      throw new PortError('INVALID_STATE', 'iframe is not available');
    }

    const finalMessage: PortMessage = {
      protocol: PROTOCOL,
      version: VERSION,
      instanceId,
      messageId: randomId(),
      ...message
    };

    iframe.contentWindow.postMessage(finalMessage, config.allowedOrigin);
  }

  function send(type: string, payload?: unknown): void {
    if (state === 'destroyed') {
      throw new PortError('PORT_DESTROYED', 'Port is destroyed');
    }

    ensureState(['ready', 'open', 'closed'], 'send');
    post({ kind: 'event', type, payload });
  }

  function call<T = unknown>(type: string, payload?: unknown): Promise<T> {
    if (state === 'destroyed') {
      return Promise.reject(new PortError('PORT_DESTROYED', 'Port is destroyed'));
    }

    ensureState(['ready', 'open', 'closed'], 'call');

    const messageId = randomId();
    const message: PortMessage = {
      protocol: PROTOCOL,
      version: VERSION,
      instanceId,
      messageId,
      kind: 'request',
      type,
      payload
    };

    iframe?.contentWindow?.postMessage(message, config.allowedOrigin);

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(messageId);
        reject(new PortError('CALL_TIMEOUT', `${type} timed out`));
      }, config.callTimeoutMs);

      pending.set(messageId, { resolve: resolve as (value: unknown) => void, reject, timeout });
    });
  }

  function on(type: string, handler: EventHandler): void {
    emitter.on(type, handler);
  }

  function off(type: string, handler: EventHandler): void {
    emitter.off(type, handler);
  }

  function update(next: Partial<PortConfig>): void {
    Object.assign(config, next);
  }

  function getState(): PortState {
    return state;
  }

  function applyResize(payload: unknown): void {
    if (!iframe) {
      return;
    }
    if (typeof payload !== 'number' || Number.isNaN(payload)) {
      return;
    }

    const bounded = Math.max(config.minHeight, Math.min(config.maxHeight, payload));
    iframe.style.height = `${bounded}px`;
  }

  return {
    mount,
    open,
    close,
    destroy,
    send,
    call,
    on,
    off,
    update,
    getState
  };
}

function validateConfig(config: PortConfig): void {
  if (!config.url || !config.allowedOrigin || !config.target) {
    throw new PortError('INVALID_CONFIG', 'url, target, and allowedOrigin are required');
  }
}
