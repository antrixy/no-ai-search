# SERP feature matrix — No AI Search

Purpose: measure, in a real browser, exactly which Google Search features
survive under each of the two possible extension modes, so the v1.2
default is chosen from observation, not assumption.

Background: the extension's current mechanism is forcing `udm=14` (the
"Web" tab). The Web tab is deliberately just organic links, so it strips
**many non-AI features** — currency conversion, calculator, knowledge
panels, and so on — not only AI Overviews. Those losses are the substance
of nearly every 1-star review of `udm=14`-based extensions. This matrix
quantifies the trade so we know what each mode actually costs.

This is **not** the release QA gate — that's `test-checklist.md`. This is
an investigative + regression instrument: re-run it whenever Google
changes Search behavior or when reconsidering the default mode.

---

## The two modes under test

- **Mode A — "Clean Web" (current behavior).** Force `udm=14`. Maximum AI
  suppression; the classic stripped-down page. Cost: loses the non-AI
  widgets below.
- **Mode B — "Keep widgets" (v1.2 proposal).** Do *not* force `udm=14`;
  let the normal SERP load and use the content-script backstop to hide
  only the AI Overview panel and the AI Mode tab. Keeps the widgets. Cost:
  selector-dependent, and a possible brief flash of the AI panel before
  it's hidden.

Key equivalence used below: because content-script hiding removes only the
AI panel and never touches a widget, **a widget's availability in Mode B
is identical to its availability on the plain (non-`udm=14`) SERP.** So
the baseline column doubles as the Mode B widget result — no separate
Mode B pass is needed for Table A.

---

## How to run

Run the canonical pass as: **desktop, signed in, US (Sun Prairie)**,
one query at a time. Then spot-check the variance dimensions in the
confounds section — Google's feature rollout differs by device, sign-in
state, and region, so a single environment is not authoritative on its
own.

> The canonical environment was originally specified as *signed out*.
> The 2026-07-22 run was performed signed in throughout; rather than
> discard a uniform pass, the canonical state was relabelled and
> signed-*out* moved to the confounds list. A pass is valid when its
> environment is internally consistent, not when it matches the
> environment guessed at in advance.

For each row:

1. **Baseline** — extension **OFF**, search the query on a normal SERP
   (no `udm=14`). Record whether the feature appears.
2. **Mode A** — extension **ON** (current build forces `udm=14`), same
   query. Record whether the feature still appears.

Legend for result cells: `Y` present · `N` absent · `~` partial /
inconsistent across retries · `—` not applicable · leave blank until run.

---

## Table A — QoL features (the review complaints)

These are the non-AI features users are angry about losing. We *want*
these present. The Baseline column = what Mode B (Keep widgets) preserves.

Run 2026-07-22. Substitute column records what the organic results offer
in Mode A once the widget is gone — see "Loss is not uniform" in Findings.

| Feature | Test query | Baseline / Mode B | Mode A (`udm=14`) | Substitute in Mode A | Notes |
|---|---|---|---|---|---|
| Currency conversion | `150 usd to eur` | Y | N | rate in snippets | Widget has editable amount + chart; snippets give rate only |
| Calculator | `12*(4+3)` | Y | N | **none** | Organic results are about *other* expressions; query unanswered |
| Unit conversion | `10 km in miles` | Y | N | reliable | 6.214 mi stated in several snippets |
| Time / timezone | `time in tokyo` | Y | N | **stale** | Two snippets disagreed by ~90 min (cached at different times) |
| Dictionary / definition | `define ephemeral` | Y | N | reliable | Also killed the right-rail "Translate to" panel — 2 features, 1 row |
| Featured snippet ("blurb") | `how to boil an egg` | **N** | N | reliable | Absent in *all* modes; see Findings — not extension-caused |
| Knowledge panel | `albert einstein` | Y | N | partial | Prose facts survive in snippets; structured table (spouse/children/education) does not |
| Spelling: "did you mean" | `definately` | Y | **N** | n/a | **KEY ROW — resolved: `udm=14` casualty** |
| Spelling: "showing results for" | `teh brown fox` | Y | **Y** | n/a | **KEY ROW — resolved: survives `udm=14`.** Exact text is now "These are results for", not "Showing results for" |
| Weather | `weather` | Y | N | **stale** | Results still localised to Sun Prairie, but snippets spanned 54–76 °F vs 62 °F on the card |
| Speed test | `internet speed test` | Y | N | **none** | A link cannot measure your connection; must click through and run a third-party test |
| Translation | `translate hello to spanish` | Y | N | lookup only | "hola" is in snippets; the interactive translate-your-own-text tool is gone |
| Sports score (optional) | `packers score` | Y | N | **none + conflicting** | No game score anywhere; NFL.com says `0-0-0`, FOX says `9-7-1`, nothing dates either |
| Stock quote (optional) | `AAPL stock` | Y | N | **stale** | Most snippets ~325 (baseline 325.88) but one undated Reddit snippet said 283.78. Also killed the right-rail knowledge panel — 2 features, 1 row |

