**Title:** Mode decision for v1.3 — keep `udm=14`, or hide on the plain SERP?

**Labels:** decision, parked

---

## Status

**Parked for v1.3.** Not started. `serp-feature-matrix.md` measured the
trade on 2026-07-22 and left three decision boxes unchecked; this doc
records why they are still unchecked, what 1.2.0 added to the picture, and
what has to be true before they can be ticked.

The mode question was originally scoped as v1.2. v1.2.0 turned out to be
the banner relocation instead (see `issue-banner-every-search.md`), so the
version label moved. Nothing about the analysis changed.

## The question

Should the extension keep forcing `udm=14`, or let the normal SERP load
and hide only the AI Overview with the content script?

- **Mode A — "Clean Web" (current).** Force `udm=14`. Network-level,
  robust, no flicker, no selector dependency.
- **Mode B — "Keep widgets."** Don't force `udm=14`; hide the AI Overview
  panel and AI Mode tab in-page.

## What prompted revisiting it

Browser testing for 1.2.0 (2026-08-28) confirmed that **People-also-ask
does not render on `udm=14`**. Measured across five-plus filtered pages;
present on the default vertical for the same queries with the extension
off. `why is the sky blue` and `what causes hiccups` both showed PAA at
baseline and neither showed it under `udm=14`.

This is not new — `issue-paa-overhide.md` already recorded that under
`udm=14` the PAA block never renders. But PAA was never in Table A, so
the count of features lost to Mode A is at least one higher than the
matrix states.

It is also not a defect. The extension is not hiding PAA there; Google's
Web vertical does not serve it. No selector change can bring it back.
Only a mode change can.

## What is already measured

From `serp-feature-matrix.md`, run 2026-07-22:

- **Twelve of fourteen** Table A rows flip from Y to N under `udm=14`.
  Calculator, currency, unit conversion, time, dictionary, knowledge
  panel, "did you mean", weather, speed test, translation, sports OneBox,
  stock quote.
- **At least sixteen features lost across fourteen rows** — two rows
  killed a second feature on the same page. The row count understates it.
- **Loss is not uniform** (finding §6). Four severity tiers: reliable
  substitute, stale substitute, no substitute, structured data lost. The
  stale tier — time, weather, stock — is arguably worse than absence,
  because a cached answer looks authoritative. Clocks 90 minutes apart,
  temperatures spanning 22 °F.
- **Mode B fully removes AI Overview and the AI Mode tab** (finding §4)
  — but it over-hides. That over-hiding is the v1.1.1 PAA bug.
- **Typos still get corrected under Mode A** (finding §2). The suggestion
  module is stripped; the query-rewriting pipeline is not. Materially
  milder than "spelling correction is broken."

## What is not measured

**Flash severity in Mode B** (finding §5). Cannot be established without
a real build; the toggle-on harness runs its scan after full page load, so
it measures hiding correctness, not latency. This is the single open input
to the decision.

One constraint on the eventual measurement: AI Overview position varies by
query — top of page on most, below People-also-ask on
`translate hello to spanish`. A panel below the fold may flash
imperceptibly, so flash severity is likely query-dependent rather than one
verdict. Any measurement that reports a single number is measuring the
wrong thing.

## The trade, stated plainly

Mode A's cost is a list of sixteen-plus features, already enumerated and
severity-tiered.

Mode B's cost is a category of defect rather than a list: it makes
`SELECTORS` the primary mechanism rather than a backstop. Two attribute
selectors have already gone bad in this project's history — a `bard`
substring selector, and `div[jsname="N760b"]` — and the second shipped a
visible bug to users. Under Mode A those failures are survivable because
the redirect is doing the real work. Under Mode B there is nothing behind
them.

`issue-paa-overhide.md` closes with the relevant question: whether the
remaining attribute selectors should be dropped in favour of heading-text
detection, which was demonstrated sufficient on live markup and carries no
false-positive risk. **That question is a prerequisite for Mode B, not a
parallel cleanup.** Mode B on the current `SELECTORS` array ships the
1.1.1 failure mode as the primary mechanism.

## Gate conditions

Before the three decision boxes in `serp-feature-matrix.md` can be
ticked:

1. Flash severity measured on a real Mode B build, across queries with the
   AI Overview both above and below the fold. Not a single verdict.
2. The `SELECTORS`-vs-heading-text question from `issue-paa-overhide.md`
   resolved, since Mode B depends on the answer.
3. Decide whether both modes ship as a popup toggle or one is chosen as
   the default. A toggle doubles the QA surface — `test-checklist.md`
   would need a full pass per mode.
4. Store-listing disclosure drafted for features lost regardless of mode.

## The disclosure worth writing either way

Finding §3 is the strongest asset here and it is currently unused. **The
featured snippet was absent in every state** — baseline with the
extension fully off, Mode A, and therefore Mode B. Confirmed 3× at
baseline with an AI Overview firing on all three runs.

Part of what users blame the extension for was already gone before they
installed it. Google's AI Overview displaced the answer box. This belongs
in the store listing regardless of which mode wins, because it is the
cleanest available counter to the review pattern this whole exercise
exists to address.

## Related

- `serp-feature-matrix.md` — the measurement instrument and the three
  unchecked decision boxes. Re-run it when Google changes Search behavior.
- `issue-paa-overhide.md` — the v1.1.1 over-hiding bug; its "wider
  question" is gate condition 2.
- `issue-banner-every-search.md` — the v1.2.0 defect that displaced this
  work from the v1.2 slot.
- `test-checklist.md` — the over-hiding check, whose method was corrected
  in 1.2.0 once it became clear a filtered page cannot carry a PAA block.
