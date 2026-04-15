# Getting Started

`@crup/port` is a browser runtime for host and child iframe communication. The host owns iframe creation, lifecycle, and request correlation. The child owns readiness, event emission, and responding to requests.

## Install

```bash
npm install @crup/port
```

```bash
pnpm add @crup/port
```

```bash
yarn add @crup/port
```

Import the host runtime from `@crup/port` and the child runtime from `@crup/port/child`.

## Host Setup

```ts
import { createPort } from '@crup/port';

const port = createPort({
  url: 'https://example.com/embed',
  allowedOrigin: 'https://example.com',
  target: '#embed-root',
  mode: 'inline',
  minHeight: 360,
  maxHeight: 720
});

await port.mount();
```

Host config stays intentionally small:

- `url`: iframe source URL
- `allowedOrigin`: exact origin accepted for both inbound and outbound messages
- `target`: container element or selector
- `mode`: `'inline'` or `'modal'`
- `handshakeTimeoutMs`, `callTimeoutMs`, `iframeLoadTimeoutMs`
- `minHeight`, `maxHeight`

## Child Setup

```ts
import { createChildPort } from '@crup/port/child';

const child = createChildPort({
  allowedOrigin: 'https://host.example.com'
});
```

The child stays idle until it receives a valid `port:hello` message from the exact configured `allowedOrigin`. Once origin validation succeeds, it replies with `port:ready` automatically.

## First Working Flow

### 1. Mount the iframe

```ts
await port.mount();
```

`mount()` creates the iframe, waits for the native `load` event, starts the handshake, and resolves when the session is ready. In inline mode the runtime moves directly to `open`.

### 2. Listen for child events

```ts
port.on('widget:loaded', (payload) => {
  console.log('child loaded', payload);
});

port.on('demo:planChanged', (payload) => {
  console.log('plan changed', payload);
});
```

Use events for one-way information: telemetry, page changes, user actions, and status acknowledgements.

### 3. Request data when the host needs an answer

```ts
const quote = await port.call<{
  plan: string;
  price: number;
  currency: string;
}>('demo:getQuote', {
  requestedAt: new Date().toISOString()
});
```

`call()` is for decision points where the host must wait for a specific result.

### 4. Handle requests inside the child

```ts
child.on('request:demo:getQuote', (message) => {
  const request = message as { messageId: string };

  if (!document.body.dataset.quoteReady) {
    child.reject(request.messageId, 'Quote engine is not ready yet');
    return;
  }

  child.respond(request.messageId, {
    plan: 'Growth',
    price: 249,
    currency: 'USD'
  });
});
```

### 5. Emit domain events from the child

```ts
child.emit('widget:loaded', {
  version: '1',
  surface: 'pricing-widget'
});

child.emit('demo:planChanged', {
  plan: 'Growth',
  price: 249,
  currency: 'USD'
});
```

### 6. Keep height in sync

```ts
child.resize(document.documentElement.scrollHeight);
```

Call `resize()` whenever the embedded layout changes. The host clamps the received height between `minHeight` and `maxHeight`.

For real apps, trigger it after meaningful layout changes instead of only once at startup:

```ts
function syncHeight() {
  child.resize(document.documentElement.scrollHeight);
}

document.querySelector('#details-toggle')?.addEventListener('click', () => {
  document.body.classList.toggle('details-open');
  syncHeight();
});
```

The live docs demo includes a dedicated resize panel so you can watch the iframe height change from the host side.

## Modal Mode

Use modal mode when the iframe should stay mounted but hidden until a user action opens it.

```ts
const port = createPort({
  url: 'https://example.com/checkout',
  allowedOrigin: 'https://example.com',
  target: '#modal-root',
  mode: 'modal'
});

await port.mount();
await port.open();
```

Modal mode includes:

- hidden mount until `open()`
- backdrop click to close
- `Escape` handling while open

## Cleanup

Destroy the session when the host surface unmounts or the embed is no longer valid.

```ts
port.destroy();
```

Destroying the port:

- removes the iframe
- clears pending RPC requests
- clears pending handshake state
- rejects outstanding calls with `PORT_DESTROYED`
- removes message listeners

## Production Checklist

- Pin `allowedOrigin` to the exact expected origin.
- Treat `createChildPort({ allowedOrigin })` as required security config, not optional convenience.
- Keep runtime messages generic and put business rules in your own named events and requests.
- Document event names, payloads, and ownership between host and child teams.
- Use `call()` only when the host truly depends on the child response.
- Use `reject()` when the child cannot satisfy a host request and the host should handle a real failure path.
- Add runtime logging around `mount`, handshake, request start, request completion, and destroy.
- Add browser tests for the actual iframe flows your product depends on.

## Next Docs

- [API reference](./api-reference.md)
- [Lifecycle](./lifecycle.md)
- [Events and RPC](./events-and-rpc.md)
- [Protocol](./protocol.md)
- [Examples](./examples.md)
