# DNR matcher run — pre-registration

**Status: PREDICTIONS ONLY. Not yet run.**

This file is committed *before* `docs/monitoring/dnr-match-probe.js` is executed.
Results go in a **separate, later commit**, so the git history shows the
predictions could not have been adjusted to fit what came back. If you find
yourself wanting to edit the predictions below after seeing output, don't —
record the disagreement instead. The disagreements are the findings.

## Why this run exists

Four claims in this repo are currently unresolved or in conflict with each
other. Each is settled by asking Chrome's own matcher, via
`chrome.declarativeNetRequest.testMatchOutcome()`, rather than by reading
documentation and reasoning about it.

| # | Claim | Where it is asserted | Status |
|---|---|---|---|
| 1 | The `www` redirect rule is scoped to Search | `background.js` calls its `urlFilter` a "short path-only" filter | Chrome docs say `urlFilter` is substring matching unless anchored |
| 2 | A typed `udm=50` URL "would reach AI Mode unhindered" | `content.js` header comment | The rule appears structurally capable of matching it |
| 3 | "The rule only fires when `udm=14` isn't already present" | root `README.md` | `14` is not in `SAFE_VERTICAL_UDM_VALUES` |
| 4 | The safe-vertical allowlist is exact | `background.js` regex comment | Untested against `02` and duplicate `udm` params |

## Run conditions

- Extension loaded **unpacked** — `testMatchOutcome()` is unavailable to packed
  builds.
- Chrome Web Store copy **disabled** first. Two installs register competing
  redirect rules; the probe itself only consults its own extension's rules, but
  anything checked by hand afterwards becomes uninterpretable.
- Extension **on**, so `init()` has installed the dynamic rules. With it off,
  every row returns empty and "nothing matches" is indistinguishable from
  "nothing exists". The probe refuses to run in that state.
- Service worker console, via `chrome://extensions` → Inspect views.

## Predictions

Rule IDs: 1 = www redirect, 3 = apex redirect, 2/4 = bypass allow,
5/6 = safe-vertical allow.

| Row | Predicted match | Reasoning |
|---|---|---|
| `www.google.com/search?q=test` | 1 | baseline |
| `google.com/search?q=test` | 3 | baseline, apex |
| `www.google.com/travel/search?q=hotel` | **1** | `urlFilter: "/search?"` is unanchored substring |
| `google.com/travel/search?q=hotel` | **none** | apex rule anchored with `\|` — the control |
| `www.google.com/maps/search?q=cafe` | 1 | same substring path |
| `www.google.com/shopping/search?q=shoes` | 1 | same |
| `www.google.com/url?q=...%2Fsearch%3Fx=1` | 1 | `/search?` appears inside a query value |
| `www.google.com/search?q=test&udm=50` | **1** | contradicts the `content.js` comment |
| `google.com/search?q=test&udm=50` | 3 | same, apex |
| `www.google.com/search?q=test&udm=14` | **1** | contradicts the README's "only fires" wording |
| `www.google.com/search?q=test&udm=2` | 5 | Images is allowlisted |
| `www.google.com/search?q=test&udm=02` | **1, not 5** | regex matches literal `2`, not `02` |
| `www.google.com/search?q=test&udm=50&udm=2` | **5** | rule asks whether a safe value *exists* |
| `www.google.com/search?q=test&udm=2&udm=50` | 5 | order should not matter to the regex |
| `www.google.com/search?q=test&udm=999` | 1 | unknown vertical falls through to redirect |
| `www.google.com/search?q=xudm=2` | 1 | `udm`-like text in the query is not a parameter |
| bypass with current token | 2 | allow, priority 2 |
| bypass with stale token | 1 | stale token must not authorize |
| `xmlhttprequest` type | none | rules specify `main_frame` |
| `post` method | none | rules specify `get` |

Bold rows are the ones the run exists to settle. The rest are controls — if a
control comes back wrong, distrust the whole run before trusting any finding
in it.

## Falsifiers

- **"The `www` rule is correctly scoped"** is falsified by any match on a
  `/travel/search`, `/maps/search`, or `/shopping/search` row.
- **"Substring matching is the cause"** is falsified if the `www` and apex
  travel rows behave the *same*. That would mean the anchoring difference is
  not what's operating and the explanation is something else.
- **"The allowlist is exact"** is falsified if `udm=02` matches rule 5.
- The whole run is untrustworthy if either baseline row fails to match.

## A limit on what this can show

`testMatchOutcome()` is documented as returning "the rules (if any) that match
the hypothetical request", which does not make clear whether the list is before
or after priority resolution. An `allow` at priority 2 and a `redirect` at
priority 1 may both appear even though only the allow takes effect.

So these rows establish which rules the matcher *considers applicable* — which
is exactly what the scope question needs, since rule 1 appearing on a
`/travel/search` row means the condition reaches Google Travel regardless of
what happens next. For the `udm=50` and `udm=14` questions, the outcome matters
as well as the match, so both need a live counterpart:

- Load `www.google.com/travel/search?q=hotel` with the extension on and watch
  whether the address bar gains `udm=14`.
- Type a `udm=50` search and record whether you land in AI Mode or Web results.

`testMatchOutcome()` says what the matcher thinks. The address bar says what
users get. Both belong in the results.

## Results

Not yet run. To be added in a separate commit, with:

- the raw `matchedRules` ids per row,
- the two live address-bar observations,
- an explicit list of rows where the prediction was **wrong**, called out
  rather than folded into prose,
- Chrome version and date.
