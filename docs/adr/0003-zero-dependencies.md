# 3. Zero runtime dependencies and a 3 KB size budget

Date: 2026-10-05

## Status

Accepted; the size budget is amended by [ADR 0004](0004-five-kilobyte-budget.md)

## Context

A tracker is loaded on every page of the site that installs it, and each of its dependencies is
code that site trusts with its visitors. A convenience package (a UUID generator, a URL parser, an
event emitter) adds weight and supply-chain risk for something a few lines of platform API can do.

## Decision

- `package.json` has no `dependencies`. Development tools are allowed; nothing reaches the bundle
  but this repository's own code.
- The published bundle has a budget of 3,072 bytes gzipped. `scripts/check-size.mts` measures
  `dist/index.js` at gzip level 9 and fails CI above the budget.
- Platform APIs replace packages: `crypto.randomUUID` (with a `getRandomValues` fallback), `URL`,
  `TextEncoder`, `fetch` with `keepalive`, `navigator.sendBeacon`.
- Every release is published by GitHub Actions through npm trusted publishing, which attaches a
  provenance attestation linking the package to the commit and workflow that built it.

## Consequences

- Installing the tracker adds one package to a site's dependency tree, and its origin can be
  verified.
- Some code a library would provide is written here and has to be tested here.
- A feature that cannot fit the budget is a design problem to solve, not a reason to raise it
  silently; changing the budget is a decision recorded in a new ADR.
