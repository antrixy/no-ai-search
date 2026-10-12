# v1.2.1

A single-fix patch release. No new features, no permission changes and no settings changes. Only the scope of two network rules changes.

## Fixed
- **The `udm=14` redirect now applies only to Google Search.** On `www.google.com`, the redirect rule's URL filter was `/search?` with no anchor. Chrome treats an unanchored filter as a substring match, so the rule matched `/search?` anywhere in a URL: Google Travel (Hotels), Maps and Shopping searches, and `/url?` redirect links whose target contained `/search?`. Those navigations gained `udm=14` and an extra redirect. Travel rendered normally because it ignores the parameter. The rule now matches only URLs that begin with `https://www.google.com/search?`. That is the same anchored form the bare-domain `google.com` rule already used, and that rule was never affected.
- **The "Show AI Overview for this search" allow rule is scoped the same way.** It had the same unanchored shape, so a bypass token on one of those non-Search paths also matched it.

## What did not change
- What gets hidden. The AI Overview and AI Mode panel hiding, the AI Mode tab hiding, and the backstop and its "Backup filter caught something" note are all untouched.
- The bypass itself. It uses the same per-session token, the same `show_ai_overview` parameter, and the same higher priority over the redirect. Only the URL prefix the rule accepts was narrowed.
- The safe-vertical allowlist. Images, Videos and the other result tabs still pass through untouched.
- The on/off switch and the "Show AI Mode tab" preference.

## Notes
- No new permissions. Still only `storage` and `declarativeNetRequest`, scoped to Google Search pages.
- Existing settings are preserved across the update.
- **Chrome Web Store rollout is pending.** This tag is published ahead of store review, so the store may serve 1.2.0 for a while. To check which build you have, open `chrome://extensions`; the version is shown under the extension name.
- Found by asking Chrome's own matcher, `chrome.declarativeNetRequest.testMatchOutcome()`, rather than reasoning from the documentation: `docs/monitoring/dnr-match-run.md`, finding 1. The apex rule's anchored form was the built-in control that identified the cause.
- Verified by a pre-registered re-run, with predictions committed before the run and results in a later commit: `docs/monitoring/dnr-match-run-1.2.1.md`. On Chrome 154, 21 of 21 matcher rows and 4 of 4 live address-bar checks matched the predictions. Travel is no longer redirected, while Search, the bypass and the Images tab behave as before.
- **Known and unchanged:** a URL carrying two `udm` parameters, one of them on the allowlist (for example `udm=50&udm=2`), still passes the allow rule. This is not a normal browsing path, and which value Google honours has not been tested. It is recorded as finding 3 of the first matcher run.
- A regression check for the Travel case is now in `docs/test-checklist.md` §13.
