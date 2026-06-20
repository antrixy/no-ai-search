# Privacy policy — No AI Search

_Last updated: June 20, 2026_

No AI Search does not collect, transmit, sell, or share any personal
data, browsing history, or search activity. There is no server, no
analytics, and no third-party service involved in how this extension
works.

## What this extension stores, and where

The extension uses Chrome's local storage (`chrome.storage.local`) to
remember a small amount of information, entirely on your own device:

- Whether the extension is turned on or off.
- A random session token used by the optional "Show AI Overview" link.
- Whether the filter rule recently failed to apply, so the popup can
  tell you instead of silently doing nothing.
- A timestamp of the last time the backup filter had to step in.

None of this leaves your device. It is never transmitted anywhere,
never visible to the developer, and never shared with any third party.

## What this extension does on Google Search pages

This extension modifies the Google Search requests your browser makes,
using Chrome's built-in `declarativeNetRequest` API, so that AI
Overviews and AI Mode are skipped in favor of classic web results. This
happens entirely within your browser. The extension does not read,
log, or transmit the contents of your searches.

As a secondary layer, the extension also reads the visible text of
elements on the Google Search results page itself (such as tab labels
and section headings) to detect and hide any AI-generated content or
the "AI Mode" tab if they appear. This check happens locally in your
browser and only looks at visible page text — nothing about what you
see or search for is recorded, stored beyond the current page view, or
sent anywhere.

## Permissions

- **storage** — stores the settings listed above, locally only.
- **declarativeNetRequest** — modifies Google Search navigation
  requests to skip AI-generated results.
- **Host access to `https://www.google.com/search*` and
  `https://google.com/search*`** — required by Chrome to allow the
  above, scoped to only the Google Search results page on both domains.
  No other site is accessed.

## No remote code

All code that runs as part of this extension is included in the
extension package itself. Nothing is downloaded or executed from a
remote server.

## Changes to this policy

If this policy changes, the updated version will be posted at this
same location.

## Contact

This extension is developed by Maverick Yadav. Questions, issues, or
feedback can be sent to fan.of.anand@gmail.com.
