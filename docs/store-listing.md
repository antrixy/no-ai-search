# Store listing reference

This file isn't read by Chrome — it's a saved copy of the text to paste
into the Developer Dashboard. Section headers below match the actual
field names you'll see there.

## Detailed description (Store listing tab)

Plain text, no markdown — paste as-is.

```
Tired of scrolling past an AI-generated summary just to get to real search results? No AI Search skips Google's AI Overviews and AI Mode automatically — every search, every time — so you land straight on the classic list of web results.

HOW IT WORKS
Searches are filtered at the source, before anything AI-generated ever loads. Nothing flashes by, nothing needs to be hidden after the fact. The in-page "AI Mode" tab is hidden by default too, so there's no separate AI chat experience waiting to pull you in. Works across both google.com and www.google.com.

CHANGED YOUR MIND?
AI blocking shouldn't be all-or-nothing:
• Want the AI Overview for one search? A small "Show AI Overview for this search" link is right there on every results page.
• Want the AI Mode tab back for good? A second toggle in the popup brings it back, no need to disable the extension.

SIMPLE CONTROLS
One toggle in the toolbar. No account, no setup, no configuration. Install it and it just works.

PRIVACY
Nothing is collected, tracked, or sent anywhere — ever. Everything runs locally in your browser. Full privacy policy linked below.
```

## Single purpose (Privacy tab)

```
This extension's single purpose is to let users skip Google's AI-generated search results (AI Overviews and AI Mode) and see classic web-only results instead, with a one-click way to view the AI Overview for an individual search if they choose to.
```

## Permission justification (Privacy tab)

One paragraph per permission — the dashboard usually gives a separate
box for each.

**storage**
```
Used to save the user's on/off preference locally, and a per-session random token used by the optional "Show AI Overview" link. Nothing is synced to an account or transmitted anywhere — chrome.storage.local only.
```

**declarativeNetRequest**
```
Used to add a "udm=14" parameter to Google Search navigation requests, which tells Google to show the classic Web results tab instead of AI Overviews/AI Mode. A separate rule allowlists Google's other legitimate result tabs (Images, Videos, Books, etc.) so they pass through untouched. Another narrowly-scoped rule lets a single intentional click through unmodified, so the user can view the AI Overview for one specific search if they want to. The extension never reads or logs request content — declarativeNetRequest applies rules without the extension inspecting traffic.
```

**Host permission: https://www.google.com/search\* and https://google.com/search\***
```
Required by Chrome to allow the declarativeNetRequest rules above to act on Google Search requests, covering both the www and bare-domain forms Google serves search results from. Scoped only to the search results path — no broader access to Google or any other site is requested.
```

**"Are you using remote code?"**
```
No. All code is bundled in the extension package. There are no remote scripts, no CDN imports, and no third-party libraries.
```

## Data usage (Privacy tab)

The dashboard asks you to check off which categories of data the
extension collects (personally identifiable info, health info,
financial info, authentication info, personal communications,
location, web history, user activity, website content). This
extension collects none of them — leave every box unchecked. The
on/off preference and session token stored locally never leave the
device, so they don't count as "collected" for this disclosure.

## Privacy policy (Privacy tab)

Paste the published URL of `PRIVACY.md` (e.g. its GitHub Pages or raw
GitHub URL) into this field once it's committed to your repo.
