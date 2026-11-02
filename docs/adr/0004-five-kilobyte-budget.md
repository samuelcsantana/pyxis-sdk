# 4. Raise the size budget to 5 KB

Date: 2026-10-05

## Status

Accepted; amends the size budget of [ADR 0003](0003-zero-dependencies.md). Amended on 2026-11-02:
the budget is 6,144 bytes (see the amendment below).

## Context

ADR 0003 set a budget of 3,072 bytes gzipped before any behavior existed. The core alone (queue,
batching under the API's limits, retries with backoff and `Retry-After`, the `sendBeacon`
fallback, the visit, the privacy signals and opt-out) came to 2,831 bytes. Page views (History
API, path templates with custom rules, campaign tags and the referrer) take it to about 3,750, and
`track`, `identify`, `reset` and `trackRequest` are still to come.

Staying at 3 KB would mean dropping behavior that protects data or privacy (retries, the beacon
fallback, custom path rules) or minifying the source by hand against the readability this
repository is held to.

## Decision

The budget is 5,120 bytes gzipped, measured the same way (`scripts/check-size.mts`, gzip level 9,
`dist/index.js`) and still enforced in CI.

## Consequences

- The tracker stays an order of magnitude below the general-purpose analytics SDKs and keeps every
  feature of its plan.
- The badge shows the real size, so the margin left is visible on every release.
- Any further change to the budget is again a decision recorded in a new ADR.

## Amendment (2026-11-02)

Counting unique visitors without an identifier (the `pyxis:period` marker, the visit's kind on its
entry event and the period read from the API's answer) took the module build from 5,053 to 5,430
bytes gzipped and the classic script build from 5,072 to 5,450, over the 5,120 above. None of it
can go without breaking what the feature promises: the kind needs the marker, the marker needs the
answer, and the marker has to be deleted on opt-out and under Global Privacy Control or Do Not
Track. The product owner approved a budget of at most 6 KB for this feature on 2026-11-02, so the
budget is 6,144 bytes gzipped for both files, measured as before. Raising it again needs a new
decision.
