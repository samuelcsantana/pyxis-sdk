# 9. Automatic events in their own entry point, `pyxis-analytics/auto`

Date: 2026-11-05

## Status

Accepted

## Context

Site owners ask for three events they would otherwise have to code by hand: clicks on links that
leave the site, file downloads and form submissions. Other analytics tools record them with a
switch, and a site installed through a tag manager has no code of its own to add `track` calls to.

Two constraints shape how they ship:

- **Size.** The tracker's budget is 6 KB gzipped ([ADR 0004](0004-five-kilobyte-budget.md)), and
  the module build had about 700 bytes left. Listening to the document, telling links apart and
  templating file paths would take most of them, and every site would pay for it, including the
  ones that never switch these events on.
- **Privacy.** A link's URL can carry a token, a coupon or an e-mail address in its query; a
  `mailto:` link is an address; a form holds whatever the visitor typed. None of it may leave the
  browser.

## Decision

- The events ship as a second entry point of the same package, `pyxis-analytics/auto`
  (`dist/auto.js`), with its own `exports` entry. It exports one function,
  `autoEvents(options)`, which returns a function that removes its listeners. `src/index.ts` and
  `window.pyxis` do not change.
- Every event is off by default: `outboundLinks`, `fileDownloads` and `formSubmits` switch on only
  with the boolean `true`, so a string such as `"false"` from a tag manager field does not.
- What each event carries is fixed by a pure function in `src/core/auto-events.ts`:
  - `outbound_link_clicked`: `domain`, the link's host, lower-case, without `www.`, the same
    normalization as the referrer host. Never the path, query or fragment.
  - `file_downloaded`: `extension` and `file_path`, the path through the page-view templating and
    cut at whole segments to the 100 characters a property allows. Never the query.
  - `form_submitted`: `form`, the form's `id` attribute, else its `name` attribute. Attributes are
    read with `getAttribute`, because `form.id` and `form.name` return a field when the form has
    an input with that name. No field is ever read.
  - Only `http:` and `https:` links count; `mailto:`, `tel:` and `javascript:` are ignored before
    anything is read from them.
- The entry sends through the public `track` of the core instead of reaching into the tracker. It
  inherits the key check, Global Privacy Control, Do Not Track, the opt-out, the automation check,
  the page path templating and the property limits without a second implementation. The three
  names are ordinary event names, not reserved ones, so the API screens their properties like any
  other.
- The build bundles `src/auto.ts` with `./index.js` left external, so `dist/auto.js` imports the
  very module `pyxis-analytics` resolves to. Bundling the core into it would give the entry its own
  copy of the tracker, never started, and every automatic event would be dropped in silence. A
  Playwright test loads the two built files as native modules and checks that the events arrive.
- Listeners sit on `document` in the capture phase, so a page that cancels a click or stops it from
  bubbling is still measured. Under Global Privacy Control or Do Not Track none is added.
- `dist/auto.js` has its own budget of 2 KB gzipped, checked by `npm run size` with the others.

## Consequences

- The core build is unchanged in behavior and grows by 7 bytes (a shared host helper). A site that
  does not import `pyxis-analytics/auto` downloads nothing more; one that does adds about 1.7 KB.
- `pyxis-analytics/auto`, `autoEvents`, its options and the three event names with their
  properties are public API: removing or renaming any of them is a major version.
- The entry needs the module build next to it. A page that loads `dist/auto.js` from a CDN loads
  `dist/index.js` from the same folder, which is what the relative import asks for.
- The classic `window.pyxis` build has no automatic events yet. A tag manager template needs a
  classic counterpart that calls `window.pyxis.track`; that is a separate decision with its own
  budget.
- A link's own handler can cancel navigation and the click is still counted, which is what a site
  owner expects from a click count. The events are sent with the next batch, and the batch leaves
  on `pagehide` when the link navigates away.
