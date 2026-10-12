# DNR matcher run, 1.2.1 anchoring fix — pre-registration

**Status: RUN COMPLETE. Results below; predictions unedited.**

This file is committed *before* the 1.2.1 fix is loaded and
`docs/monitoring/dnr-match-probe.js` is executed against it. Results go in a
**separate, later commit**, so the git history shows the predictions could not
have been adjusted to fit what came back. If a prediction turns out wrong, do
not edit it — record the disagreement under Results. The disagreements are the
findings.

Predecessor: `dnr-match-run.md` (2026-08-17, against 1.2.0). This run uses the
same probe and the same controls, so every row can be read against that one.

## The change under test

`dnr-match-run.md` finding 1 established that the www redirect rule's
`urlFilter: "/search?"` is unanchored substring matching, so it reaches Google
Travel, Maps, Shopping, and `/url?` redirects. The apex rule, anchored with
`|`, did not — that was the control that identified the mechanism.

The 1.2.1 change gives the two www rules the same anchored form the apex rules
already use and that the 08-17 run validated:

| Rule | 1.2.0 `urlFilter` | 1.2.1 `urlFilter` |
|---|---|---|
| 1 — www redirect | `/search?` | `\|https://www.google.com/search?` |
| 2 — www bypass allow | `/search?*show_ai_overview=<token>` | `\|https://www.google.com/search?*show_ai_overview=<token>` |

`requestDomains: ["www.google.com"]` stays on both. Rules 3–6 are unchanged.

The anchored `urlFilter` was chosen over the `regexFilter` form suggested in
`dnr-match-run.md`. It is the smaller change, and it is the exact form whose
behaviour the 08-17 apex control row already measured. The regex form would
introduce a shape no run has tested.

## Out of scope, deliberately

- **Duplicate `udm` (finding 3).** `udm=50&udm=2` still reaches the allow rule.
  RE2 has no lookahead, so the fix is not a one-line regex change, and which
  value Google honours has not been tested. These rows stay in the run and are
  predicted to be **unchanged**. A `5` on them is the known defect persisting,
  not a pass.
- **The `udm=14` no-match mechanism.** The 08-17 run found no match. Whether
  Chrome suppresses an identity redirect is still an untested hypothesis. This
  run predicts the same no-match and does not try to explain it.
- **Chrome's interception of `udm=50`.** Browser-side behaviour, not something
  this change touches. Only the matcher rows are predicted here.

## Run conditions

- The 1.2.1 build is loaded **unpacked** from the fix commit.
  `testMatchOutcome()` is unavailable to packed builds.
- The **Chrome Web Store copy is disabled** first.
- The unpacked copy is **reloaded** after checkout, so that `onInstalled`
  rebuilds the dynamic rules from the new `background.js`.
- The extension is **on** in its popup.
- The probe runs in the service worker console:
  `chrome://extensions` → Inspect views: service worker.

## Control zero — the build is the one under test

The probe prints the installed rules before it prints any match row. Predicted
`condition` column:

| id | predicted condition |
|---|---|
| 1 | `\|https://www.google.com/search?` |
| 2 | `\|https://www.google.com/search?*show_ai_overview=<token>` |
| 3 | `\|https://google.com/search?` |
| 4 | `\|https://google.com/search?*show_ai_overview=<token>` |
| 5 | `^https://www\.google\.com/search\?(?:.*&)?udm=(2\|6\|…\|48)(?:&\|$)` |
| 6 | `^https://google\.com/search\?(?:.*&)?udm=(2\|6\|…\|48)(?:&\|$)` |

**If rule 1 still reads `/search?`, the reload did not take. Stop: every row
below would be measuring 1.2.0.**

## Predictions

Rule IDs: 1 = www redirect, 3 = apex redirect, 2/4 = bypass allow, 5/6 =
safe-vertical allow. The "08-17" column is what the 1.2.0 run returned.

