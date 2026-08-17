# Monitoring

The extension depends on two things it does not control: that `udm=14` remains a
valid Google Search parameter, and that the AI Overview panel keeps carrying a
`role="heading"` label `content.js` can match. One has already drifted — see
`../issue-paa-overhide.md`.

`monitoring-feasibility.md` records why an automated daily check could not be built:
Google gates `/search` behind JavaScript execution, and the document a fetch
receives has no results on it in either direction. The two probes here are the
manual alternative.

| file | checks | run with |
|---|---|---|
| `redirect-health.js` | `udm=14` redirect, safe-vertical allowlist, bypass token | extension **ON**, any SERP |
| `heading-detection-dryrun.js` | heading-text detection, container scope, `SELECTORS` | extension **OFF**, plain SERP with a visible AI Overview |

Run conditions are not incidental. Under `udm=14` there is no AI Overview to detect;
with the extension on, panels are `display:none` and `climbToPanel()`'s height check
reads 0, so it resolves a container it would not resolve in real use.

Neither probe hides anything or writes to the page.

## Pairing

`heading-detection-dryrun.js` copies detection logic from `content.js`, which
`../inspect-hidden-panels.js` warns against — a probe that duplicates matching rules
drifts out of sync with them. It does so deliberately, since a pattern cannot be
tested without being evaluated, and the copy is guarded by
`.github/workflows/probe-freshness.yml`, which fails the build when `content.js`
changes and the probe's pinned hash does not.

Run the two as a pair: the dry run **predicts** what would be hidden, then toggle the
extension on and run `../inspect-hidden-panels.js` to **observe** what actually was.
If they disagree, the dry run has drifted and the observer is correct.

## Calibration

`heading-detection-dryrun.js` ships with `K_MIN = null` and will not issue verdicts
until that is set — see the K section of `monitoring-feasibility.md`. The first runs
are calibration, not evidence.

## Query shapes

`../issue-paa-overhide.md` reproduced on `best way to learn guitar` and
`how does photosynthesis work`; reusing those gives a comparison against a documented
run. Add a shopping-carousel query for the allowlist check — that is where an
unlisted `udm` code is most likely to surface.
