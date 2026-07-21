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

Run the canonical pass as: **desktop, signed out, US (Sun Prairie)**,
one query at a time. Then spot-check the variance dimensions in the
confounds section — Google's feature rollout differs by device, sign-in
state, and region, so a single environment is not authoritative on its
own.

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

| Feature | Test query | Baseline / Mode B | Mode A (`udm=14`) | Notes |
|---|---|---|---|---|
| Currency conversion | `150 usd to eur` | | | Confirmed stripped by Web tab in prior research |
| Calculator | `12*(4+3)` | | | |
| Unit conversion | `10 km in miles` | | | |
| Time / timezone | `time in tokyo` | | | |
| Dictionary / definition | `define ephemeral` | | | |
| Featured snippet ("blurb") | `how to boil an egg` | | | The pre-Gemini answer box reviewers miss |
| Knowledge panel | `albert einstein` | | | Confirmed stripped by Web tab (informational boxes) |
| Spelling: "did you mean" | `definately` | | | Unconfirmed whether `udm=14` drops this — key row |
| Spelling: "showing results for" | `teh brown fox` | | | Same open question as above |
| Weather | `weather` | | | Location-gated; confirm it fires at all in baseline |
| Speed test | `internet speed test` | | | |
| Translation | `translate hello to spanish` | | | |
| Sports score (optional) | `packers score` | | | OneBox; seasonal availability |
| Stock quote (optional) | `AAPL stock` | | | |

**Reading Table A:** every row that is `Y` in Baseline but `N` in Mode A
is a feature Keep-widgets mode would rescue. That set is the concrete
answer to "what does forcing `udm=14` actually cost the user."

---

## Table B — AI targets (what the extension must remove)

These we *want* gone. Mode A removes them by never serving them. Mode B
must remove them via the content-script backstop on a normal SERP — so
Mode B needs its own live check here, plus a flash observation.

| AI target | Test query | Baseline (served?) | Mode A (`udm=14`) removed? | Mode B (content-script) removed? | Flash before hide? |
|---|---|---|---|---|---|
| AI Overview panel | `how does photosynthesis work` | | | | |
| AI Overview (2nd query) | `best way to learn guitar` | | | | |
| AI Mode tab | any informational query | | | | — |

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

- [ ] **Mobile** (real device or DevTools device mode) — known to differ
      from desktop for the same query.
- [ ] **Signed in** vs the canonical signed-out pass.
- [ ] **Region** — if feasible, one non-US locale; feature rollout and
      the ccTLD→`google.com` redirect vary by region.
- [ ] **Retry variance** — for any AI row, retry 2–3× and after scrolling;
      AI Overview firing is non-deterministic per query intent/experiment
      assignment, so a single "absent" is not proof of suppression.

---

## Findings — fill in after running

Summarize once the tables are complete. This section is the actual
deliverable the v1.2 mode decision rests on.

- **Features lost only to `udm=14` (Mode A cost):**
  _(list every Baseline=Y / ModeA=N row)_
- **Features lost regardless of mode:**
  _(any Baseline=N row — these are gone no matter what we ship, and
  should be stated plainly in the store listing so reviewers stop
  blaming the extension)_
- **Does Mode B fully remove AI Overview + AI Mode tab?** _(Y/N + any
  selector gaps found)_
- **Flash severity in Mode B:** _(imperceptible / noticeable)_

## Decision

- [ ] **Default mode for v1.2:** _(Clean Web / Keep widgets)_
- [ ] **Ship both as a popup toggle?** _(Y/N)_
- [ ] **Store-listing note** drafted for any features lost regardless of
      mode, so the known limitation is disclosed up front rather than
      discovered in a 1-star review.
