# Lifecycle

`@crup/port` is mostly a lifecycle tool. The message helpers matter, but the real value is that the host and child only exchange traffic once the session boundary is valid.

## State Flow

```text
idle
  -> mounting
  -> mounted
  -> handshaking
  -> ready
  -> open
  -> closed
  -> destroyed
```

## Phase By Phase

### `idle`

The port exists in memory but no iframe has been created yet.

Allowed next action:

- `mount()`

### `mounting`

The host has created the iframe and is waiting for the browser `load` event.

Failure risk:

- bad URL
- blocked page load
- overly strict iframe policies
- `iframeLoadTimeoutMs` reached

### `mounted`

The iframe element is live and the host is ready to begin protocol negotiation.

Allowed next action:

- handshake starts automatically during `mount()`

### `handshaking`

The host sends `port:hello` and waits for the child to reply with `port:ready`.

Failure risk:

- child never initializes `createChildPort()`
- host and child disagree on origin
- message blocked by an unexpected wrapper or intermediate page
- `handshakeTimeoutMs` reached

### `ready`

The child accepted the session and the runtime can now exchange application traffic.

Allowed actions:

- `send()`
- `call()`
- `open()`
- `destroy()`

### `open`

The port is active. Inline mode reaches this automatically after readiness. Modal mode reaches this when the host calls `open()`.

Allowed actions:

- `send()`
- `call()`
- `close()`
- `destroy()`

### `closed`

The runtime still exists but the surface is not open. This matters mostly for modal surfaces.

Allowed actions:

- `open()`
- `send()`
- `call()`
- `destroy()`

### `destroyed`

All message listeners are removed and in-flight requests reject with `PORT_DESTROYED`.

## Timing Guidance

- Keep `iframeLoadTimeoutMs` high enough to tolerate realistic embed load times.
- Keep `handshakeTimeoutMs` short enough that broken integrations fail quickly and visibly.
- Treat `callTimeoutMs` as a product decision, not a default you never revisit.
- Log load, handshake start, handshake success, request start, request success, request timeout, and destroy events in production.

## When To Use Events vs RPC

Use events when:

- the host is observing child activity
- the child is reporting telemetry
- the message is informational
- the host should not block UI on a result

Use RPC when:

- the host needs an answer before continuing
- the child owns the authoritative data or decision
- retries or error handling need clear correlation

## Common Failure Modes

### Iframe never becomes ready

Look at:

- incorrect `url`
- page failing before the child runtime initializes
- `allowedOrigin` mismatch
- `handshakeTimeoutMs` too low for the actual child startup path

Failed `mount()` calls now clean up the iframe and reset the runtime to `idle`, so a corrected retry can mount again without creating a poisoned instance.

### Host calls too early

`send()` and `call()` require the runtime to be `ready`, `open`, or `closed`. Calling them earlier throws `INVALID_STATE`.

### Resize feels unreliable

Usually the child is only sending one `resize()` call. Resize again after content changes, tabs switch, forms expand, or async content renders.

### Multiple embeds cross-talk

This is what `instanceId` prevents. Keep each embed session isolated and do not bypass the runtime envelope with unrelated global listeners.
