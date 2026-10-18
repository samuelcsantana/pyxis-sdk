# 6. Send nothing more from a page after the API refuses a batch

Date: 2026-10-18

## Status

Accepted

## Context

Since pyxis-api v0.23.0 a refused batch is readable by the page that sent it
([pyxis-api ADR 0039](https://github.com/samuelcsantana/pyxis-api/blob/main/docs/adr/0039-a-refused-batch-is-readable-by-its-page.md)):
`401 unknown_key` and every `403` reach the tracker as a status instead of a network error, so a
refused batch is no longer retried five times. The tracker still dropped only that batch and sent
the next one five seconds later. A site whose key was revoked, whose project was deleted or whose
origin is missing from the project's list kept sending one request every five seconds from every
open page, each refused for the same reason.

On `/v1/batch` these answers do not depend on the batch. `401` means the key is unknown or revoked;
`403` means the origin is not allowed, the monthly quota is used up, or the account or project is
suspended. None of them changes while a page is open.

## Decision

- The retry policy has a fourth verdict, `stop`, for `401` and `403`. On it the tracker disposes of
  itself: the queue and any scheduled retry are dropped, and later events, page views and
  `identify` calls send nothing.
- The stop lasts for the page only, in memory. The next page load starts again and sends one
  batch, so a fixed key, an added origin or a lifted suspension takes effect on the next page
  without any stored state to clear.
- `400`, `404` and `413` still drop only the batch: a later batch can be valid. `429`, `5xx` and
  network errors are still retried.
- With the `debug` option the tracker warns once that the API refused the batch and that nothing
  more is sent from the page. Without it the tracker stays silent; the refused request is visible
  in the browser's network panel.

## Consequences

- A refused site costs one request per page load instead of one every five seconds.
- Events of a page whose first batch is refused are lost, as they already were; a site that fixes
  its key or origin measures again from the next page load.
- A `403` that a proxy in front of a self-hosted API returns for one batch only would silence the
  rest of that page. The API itself never answers `403` for a reason that a later batch could avoid.
