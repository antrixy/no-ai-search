# Drift monitoring: why the fetch route does not work

**Measured 2026-08-10. Negative result.**

This extension depends on two things it does not control: that `udm=14` remains a
valid Google Search parameter, and that Google's AI Overview panel keeps carrying a
`role="heading"` label the content script can match. Both can change without notice,
and one already has — a stale selector (`div[jsname="N760b"]`) was hiding *People
also ask* until it was found and dropped in v1.1.2.

A daily drift monitor was scoped to catch the next one. It was not built. This
records why, so the question is not re-opened from scratch.

## The design constraint

The check's success condition is *the AI Overview selector matches nothing*. A
CAPTCHA page, a consent interstitial and a 429 also match nothing. A blocked fetch
therefore renders as a PASS, silently, every day — a monitor that manufactures
confidence, which is worse than no monitor.

So the first thing to build was not an assertion but a **liveness probe**:
positively confirm a real results page was fetched, and let no assertion carry a
verdict until it passes.

Liveness was defined structurally rather than from Google's markup:

> LIVE ⟺ the final URL is not an interstitial path, **and** the status is 200,
> **and** the query is echoed in the document title, **and** at least K distinct
> non-Google external hostnames appear as result destinations.

Deliberately not a count of `div.g` or `data-hveid` blocks. A probe built from
Google's internal markup fails on the same day the assertion does, and then reports
"blocked" during a real breakage — the exact inversion of the thing being guarded
against.

## What was measured

Two fetch configurations, one query (`how does photosynthesis work`), one
residential IP.

| | fetch 1 | fetch 2 |
|---|---|---|
| configuration | browser UA only | warmed cookie jar, full `Sec-Fetch-*`, `Accept`, `Accept-Language`, `Upgrade-Insecure-Requests` |
| status | HTTP/2 200 | HTTP/2 200 |
| bytes | 92,004 | 91,969 |
| `data-hveid` | 0 | 0 |
| `role="heading"` | 0 | 0 |
| external result hostnames | 0 | — |
| `/url?q=` | — | 0 |
| `enablejs` | 1 | 1 |
| consent / `sorry` / "unusual traffic" markers | 0 | — |
| `<title>` | `Google Search` (query not echoed) | — |

Both responses are the same document: a script shell whose `<noscript>` block sets
`table,div,span,p{display:none}` and whose meta refresh points at
`/httpservice/retry/enablejs`. Google gates `/search` behind JavaScript execution.

## The finding

**A fetch-based drift monitor cannot reach the page this extension runs on.**

The returned document has no result blocks, no headings, and no destinations off
Google. Every assertion about AI-panel presence or absence is inert on it, in *both*
directions. The gate is on script execution, so no header, cookie, or user-agent
configuration reaches past it.

Note what the naive version of this check would have reported. Searching that
document for `AI Overview` returns **0** — and scored as an assertion, that is a
PASS. Every day, forever, from a page with no search results on it. The liveness
signals are the only reason the run was classified correctly.

## What this does not claim

Two configurations, one IP, one query. This does not establish that no fetch-based
route exists. It establishes that the two obvious ones fail identically, and that
the failure is architectural rather than a matter of looking more like a browser.

## Status

Not pursued further. Driving a real headless browser with the extension loaded is
the only remaining route to these assertions, and that is a materially larger piece
of work than a monitoring script — it is a separate decision, not a continuation of
this one.

The extension remains unmonitored. That was also true before this measurement; what
is new is the reason.

## Fixtures

`docs/fixtures/` holds both responses. See the README there.
