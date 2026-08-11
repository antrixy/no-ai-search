# Fixtures

Captured 2026-08-10. Evidence for `docs/monitoring-feasibility.md`.

| file | what it is |
|---|---|
| `serp-noudm.html` | `GET /search?q=how+does+photosynthesis+work` with a browser user-agent and nothing else. 92,004 bytes. |
| `serp-retry.html` | The same request with a warmed cookie jar, `Accept`, `Accept-Language`, `Sec-Fetch-Dest/Mode/Site/User`, and `Upgrade-Insecure-Requests`. 91,969 bytes. |

Neither is a search results page. Both are Google's JS-execution gate: a script
shell with a `<noscript>` block hiding all content and a meta refresh to
`/httpservice/retry/enablejs`.

## Why keep them

These are a **negative control of a third kind**, distinct from the two obvious
ones. A consent interstitial and a CAPTCHA page announce themselves — recognisable
paths, recognisable strings. This one does not:

- HTTP status is **200**
- no consent markers, no `/sorry/`, no "unusual traffic"
- ~92 KB of body, which reads as a healthy page by size

A liveness check built on status codes, interstitial strings, or response size
passes this document. Only structure catches it: zero `data-hveid`, zero
`role="heading"`, zero external result destinations.

Any future monitoring attempt — headless or otherwise — gets tested against these
two files before it is trusted. A check that calls either of them live is not ready.

## Not captured here

A genuine SERP and a genuine consent/CAPTCHA page. Those were the intended positive
and negative controls; neither was reachable by fetch, which is the finding itself.
The value of `K` in the liveness definition is consequently **unset** — it can only
be measured from a document that has external destinations, and no such document
was obtained.