**Result: 12 features lost to `udm=14`, 1 survives, 1 absent regardless.**

**Reading Table A:** every row that is `Y` in Baseline but `N` in Mode A
is a feature Keep-widgets mode would rescue. That set is the concrete
answer to "what does forcing `udm=14` actually cost the user."

---

## Table B — AI targets (what the extension must remove)

These we *want* gone. Mode A removes them by never serving them. Mode B
must remove them via the content-script backstop on a normal SERP — so
Mode B needs its own live check here, plus a flash observation.

Mode B measured against `content.js` **as shipped in v1.1.1**, via the
toggle-on harness described below. These rows are build-stamped: they
must be re-run after the selector fix in Findings §4.

| AI target | Test query | Baseline (served?) | Mode A (`udm=14`) removed? | Mode B (content-script) removed? | Flash before hide? |
|---|---|---|---|---|---|
| AI Overview panel | `how does photosynthesis work` | Y | Y | **Y** — but over-hid PAA, see §4 | not measurable |
| AI Overview (2nd query) | `best way to learn guitar` | Y | Y | **Y** — but over-hid PAA, see §4 | not measurable |
| AI Mode tab | any informational query | Y | Y | **Y** — content script alone, no redirect needed | — |

**Mode B harness (used in place of a build).** With no Keep-widgets build
yet, Mode B was produced by: extension **OFF** → load a plain SERP with a
live AI Overview → toggle extension **ON** without reloading. Toggling
`enabled` fires a storage listener in every open SERP tab that runs
`initialScan()` on the already-loaded page, so `content.js` filters a real
non-`udm=14` SERP. This is the *only* way to reach "filtering active, no
redirect" with the shipped build — normal use always redirects, and the
bypass token disables filtering entirely.

**Why flash is not measurable this way.** The harness runs the scan *after*
the page has fully loaded, so it says nothing about how long the panel is
painted before `content.js` fires at `document_idle` on a real page load.
Hiding *correctness* is fully testable here; hiding *latency* is not. That
column needs a real build and stays blank — see Findings §5.

**AI Mode tab scope.** The row says "any informational query", but the tab
was present on *every* baseline SERP observed, including `12*(4+3)` and
`150 usd to eur`. It appears to be universal page chrome, not AI-content
gated. Reword this row on the next revision.

**Mode B procedure (per AI row):** temporarily load the normal SERP with
the content script hiding enabled but `udm=14` *not* forced. (Until a
build exists, simulate by loading the plain SERP and confirming the
existing `SELECTORS` / heading-text logic in `content.js` matches the
live AI Overview container — see checklist §12.) Record whether the panel
is hidden, and whether it was briefly visible first (the flash cost).

**Flash column matters:** a visible flash-then-hide is the main UX
downside of Mode B versus Mode A. If it's imperceptible, Mode B is close
to free; if it's a noticeable jump, that's a real reason some users would
still prefer Mode A.

---

## Confounds — run after the canonical desktop pass

Re-run at least the AI Overview row and 2–3 representative QoL rows under
each variant; note any that differ from the canonical result.

**None of these were run on 2026-07-22 except retry variance.** The
canonical pass stands on its own; these remain open.

- [ ] **Mobile** (real device or DevTools device mode) — known to differ
      from desktop for the same query.
- [ ] **Signed out** vs the canonical signed-in pass. *(Inverted from the
      original plan — see the note under "How to run".)*
