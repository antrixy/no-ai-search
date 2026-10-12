# DNR matcher run, 1.2.1 anchoring fix — pre-registration

**Status: PRE-REGISTERED, NOT RUN.**

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

*(Separate, later commit. Do not fill in before the run.)*
