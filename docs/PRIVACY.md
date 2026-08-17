# Privacy policy — No AI Search

_Last updated: August 17, 2026_

No AI Search has no server, no analytics, and no third-party service. The
developer receives nothing: no personal data, no browsing history, and no
search activity is sent to the developer or to any developer-controlled
system. What the extension does handle, it handles locally in your browser,
and this policy describes that handling.

## What this extension stores, and where

The extension uses Chrome's local storage (`chrome.storage.local`) to
remember a small amount of information, entirely on your own device:

- Whether the extension is turned on or off.
- A random session token used by the optional "Show AI Overview" link.
- Whether the filter rule recently failed to apply, so the popup can
  tell you instead of silently doing nothing.
- A timestamp of the last time the backup filter had to step in.

None of this is sent to the developer, and none of it is shared with any
third party.

One clarification, because "stays on your device" would not be strictly
accurate: when you click the optional "Show AI Overview for this search"
link, the extension rebuilds the current search URL with the random session
token added as a parameter, and your browser navigates to it. Google
therefore receives that token as part of that one Google Search URL, in the
same way it receives any other part of a URL you navigate to. The token is a
random value with no connection to your identity, it is regenerated every
browser session, and it is not sent anywhere other than Google as part of
that navigation. Nothing else in the list above ever leaves your device.

## What this extension does on Google Search pages

This extension modifies the Google Search requests your browser makes,
using Chrome's built-in `declarativeNetRequest` API, so that AI
Overviews and AI Mode are skipped in favor of classic web results. The
rule is declarative: it tells Chrome what to change without the extension
ever receiving or inspecting the request, so the text of your searches is
not read, logged, or transmitted by this mechanism.

The one place the extension does read your query is the optional "Show AI
Overview" link described above. To send you to the same search with AI
content restored, it reads the current page's URL — which includes your
query — and rebuilds it. That happens in your browser, at the moment you
use the link, and the result is a Google Search URL you navigate to. The
query is not stored or sent anywhere else.

As a secondary layer, the extension also reads the visible text of
elements on the Google Search results page itself (such as tab labels
and section headings) to detect and hide any AI-generated content or
the "AI Mode" tab if they appear. This check happens locally in your
browser and only looks at visible page text — nothing about what you
see or search for is recorded, stored beyond the current page view, or
sent to the developer or any third party.

## Permissions

- **storage** — stores the settings listed above, locally only.
- **declarativeNetRequest** — modifies Google Search navigation
  requests to skip AI-generated results.
- **Host access to `https://www.google.com/search*` and
  `https://google.com/search*`** — required by Chrome for the above.
  Chrome ignores the path portion of a host permission, so what Chrome
  actually grants is access to the `www.google.com` and `google.com`
  origins. The extension itself is narrower than that grant: its content
  script is registered only for Search URLs, and its request rules only
  ever match Google Search navigations. No other site is accessed, and no
  other Google product is touched by the extension's own logic.

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
