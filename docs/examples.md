# Examples

These examples stay intentionally small, but they map directly to the runtime API and the docs site.

## Repository Files

- `examples/host-inline.ts`: mount an iframe inline and subscribe to child events
- `examples/host-modal.ts`: mount a modal port and control open and close explicitly
- `examples/child-basic.ts`: respond to host requests, reject invalid requests, and emit resize signals

## Live Demo

- local dev: `pnpm demo:dev`
- production demo: https://crup.github.io/port/

## Recommended Patterns

### Inline Product Surface

Use inline mode for dashboards, settings panels, or embedded tools that should feel native to the parent page.

### Modal Workflow Surface

Use modal mode for contained flows like checkout, onboarding, or editor tools that deserve a focused frame.

### Contract Wrapper

For production apps, wrap the generic runtime with domain helpers:

```ts
export async function requestQuote(port: Port) {
  return port.call<QuoteResponse>('demo:getQuote', {
    requestedAt: new Date().toISOString()
  });
}

export function sendHostContext(port: Port, payload: HostContext) {
  port.send('demo:hostContext', payload);
}
```

This keeps the rest of the application from repeating message names everywhere.

On the child side, do the same for both success and failure paths:

```ts
export function replyWithQuote(child: ChildPort, messageId: string, quote: QuoteResponse) {
  child.respond(messageId, quote);
}

export function rejectQuote(child: ChildPort, messageId: string, reason: string) {
  child.reject(messageId, { reason });
}
```
