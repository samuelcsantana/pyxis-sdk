# Contributing to pyxis-sdk

Thanks for your interest. This document explains how the repository is organized and what a pull
request needs before it can be merged.

## Prerequisites

- Node.js 24 (`.nvmrc`) and npm 11, for development only; the package itself runs in browsers.

## Setup

```bash
npm ci
npm run build      # dist/index.js and its type declarations
npm run size       # the gzip size of the bundle against its budget
```

`npm ci` also installs the Git hooks (Husky).

## Scripts

| Script                            | What it does                                                    |
| --------------------------------- | --------------------------------------------------------------- |
| `npm run lint`                    | ESLint, then the comment check for YAML, shell and config files |
| `npm run format` / `format:check` | Prettier                                                        |
| `npm run typecheck`               | The library (browser only), the tests and the scripts           |
| `npm test` / `npm run test:cov`   | Unit tests in jsdom; `test:cov` enforces 100% coverage          |
| `npm run test:tooling`            | Tests of the lint rule and the scripts                          |
| `npm run build`                   | Minified ES module with esbuild, declarations with tsc          |
| `npm run size`                    | Fails when the gzipped bundle exceeds 5 KB                      |
| `npm run contract:sync`           | Copies the API contract from pyxis-api into `contract/`         |

## Design rules

- **Zero runtime dependencies.** The package ships nothing but its own code.
- **Functional core, thin shell**: every rule (path templating, query sanitizing, batching, retry,
  session) is a pure function with no access to `window` or `document`; browser APIs sit behind
  small adapters that tests replace with fakes ([ADR 0002](docs/adr/0002-functional-core.md)).
- **The public API is what `src/index.ts` exports.** Removing or changing an export or an option is
  a major version.
- **The tracker never throws into the page it measures.**
- **Without a key, every public function is a no-op.**

## Workflow

- `main` is the only long-lived branch and is protected. Cut a branch from an up-to-date `main`
  (`feat/…`, `fix/…`, `refactor/…`, `perf/…`, `test/…`, `docs/…`, `ci/…`, `build/…`, `chore/…`)
  and open a pull request into `main`.
- A change to the batch format starts in pyxis-api, backward compatible; this repository follows
  with `npm run contract:sync` and the matching code.
- Pull requests are merged with **Rebase and merge**. Keep commits atomic: each builds and passes
  the tests on its own.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/); a hook and a
  CI job check them. release-please writes the changelog and the release from them, and the release
  workflow publishes to npm with provenance.

## Code rules

- **No comments in code**, in any file. Names, small functions, types and tests carry the meaning;
  the _why_ goes in the commit body, the pull request, an [ADR](docs/adr/) or the README. An ESLint
  rule and a script enforce it.
- Never silence a check: no `eslint-disable`, `@ts-ignore`, `@ts-expect-error` or coverage ignore
  comments.
- Development dependencies must be MIT, Apache-2.0, BSD or ISC licensed, and justified in the pull
  request.

## Tests

- Coverage stays at **100%** of statements, branches, functions and lines.
- Every branch a change introduces has a test for each side; a bug fix starts with a failing test.
- Tests are deterministic: fake timers, fake adapters, no network.

## Security

Report vulnerabilities privately, as described in [SECURITY.md](SECURITY.md), never in a public
issue.
