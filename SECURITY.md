# Security policy

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub's private vulnerability reporting](https://github.com/samuelcsantana/pyxis-sdk/security/advisories/new).
Do not open a public issue.

Include what you found, how to reproduce it and the impact you expect. You will get an
acknowledgement within a few days, and the fix will be credited to you if you wish.

## Scope

Of particular interest:

- personal data leaving the browser despite the path templating and query sanitizing (an email in
  a path, a token in a query string);
- tracking that continues after an opt-out, or despite Global Privacy Control or Do Not Track;
- anything the tracker stores that could identify a visitor across days;
- ways for a page's content to make the tracker run code or send requests elsewhere;
- a tampered package: every release is published by GitHub Actions with npm provenance, so a
  version without a provenance attestation is suspicious.
