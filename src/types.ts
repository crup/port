export type PortState =
  | 'idle'
  | 'mounting'
  | 'mounted'
  | 'handshaking'
  | 'ready'
  | 'open'
  | 'closed'
  | 'destroyed';

export type PortErrorCode =
  | 'INVALID_CONFIG'
  | 'INVALID_STATE'
  | 'IFRAME_LOAD_TIMEOUT'
  | 'HANDSHAKE_TIMEOUT'
  | 'CALL_TIMEOUT'
  | 'ORIGIN_MISMATCH'
  | 'MESSAGE_REJECTED'
  | 'PORT_DESTROYED';

export type MessageKind = 'event' | 'request' | 'response' | 'error' | 'system';

export interface PortMessage {
  protocol: 'crup.port';
  version: '1';
  instanceId: string;
  messageId: string;
  replyTo?: string;
  kind: MessageKind;
  type: string;
  payload?: unknown;
}

export interface PortConfig {
  url: string;
  allowedOrigin: string;
  target: string | HTMLElement;
  mode?: 'inline' | 'modal';
  handshakeTimeoutMs?: number;
  callTimeoutMs?: number;
  iframeLoadTimeoutMs?: number;
  minHeight?: number;
  maxHeight?: number;
}

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

export interface ChildPortConfig {
  allowedOrigin?: string;
}
