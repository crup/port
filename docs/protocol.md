# Protocol

`@crup/port` treats iframe communication as an explicit protocol instead of a loose message bus.

## Message Envelope

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

## Core Guarantees

- Messages are ignored unless `protocol` and `version` match.
- Host accepts messages only from the mounted iframe window.
- Host ignores messages from any origin other than `allowedOrigin`.
- Child ignores messages until it has seen a valid `port:hello`.
- `instanceId` prevents sibling embeds from cross-handling messages.

## Lifecycle Messages

- `system / port:hello`: host starts the handshake
- `system / port:ready`: child confirms readiness
- `event / port:resize`: child proposes a new iframe height

## Application Messages

- `event`: one-way notifications such as `widget:loaded`
- `request`: host asks the child for a result
- `response`: child resolves a previous request
- `error`: child rejects a previous request

## Example Request/Response

```ts
await port.call('system:ping', { requestedAt: Date.now() });
```

```ts
child.on('request:system:ping', (message) => {
  const request = message as { messageId: string };

  child.respond(request.messageId, {
    ok: true
  });
});
```

## Versioning Guidance

When you change message contracts in your application:

- keep payload validation at the application boundary
- add capability negotiation if multiple child versions will coexist
- treat protocol changes as breaking changes

The library keeps the base envelope stable. Your domain messages still need their own discipline.
