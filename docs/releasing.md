# Releasing

This repository now has a release flow similar in shape to `crup/react-timer-hook`, but sized for a single-package TypeScript library.

## Daily Development

1. Add code changes.
2. Run `pnpm check`.
3. Add a Changeset with `pnpm changeset` when you want to keep pending release notes.
4. Open a pull request.

## Stable Releases

- `release.yml` is a manual workflow dispatch from `main`.
- It uses a guarded release gate, a separate verify job, and a dedicated publish job.
- `NPM_TOKEN` is passed directly to the publish step via `NODE_AUTH_TOKEN` and `NPM_TOKEN`.
- After publish, the workflow commits the released `package.json` version back to `main`, then creates the GitHub release tag and notes from that release commit.

Required secrets:

- `NPM_TOKEN`

Required repository settings:

- GitHub Pages configured to deploy with GitHub Actions
- Actions permissions left enabled for workflow writes on releases

## Prereleases

`prerelease.yml` is a manual workflow for publishing an alpha build from the `next` branch.

Use it when you want to validate a release candidate without moving npm `latest`.

## Documentation Deploys

- `docs.yml` builds the Vite demo in `demo/`
- Pages deploys to `https://crup.github.io/port/`

## Bundle Size Reporting

- `pnpm size` prints a human-readable size table
- `pnpm size:json` emits JSON for the size workflow

The PR size workflow compares the built bundle on the branch against `main` and comments the delta on pull requests.
