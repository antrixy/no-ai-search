**Title:** `injectShowAiBanner()` puts a fixed-position banner on every search with no way to suppress it

**Labels:** bug

---

## Summary

`content.js` injects a "Show AI Overview for this search" banner into the
results page on every search. It is a fixed-position overlay in the
top-right corner, its dismissal is not persisted, and no setting suppresses
it. The control was intended as a per-search escape hatch; in practice it
was permanent furniture.

Affects v1.0.0 through v1.1.2 (shipped). Reported externally as a 1-star
review on the Chrome Web Store listing, 2026-08-28:

> it should not display "Show AI Overview for this search" after every
> search result

Not a detection or selector bug. The string in the report is the
extension's own, not Google's — `content.js` sets it directly:

```js
link.textContent = "Show AI Overview for this search";
```

## Impact

Every search, every user, for the life of three releases. Unlike
`issue-paa-overhide.md`, this needed no unusual entry path to reproduce —
normal operation was the failure mode.

The banner is `position: fixed; top: 12px; right: 12px;
z-index: 2147483647`, which is where Google renders its own account
avatar, apps grid and share controls. Overlap of Google's own UI was
likely and worth assuming rather than disproving.

Second-order cost: `README.md` advertised "**Scoped, unobtrusive UI**" and
the store listing described the control as "right there on the results
page." Both were written from the builder's view of a feature and read as
false to a user who did not want it.

## Reproduction

Under the test rig, with a `udm=14` fixture URL:

```
not ok 2 - DEFECT 4: no UI injected on the filtered Web results view (udm=14)
  error: 'content.js must not inject a banner or any other element'
    0: '<div id="no-ai-search-banner" style="position: fixed; top: 12px;
        right: 12px; z-index: 2147483647; ...">
          <a href="https://www.google.com/search?q=learn+guitar&show_ai_overview=tok123">
            Show AI Overview for this search</a>
          <button aria-label="Dismiss">×</button></div>'
```

Deterministic, not a race. Also reproduces through the
`chrome.storage.onChanged` path (toggle off, then on) on an already-loaded
page.

**Not reproduced in a live browser against the buggy build.** The external
report plus the rig output were treated as sufficient, and browser time
went to verifying the fixed build instead. Noted because the house
standard elsewhere in `docs/` is live-markup confirmation.

## Root cause

Three independent things, each of which alone would have been survivable:

**1. The scoping gate is vacuous.** `injectShowAiBanner()` returns early
unless `isWebResultsView()` — that is, unless `udm=14`:

```js
if (!isWebResultsView()) return;
```

But the DNR rule in `background.js` forces `udm=14` onto every
`google.com/search` main-frame GET. After the redirect, *every* search is
the Web results view. The v1.1.0 change that added this gate reads as a
narrowing and excludes only verticals the user manually clicks into.

**2. Dismissal is not persisted.**

```js
close.addEventListener("click", () => banner.remove());
```

DOM-only. The next search is a new page load, so the banner returns. There
is no "dismissed" flag in `chrome.storage.local` and nothing consults one.

**3. No setting controls it.** `popup.html` carries exactly two toggles —
the master switch and "Show AI Mode tab". The banner is reachable by no
preference.

## Latent defect found in the same code

```js
if (document.getElementById(BANNER_ID)) return;   // dedupe guard
const href = await buildShowAiUrl();               // ← await
...
document.body.appendChild(banner);                 // append
```

The guard runs before the `await` and the append after it, so two
overlapping `applyPageState()` calls — a fast off/on toggle during page
load — can both clear the guard and stack two banners in the same fixed
position. Low severity, never reported, removed along with the banner
rather than fixed.

## Fix (shipped in v1.2.0)

The control moved into the popup. `injectShowAiBanner()`,
`removeShowAiBanner()`, `buildShowAiUrl()` and `isWebResultsView()` are
gone from `content.js`; `popup.js` builds the same URL from the active
tab's URL and navigates with `chrome.tabs.update()`.

The bypass mechanism itself is untouched — same per-session token, same
`show_ai_overview` parameter, same higher-priority `allow` rule. Only the
control's location moved.

`applyPageState()`'s invariant block gained a third line:

```
always ⟹ no UI of our own is added to the page, in any state
```

Verified in a browser that the popup reads the active tab's URL through
the existing host permissions, so `activeTab` was not required and the
permission set is unchanged from 1.1.2.

## Why the test suite could not have caught it

`test/rig.js`'s fixture URL is `https://www.google.com/search?q=learn+guitar`
— no `udm` parameter. So under test, `isWebResultsView()` returned false
and the banner was never injected. Nine tests could all be green while the
defect shipped, because **the one page state every real user is in —
`udm=14`, post-redirect — was the one state never exercised.**

`test/no-injected-ui.test.js` pins this deliberately. Its first case runs
the old fixture URL and passes on the buggy build too; it exists only to
sit next to the second case and document the gap.

The assertions are written against the page, not the banner's id.
Asserting `getElementById('no-ai-search-banner') === null` would go green
if the same overlay were reintroduced under a different id. The invariant
worth defending is "content.js adds nothing to the page."

Mutation-checked against the shipped 1.1.2 `content.js`: 10 of 12 pass
there, with the two new assertions red.

## Wider question

The manual checklist had two sections covering the banner and both missed
this. Old §5 asked the tester to confirm the banner **is present** on Web
results; old §6 asked them to dismiss it once and confirm it disappears.
Neither was wrong about the feature. Both were written from "does my thing
work" and never from "how often does my thing interrupt someone."

A single pass over a checklist cannot surface a frequency complaint. §6 is
now a five-search repetition that also checks Google's own header controls
are unobscured.

The portable question: which other checklist items confirm a feature is
present, where the real risk is that it is present too often, or in the
wrong place? Same shape as the `SELECTORS` question raised in
`issue-paa-overhide.md` — a class of defect, not one instance.

## Related

- `issue-paa-overhide.md` — previous externally-found defect in the same
  file. Both were found by users rather than by the suite.
- `test-checklist.md` §5, §6 — rewritten in this release.
- `CHANGELOG.md`, `RELEASE-v1.2.0.md` — the shipped account.
