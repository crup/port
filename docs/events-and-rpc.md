# Events And RPC

This runtime becomes valuable once the host and child agree on message intent. A small event catalog beats a pile of ad hoc `postMessage` handlers.

## Naming Pattern

Use explicit namespaced message types:

- `widget:loaded`
- `demo:planChanged`
- `auth:sessionExpired`
- `checkout:getSnapshot`
- `analytics:track`

Avoid vague names like:

- `message`
- `update`
- `data`
- `change`

## Rule Of Thumb

- `send()` / `emit()` for fire-and-forget signals
- `call()` / `respond()` for data the host is blocked on

## Host To Child Events

These are good fits for `port.send()`:

- navigation context
- theme or mode changes
- filter updates
- host user identity
- experiment flags

Example:

```ts
port.send('demo:hostContext', {
  workspace: 'Ops review',
  accent: 'amber',
  focus: 'Session quality'
});
```

Child side:

```ts
child.on('demo:hostContext', (payload) => {
  const context = payload as {
    workspace: string;
    accent: string;
    focus: string;
  };

  applyContext(context);
  child.emit('demo:contextApplied', context);
});
```

## Child To Host Events

These are good fits for `child.emit()`:

- widget readiness
- telemetry
- selection changes
- form progress
- async job state

Example:

```ts
child.emit('demo:planChanged', {
  plan: 'Growth',
  price: 249,
  currency: 'USD'
});
```

Host side:

```ts
port.on('demo:planChanged', (payload) => {
  console.log('child selected a new plan', payload);
});
```

## Request / Response

Use RPC when the host needs a concrete answer before it can continue.

Host:

```ts
const quote = await port.call<{
  plan: string;
  price: number;
  currency: string;
}>('demo:getQuote', {
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

## Request Payload Pattern

Keep request payloads small and explicit:

```ts
{
  requestedAt: string;
  correlationId?: string;
  context?: {
    accountId: string;
  };
}
```

Do not rely on the runtime envelope alone to carry business meaning.

## Event Catalog Template

Document your own contract in a table like this:

| Type | Direction | Kind | Payload | Notes |
| --- | --- | --- | --- | --- |
| `widget:loaded` | Child -> Host | Event | `{ version: string }` | Sent once after child UI is stable |
| `demo:planChanged` | Child -> Host | Event | `{ plan: string; price: number }` | Sent whenever the selected plan changes |
| `demo:hostContext` | Host -> Child | Event | `{ workspace: string; accent: string }` | Sent when parent context changes |
| `demo:getQuote` | Host -> Child | Request | `{ requestedAt: string }` | Returns current quote |
| `system:ping` | Host -> Child | Request | `{ requestedAt: string }` | Operational health check |

## Error Strategy

You have two choices when child-side work fails:

1. respond with a domain payload that includes failure details
2. emit `kind: 'error'` so the host receives `MESSAGE_REJECTED`

The current child runtime exposes `respond()` only, so if you need richer rejection semantics you can either send a failure-shaped success payload or extend the runtime for explicit error responses.

## Good Contract Habits

- Keep message names stable and payloads additive where possible.
- Do not reuse one message type for unrelated UI states.
- Keep runtime messages generic and application messages business-specific.
- Put ownership next to every message name in docs.
- Add browser tests for the message contracts that represent real product flows.
