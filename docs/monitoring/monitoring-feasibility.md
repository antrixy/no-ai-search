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

The extension remains **unmonitored** in the sense meant here: nothing runs on a
schedule, and nothing catches drift without a human deciding to look. That
constraint is unchanged by anything below.

What has since been added is the manual route this finding left open — two console
probes, run in a real browser, which clears the JS-execution gate by construction:

- `heading-detection-dryrun.js` — the `role="heading"` detection path. Predicts what
  `content.js` would hide, without hiding it. Carries the liveness gate defined
  above, because "no AI heading matched" is also what a page with no AI Overview
  looks like.
- `redirect-health.js` — the `udm=14` redirect and the `SAFE_VERTICAL_UDM_VALUES`
  allowlist. No liveness gate needed: it reads the URL of a page you navigated to
  yourself, so a gated response is not a state it can silently be in.

Both are manual and on demand. They do not make the extension monitored; they make
it checkable in a few minutes when there is reason to look. See the README in this
folder.

### K is still unset — but now measurable

The liveness definition above depends on `K`, the minimum count of distinct
non-Google external result hostnames. It could not be measured here, because no
document with external destinations was ever obtained by fetch.

`heading-detection-dryrun.js` runs on exactly such a document. It ships with
`K_MIN = null`, which puts it in calibration mode: liveness is reported, verdicts
are withheld, and the observed hostname count is logged. Run the three query shapes,
take the floor, subtract margin, set `K_MIN`, and record the measurements here.

## Fixtures

`docs/fixtures/` holds both responses. See the README there.
