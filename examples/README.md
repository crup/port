# Examples

These files stay intentionally small and map directly to the library API:

- `host-inline.ts`: mount an iframe inline and listen for child events
- `host-modal.ts`: mount a modal port and open it explicitly
- `child-basic.ts`: respond or reject host requests and emit resize signals

For richer guidance, use the docs alongside the examples:

- [Getting started](../docs/getting-started.md)
- [API reference](../docs/api-reference.md)
- [Lifecycle](../docs/lifecycle.md)
- [Events and RPC](../docs/events-and-rpc.md)
- [Protocol](../docs/protocol.md)

For a polished live walkthrough with a real host and child page:

- local dev: `pnpm demo:dev`
- production demo: https://crup.github.io/port/
