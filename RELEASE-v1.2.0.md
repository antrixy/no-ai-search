# v1.2.0

Single-change minor release. One user-facing control moves location; no new permissions, no settings changes, no change to how filtering works. Ships independently of the larger filtering-mode work still in progress.

## Changed
- **"Show AI Overview for this search" moved into the toolbar popup.** Through 1.1.2 this was a fixed-position banner injected into the results page. Because the redirect rule puts every search on `udm=14`, the banner's "Web results only" scoping excluded nothing in practice — it appeared on every search. Dismissing it was per-page and not persisted, and no setting suppressed it. It also sat in the top-right corner, where it could overlap Google's own account and apps controls. The control is now a button in the popup, shown only when the filter is on and the active tab is a Google search.

## Removed
- **The content script no longer injects any UI into the page.** It now only ever removes AI panels; it never adds an element of its own, in any state. `injectShowAiBanner()`, `removeShowAiBanner()`, `buildShowAiUrl()` and `isWebResultsView()` are gone from `content.js`; the URL is now built in `popup.js` from the active tab.
- A latent duplicate-banner race went with it: the dedupe check ran before an `await` and the append after it, so two overlapping state applications could both clear the guard and stack two banners.

## What did not change
- The bypass itself. Same per-session token, same `show_ai_overview` parameter, same higher-priority `allow` rule in `background.js`. Only the control's location moved. A bypass page is still exempt from all filtering, and a token from a previous session is still rejected.
- The `udm=14` redirect, the safe-vertical allowlist, AI Overview and AI Mode panel hiding, the AI Mode tab hiding, the on/off switch, and the "Show AI Mode tab" preference — all untouched.
- The backstop and its `ai_content_detected` reporting, including the "Backup filter caught something" note in the popup.

## Notes
- No new permissions. Still only `storage` and `declarativeNetRequest`, scoped to Google Search pages. Verified in-browser that the popup reads the active tab's URL through the existing host permissions, so `activeTab` was not required.
- Existing settings (on/off toggle, "Show AI Mode tab") are preserved across the update.
- **Chrome Web Store rollout is pending.** This tag is published ahead of store review, so the store may still serve 1.1.2 for a while. To check which build you have, open `chrome://extensions` — the version is shown under the extension name.
- Reported externally through a review on the store listing, not by the test suite. `test/rig.js`'s fixture URL carried no `udm` parameter, so the one page state every real user is in — `udm=14`, post-redirect — was never exercised. Full reasoning and root cause is in `docs/issue-banner-every-search.md`.
- Guarded going forward by `test/no-injected-ui.test.js`, which asserts against the page rather than the banner's id, so reintroducing the same overlay under a different name would still fail. Mutation-checked against the shipped 1.1.2 `content.js`: 10 of 12 pass there, with the two new assertions red.
