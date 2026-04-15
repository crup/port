# Getting Started

## Install

```bash
npm install @crup/port
```

## Host Setup

```ts
import { createPort } from '@crup/port';

const port = createPort({
  url: 'https://example.com/embed',
  allowedOrigin: 'https://example.com',
  target: '#embed-root',
  mode: 'inline'
});

await port.mount();
```

Host config is intentionally small:

- `url`: iframe source URL
- `allowedOrigin`: exact origin accepted for inbound and outbound messages
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

child.on('request:data:get', (message) => {
  const request = message as { messageId: string; payload: { id: string } };

  child.respond(request.messageId, {
    id: request.payload.id,
    status: 'ok'
  });
});
```

The child automatically responds to the host handshake after `port:hello` is received from the correct origin.

## Common Flow

1. Host creates a port.
2. Host mounts the iframe and waits for the `load` event.
3. Host sends `port:hello`.
4. Child validates origin and replies with `port:ready`.
5. Host transitions to `ready` and then `open` for inline mode.
6. Host and child exchange events or request/response messages.

## Inline Vs Modal

- `inline` renders directly into the target container and opens after handshake.
- `modal` mounts hidden, then opens when `port.open()` is called.

Modal mode includes backdrop click and `Escape` handling out of the box.

## Recommended Next Steps

- Add schema validation at your app boundary.
- Wrap `port.call()` usage with domain-specific helpers.
- Export correlation IDs or add logging around message boundaries if you need auditability.
- Add end-to-end browser tests for the embed flows your product depends on.
