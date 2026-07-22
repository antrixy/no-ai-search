**Title:** `SELECTORS` entry `div[jsname="N760b"]` now matches the People-also-ask container

**Labels:** bug

---

## Summary

`content.js` hides the People-also-ask question list along with the AI
Overview panel, leaving an orphaned "People also ask" heading over empty
space. Caused by a hardcoded attribute selector that Google has since
reassigned to a different element.

Affects v1.1.1 (shipped).

## Impact

The content script only reaches a page carrying a PAA block when it runs
on a SERP that was **not** redirected to `udm=14` — under `udm=14` the PAA
block never renders, so the bug is invisible in normal operation.

In shipped use that happens when a user toggles the extension **on** while
a Google results page is already open: the `chrome.storage.onChanged`
listener fires `initialScan()` in that tab, filtering a live, plain SERP.
The user sees the AI Overview vanish correctly and the PAA questions
vanish incorrectly.

This also blocks the "Keep widgets" mode under consideration for v1.2,
where the content script becomes the primary hiding mechanism on every
page.

## Reproduction

1. Extension **OFF**
2. Search `best way to learn guitar` on google.com (plain SERP, no `udm=14`)
3. Confirm the AI Overview and four People-also-ask questions are visible
4. Open the popup, toggle **Block AI results ON** — do **not** reload

**Expected:** AI Overview hidden, PAA block untouched.
**Actual:** AI Overview hidden (correctly), PAA questions hidden, PAA
heading left behind over ~68px of dead space.

Reproduced 2/2 on `best way to learn guitar` and again on
`how does photosynthesis work`. Deterministic, not a race.

Confirmed the extension is the cause by reversal: toggling **OFF** runs
`restoreHiddenPanels()`, which only restores elements carrying
`data-noaisearch-hidden-panel` — the PAA questions reappear, so they were
hidden by `hide()`.

## Root cause

Console inspection of elements carrying the extension's own marker
attribute returned two hits:

```js
document.querySelectorAll('[data-noaisearch-hidden-panel]')
```

| # | element | correct? |
|---|---|---|
| 0 | `<div jsname="ZLxsqf" data-hveid="CA8QAA">` | yes — AI Overview wrapper |
| 1 | `<div jsname="N760b">` | **no — PAA container** |

Element 1's text content begins:
`What is the most effective way to learn guitar?The 10 Best Methods For Learning...`

The second hit comes from this entry in `SELECTORS`:

```js
const SELECTORS = [
  'div[data-attrid="AIOverview"]',
  'div[jsname="N760b"]',        // <-- now matches the PAA container
  '[aria-label="AI Overview"]',
  '[aria-label*="AI Mode" i]'
];
```

Google has reassigned `jsname="N760b"`. The extension is faithfully hiding
whatever currently carries that value.

## Proposed fix

Remove the `div[jsname="N760b"]` entry.

**Validated against live markup before proposing.** Running heading-text
detection alone on the same page — no `SELECTORS` pass — gives:

```
AI headings found: 1
container: <div jsname="ZLxsqf" ... data-hveid="CA8QAA">
  contains PAA? false
```

The resolved container outlined exactly the AI Overview (sparkle icon,
body text, "Show more") and stopped above the first organic result. So
`HEADING_TEXT_PATTERNS` → `closest('[data-hveid]')` resolves the correct
panel on its own, and removing the selector costs no detection coverage.

## Wider question

This is the second attribute-based selector to go bad — a previous `bard`
substring selector was already removed for related reasons, and the
`SELECTORS` header comment already warns these values "get renamed often,
so treat them as a cheap first check, not the primary mechanism."

Heading-text detection has now been demonstrated sufficient on live
markup. Worth considering whether the remaining attribute selectors should
go too, rather than patching values one at a time as each breaks. They
carry a false-positive risk that the heading-text path does not, and this
issue is what that risk looks like in production.

## Related

Discovered while running `docs/serp-feature-matrix.md` for v1.2 mode
planning (run 2026-07-22). Findings §4 in that doc covers the same ground
from the mode-decision angle.
