# Security Guidance

`@crup/port` helps enforce message boundaries, but secure embedding still depends on how you configure the host and child applications.

## Required Practices

- Always set `allowedOrigin` to the exact expected origin.
- Never use `*` for iframe messaging.
- Validate request and response payloads in your app code.
- Keep iframe URLs pinned to trusted origins.
- Set conservative `iframe` attributes if your product needs tighter isolation.

## Host Recommendations

- Treat `allowedOrigin` as mandatory security policy, not convenience config.
- Use content security policy rules that explicitly allow only your embed origins.
- If the iframe is untrusted, consider `sandbox` plus only the permissions you actually need.
- Clean up with `destroy()` when the embed is no longer active.

## Child Recommendations

- Treat `createChildPort({ allowedOrigin })` as required policy, not an optional convenience.
- Ignore application messages until the library handshake completes.
- Keep responses narrow and typed.
- Use `reject()` for transport-level failures instead of overloading success payloads.
- Avoid emitting secrets through generic event channels.

## Timeout Strategy

Time limits are not just UX polish:

- `iframeLoadTimeoutMs` prevents silent dead mounts.
- `handshakeTimeoutMs` surfaces wrong-origin or broken-child failures quickly.
- `callTimeoutMs` avoids orphaned request promises.

Tune them to the real network and rendering behavior of your embed, not to optimistic localhost defaults.

## Threat Model Notes

The runtime defends against:

- messages from the wrong origin
- messages from the wrong iframe window
- cross-talk between sibling instances using different `instanceId`s

It does not replace:

- application authorization
- payload validation
- CSP
- iframe sandbox policy
- product-specific fraud or abuse controls
