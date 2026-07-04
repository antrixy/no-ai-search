# No AI Search

A Chrome extension that skips Google's AI Overviews and AI Mode automatically, showing classic web search results instead — with a one-click way to bring AI content back for a single search when you want it.

[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/bpgffbdgipfobnjdoikbbficmenihffg)](https://chromewebstore.google.com/detail/no-ai-search/bpgffbdgipfobnjdoikbbficmenihffg)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/bpgffbdgipfobnjdoikbbficmenihffg)](https://chromewebstore.google.com/detail/no-ai-search/bpgffbdgipfobnjdoikbbficmenihffg)
[![Chrome Web Store Rating](https://img.shields.io/chrome-web-store/rating/bpgffbdgipfobnjdoikbbficmenihffg)](https://chromewebstore.google.com/detail/no-ai-search/bpgffbdgipfobnjdoikbbficmenihffg)

## Why

Google increasingly puts AI Overviews and "AI Mode" at the top of the results page, pushing the classic list of links down or replacing it outright. If you prefer plain, source-linked web results — the ten-blue-links experience — you normally have to click into the "Web" filter on every single search. No AI Search does that for you automatically, so your default is always the classic view.

## How it works

Google exposes a "Web" results filter through a URL parameter: `udm=14`. Adding it to a search returns a clean, classic results page — no AI Overview, no AI Mode, and none of the extra widgets.

Rather than waiting for the page to load and then hiding AI blocks with a content script (which causes a visible flash and breaks whenever Google reshuffles its markup), No AI Search works at the network layer using Chrome's `declarativeNetRequest` API. A declarative redirect rule matches Google search requests and rewrites them to include `udm=14` *before* the page loads. Because the rule is declarative:

- there's no blocking `webRequest` handler sitting in the request path,
- the rule never reads the text of your queries,
- and the classic page is what renders first — no flash of the AI version.

The rule only fires when `udm=14` isn't already present, which avoids redirect loops.

## Features

- **Automatic classic results** — forces Google's "Web" filter (`udm=14`) on every search, no manual clicking.
- **One-click bypass** — a small banner on the results page lets you reload the current search with AI content back on, for that one search only. Your default stays AI-free.
- **Scoped, unobtrusive UI** — the bypass banner appears only on Web-results pages, so it never shows up where it doesn't belong.
- **Clean disable** — restores anything it adjusts when you turn the extension off, so nothing is left in a half-modified state.
- **Auditable** — plain Manifest V3 with straightforward HTML/CSS/JS and no build step, so you can read exactly what it does.

## Install

### From the Chrome Web Store (recommended)

**[Install No AI Search](https://chromewebstore.google.com/detail/no-ai-search/bpgffbdgipfobnjdoikbbficmenihffg)** — one click, and it auto-updates.

### Load unpacked (for development)

1. Clone or download this repo.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `no-ai-search/` folder.
5. Run any Google search — you should land on the classic Web-results view.

## Usage

Once installed, just search Google as you normally would. Every search resolves to the classic Web-results page automatically.

When you want the AI version back for a single search, use the bypass control in the banner on the results page. It reloads that one query with Google's default (AI-inclusive) results. Your next search returns to AI-free on its own — the bypass is per-search, not a mode switch.

## Permissions

No AI Search requests the minimum needed to do its job. The authoritative list lives in `no-ai-search/manifest.json`; in plain terms:

- **`declarativeNetRequest`** — to apply the redirect rule that appends `udm=14`.
- **Host access to Google Search** — so the redirect rule and the bypass banner run only on Google search result pages and nowhere else.

The extension does not read the content of pages other than Google search results. See the privacy policy for what is and isn't collected.

## In this repo

- **`no-ai-search/`** — the extension itself. See its own README for the manifest, the ruleset, and how the pieces fit together.
- **`docs/`** — the privacy policy, Chrome Web Store listing text, and a manual test checklist.
- **`assets/`** — promotional graphics and screenshots used in the Store listing.

## Compatibility

- Works in Chrome and Chromium-based browsers that support Manifest V3 and `declarativeNetRequest` (Chrome, Edge, Brave, and similar).
- Targets Google Search specifically. Other search engines are out of scope.
- Because it relies on Google's `udm=14` parameter and results-page structure, a change on Google's side could require an update. If something breaks, please [open an issue](../../issues).

## Possible future features

Ideas under consideration — not commitments or a timeline.

- **"AI-free People also ask" mode** *(exploring)* — an optional mode that keeps the normal results page but reroutes each "People also ask" question to a `udm=14` search, so expanding a question returns plain web links instead of an AI-generated answer. Would be a separate toggle, since it's mutually exclusive with the global `udm=14` force (which removes the PAA box entirely). Design discussion: #1.

Have an idea or hit a bug? [Open an issue](../../issues).

## Contributing

Issues and pull requests are welcome. If you're reporting a bug, it helps to include your Chrome version and a search URL or screenshot showing the problem, so it can be reproduced quickly.

## Privacy

See [`docs/PRIVACY.md`](docs/PRIVACY.md) for the full privacy policy.

## License

<!-- TODO: pick a license and add a LICENSE file. MIT is a common choice for a tool like this. -->
_License to be finalized — see `LICENSE`._