| Row | 08-17 | Predicted | Why |
|---|---|---|---|
| `www.google.com/search?q=test` | 1 | **1** | baseline — the anchor must not lose Search |
| `google.com/search?q=test` | 3 | 3 | baseline, apex, untouched |
| `www.google.com/travel/search?q=hotel` | 1 | **none** | the fix |
| `google.com/travel/search?q=hotel` | none | none | apex control, untouched |
| `www.google.com/maps/search?q=cafe` | 1 | **none** | the fix |
| `www.google.com/url?q=https://example.com/search?x=1` | 1 | **none** | the fix |
| `www.google.com/shopping/search?q=shoes` | 1 | **none** | the fix |
| `www.google.com/travel/search?q=hotel&show_ai_overview=<token>` | *(new row)* | **none** | the same fix, applied to rule 2 |
| `www.google.com/search?q=test&udm=50` | 1 | 1 | Search path, still matched |
| `google.com/search?q=test&udm=50` | 3 | 3 | untouched |
| `www.google.com/search?q=test&udm=14` | none | none | unchanged, mechanism still open |
| `www.google.com/search?q=test&udm=2` | 5 | 5 | allowlist untouched |
| `www.google.com/search?q=test&udm=02` | 1 | 1 | allowlist exact, unchanged |
| `www.google.com/search?q=test&udm=50&udm=2` | 5 | 5 | **known defect, out of scope** |
| `www.google.com/search?q=test&udm=2&udm=50` | 5 | 5 | **known defect, out of scope** |
| `www.google.com/search?q=test&udm=999` | 1 | 1 | unknown vertical still redirects |
| `www.google.com/search?q=xudm=2` | 1 | 1 | not a parameter |
| bypass, current token | 2 | **2** | the anchor must not break the bypass |
| bypass, stale token | 1 | 1 | stale token must not authorize |
| `xmlhttprequest` type | none | none | rules specify `main_frame` |
| `post` method | none | none | rules specify `get` |

The new row exists because rule 2 had the same unanchored shape as rule 1, and
the 08-17 run never put the bypass marker on a non-Search path. Under 1.2.0 it
would have matched rule 2. That was never measured, so this run makes no
claim about the old build on that row.

## Falsifiers

- **"The anchor fixes the scope"** is falsified by any match on the five rows
  marked *the fix* / *the same fix*.
- **"The anchor costs nothing on Search"** is falsified if the www baseline,
  `udm=50`, `udm=02`, `udm=999`, `xudm=2` or stale-token row returns anything
  other than `1`, or if the current-token row returns anything other than `2`.
- **The whole run is untrustworthy** if control zero fails, either baseline
  row fails, or any apex row differs from its 08-17 result. The apex rules did
  not change, so a different apex result means something other than this
  change is operating.

## Live checks, predicted

`testMatchOutcome()` says what the matcher thinks; the address bar says what
users get. Run these with the unpacked 1.2.1 build on and the store copy
disabled. **Use a different query each time.** The 08-17 run lost three
attempts to omnibox autocomplete replaying the same URL — byte-identical
`biw`/`bih` values are the tell.

| # | Action | Predicted address bar |
|---|---|---|
| L1 | Load `www.google.com/travel/search?q=<fresh query>` | **no `udm=14`** (08-17: `udm=14` was appended) |
| L2 | Ordinary search typed into the omnibox | `udm=14` present |
| L3 | Popup → "Show AI Overview for this search" | `show_ai_overview=` present, no `udm=14`, AI Overview visible |
| L4 | Click the Images tab on a filtered results page | `udm=2`, Images results |

L2–L4 are regressions: they must look exactly as they did on 1.2.0.

## Results

Run 2026-10-12. Google Chrome 154.0.8037.98 (Official Build) (arm64), macOS
26.5.2. Unpacked build from branch `fix/anchor-www-rules` @ `8e2d28b`,
downloaded as the branch zip. Extension id `cpcipliiemhednncihhkokocoljbbadk`.
Service worker console, context `background.js`.

**Every prediction held. Control zero passed, and 21 of 21 matcher rows and
4 of 4 live checks came back as predicted.**

### Deviations from the stated run conditions

- **A fresh Chrome profile with no store copy installed**, rather than an
  existing profile with the store copy disabled. This meets the condition's
  intent, since nothing could compete with the unpacked rules, and does so
  more strictly.
- **The popup's on state was not checked by hand.** On a fresh install,
  `enabled` defaults to true. The probe's installed-rules table showing all six
  rules is the evidence that `init()` ran.
- **The reload step did not apply.** This was a first load into a fresh
  profile, so `onInstalled` built the rules from this build directly.

### Control zero

`console.table` truncates the `condition` column. Rules 1 and 2 read
`|https://www.google.co…`: the leading `|` is visible, and `/search?` is not
what they read. Row 17's rule label reads `#2 allow [ancho…`, which is the
probe's own classification of a `urlFilter` starting with `|`. Rules 3–6 read
as their 1.2.0 forms. **Passed.** The build is the one under test. The full
condition strings were not visible, so the exact text after the anchor is
supported by the matcher rows rather than read off the table.

