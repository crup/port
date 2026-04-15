# Releasing

This repository now has a release flow similar in shape to `crup/react-timer-hook`, but sized for a single-package TypeScript library.

## Daily Development

1. Add code changes.
2. Run `npm run check`.
3. Add a Changeset with `npm run changeset`.
4. Open a pull request.

## Stable Releases

- `release.yml` runs on pushes to `main`.
- If release notes are pending, Changesets opens or updates a release PR.
- When a release PR is merged, the same workflow publishes the package to npm.

Required secrets:

- `NPM_TOKEN`

Required repository settings:

- GitHub Pages configured to deploy with GitHub Actions
- Actions permissions left enabled for workflow writes on releases

## Prereleases

`prerelease.yml` is a manual workflow for publishing a prerelease build under the `next` dist-tag.

Use it when you want to validate a release candidate without moving npm `latest`.

## Documentation Deploys

- `docs.yml` builds the Vite demo in `demo/`
- Pages deploys to `https://crup.github.io/port/`

## Bundle Size Reporting

- `npm run size` prints a human-readable size table
- `npm run size:json` emits JSON for the size workflow

The PR size workflow compares the built bundle on the branch against `main` and comments the delta on pull requests.
