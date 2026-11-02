# 8. Tell a visit's kind from a period marker, not from an identifier

Date: 2026-11-02

## Status

Accepted

## Context

A project may count unique visitors per day and per month without any identifier
([pyxis-api ADR 0055](https://github.com/samuelcsantana/pyxis-api/blob/main/docs/adr/0055-unique-visitors-without-an-identifier.md)):
the first event of each visit says whether it is this browser's first visit, its first this month,
its first today or another one today, and the API counts those kinds. Only the browser can tell
them apart, so the tracker has to keep something between visits. What it keeps decides what the
tracker can promise: until now the only thing it kept beyond the tab was the opt-out choice.

Three things could be kept:

1. **An identifier**, random or derived. It answers every question, and it is exactly what the
   tracker promises not to have: one value that ties every visit of a browser together.
2. **The time of the last visit, or the project's time zone**, with the tracker working out the
   day and the month itself. The last visit's time is different for every browser, so it is a
   finer trace of the visitor than anything the tracker keeps today. Working in the project's zone
   needs the zone from somewhere and calendar arithmetic across summer time in the browser, with
   the bugs and the bytes that come with it, while the API already computes it for every batch.
3. **When the site's day and month end**, as the API answers them: two UTC instants, the same for
   every visitor of the site on that day.

## Decision

- The tracker keeps the third: `pyxis:period` in `localStorage`, holding only `day_ends_at` and
  `month_ends_at`, exactly as the API last answered them. Anything else in the answer is never
  stored.
- The visit's kind is told once, when the entry event is recorded, from the marker read at that
  moment and the device clock: no marker is `first_visit`; at or after `month_ends_at`,
  `first_this_month`; at or after `day_ends_at`, `first_today`; before it, `again_today`. A stored
  value that is not two UTC instants with the day ending no later than the month counts as no
  marker.
- The entry event of every visit carries `visitor`, whether or not the project counts unique
  visitors; without a marker it is `first_visit`, and the API drops it when the option is off.
  Later events of the visit carry nothing, and the marker itself is never sent.
- The site does nothing: there is no option and no new export. The project's setting decides,
  through the API's answer. A successful answer with `visitor_period` writes the marker; a
  successful answer without it deletes the marker. A beacon has no answer, so it changes nothing;
  neither does a network error, an answer that is not a success, or a body that is not the API's
  answer to a batch, so a proxy that strips bodies cannot wipe the count.
- `optOut()` deletes the marker. When `init()` finds Global Privacy Control, Do Not Track or an
  earlier opt-out, it deletes the marker if present and sends nothing. Under automation
  (`navigator.webdriver`) the tracker does not start, so nothing is read, written or sent.

## Consequences

- No identifier is created, stored or sent. Two browsers that visit the same site on the same day
  hold the same marker.
- The count has the limits of a marker that only the answer writes: a visit that ends before its
  first answered send counts again as `first_visit`, two tabs opened at once on the first visit of
  the day count twice, each origin keeps its own marker, and a device with a wrong clock may count
  a visit on the wrong day. The API's ADR lists them with the reports.
- The release order is fixed: the API that accepts `visitor` must be live before a tracker that
  sends it, since an older API rejects an event with an unknown field.
- The marker, the answer's parsing and the deletions took both builds past the 5 KB budget; the
  budget is now 6 KB ([ADR 0004](0004-five-kilobyte-budget.md), amended).
