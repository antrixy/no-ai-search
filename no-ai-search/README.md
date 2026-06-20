# No AI Search

A small Chrome extension that automatically skips Google's AI Overviews
and AI Mode, showing classic web search results instead. Toggle it on/off
from the toolbar icon.

## How it works

1. **Primary method (does the real work):** a `declarativeNetRequest`
   rule in `background.js` rewrites every Google search navigation to
   include `udm=14`, which is Google's own "Web" results filter. This
   bypasses AI Overviews and AI Mode at the source, so nothing
   AI-generated ever loads — not just hidden with CSS. This covers both
   `www.google.com` and the bare `google.com` apex — see "Domain
   coverage" below for why that's enough without listing country
   domains. A second, higher-priority rule allowlists Google's other
   legitimate result tabs (Images, Videos, Books, etc., by their `udm`
   codes) so they pass through untouched instead of also getting bounced
   to Web — see the comment above `SAFE_VERTICAL_UDM_VALUES` in
   `background.js` for the full list and its limits.
2. **Backstop:** `content.js` runs only on actual search results pages
   (`google.com/search*`, not every Google page) and exists for what the
   redirect can't cover at the network level: Google quietly changing
   how `udm=14` behaves. It does one cheap full check when the page
   loads, then only inspects nodes that are actually added to the page
   afterward — it never re-scans the whole DOM on every mutation, so it
   stays out of the way even on a busy results page. Detection works by
   matching the panel's visible heading text ("AI Overview", "Mode IA",
   etc. — see "Language coverage" below) rather than internal Google
   attributes, which proved more durable.
3. **The in-page "AI Mode" tab** is handled preventatively rather than
   reactively. Three different approaches were tried to catch the AI
   Mode page after it loads — watching the DOM for changes, the network
   redirect, and Chrome's tab-URL tracking API — and none of them ever
   observed that transition happening, even though the address bar
   visibly changes. So instead, `content.js` hides the clickable "AI
   Mode" tab itself, preventing the click rather than reacting to it.
   This is a real but bounded mitigation, not a guarantee — see "What
   this can't do" below. Hiding it is the default, but it's not forced:
   a second toggle in the popup ("Show 'AI Mode' tab") lets you bring it
   back if you'd rather have the option to use it yourself. Flipping
   that takes effect immediately on the current page, not just future
   ones.
4. **Show AI Overview on demand:** every results page gets a small
   "Show AI Overview for this search" link (top-right, dismissible).
   Clicking it reopens the same query without `udm`, plus a marker
   param whose value is a random token generated fresh each session (on
   install and on browser startup) — old bypass links stop working once
   the session that created them ends. A second, higher-priority
   `declarativeNetRequest` rule in `background.js` watches for that
   marker and lets the matching request through untouched — so that one
   click skips the redirect, while every other search still gets
   filtered normally. It's scoped to a single query; the next search you
   run isn't affected.

Both the redirect and the backstop are deliberately not assumed to be
perfect. If the backstop ever has to hide something, it reports that
back to `background.js`, and the popup will show a small note like
"Backup filter caught something — Google may have changed something"
instead of silently doing nothing. If the redirect rule itself fails to
apply (a real failure, not just "Google changed something"), the popup
will say so instead of showing "on" while nothing is actually happening.

## Domain coverage

This works on `www.google.com` and bare `google.com`, which as of 2025
is effectively all Google Search traffic worldwide: Google retired its
country-code domains (`google.co.uk`, `google.de`, `google.co.in`, and
so on) and now redirects every one of them to `google.com`. That
redirect happens before this extension ever sees the request, so there
was no good reason to hardcode a list of ~190 country domains that
Google itself is phasing out — and no way to keep such a list reliably
current anyway.

The one honest gap: if that ccTLD-to-`google.com` redirect hasn't
finished rolling out in some region, or Google reintroduces
country domains in the future, a search made directly on a ccTLD
wouldn't be caught here. That's a narrowing, historical edge case
rather than a current blocker for most users.

## Language coverage

The redirect rule (`udm=14`) is fully language-independent — it works
regardless of what language Google is serving you in, since it's a
server-side parameter, not something this extension has to translate.

The backstop's heading-text detection is different: it matches the
literal visible label on the AI Overview/AI Mode panel, so it only
recognizes the languages it's been given patterns for. Currently:
English, French, German, Portuguese, and (with looser, lower-confidence
matching) Spanish — see the comment above `HEADING_TEXT_PATTERNS` in
`content.js` for which strings were directly confirmed against Google's
own Search Help pages versus which are best-effort. Any other language
falls back to the attribute-based `SELECTORS` only, which may or may not
currently match.

In practice this means: the redirect protects everyone regardless of
language, and the backstop's extra layer of protection is strongest in
the listed languages. If you use Google in a language not covered and
ever see AI content slip through, that's the expected gap — open
`content.js`, find the panel's `role="heading"` element via Inspect, and
add a pattern for its text to `HEADING_TEXT_PATTERNS`.

## What this can't do

Chrome's own **address bar "AI Mode" button** (the Gemini icon that
appears as you type in the omnibox) is native browser UI, not part of any
web page. Extensions have no API to remove it — that one requires
`chrome://flags` (search for "AI Mode" and disable the relevant entries)
or, on managed devices, a registry/policy setting. This extension only
controls what happens once you actually land on a Google search results
page.

The **in-page "AI Mode" tab** is only prevented by hiding the clickable
tab — see "How it works" above for why a more complete fix isn't
possible with the APIs available here. If someone navigates directly to
a `udm=50` URL by some other means (typing it manually, an old bookmark,
a link from elsewhere), that page will load and nothing in this
extension can detect or correct it. This is a real, accepted gap, not an
oversight — the alternative was building something that claimed to fix
it and didn't, which seemed worse than being upfront about the limit.

If another installed extension registers its own `declarativeNetRequest`
redirect rule for the same Google search URL with a higher priority,
that rule could take precedence over this one. The backstop above is the
safety net for that case too.

Google also changes its search page's HTML periodically, which can break
the backstop's attribute-based selectors or its heading-text patterns
(the redirect rule is unaffected by this, since it doesn't depend on
page markup). If AI content ever slips through:

1. Right-click the AI content on the search page → **Inspect**.
2. If you can find a stable `data-attrid`, `jsname`, or `aria-label` on
   it, add a new CSS selector for it to the `SELECTORS` array at the top
   of `content.js`.
3. Otherwise, look for the panel's visible `role="heading"` text and add
   a matching pattern to `HEADING_TEXT_PATTERNS` in the same file — this
   is the more durable option (see "Language coverage" above).

## Install (unpacked, for personal use)

This isn't published to the Chrome Web Store, so you'll load it directly:

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this folder (`no-ai-search`).

The toolbar icon will appear immediately. Click it to flip the toggle on
or off — this is stored locally on this device/profile (not synced
across your other signed-in Chrome devices).

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension configuration (Manifest V3) |
| `background.js` | The redirect rule, the on-demand bypass rule, plus error/fallback tracking |
| `content.js` | Backstop scoped to search pages, plus the "Show AI Overview" link |
| `popup.html` / `popup.js` | The on/off toggle UI, plus status notes |
| `icons/` | Toolbar icon |


