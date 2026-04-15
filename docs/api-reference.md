# API Reference

## Host Runtime

```ts
import { createPort } from '@crup/port';
```

### `createPort(config)`

Creates a host-side runtime for mounting and communicating with one iframe session.

#### Config

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | `string` | Yes | The iframe source URL. |
| `allowedOrigin` | `string` | Yes | Exact origin accepted for all iframe messages. |
| `target` | `string \| HTMLElement` | Yes | Container selector or element where the iframe should mount. |
| `mode` | `'inline' \| 'modal'` | No | Inline mounts directly into the target. Modal mounts hidden until `open()`. Default: `'inline'`. |
| `handshakeTimeoutMs` | `number` | No | Max time allowed for `port:ready`. Default: `8000`. |
| `callTimeoutMs` | `number` | No | Max time allowed for a child response. Default: `8000`. |
| `iframeLoadTimeoutMs` | `number` | No | Max time allowed for the browser `load` event. Default: `8000`. |
| `minHeight` | `number` | No | Minimum iframe height accepted from `port:resize`. Default: `0`. |
| `maxHeight` | `number` | No | Maximum iframe height accepted from `port:resize`. Default: `Number.MAX_SAFE_INTEGER`. |

### Methods

#### `mount(): Promise<void>`

Creates the iframe, waits for `load`, performs the handshake, and resolves when the port is ready.

#### `open(): Promise<void>`

Opens the port surface. In inline mode this simply forces state to `open`. In modal mode this reveals the mounted modal container.

#### `close(): Promise<void>`

Closes a modal or marks an inline port as `closed`.

#### `destroy(): void`

Clears pending requests, removes listeners, and removes mounted DOM elements.

#### `send(type: string, payload?: unknown): void`

Sends a one-way event to the child.

#### `call<T>(type: string, payload?: unknown): Promise<T>`

Sends a request message and waits for a matching response or error.

#### `on(type: string, handler: EventHandler): void`

Subscribes to child events routed by message `type`.

#### `off(type: string, handler: EventHandler): void`

Removes a previously registered handler.

#### `update(config: Partial<PortConfig>): void`

Mutates the in-memory config for future runtime behavior.

Once the port has mounted, only timeout and sizing fields may change. `url`, `allowedOrigin`, `target`, and `mode` are fixed for the lifetime of the mounted session.

#### `getState(): PortState`

Returns the current runtime state.

### Host States

| State | Meaning |
| --- | --- |
| `idle` | Port created but not mounted. |
| `mounting` | Host is creating the iframe and waiting for the `load` event. |
| `mounted` | Iframe loaded and ready for handshake. |
| `handshaking` | Host sent `port:hello` and is waiting for `port:ready`. |
| `ready` | Handshake completed successfully. |
| `open` | Port is active and visible or usable. |
| `closed` | Port exists but is not currently open. |
| `destroyed` | Runtime has been torn down. |

## Child Runtime

```ts
import { createChildPort } from '@crup/port/child';
```

### `createChildPort(config)`

Creates the child-side runtime that listens for the host handshake and communicates back to the parent window.

#### Config

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `allowedOrigin` | `string` | Yes | Exact parent origin accepted for the handshake and all later messages. |

### Methods

#### `ready(): void`

Sends `system / port:ready`. Usually this is called internally once the child accepts `port:hello`.

#### `emit(type: string, payload?: unknown): void`

Sends a one-way event to the host.

#### `on(type: string, handler: EventHandler): void`

Subscribes to host traffic. Requests are surfaced as `request:<type>`.

#### `respond(messageId: string, payload: unknown): void`

Resolves a previous host request.

#### `reject(messageId: string, payload?: unknown): void`

Rejects a previous host request. The host receives a `PortError` with code `MESSAGE_REJECTED`.

#### `resize(height: number): void`

Sends `event / port:resize` if the height is finite and non-negative.

#### `destroy(): void`

Removes the child-side message listener.

## Error Codes

| Code | Meaning |
| --- | --- |
| `INVALID_CONFIG` | Required config is missing or target lookup failed. |
| `INVALID_STATE` | An action was attempted from a disallowed state. |
| `IFRAME_LOAD_TIMEOUT` | The iframe never produced `load()` within the allowed time. |
| `HANDSHAKE_TIMEOUT` | The child never responded with `port:ready`. |
| `CALL_TIMEOUT` | A request did not resolve before `callTimeoutMs`. |
| `ORIGIN_MISMATCH` | Reserved for application-level contract handling when your own code detects an origin mismatch case. |
| `MESSAGE_REJECTED` | The child replied with `kind: 'error'`. |
| `PORT_DESTROYED` | The port was destroyed while work was in flight. |

## Message Shape

```ts
type PortMessage = {
  protocol: 'crup.port';
  version: '1';
  instanceId: string;
  messageId: string;
  replyTo?: string;
  kind: 'event' | 'request' | 'response' | 'error' | 'system';
  type: string;
  payload?: unknown;
};
```
