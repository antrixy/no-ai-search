# v1.1.2

Single-fix patch release. No new features, no permission changes, no settings changes. Ships independently of the larger filtering-mode work still in progress.

## Fixed
- **"People also ask" is no longer hidden.** The extension identified AI panels partly by an internal Google attribute. Google reassigned that attribute, and it now marks the People-also-ask container — so on searches where that block appeared, the extension was removing it silently along with the AI Overview. The stale selector has been dropped.

## What did not change
- AI Overview hiding. Re-verified after the fix across nine runs — three queries, three repeats each — with the AI Overview fully hidden in all nine, including a query where the Overview renders *below* People-also-ask.
- An AI answer attached to the top People-also-ask question is still hidden. The boundary the extension now draws is: the AI answer *on* People-also-ask goes, the questions themselves stay.
- Everything else — the `udm=14` redirect, the "Show AI Overview for this search" bypass, the AI Mode tab toggle, and the on/off switch — is untouched.

## Notes
- No new permissions. Still only `storage` and `declarativeNetRequest`, scoped to Google Search pages.
- Existing settings (on/off toggle, "Show AI Mode tab") are preserved across the update.
- The fix is a one-line deletion in `content.js`. Full measurement detail is in `docs/serp-feature-matrix.md` §9.