- [ ] **Region** — if feasible, one non-US locale; feature rollout and
      the ccTLD→`google.com` redirect vary by region.
- [x] **Retry variance** — run for the featured-snippet row only
      (3× at baseline; AI Overview fired every time, snippet absent every
      time). Not run for other rows. Note that two of the three runs
      returned pixel-identical pages, suggesting a cached response rather
      than three independent samples.

**Observed non-determinism at baseline** (unprompted, worth recording):
a sponsored result appeared on one `how to boil an egg` run and vanished
on an immediate re-run of the same query; People-also-ask question sets
varied between runs of the same query. The matrix's retry-variance
warning applies to QoL rows, not only AI rows.

---

## Findings

Run 2026-07-22 · desktop, signed in, US (Sun Prairie), ~1550px ·
extension v1.1.1 · Chrome.

### 1. Features lost only to `udm=14` (the Mode A cost)

Twelve of fourteen. Every Baseline=Y row except the spelling-autocorrect
row flipped to N:

currency conversion · calculator · unit conversion · time/timezone ·
dictionary · knowledge panel · **"did you mean"** · weather · speed test ·
translation · sports OneBox · stock quote

All twelve are preserved under Mode B, since content-script hiding never
touches a widget.

**The row count understates the true cost.** Two rows killed a second,
unrecorded feature on the same page: `define ephemeral` also lost the
right-rail "Translate to" panel, and `AAPL stock` also lost its right-rail
knowledge panel. Fourteen rows measured; at least sixteen features lost.
Treating each row as independent is this instrument's weakest structural
assumption — a nesting column would fix it.

### 2. The two key rows diverge — they are not one question

