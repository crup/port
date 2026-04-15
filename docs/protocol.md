# Protocol

`@crup/port` treats iframe communication as an explicit protocol instead of a loose event bus. The runtime keeps the envelope small, the lifecycle strict, and the routing rules predictable.

## Envelope

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

## Routing Guarantees

- Messages are ignored unless `protocol` and `version` match.
- The host accepts messages only from the currently mounted iframe window.
- The host ignores messages from any origin other than `allowedOrigin`.
- The child ignores messages until it has observed a valid `port:hello`.
- `instanceId` prevents sibling embeds from handling each other’s traffic.
- `replyTo` ties responses and errors to a single outstanding request.

## Message Kinds

### `system`

Reserved for runtime lifecycle behavior.

- `port:hello`: host starts the handshake
- `port:ready`: child confirms readiness

### `event`

One-way notifications that do not require a response.

Examples:

- `widget:loaded`
- `demo:planChanged`
- `demo:contextApplied`
- `telemetry:tick`
- `port:resize`

### `request`

Host asks the child for a concrete answer.

Examples:

- `system:ping`
- `demo:getQuote`
- `auth:getSession`
- `checkout:getSnapshot`

### `response`

Child resolves a previous request. The runtime looks up the pending request by `replyTo`.

### `error`

Child rejects a previous request. The runtime converts the rejection into a `PortError` with code `MESSAGE_REJECTED`.

## Handshake Sequence

1. Host mounts the iframe and waits for the browser `load` event.
2. Host sends `system / port:hello`.
3. Child validates origin and stores `instanceId`.
4. Child replies with `system / port:ready`.
5. Host transitions to `ready`.
6. Inline ports move immediately to `open`; modal ports wait for `open()`.

## Request / Response Example

Host:

```ts
const quote = await port.call('demo:getQuote', {
  requestedAt: new Date().toISOString()
});
```

Child:

```ts
child.on('request:demo:getQuote', (message) => {
  const request = message as { messageId: string };

  child.respond(request.messageId, {
    plan: 'Growth',
    price: 249,
    currency: 'USD'
  });
});
```

## Resize Flow

The child proposes height changes through a normal event:

```ts
child.resize(document.documentElement.scrollHeight);
```

The host clamps the value using `minHeight` and `maxHeight` before applying it to the iframe element.

## Contract Discipline

The runtime only guarantees the envelope and routing. Your application should still define:

- message ownership
- payload shape
- versioning expectations
- validation rules
- error payload semantics

## Versioning Guidance

When your own message contracts change:

- keep payload validation at the application boundary
- add capability negotiation if multiple child versions must coexist
- treat incompatible payload changes as breaking changes
- prefer additive message evolution before renaming or reusing an existing message type
