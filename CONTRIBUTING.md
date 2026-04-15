# Contributing

Thanks for contributing. Keep changes small, explicit, and easy to verify.

## Local Setup

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

Node `18` is the minimum supported development runtime for this repository. The CI and release workflows run on newer Node for tooling, but the package engine target is Node 18+.

## Repo Structure

- `src/`: library runtime
- `test/`: Vitest coverage for host and child behavior
- `examples/`: tiny API-level snippets
- `demo/`: GitHub Pages demo site
- `docs/`: supporting documentation

## Development Expectations

- keep the runtime small and protocol-focused
- avoid framework-specific abstractions in the core package
- pin origins explicitly in examples and docs
- add or update tests when behavior changes
- update docs when API or release workflow changes

## Before Opening A PR

Run:

```bash
pnpm check
pnpm docs:build
```

If the change affects a published artifact, add a Changeset:

```bash
pnpm changeset
```

## Pull Request Guidelines

- describe the behavioral change, not just the code edit
- call out protocol, security, or lifecycle implications explicitly
- include screenshots or a short clip if the demo UI changed
- keep unrelated formatting churn out of the PR

## Release Notes

Stable releases are managed with Changesets. Add a changeset for:

- new features
- bug fixes
- public API changes
- behavior changes that consumers need to know about

Skip a changeset for:

- docs-only edits
- CI-only changes
- internal refactors with no consumer impact

## Security

If you believe you have found a security issue, do not open a public issue first. Follow [`SECURITY.md`](SECURITY.md).
