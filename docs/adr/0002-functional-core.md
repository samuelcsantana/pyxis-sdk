# 2. Functional core, thin shell

Date: 2026-10-05

## Status

Accepted

## Context

Most of what a tracker does is decision-making: which part of a URL may leave the browser, when a
queue is flushed, how a batch is split under a byte limit, when a failed send is retried, when a
visit ends. A few things touch the browser: `fetch`, `sendBeacon`, storage, the History API, the
clock. Tests that need a real browser for every rule are slow and leave branches untested.

## Decision

- Rules live in `src/core/` as pure functions: no `window`, no `document`, no global state, no
  clock read. They take values and return values.
- Browser APIs live behind small interfaces in `src/adapters/` (transport, storage, navigation,
  clock, random), each with a fake for tests.
- One shell composes the core with the adapters and owns the tracker's state; `src/index.ts`
  exposes the public functions over it.

## Consequences

- The core is tested exhaustively with plain inputs, which keeps the 100% coverage gate honest
  rather than expensive.
- Adapters are tested once against jsdom or hand-written stubs where jsdom lacks the API.
- The library's own code is typechecked without Node types, so a Node API cannot slip into a
  browser package.