The matrix treated these as a single unknown ("same open question as
above"). They are mechanically different and the answers are opposite:

- **`definately` → "Did you mean: definitely" — LOST under `udm=14`.**
- **`teh brown fox` → "These are results for the brown fox" — SURVIVES,**
  and the correction still happens: results were for the corrected query,
  not the typo.

Corroborated: an accidental typo (`internet speet test`) produced the same
survival on a second, unrelated query. Two independent observations.

Working hypothesis — `udm=14` strips the *suggestion module*, a discrete
UI block rendered above results, while leaving the *query-rewriting
pipeline* intact, since rewriting happens upstream of which vertical
renders. Not confirmed; consistent with both observations.

**Practical read: typos still get corrected in Mode A.** The user loses
one of the two ways Google announces it, not the correction itself. This
is a materially milder outcome than "spelling correction is broken."

Neither variant rewrote the URL, at baseline or under `udm=14`. The
feared autocorrect-strips-`udm=14` confound does not exist.

### 3. Features lost regardless of mode — the store-listing disclosure

**The featured snippet was absent in every state**: baseline (extension
fully off), Mode A, and therefore Mode B. Confirmed 3× at baseline, with
an AI Overview firing on all three runs.

This is the one item to disclose up front, because it is the cleanest
counter to the review pattern this whole exercise exists to address:
**part of what users miss was already gone before they installed
anything.** Google's AI Overview displaced the answer box; the extension
was not running.

Caveat on rigour: because an AI Overview fired on all three runs, absence
cannot be *proven* to be displacement rather than plain unavailability for
this query. Testing that properly needs a snippet query that does not
reliably trigger an AI Overview — none of the current rows qualifies.

### 4. Does Mode B fully remove AI Overview + AI Mode tab? Yes — but it over-hides

**Removal: works.** On both AI queries, the content script hid the AI
Overview panel with a clean collapse — no leftover gap, first organic
result moved up correctly. It also removed the AI Mode tab **on its own,
with no redirect involved**, which confirms Mode B does not need `udm=14`
to satisfy row B3.

**Defect: `content.js` also hides the People-also-ask questions.**
Reproduced 2/2 on `best way to learn guitar` and again on
`how does photosynthesis work`. The PAA *heading* survives while its
question list is hidden, leaving an orphaned label over dead space.

**Root cause — one line.** Console inspection of elements carrying the
extension's own `data-noaisearch-hidden-panel` marker returned two hits:
the AI Overview wrapper (`jsname="ZLxsqf"`, correct) and the PAA container
(`jsname="N760b"`, wrong). That second value is a hardcoded entry in
`SELECTORS`:

```js
'div[jsname="N760b"]',   // now matches the PAA container
```

Google has reassigned the attribute. The extension is faithfully hiding
whatever currently carries it.

**Fix validated live before writing any code.** Running heading-text
detection alone on the same page returned `AI headings found: 1`,
resolved the container via `closest('[data-hveid]')` to the correct
`jsname="ZLxsqf"` wrapper, and reported `contains PAA? false`. The
outline covered the AI Overview exactly and stopped above the first
organic result. **Removing the `N760b` selector fixes the bug with no
loss of detection coverage.**

**This is a v1.1.1 bug, not merely a Mode B concern.** The over-hiding
occurs whenever the content script runs on a non-`udm=14` SERP — which in
shipped use happens every time a user toggles the extension on with a
search page already open. It is user-visible in the current release and
warrants its own issue, separate from the v1.2 mode decision.

**Second instance of the same failure mode.** `content.js`'s own header
comment warns these attributes "get renamed often", and a previous `bard`
substring selector was already removed for related reasons. That argues
for dropping attribute-based detection entirely rather than patching
values one at a time — heading-text detection has now been shown
sufficient on live markup.

### 5. Flash severity in Mode B: NOT MEASURED

Cannot be established without a real build. The toggle-on harness runs
the scan after full page load, so it measures hiding correctness, not
latency. This remains an open input to the mode decision.

One observation that will shape the eventual measurement: **AI Overview
position varies by query.** It rendered at the top of the page on most
queries but *below* People-also-ask on `translate hello to spanish`. A
panel below the fold may hide with no perceptible flash at all, so flash
severity is likely query-dependent rather than a single verdict.

### 6. Loss is not uniform — severity tiers

Binary Y/N understates what matters to a user. Four tiers were observed,
and they cut across the row list:

- **Reliable substitute** — unit conversion, dictionary, translation
  lookup. The fact is in the organic snippets and does not go stale.
- **Stale substitute** — time, weather, stock. An answer is present but
  cached at unknown times: clocks 90 minutes apart, temperatures spanning
  22 °F, one stock snippet off by ~15% with no visible date. *Arguably
  worse than absence, because it looks authoritative.*
- **No substitute** — calculator, speed test, sports scores. Nothing on
  the page answers the question. A link cannot measure your connection.
- **Structured data lost** — knowledge panel. Prose facts survive; the
  fielded table does not.

Note against over-generalising: predictions about fallback quality made
*before* looking at each page were wrong three times (weather results
turned out still localised; sports snippets turned out to carry no scores
at all). Fallback quality has to be read off each page, not inferred from
the nature of the data.

### 7. Popup false positive on toggle-on

Enabling the extension while any SERP with AI content is open fires
`initialScan()` in that tab, which hides something, which reports
`ai_content_detected`, which surfaces *"Backup filter caught something
just now — Google may have changed something."* Nothing changed; the user
toggled a switch. The note then persists for 24 hours.

Users will hit this constantly and read it as a malfunction. Suppress
reports originating from a toggle-triggered scan as distinct from a
page-load scan. v1.2 fix, cheap.

### 8. Instrument corrections for the next revision

- Row label: **"These are results for"**, not "Showing results for".
- Add **People also ask** as a row — appeared at baseline on most queries,
  is a Web-tab casualty, and is currently only visible in this run as
  collateral damage from a bug.
- Add a **nesting column** — which rows share a page or a component with
  another feature (see §1).
- Add a **substitute-quality column** — the tiers in §6.
- Replace or supplement the featured-snippet query with one that does not
  reliably trigger an AI Overview (see §3).
- Reword the AI Mode tab row: it is universal chrome, not
  informational-query gated.
- Document the **toggle-on harness** as the standing Mode B method until a
  build exists (now recorded under Table B).

## Decision

- [ ] **Default mode for v1.2:** _(Clean Web / Keep widgets)_
- [ ] **Ship both as a popup toggle?** _(Y/N)_
- [ ] **Store-listing note** drafted for any features lost regardless of
      mode, so the known limitation is disclosed up front rather than
      discovered in a 1-star review.
