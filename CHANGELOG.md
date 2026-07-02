# Changelog

All notable changes to No AI Search are documented here. This project
follows [Semantic Versioning](https://semver.org/) and the format is based
on [Keep a Changelog](https://keepachangelog.com/).

## [1.1.1] — 2026-07-02

Listing-only update; no code or permission changes.

### Changed
- Updated the Chrome Web Store title and short description for clearer
  discovery ("Turn Off Google AI Overviews"), and noted in the store
  description that the extension works by forcing Google's classic Web
  results via the `udm=14` filter.

## [1.1.0] — 2026-07-01

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

## [1.0.0] — 2026-06-20

### Added
- Initial Chrome Web Store release.
- Forces Google's classic Web results (`udm=14`) so AI Overviews and AI
  Mode are skipped at the source, with a content-script backstop.
- Hides the in-page "AI Mode" tab by default, with a popup toggle to show
  it.
- One-click on/off toggle in the toolbar.
- "Show AI Overview for this search" link to view AI results for a single
  query on demand.

[1.1.1]: https://github.com/antrixy/no-ai-search/releases/tag/v1.1.1
[1.1.0]: https://github.com/antrixy/no-ai-search/releases/tag/v1.1.0
[1.0.0]: https://github.com/antrixy/no-ai-search/releases/tag/v1.0.0
