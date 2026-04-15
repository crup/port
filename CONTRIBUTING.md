# Contributing

Thanks for contributing. Keep changes small, explicit, and easy to verify.

## Local Setup

```bash
npm install
npm run lint
npm run typecheck
npm test
```

Node `24` is the supported development runtime for this repository.

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
npm run check
npm run demo:build
```

If the change affects a published artifact, add a Changeset:

```bash
npm run changeset
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
