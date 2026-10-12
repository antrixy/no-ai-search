# Changelog

All notable changes to No AI Search are documented here. This project
follows [Semantic Versioning](https://semver.org/) and the format is based
on [Keep a Changelog](https://keepachangelog.com/).

## 1.2.1 — 2026-10-12

### Fixed
- The `udm=14` redirect now applies only to Google Search. On
  `www.google.com` the redirect rule's URL filter was unanchored, so it
  matched `/search?` anywhere in a URL. That included Google Travel
  (Hotels), Maps and Shopping searches, and `/url?` redirect links whose
  target contained `/search?`. Those navigations gained `udm=14` and an
  extra redirect. Travel rendered normally because it ignores the
  parameter. The bare `google.com` rule was already anchored and was
  not affected.
- The allow rule behind "Show AI Overview for this search" had the same
  unanchored shape, so a bypass token on one of those non-Search paths also
  matched it. Both `www.google.com` rules now use the anchored form the
  bare-domain rules already used.

### Notes
- No new permissions. The permission set is unchanged from 1.2.0. The
  only code changes are the two rule filters. What gets hidden, the bypass
  mechanism, the safe-vertical allowlist and the settings are all
  unchanged.
- Found by asking Chrome's own matcher (`testMatchOutcome()`) rather than
  reading the documentation. See `docs/monitoring/dnr-match-run.md`,
  finding 1. The fix was verified by a pre-registered re-run,
  `docs/monitoring/dnr-match-run-1.2.1.md`: 21 of 21 matcher rows and 4 of
  4 address-bar checks came back as predicted, on Chrome 154.
- Known and unchanged: a URL carrying two `udm` parameters, one of them
  allowlisted (for example `udm=50&udm=2`), still passes the allow rule.
  This is not a normal browsing path. It is recorded as finding 3 of the
  first matcher run.
- Code comments corrected in `background.js` (the rules' scope) and
  `content.js`. Chrome serves AI Mode navigations from an internal
  `chrome://` page, which is why a typed `udm=50` URL is out of reach.

## 1.2.0 — 2026-08-28

### Changed
- The **"Show AI Overview for this search"** control moved from a banner on
  the results page into the toolbar popup. Reported externally as a 1-star
  review: because the redirect rule puts every search on `udm=14`, the
  banner's "Web results only" scoping excluded nothing in practice, so it
  appeared on every search. Dismissing it was per-page and not persisted,
  and there was no setting to suppress it. As a fixed-position overlay in
  the top-right corner it could also sit over Google's own account and
  apps controls.
- The bypass mechanism is otherwise unchanged — same per-session token,
  same query parameter, same network allow rule. Only the control's
  location moved.

### Removed
- The content script no longer injects any UI into the page. It now only
  ever removes AI panels; it never adds an element of its own in any
  state. Guarded by `test/no-injected-ui.test.js`.

### Fixed
- A latent duplicate-banner race is gone with the banner: the dedupe check
  ran before an `await` and the append after it, so two overlapping state
  applications could both pass the guard and stack two banners.

### Notes
- No new permissions. Verified in a browser that the popup reads the active
  tab's URL through the existing host permissions, so `activeTab` was not
  required — the permission set is unchanged from 1.1.2.
- The existing test suite could not have caught this. `test/rig.js`'s
  fixture URL carried no `udm` parameter, so the one page state every real
  user is in — `udm=14`, post-redirect — was never exercised. The new
  tests pin that state explicitly, and the first of them documents the gap
  by passing on the old build too.
- Full reasoning, reproduction, and the checklist-design question in
  `docs/issue-banner-every-search.md`.

## 1.1.2 — 2026-07-23

### Fixed
- The **"People also ask"** block is no longer hidden along with the AI
  Overview. Google reassigned the internal attribute the extension used to
  identify AI panels, and it now marks the People-also-ask container
  instead, so that block was being removed on searches where it appeared.
  The stale selector has been dropped. AI Overview hiding is unchanged and
  was re-verified across nine runs on three queries. An AI answer attached
  to the top People-also-ask question is still hidden — only the questions
  themselves come back.

## 1.1.1 — 2026-07-02

Listing-only update; no code or permission changes.

### Changed
- Updated the Chrome Web Store title and short description for clearer
  discovery ("Turn Off Google AI Overviews"), and noted in the store
  description that the extension works by forcing Google's classic Web
  results via the `udm=14` filter.

## 1.1.0 — 2026-07-01

### Fixed
- "Show AI Overview for this search" now works. Previously the link let
  the AI Overview load at the network layer, but the content-script
  backstop re-hid it and raised a false "backup filter caught something"
  note in the popup. The backstop now recognizes an authorized bypass and
  stays completely hands-off on that page, so the requested AI Overview
  stays visible.

### Added
- Hidden AI panels are restored immediately when the extension is toggled
  off, instead of only after a page reload.
- `minimum_chrome_version` set to `101`, so the extension installs only
  where the required declarativeNetRequest features are available.

### Changed
- The fallback that hides an AI panel when no stable anchor is found is now
  bounded — it stops at the results container, the page body, or a
  viewport-sized element — so a Google layout change can't cause it to hide
  large parts of the page.
- The "Show AI Overview" banner now appears only on the Web results view,
  not on Images, Videos, or other result tabs.

## 1.0.0 — 2026-06-20

### Added
- Initial Chrome Web Store release.
- Forces Google's classic Web results (`udm=14`) so AI Overviews and AI
  Mode are skipped at the source, with a content-script backstop.
- Hides the in-page "AI Mode" tab by default, with a popup toggle to show
  it.
- One-click on/off toggle in the toolbar.
- "Show AI Overview for this search" link to view AI results for a single
  query on demand.
