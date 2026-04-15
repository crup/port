# @crup/port

[![npm version](https://img.shields.io/npm/v/%40crup%2Fport?color=1f8b4c)](https://www.npmjs.com/package/@crup/port)
[![npm downloads](https://img.shields.io/npm/dm/%40crup%2Fport?color=0b7285)](https://www.npmjs.com/package/@crup/port)
[![bundle size](https://deno.bundlejs.com/badge?q=%40crup%2Fport)](https://bundlejs.com/?q=%40crup%2Fport)
[![License](https://img.shields.io/github/license/crup/port?color=495057)](https://github.com/crup/port/blob/main/LICENSE)
[![CI](https://github.com/crup/port/actions/workflows/ci.yml/badge.svg)](https://github.com/crup/port/actions/workflows/ci.yml)
[![Docs](https://github.com/crup/port/actions/workflows/docs.yml/badge.svg)](https://github.com/crup/port/actions/workflows/docs.yml)

Protocol-first iframe runtime for explicit host/child communication.

`@crup/port` exists for the part of embedded app work that usually rots first: lifecycle, handshake timing, and message discipline. It gives the host page a small runtime for mounting an iframe, opening it inline or in a modal, pinning exact origins, and exchanging request/response/error messages without ad hoc `postMessage` glue.

Package: https://www.npmjs.com/package/@crup/port

Live demo: https://crup.github.io/port/

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

## Quick Links

- npm package: https://www.npmjs.com/package/@crup/port
- live demo: https://crup.github.io/port/
- source: https://github.com/crup/port
- issues: https://github.com/crup/port/issues

## Why This Package Exists

- Raw `postMessage` is low-level and easy to drift across products.
- Iframe lifecycle bugs usually hide in timing and cleanup paths.
- Cross-window integrations need explicit origin pinning and state transitions.
- Small embed runtimes should stay tiny, predictable, and framework-agnostic.

## Quick Start

### Host

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

port.on('widget:loaded', (payload) => {
  console.log('child event', payload);
});

const result = await port.call<{ ok: boolean }>('system:ping', {
  requestedAt: Date.now()
});

console.log(result.ok);
```

### Child

```ts
import { createChildPort } from '@crup/port/child';

const child = createChildPort({
  allowedOrigin: 'https://host.example.com'
});

child.on('request:system:ping', (message) => {
  const request = message as { messageId: string; payload?: unknown };

  if (!request.payload) {
    child.reject(request.messageId, 'missing ping payload');
    return;
  }

  child.respond(request.messageId, {
    ok: true,
    receivedAt: Date.now()
  });
});

child.emit('widget:loaded', { version: '1' });
child.resize(document.body.scrollHeight);
```

## What You Get

- Explicit lifecycle: `idle -> mounting -> mounted -> handshaking -> ready -> open -> closed -> destroyed`
- Explicit origin pinning on both host and child
- Inline and modal host modes
- Event emission plus request/response/error RPC
- Child-driven height updates
- Small ESM-only bundle built with `tsup`

## API Surface

### `createPort(config)`

Host runtime with:

- `mount()`
- `open()`
- `close()`
- `destroy()`
- `send(type, payload?)`
- `call<T>(type, payload?)`
- `on(type, handler)`
- `off(type, handler)`
- `update(partialConfig)`
- `getState()`

### `createChildPort(config)`

Child runtime with:

- `ready()`
- `emit(type, payload?)`
- `on(type, handler)`
- `respond(messageId, payload)`
- `reject(messageId, payload?)`
- `resize(height)`
- `destroy()`

### Message Shape

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

## Demo And Examples

- Live GitHub Pages docs and demo: https://crup.github.io/port/
- Inline example: [`examples/host-inline.ts`](examples/host-inline.ts)
- Modal example: [`examples/host-modal.ts`](examples/host-modal.ts)
- Child example: [`examples/child-basic.ts`](examples/child-basic.ts)
- Example overview: [`examples/README.md`](examples/README.md)

## Documentation

- Getting started: [`docs/getting-started.md`](docs/getting-started.md)
- API reference: [`docs/api-reference.md`](docs/api-reference.md)
- Lifecycle guide: [`docs/lifecycle.md`](docs/lifecycle.md)
- Events and RPC: [`docs/events-and-rpc.md`](docs/events-and-rpc.md)
- Protocol notes: [`docs/protocol.md`](docs/protocol.md)
- Example patterns: [`docs/examples.md`](docs/examples.md)
- Security guidance: [`docs/security.md`](docs/security.md)
- Release process: [`docs/releasing.md`](docs/releasing.md)
- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Positioning

`@crup/port` stays intentionally narrow:

- it is a protocol runtime for iframe lifecycle, handshake, resize, and correlated messaging
- it is not a framework adapter layer for React, Vue, or Web Components
- it is not a generic method bridge that reaches into arbitrary child code
- it is not an automatic DOM sync system beyond explicit child-driven `resize()`

That scope is what keeps the package small and predictable.

## Local Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm demo:dev
```

Useful scripts:

- `pnpm docs:build` builds the GitHub Pages site into `demo-dist/`
- `pnpm size` reports raw and gzip bundle sizes for `dist/`
- `pnpm changeset` adds a release note entry when you want to track pending package notes
- `pnpm readme:check` validates the README install and package links

## Release Model

- `ci.yml` validates lint, types, tests, package build, demo build, README checks, size output, and package packing.
- `docs.yml` deploys the Vite demo to GitHub Pages at `https://crup.github.io/port/`.
- `release.yml` is a guarded manual stable release workflow modeled on `crup/react-timer-hook`, and it persists the published version back to `main`.
- `prerelease.yml` publishes a manual alpha prerelease from the `next` branch.

## Security

This package helps enforce the runtime boundary, but it cannot secure a weak embed strategy on its own. Always pin `allowedOrigin`, set restrictive iframe attributes, and validate application-level payloads. The practical guidance lives in [`docs/security.md`](docs/security.md).

## OSS Baseline

This repo ships with:

- MIT license
- Code of conduct
- Contributing guide
- Security policy
- Issue and PR templates
- Husky hooks
- Changesets
- GitHub Actions for CI, Pages, size reporting, and releases

## License

MIT, see [`LICENSE`](LICENSE).