Bypass token reported as `857d… (live)`.

### Matcher rows

| # | Row | Predicted | Actual |
|---|---|---|---|
| 0 | www `search?q=test` | 1 | 1 |
| 1 | apex `search?q=test` | 3 | 3 |
| 2 | www `travel/search` | none | none |
| 3 | apex `travel/search` | none | none |
| 4 | www `maps/search` | none | none |
| 5 | www `url?q=…/search?x=1` | none | none |
| 6 | www `shopping/search` | none | none |
| 7 | www `travel/search` + current bypass token | none | none |
| 8 | www `udm=50` | 1 | 1 |
| 9 | apex `udm=50` | 3 | 3 |
| 10 | www `udm=14` | none | none |
| 11 | www `udm=2` | 5 | 5 |
| 12 | www `udm=02` | 1 | 1 |
| 13 | www `udm=50&udm=2` | 5 | 5 |
| 14 | www `udm=2&udm=50` | 5 | 5 |
| 15 | www `udm=999` | 1 | 1 |
| 16 | www `q=xudm=2` | 1 | 1 |
| 17 | bypass, current token | 2 | 2 |
| 18 | bypass, stale token | 1 | 1 |
| 19 | `xmlhttprequest` | none | none |
| 20 | `post` | none | none |

Both falsifiers stand unfalsified. Nothing on the five out-of-Search rows
matched, and every Search row returned its 08-17 rule. The apex rows match
08-17 exactly, so nothing other than this change was operating.

Rows 13 and 14 returning `5` are the duplicate-`udm` defect persisting, as
predicted. They are not a pass.

### Live checks

| # | Predicted | Observed |
|---|---|---|
| L1 | no `udm=14` | `google.com/travel/search?q=hotels%20in%20madison&ved=0CAAQ5JsGahcKEwjYn9_bsrWXAxUAAAAAHQAAAAAQCA`. **No `udm=14`.** Hotel results rendered. The 08-17 equivalent read `…&udm=14&ved=…`. Chrome hides `www.` in the address bar; the typed URL was `https://www.google.com/travel/search?q=hotels in madison`. |
| L2 | `udm=14` | Query `why do cats purr`, typed into the omnibox. **The Web tab was selected**, and there was no AI Overview and no AI Mode tab. The address bar was truncated before the end of the URL, where the redirect appends `udm=14`, so the parameter itself was not seen. Recorded as the Web vertical rendered, which is what `udm=14` produces, and not as the parameter observed. |
| L3 | bypass param, no `udm=14`, AI Overview visible | `https://www.google.com/search?q=why+do+cats+purr&…&sourceid=chrome&source=chrome.ob&ie=UTF-8&show_ai_overview=857d62964ed524b0`. **No `udm`.** The token matches the probe's `857d…`. The AI Overview rendered, and the tab row returned to All. |
| L4 | `udm=2`, Images | Query `red maple leaf`, with the Web tab confirmed selected before clicking Images. The URL carried a **single `udm=2`**: it was not rewritten to 14, and no second `udm` was added. |

L1 and L2 ran in the same profile and the same session. Together they show
Travel left alone while Search is still redirected, which is the change
under test.

### Supplementary: sandbox matcher run (not the pre-registered run)

After this file's predictions were committed and before the run above, the
same unmodified probe was run in headless Chromium 141 (Linux), against
both builds loaded unpacked. It is recorded separately because it differs
from the stated conditions: a different browser and OS, headless, and no
live checks.

- **1.2.0:** all 20 rows of the 08-17 run reproduced exactly. On the new
  row 7 (bypass marker on Travel), **1.2.0 matched rule 2**. The bypass
  rule's scope gap was real, not only structurally possible. The
  prediction table above makes no claim about 1.2.0 on that row; this
  observation is where the claim comes from.
- **1.2.1:** 21 of 21 rows identical to the Chrome 154 result above.

### Still open, unchanged by this run

- **Duplicate `udm` allow (`dnr-match-run.md` finding 3).** Still present, as
  rows 13–14 show.
- **The `udm=14` no-match mechanism.** Row 10 is still none. Whether this is
  identity-redirect suppression is still untested.
- **Chrome's interception of `udm=50`.** Not re-tested. The interception
  depends on the Chrome version, and this run's Chrome version is now on
  record for any future comparison.
