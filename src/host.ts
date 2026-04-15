import { Emitter } from './emitter';
import { PortError } from './errors';
import type { EventHandler, PortConfig, PortMessage, PortState } from './types';
import { isPortMessage, PROTOCOL, randomId, VERSION } from './utils';

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface PendingHandshake {
  resolve: () => void;
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
  let pendingHandshake: PendingHandshake | null = null;
  let modalBackdropListener: ((event: MouseEvent) => void) | null = null;
  let modalKeydownListener: ((event: KeyboardEvent) => void) | null = null;

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

    const msg = event.data;
    if (msg.instanceId !== instanceId) {
      return;
    }

    if (msg.kind === 'system' && msg.type === 'port:ready') {
      if (state === 'handshaking' && pendingHandshake) {
        clearTimeout(pendingHandshake.timeout);
        const { resolve } = pendingHandshake;
        pendingHandshake = null;
        state = 'ready';
        resolve();
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
      const reason = typeof msg.payload === 'string' ? msg.payload : 'Rejected';
      call.reject(new PortError('MESSAGE_REJECTED', reason));
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
    try {
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

        modalBackdropListener = (event) => {
          if (event.target === modalRoot) {
            void close();
          }
        };
        modalRoot.addEventListener('click', modalBackdropListener);

        modalKeydownListener = (event) => {
          if (event.key === 'Escape' && state === 'open') {
            void close();
          }
        };
        window.addEventListener('keydown', modalKeydownListener);
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
    } catch (error) {
      cleanupPendingHandshake();
      cleanupMountedElements();
      state = 'idle';
      throw error;
    }
  }

  async function handshake(): Promise<void> {
    ensureState(['mounted'], 'handshake');
    if (!iframe?.contentWindow) {
      throw new PortError('INVALID_STATE', 'iframe is unavailable for handshake');
    }

    state = 'handshaking';

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingHandshake = null;
        reject(new PortError('HANDSHAKE_TIMEOUT', 'handshake timed out'));
      }, config.handshakeTimeoutMs);

      pendingHandshake = {
        resolve,
        reject,
        timeout: timer
      };

      try {
        post({ kind: 'system', type: 'port:hello' });
      } catch (error) {
        if (pendingHandshake) {
          pendingHandshake = null;
          clearTimeout(timer);
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    if (config.mode === 'inline') {
      state = 'open';
    }
  }

  function open(): Promise<void> {
    ensureState(['ready', 'closed'], 'open');
    if (config.mode !== 'modal') {
      state = 'open';
      return Promise.resolve();
    }
    if (!modalRoot) {
      throw new PortError('INVALID_STATE', 'modal root missing');
    }
    modalRoot.style.display = 'flex';
    state = 'open';
    return Promise.resolve();
  }

  function close(): Promise<void> {
    ensureState(['open'], 'close');
    if (config.mode === 'modal' && modalRoot) {
      modalRoot.style.display = 'none';
    }
    state = 'closed';
    return Promise.resolve();
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
    cleanupPendingHandshake(new PortError('PORT_DESTROYED', 'Port has been destroyed'));

    window.removeEventListener('message', listener);
    cleanupMountedElements();
    state = 'destroyed';
  }

  function post(message: Pick<PortMessage, 'kind' | 'type' | 'payload' | 'replyTo'> & { messageId?: string }): void {
    if (!iframe?.contentWindow) {
      throw new PortError('INVALID_STATE', 'iframe is not available');
    }

    const finalMessage: PortMessage = {
      protocol: PROTOCOL,
      version: VERSION,
      instanceId,
      messageId: message.messageId ?? randomId(),
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
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(messageId);
        reject(new PortError('CALL_TIMEOUT', `${type} timed out`));
      }, config.callTimeoutMs);

      pending.set(messageId, { resolve: resolve as (value: unknown) => void, reject, timeout });

      try {
        post({ kind: 'request', type, payload, messageId });
      } catch (error) {
        clearTimeout(timeout);
        pending.delete(messageId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  function on(type: string, handler: EventHandler): void {
    emitter.on(type, handler);
  }

  function off(type: string, handler: EventHandler): void {
    emitter.off(type, handler);
  }

  function update(next: Partial<PortConfig>): void {
    validatePartialConfig(next, config);

    if (state !== 'idle') {
      for (const key of ['url', 'allowedOrigin', 'target', 'mode'] as const) {
        if (key in next) {
          throw new PortError('INVALID_STATE', `${key} cannot be updated after mount`);
        }
      }
    }

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

  function cleanupMountedElements(): void {
    cleanupModalListeners();
    iframe?.remove();
    modalRoot?.remove();
    iframe = null;
    modalRoot = null;
    targetNode = null;
  }

  function cleanupModalListeners(): void {
    if (modalRoot && modalBackdropListener) {
      modalRoot.removeEventListener('click', modalBackdropListener);
    }
    if (modalKeydownListener) {
      window.removeEventListener('keydown', modalKeydownListener);
    }
    modalBackdropListener = null;
    modalKeydownListener = null;
  }

  function cleanupPendingHandshake(reason?: unknown): void {
    if (!pendingHandshake) {
      return;
    }

    clearTimeout(pendingHandshake.timeout);
    if (reason !== undefined) {
      pendingHandshake.reject(reason);
    }
    pendingHandshake = null;
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

  validateUrl(config.url);
  validateOrigin(config.allowedOrigin);
  validatePartialConfig(config, {
    minHeight: config.minHeight ?? 0,
    maxHeight: config.maxHeight ?? Number.MAX_SAFE_INTEGER
  });
}

function validatePartialConfig(
  next: Partial<PortConfig>,
  current: Required<Pick<PortConfig, 'minHeight' | 'maxHeight'>>
): void {
  if (next.mode && next.mode !== 'inline' && next.mode !== 'modal') {
    throw new PortError('INVALID_CONFIG', 'mode must be either inline or modal');
  }

  if (typeof next.url === 'string') {
    validateUrl(next.url);
  }

  if (typeof next.allowedOrigin === 'string') {
    validateOrigin(next.allowedOrigin);
  }

  for (const [key, value] of [
    ['handshakeTimeoutMs', next.handshakeTimeoutMs],
    ['callTimeoutMs', next.callTimeoutMs],
    ['iframeLoadTimeoutMs', next.iframeLoadTimeoutMs]
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
      throw new PortError('INVALID_CONFIG', `${key} must be a positive number`);
    }
  }

  for (const [key, value] of [
    ['minHeight', next.minHeight],
    ['maxHeight', next.maxHeight]
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new PortError('INVALID_CONFIG', `${key} must be a non-negative number`);
    }
  }

  const minHeight = next.minHeight ?? current.minHeight;
  const maxHeight = next.maxHeight ?? current.maxHeight;

  if (minHeight > maxHeight) {
    throw new PortError('INVALID_CONFIG', 'minHeight cannot be greater than maxHeight');
  }
}

function validateOrigin(origin: string): void {
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin) {
      throw new Error('Origin must not include a path');
    }
  } catch {
    throw new PortError('INVALID_CONFIG', 'allowedOrigin must be an exact origin such as https://child.example.com');
  }
}

function validateUrl(url: string): void {
  try {
    void new URL(url, window.location.href);
  } catch {
    throw new PortError('INVALID_CONFIG', 'url must be a valid iframe URL');
  }
}
