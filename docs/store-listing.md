# Store listing reference

This file isn't read by Chrome — it's a saved copy of the text to paste
into the Developer Dashboard. Section headers below match the actual
field names you'll see there.

## Detailed description (Store listing tab)

Plain text, no markdown — paste as-is.

```
Tired of scrolling past an AI-generated summary just to get to real search results? No AI Search turns off Google's AI Overviews and AI Mode automatically — every search, every time — so you land straight on the classic list of web results.

HOW IT WORKS
Searches are filtered at the source, before anything AI-generated ever loads — nothing flashes by, nothing has to be hidden after the fact. Under the hood it forces Google's classic Web results (the udm=14 filter), so no AI Overview is generated in the first place. The in-page "AI Mode" tab is hidden by default too, so there's no separate AI chat experience waiting to pull you in. Works across both google.com and www.google.com.

CHANGED YOUR MIND?
Blocking AI shouldn't be all-or-nothing:
• Want the AI Overview for one search? A small "Show AI Overview for this search" link is right there on the results page.
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

## Test instructions (Privacy tab or Test instructions field)

```
No account or login is needed to test this extension.

1. Install and confirm the toolbar icon appears. Click it — the popup shows two toggles: "Block AI results" (on by default) and "Show 'AI Mode' tab" (off by default).

2. Go to google.com and search for something like "what is machine learning." The URL will include "udm=14" and the results page will show only standard web links — no AI-generated summary panel.

3. On that same results page, note there is no "AI Mode" tab in the row of tabs (All, Images, Videos, etc.) — it's hidden by default.

4. In the top-right corner of the results page, there's a small "Show AI Overview for this search" link. Clicking it reloads the same search without the udm=14 filter, so Google's AI Overview (if available for that query) is shown for that one search only. Searching again afterward returns to the filtered default.

5. In the popup, turn "Block AI results" off. Search again — AI Overview is no longer filtered, demonstrating the toggle controls the entire feature.

6. Turn "Block AI results" back on, then turn "Show 'AI Mode' tab" on. Search again — the "AI Mode" tab now appears in the tab row, since this is an opt-in setting for people who sometimes want access to it.

No special test account, region, or language is required — all of the above works on a standard Google search in English.
```

## Privacy policy (Privacy tab)

```
https://github.com/antrixy/no-ai-search/blob/main/docs/PRIVACY.md
```
