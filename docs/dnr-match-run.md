# DNR matcher run — pre-registration

**Status: RUN COMPLETE. Results below; predictions unedited.**

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

Run 2026-08-17, unpacked build (id `npgmaadkml…`), store copy disabled,
extension on, six dynamic rules installed (ids 1–6 as expected).
`testMatchOutcome()` via the service worker console.

**19 of 20 rows matched the prediction. All six control rows were correct, so
the run is trustworthy.**

### Predictions that were WRONG

| Row | Predicted | Actual | What this means |
|---|---|---|---|
| `search?q=test&udm=14` | rule 1 | **no match** | The README was right and the prediction was wrong. |

The reasoning behind the prediction was that `14` is absent from
`SAFE_VERTICAL_UDM_VALUES`, so no allow rule covers it, so the redirect rule
must match and rewrite `14`→`14`. Chrome's matcher does not report a match at
all.

The likely mechanism is that Chrome suppresses a redirect whose transform
produces a URL identical to the request — a redirect-loop guard. **This is a
hypothesis, not a measurement.** Nothing here tested it, and the difference
matters: "the rule does not match" and "the rule matches but the redirect is
discarded as a no-op" imply different things about what happens if the
transform ever changes. Recorded as open.

### Confirmed findings

**1. The `www` rule reaches beyond Search (P1).**

| URL | Matched |
|---|---|
| `www.google.com/travel/search?q=hotel` | **1** |
| `www.google.com/maps/search?q=cafe` | **1** |
| `www.google.com/shopping/search?q=shoes` | **1** |
| `www.google.com/url?q=…%2Fsearch%3Fx=1` | **1** |
| `google.com/travel/search?q=hotel` | **none** |

The apex control did not match. Since the apex rule differs from the www rule
only in being anchored with `|`, unanchored substring matching is established
as the mechanism rather than merely suspected. `urlFilter: "/search?"` matches
the substring anywhere in the URL, and the comment in `background.js` calling
it a "short path-only urlFilter" is wrong.

Fix: give the www redirect and bypass rules the same anchored form the
safe-vertical rules already use — `^https://www\\.google\\.com/search\\?`.

**2. `udm=50` — the matcher and the browser disagree, and both are right.**

Matcher rows:

| URL | Matched |
|---|---|
| `www.google.com/search?q=test&udm=50` | 1 |
| `google.com/search?q=test&udm=50` | 3 |

Live check, run from a page console to bypass omnibox autocomplete:

```js
location.href = 'https://www.google.com/search?q=test&udm=50';
```

DevTools reported:

```
Navigated to chrome://contextual-tasks/?chrome_task_id=2181c9a5-4607-4afe-978f-18d82738d335
```

**The request never reached `www.google.com`.** Chrome intercepted the
navigation and served AI Mode from an internal `chrome://contextual-tasks/`
surface. The result was AI Mode, with the AI Mode tab visible and nothing
hidden.

There is no contradiction between the two results. `testMatchOutcome()` answers
a hypothetical — *if* this URL were issued as a main-frame GET, rule 1 would
match it. Chrome's interception means that request is never issued.
`declarativeNetRequest` only applies to requests that reach the network stack,
and a `chrome://` page is not one.

This also explains an observation recorded in the `content.js` header comment
but never accounted for: four unrelated extension APIs — declarativeNetRequest,
MutationObserver, `chrome.tabs.onUpdated`, `chrome.storage.onChanged` — all
report *nothing at all* on the AI Mode page. The comment inferred from that
silence that AI Mode "isn't part of the same page/origin a content script
attaches to." That inference was correct, and the mechanism is now identified:
it is a `chrome://` page. No content script can be injected into one, and no
DNR rule applies to it.

Fix: sharpen the comment rather than correct it. The claim that a manually
navigated `udm=50` URL reaches AI Mode unhindered is **true**, and the reason
is Chrome-side interception — not, as the comment implies, a property of the
request the extension failed to match.

**Open, and more consequential than the original question.** This is
Chrome-version-dependent *browser* behaviour, not Google-server behaviour. If a
future Chrome stops intercepting `udm=50` and lets the navigation reach the
network, rule 1 would begin firing and the extension's coverage would change
without any change to this repo. Nothing here monitors that.

Scope limit on this measurement: tested once, from an AI Mode page, via
`location.href`, on the bare apex. Whether a `www.google.com` navigation
initiated from an ordinary page behaves identically was not tested — the
interception appears URL-pattern-based rather than origin-based, but that is
inference, not measurement.

**3. The safe-vertical allow rule is over-permissive on duplicate `udm` (P2).**

| URL | Matched |
|---|---|
| `search?q=test&udm=50&udm=2` | **5** (allow) |
| `search?q=test&udm=2&udm=50` | **5** (allow) |

Order does not matter. The rule asks whether a safe value *exists* in the query
string, not whether the effective `udm` state is safe, so a URL carrying
`udm=50` alongside any allowlisted vertical passes through unredirected.

Not a normal-browsing scenario, and which value Google honours was not tested.
But it points the wrong way relative to the design intent stated in
`background.js`: unrecognised input is supposed to fall through to a redirect,
not to an allow.

**4. The allowlist is exact (no defect).**

`udm=02` → rule 1, not rule 5. The RE2 alternation matches the literal `2` at a
parameter boundary and does not treat `02` as numerically equal. Confirms the
comment in `background.js`.

### Controls — all correct

| Row | Expected | Actual |
|---|---|---|
| `www.google.com/search?q=test` | 1 | 1 |
| `google.com/search?q=test` | 3 | 3 |
| `search?q=test&udm=2` | 5 | 5 |
| `search?q=test&udm=999` | 1 | 1 |
| `search?q=xudm=2` | 1 | 1 |
| bypass, current token | 2 | 2 |
| bypass, stale token | 1 | 1 |
| `xmlhttprequest` | none | none |
| `post` | none | none |

### Live checks — both complete

**Travel.** Loading `www.google.com/travel/search?q=hotel` with the extension
on produced an address bar reading:

```
google.com/travel/search?q=hotel&udm=14&ved=0CAAQ5JsGahcKEwjgjd7t-qiWAxUAAAAAHQAAAAACCg
```

The extension appended `udm=14` to a Google Hotels search. The page rendered
hotel results normally — Travel ignores the parameter — so the practical cost
is an extra navigation rather than broken functionality. Finding 1 is therefore
confirmed at the address bar, not only in the matcher.

**udm=50.** See finding 2 above. Resolved differently than expected.

### A note on how this run nearly went wrong

The first three `udm=50` attempts all produced the identical URL, carrying
`sourceid=chrome&ccb=1&biw=…&bih=…` — markers Chrome adds when it constructs a
search itself. Omnibox autocomplete was completing the previously visited URL,
so each "new" attempt re-ran the same navigation. Three data points, one
measurement.

The tell was that the URL was byte-identical across attempts, including the
viewport-dependent `biw`/`bih` values. Worth remembering: when a repeated
manual test keeps producing exactly the same result, check that the input is
actually varying before concluding the behaviour is stable.
