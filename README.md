# No AI Search

A Chrome extension that skips Google's AI Overviews and AI Mode
automatically, showing classic web search results instead — with a
one-click way to bring AI content back for a single search if you want
it.

## In this repo

- **[`no-ai-search/`](./no-ai-search)** — the extension itself. See its
  own README for how it works and how to load it unpacked in Chrome.
- **[`docs/`](./docs)** — the privacy policy, Chrome Web Store listing
  text, and a manual test checklist.
- **[`assets/`](./assets)** — promotional graphics and screenshots used
  in the Store listing.

## Possible future features

Ideas under consideration — not commitments or a timeline.

- **"AI-free People also ask" mode** *(exploring)* — an optional mode that keeps the
  normal results page but reroutes each "People also ask" question to a `udm=14`
  search, so expanding a question returns plain web links instead of an AI-generated
  answer. Would be a separate toggle, since it's mutually exclusive with the global
  `udm=14` force (which removes the PAA box entirely). Design discussion: #NN.

Have an idea or hit a bug? [Open an issue](../../issues).

## Privacy policy

[`docs/PRIVACY.md`](./docs/PRIVACY.md)
