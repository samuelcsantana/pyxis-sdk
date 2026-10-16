# 5. Do not measure browsers driven by automation

Date: 2026-10-16

## Status

Accepted

## Context

The API refuses events whose user agent declares a robot (`bot`, `crawler`, `spider`, `headless`,
`lighthouse`). A script that drives a real browser sends an ordinary user agent, so its page views
reached the dashboard as visits by people: uptime checks, scrapers, a site's own end-to-end tests
pointed at production. Nothing in the batch tells them apart, and the API never stores the user
agent anyway.

A browser under remote control says so to the page: the WebDriver specification defines
`navigator.webdriver`, `true` while the browser is automated. Playwright's Chromium sets it,
headless or headed, and `--disable-blink-features=AutomationControlled` turns it back to `false`
(checked with Playwright 1.63).

## Decision

- The tracker reads `navigator.webdriver === true` as a privacy signal, `automated`, next to Global
  Privacy Control, Do Not Track and the opt-out. Under it `init()` does nothing, as without a key,
  and `optIn()` only removes the opt-out marker.
- `trackingStatus()` ignores the signal and keeps answering `'on'`. It feeds a site's opt-out
  switch, which speaks to people; "blocked by your browser" would be false, and no switch can
  change it.
- With the `debug` option, `init()` warns that it measures nothing and why. Global Privacy Control
  and Do Not Track stay silent: they are the visitor's choice, while automation is what a
  developer meets, unexpectedly, in a test suite.
- The check runs in the browser, not in the API. Nothing is sent at all, like under the other
  signals, and the batch contract does not grow a field that only the SDK could fill in honestly.

## Consequences

- Automated visits that do not hide their automation stop reaching the dashboard. Automation that
  hides it (the Chromium flag, stealth plugins) still counts: this filters honest automation, it is
  not bot detection.
- Visitors are unaffected: a browser sets the property only while it is under remote control.
- A site's end-to-end tests that expect events must launch Chromium with
  `--disable-blink-features=AutomationControlled`. That makes the change breaking for those suites,
  and it ships as one. This repository's playground tests run that way, plus one test in an
  automated browser that checks nothing is queued.
