# v1.1.1

First tagged release. Covers everything shipped since the initial 1.0.0 Chrome Web Store launch — the 1.1.0 code update and the 1.1.1 listing update.

## Fixed
- **"Show AI Overview for this search" now works.** In 1.0.0 the link let the AI Overview load at the network layer, but the content-script backstop then re-hid it and raised a false "backup filter caught something" note in the popup. The backstop now recognizes an authorized bypass and stays completely hands-off on that page, so the AI Overview you asked for stays visible.

## Improved
- **Restore on disable.** Turning the extension off now un-hides any AI panels it had hidden on the current page immediately, instead of only after a reload.
- **Safer panel hiding.** The fallback that hides an AI panel when no stable anchor is found is now bounded — it stops at the results container, the page body, or a viewport-sized element — so a Google layout change can't cause it to hide large parts of the page.
- **Banner scoped to Web results.** The "Show AI Overview" link now appears only on the Web results view, not on Images, Videos, or other tabs where there's no AI Overview to show.
- **`minimum_chrome_version` set to 101,** so the extension installs only where the declarativeNetRequest features it relies on are available.

## Listing
- Updated the store title and description for clearer discovery ("Turn Off Google AI Overviews") and added a note that the extension works by forcing Google's classic Web results via the `udm=14` filter. No code or permission changes in this part.

## Notes
- No new permissions in this release. Still only `storage` and `declarativeNetRequest`, scoped to Google Search pages.
- Existing settings (on/off toggle, "Show AI Mode tab") are preserved across the update.
