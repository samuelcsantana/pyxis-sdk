# 7. Publish a classic script build that sets `window.pyxis`

Date: 2026-11-02

## Status

Accepted

## Context

The tracker was published only as an ES module (`dist/index.js`), loaded with `import` from a
bundler or from `<script type="module">`. Many places where a site owner adds a script without a
build step load it as a classic script. A Google Tag Manager custom template can add a script only
through `injectScript`, which inserts a classic `<script>` element and has no way to load a module;
the "add a script" fields of themes and shop platforms work the same way. A module loaded as a
classic script fails on its `export` statement, and a classic script cannot `import`.

## Decision

- The package also ships `dist/pyxis.global.js` and its source map, built by esbuild from the same
  source as a minified IIFE for ES2020. Loading it defines `window.pyxis`, an object with exactly
  the functions `src/index.ts` exports: `init`, `track`, `identify`, `reset`, `trackRequest`,
  `optOut`, `optIn` and `trackingStatus`.
- The package's `exports` do not change: `import 'pyxis-analytics'` still resolves to the module
  build, and no `unpkg` or `jsdelivr` field points a CDN at the classic file. It is reached by its
  path, for example `https://cdn.jsdelivr.net/npm/pyxis-analytics@0.6/dist/pyxis.global.js`.
- The entry, `src/global.ts`, assigns the object to `globalThis.pyxis` itself instead of using
  esbuild's `globalName` option. With `globalName`, esbuild wraps the exports in its CommonJS
  interop helpers (`__toCommonJS` and a getter per export), which put the file at 5,280 bytes
  gzipped, 160 over the budget of [ADR 0004](0004-five-kilobyte-budget.md). With the assignment it
  measures 5,072 bytes.
- The classic file is held to the same 5,120-byte budget as the module build: `npm run size`
  measures both, and CI fails if either is over.
- A unit test checks that `window.pyxis` holds the very functions the module exports, no more and
  no fewer. A Playwright test loads the built file with a plain `<script src>` and checks the batch
  that reaches the endpoint.

## Consequences

- A page or a tag manager template installs Pyxis with one classic script and a call to
  `pyxis.init(...)`, without a bundler or module support.
- `window.pyxis` and the file's path are public API, like the module's exports. Renaming the
  global, moving the file, or removing or changing a function on it is a major version.
- A function added to the module's exports has to be added to `src/global.ts`; the unit test fails
  until it is.
- Each loaded copy of the tracker has its own state. A page that loads the classic file twice, or
  both builds, and initializes each copy measures every page view twice, so a site or a template
  loads one build, once.
- The classic file is the larger of the two, with 48 bytes left under the budget against 67 for
  the module build. A change to the tracker now has to fit the classic file.
