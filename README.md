# @crup/port

`@crup/port` exists because I got tired of rewriting iframe integrations that looked simple on paper and turned into brittle `postMessage` glue in production.

Every time the pattern repeated:

- create iframe
- wait for load
- hope handshake works
- wire request/response manually
- debug weird cross-origin timing issues at 2am

This package is intentionally small and opinionated about one thing: **embedding remote apps safely with explicit lifecycle and protocol contracts**.

## The problem this solves

### 1) Repeated iframe lifecycle code

Most projects eventually need the same mount/open/close/destroy flow. Without a runtime, each implementation drifts and gets harder to maintain.

### 2) Messy `postMessage` pipelines

Raw browser messaging is low-level and easy to misuse. You can absolutely ship with it—but consistency and validation become your burden.

### 3) No lifecycle guarantees

You often need strong state transitions (`idle -> mounting -> mounted -> handshaking -> ready`). If those transitions are implicit, bugs become timing-dependent and expensive.

### 4) Debugging pain

When host and child disagree on message shapes or timing, failures become silent. This runtime keeps protocol semantics explicit.

## Alternatives I explored

All of these are good libraries. They just optimize for different goals than mine.

- **Zoid**: powerful cross-domain component system, but heavier and more abstraction than I wanted for a tiny protocol runtime.
- **Penpal**: excellent RPC ergonomics, but less focused on full iframe lifecycle + render orchestration.
- **Postmate**: refreshingly simple and approachable, but I needed stricter state/lifecycle control.

## Why this exists

`@crup/port` is:

- minimal
- explicit
- protocol-first
- lifecycle-aware
- UI-agnostic

Host owns lifecycle. Child speaks protocol.

## Design philosophy

- tiny > feature-rich
- explicit > magical
- protocol > abstraction

## What this is NOT

- not a UI framework
- not a product SDK
- not a replacement for your app architecture

If this library starts solving business logic instead of embed logic, it is bloatware.

## Install

```bash
npm i @crup/port
```

## Host API

```ts
import { createPort } from '@crup/port';

const port = createPort({
  url: 'https://example.com/embed',
  target: '#root',
  allowedOrigin: 'https://example.com'
});

await port.mount();
port.on('action:done', (payload) => {
  console.log(payload);
});

const result = await port.call('data:get', { id: '42' });
console.log(result);
```

## Child API

```ts
import { createChildPort } from '@crup/port/child';

const port = createChildPort();

port.on('request:data:get', (message) => {
  const msg = message as { messageId: string; payload: { id: string } };
  port.respond(msg.messageId, { id: msg.payload.id, ok: true });
});

port.resize(720);
```

## Protocol

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

## Lifecycle

`idle -> mounting -> mounted -> handshaking -> ready -> open -> closed -> destroyed`

## Multiple hosts / multiple ports

Yes—multiple host instances are supported in the same page. Each port instance has a unique `instanceId`, and host-side message routing now validates both `instanceId` and the exact `iframe.contentWindow` source so sibling ports cannot cross-handle each other’s messages.

## Local examples

Quick snippets are provided in:

- `examples/host-inline.ts`
- `examples/host-modal.ts`
- `examples/child-basic.ts`

## Staff/principal engineer recommendations (what is still missing)

Before production rollout, I recommend adding:

1. **Schema validation for payloads** at app boundaries (runtime guardrails for request/response contracts).
2. **Observability hooks** (`onStateChange`, debug logger, correlation IDs exported for tracing).
3. **Host capability negotiation** during handshake (versioning and optional features).
4. **Security hardening** docs: CSP recommendations, sandbox iframe attributes, strict origin pinning guidance.
5. **E2E browser tests** (Playwright/Cypress) to complement jsdom tests, especially for modal + ESC/backdrop behavior.
6. **Release automation** (changesets/semantic-release) and size budget checks to enforce the `<8KB` target.

## Error codes

- `INVALID_CONFIG`
- `INVALID_STATE`
- `IFRAME_LOAD_TIMEOUT`
- `HANDSHAKE_TIMEOUT`
- `CALL_TIMEOUT`
- `ORIGIN_MISMATCH`
- `MESSAGE_REJECTED`
- `PORT_DESTROYED`

## Build outputs

- `dist/index.mjs`
- `dist/index.global.js`
- `dist/child.mjs`
