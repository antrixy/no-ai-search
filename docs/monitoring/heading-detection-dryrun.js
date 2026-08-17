// No AI Search — heading detection dry run (READ-ONLY, hides nothing)
// docs/monitoring/heading-detection-dryrun.js
//
// Tests the path content.js actually relies on: HEADING_TEXT_PATTERNS
// matched against role="heading" text, then resolved to a container via
// closest('[data-hveid]') or the climbToPanel() fallback. That is the
// primary detection mechanism — SELECTORS is described in source as a
// cheap first check, and two of its entries have already been removed
// for going bad.
//
// Checks both failure directions:
//   UNDER-MATCH — Google relabels the panel and no pattern matches. Silent:
//     detection just stops and nothing visibly breaks.
//   OVER-MATCH  — the resolved container swallows a neighbouring block.
//     Shipped in v1.1.1 as the PAA over-hide, fixed in 1.1.2.
//
// ---------------------------------------------------------------------
// LIVENESS GATE — why section 0 exists
//
// docs/monitoring/monitoring-feasibility.md records that a fetch-based
// version of this check is impossible: Google gates /search behind JS
// execution and returns a 200, ~92 KB script shell with zero data-hveid
// and zero role="heading". Searching that document for "AI Overview"
// returns 0, which a naive check scores as a PASS — forever, from a page
// with no search results on it.
//
// This script runs in a real browser, so it clears the JS gate by
// construction. But it inherits the same structural flaw: "no AI heading
// matched" is ALSO what a page with no AI Overview on it looks like.
// Per the standard that document sets, no assertion below carries a
// verdict until liveness passes.
//
// K is deliberately unset. The feasibility doc could not measure it — the
// value requires a document with real external destinations, and no such
// document was ever obtained by fetch. This script is the first thing
// able to measure it. Run in calibration mode across the three query
// shapes, take the floor, subtract margin, set K_MIN below.
// ---------------------------------------------------------------------
//
// A NOTE ON DUPLICATION, because the repo warns about exactly this.
//
// docs/inspect-hidden-panels.js reads the extension's own marker attribute
// rather than re-deriving matching rules, and says to prefer it over "any
// probe that copies the matching rules." This script IS such a probe and
// copies them deliberately: you cannot test whether a pattern still
// matches without evaluating the pattern. The trade-off is real — this
// file goes stale the moment content.js changes.
//
// Mitigations: everything in the verbatim block is copied unmodified from
// content.js at the sha pinned below, guarded by .github/workflows/
// probe-freshness.yml; and the two scripts are run as a pair — this one
// PREDICTS what would be hidden, inspect-hidden-panels.js then OBSERVES
// what actually was. If they disagree, this file has drifted and the
// observer is right.

const CONTENT_JS_SHA256 = "786de2928d464f6b937497ddf11341c220394562c92b1f4ef0999f3c0eb1ac5d";

// RUN CONDITIONS — these matter:
//   Extension OFF, on a plain SERP (no udm=14) with a live AI Overview.
//   Under udm=14 there is no AI Overview to detect. With the extension ON,
//   panels are display:none and climbToPanel's getBoundingClientRect
//   height check reads 0, so it resolves a container it would not resolve
//   in real use.
//
// PRE-REGISTER BEFORE RUNNING:
//   P0. Distinct external result hostnames on this page: ______
//   P1. AI headings matched: ______ (expect 1)
//   P2. Resolution route: ______ (expect data-hveid ancestor, not climb)
//   P3. Container will contain a PAA block: ______ (expect false)
//   P4. SELECTORS entries matching anything: ______
//
//   Falsifier for "detection is healthy": zero matched headings on a
//   LIVE page with an AI Overview plainly visible on screen.
//   P4 is the open question from issue-paa-overhide.md: if the three
//   remaining selectors match nothing across every query shape, that is
//   evidence for deleting them rather than a regression.

(() => {
  // ---- verbatim from content.js @ CONTENT_JS_SHA256 ----
  const SELECTORS = [
    'div[data-attrid="AIOverview"]',
    '[aria-label="AI Overview"]',
    '[aria-label*="AI Mode" i]'
  ];

  const HEADING_TEXT_PATTERNS = [
    /^AI (Overview|Mode)\b/i,
    /Aperçus? .*IA/i, /\bMode IA\b/i,
    /KI-Übersicht/i, /Übersicht mit KI/i, /KI-Modus/i,
    /Visão Geral.*IA/i, /\bModo IA\b/i,
    /Visión general.*IA/i, /\bVista.*IA\b/i
  ];

  const MAX_CLIMB_LEVELS = 6;
  const RESULTS_CONTAINER_IDS = new Set(['search', 'rso', 'center_col', 'main', 'cnt']);

  function climbToPanel(node, maxLevels) {
    let el = node;
    for (let i = 0; i < maxLevels && el.parentElement; i++) {
      const parent = el.parentElement;
      if (parent === document.body || parent === document.documentElement) break;
      if (parent.id && RESULTS_CONTAINER_IDS.has(parent.id)) break;
      const height = parent.getBoundingClientRect().height;
      if (height > 0 && height > window.innerHeight * 0.9) break;
      el = parent;
    }
    return el;
  }
  // ---- end verbatim ----

  // Set from calibration runs. null = uncalibrated; verdicts withheld.
  const K_MIN = null;

  // Google-owned hosts do not count toward K — the signal is destinations
  // OFF Google, which is what the gate page has none of.
  const GOOGLE_HOSTS = /(^|\.)(google\.[a-z.]+|gstatic\.com|googleusercontent\.com|googleapis\.com|youtube\.com|withgoogle\.com|blogger\.com|goo\.gl)$/i;

  const cleanText = (el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('style, script').forEach((n) => n.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  };

  // ================= 0. LIVENESS =================
  console.log('%c=== No AI Search — heading detection dry run ===', 'font-weight:bold');

  const params = new URLSearchParams(location.search);
  const q = params.get('q') || '';
  const udm = params.get('udm');

  // Structural signals. Per the fixtures README, only structure catches
  // the JS gate — status, body size and interstitial strings all pass it.
  const hveidCount = document.querySelectorAll('[data-hveid]').length;
  const headingCount = document.querySelectorAll('[role="heading"]').length;
  const metaRefresh = document.querySelector('meta[http-equiv="refresh" i]');
  const enablejs = !!(metaRefresh && /enablejs/i.test(metaRefresh.getAttribute('content') || ''))
    || /\/httpservice\/retry\/enablejs/i.test(document.documentElement.innerHTML.slice(0, 20000));

  const hosts = new Set();
  // a[href] rather than a[href^="http"]: Google's legacy redirector appears as
  // a RELATIVE href (/url?q=...), which an ^="http" attribute selector cannot
  // match — so the unwrap branch below was unreachable in the first version of
  // this file. Resolve against location.href instead, then unwrap.
  document.querySelectorAll('a[href]').forEach((a) => {
    let u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch { return; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return;
    // Unwrap the legacy /url?q= redirector if Google is still using it.
    if (/(^|\.)google\.[a-z.]+$/i.test(u.hostname) && u.pathname === '/url') {
      const inner = u.searchParams.get('q') || u.searchParams.get('url');
      if (inner) { try { u = new URL(inner); } catch { return; } }
    }
    if (!GOOGLE_HOSTS.test(u.hostname)) hosts.add(u.hostname);
  });

  // The doc's definition: not an interstitial path, status 200, query
  // echoed in the title, and at least K external result hostnames.
  const nav = performance.getEntriesByType('navigation')[0];
  const status = nav && typeof nav.responseStatus === 'number' ? nav.responseStatus : null;
  const interstitial = /\/sorry\/|\/httpservice\/|consent\./i.test(location.href);
  const titleEcho = q ? document.title.toLowerCase().includes(q.toLowerCase().slice(0, 24)) : false;

  // LIVENESS SIGNALS — independent of Google's internal markup.
  //
  // An earlier version of this file gated liveness on `data-hveid > 0` and
  // `role="heading" > 0`. That was wrong, and wrong in the specific way
  // monitoring-feasibility.md warns about: `role="heading"` IS the detection
  // path being monitored. A Google relabel would have broken the detector and
  // the liveness probe together, reporting "NOT LIVE" — blocked — instead of
  // "the detector no longer matches" — the finding. A liveness oracle built
  // from the thing under test fails on the same day the thing under test does.
  //
  // These four depend only on the transport and the query, not on Google's
  // result markup, so they can still classify the run correctly on the exact
  // day the markup changes.
  const signals = [
    { signal: 'not an interstitial path', value: String(!interstitial), ok: !interstitial },
    { signal: 'status 200', value: status === null ? 'unavailable' : String(status), ok: status === null || status === 200 },
    { signal: 'query echoed in <title>', value: String(titleEcho), ok: titleEcho },
    { signal: 'no enablejs gate markers', value: String(!enablejs), ok: !enablejs },
    { signal: 'distinct external hostnames', value: String(hosts.size), ok: K_MIN === null ? true : hosts.size >= K_MIN },
  ];

  console.log('%c0. Liveness', 'font-weight:bold');
  console.table(signals);

  // Observations, NOT liveness prerequisites. Recorded because a sudden drop
  // to zero here is informative — but it is evidence about Google's markup,
  // which is the subject of the test, so it must never gate the verdict.
  console.log('markup observations (not gating):',
    { 'data-hveid': hveidCount, 'role="heading"': headingCount });
  console.log('udm:', udm ?? 'none', '| K_MIN:', K_MIN === null ? 'UNSET (calibration mode)' : K_MIN);
  if (udm === '14') console.warn('udm=14: no AI Overview renders here. Load a plain SERP with the extension OFF.');

  const hidden = document.querySelectorAll('[data-noaisearch-hidden-panel]').length;
  if (hidden) console.warn(`${hidden} panel(s) already hidden — turn the extension OFF and reload, or container scope will be wrong.`);

  const failed = signals.filter((s) => !s.ok);
  const LIVE = failed.length === 0;

  if (!LIVE) {
    console.log('%cNOT LIVE — ' + failed.map((s) => s.signal).join(', '),
      'color:crimson;font-weight:bold');
    console.log('No verdict is available from this run. Everything below is inert on a');
    console.log('page that is not a real results page — in both directions. Fix the page,');
    console.log('then re-run. Do not record this as evidence.');
    return;
  }

  if (K_MIN === null) {
    console.log('%cCALIBRATION RUN — liveness structurally OK, K unset.', 'color:darkorange;font-weight:bold');
    console.log(`Distinct external hostnames here: ${hosts.size}`);
    console.log('Run the three query shapes, take the floor, subtract margin, set K_MIN.');
    console.log('Sections below are OBSERVATIONS ONLY and are not evidence until K is set.');
    console.log('Hostnames:', [...hosts].sort());
  } else {
    console.log('%cLIVE — verdicts below are valid.', 'color:green;font-weight:bold');
  }

  // ================= 1. Heading matches =================
  const headings = [...document.querySelectorAll('[role="heading"]')];
  const matched = [];

  headings.forEach((el) => {
    const text = (el.textContent || '').trim();
    const hitIdx = HEADING_TEXT_PATTERNS.findIndex((re) => re.test(text));
    if (hitIdx === -1) return;
    const viaHveid = el.closest('[data-hveid]');
    const container = viaHveid || climbToPanel(el, MAX_CLIMB_LEVELS);
    const inner = [...container.querySelectorAll('[role="heading"]')]
      .map((h) => (h.textContent || '').trim()).filter(Boolean);
    matched.push({ el, text, hitIdx, viaHveid: !!viaHveid, container, inner });
  });

  console.log('%c1. Headings matched by HEADING_TEXT_PATTERNS', 'font-weight:bold', `— ${matched.length}`);
  if (!matched.length) {
    console.log('%cNo AI heading matched on a LIVE page.', 'color:crimson;font-weight:bold');
    console.log('If an AI Overview is visible on screen right now, the patterns have gone');
    console.log('stale and primary detection is dead. If none is visible, this page had');
    console.log('nothing to detect — not a finding, and not a pass either.');
  }

  matched.forEach((m, i) => {
    console.group(`[${i}] "${m.text.slice(0, 60)}"`);
    console.log('pattern      :', HEADING_TEXT_PATTERNS[m.hitIdx].toString());
    console.log('resolved via :', m.viaHveid ? 'data-hveid ancestor' : 'climbToPanel FALLBACK');
    console.log('container    :', `<${m.container.tagName.toLowerCase()}> jsname=${m.container.getAttribute('jsname') || '—'}`);
    console.log('text starts  :', cleanText(m.container).slice(0, 160) || '(empty)');
    console.log('headings in  :', m.inner.slice(0, 6));
    const paa = m.inner.some((h) => /people also ask|autres questions|ähnliche fragen|perguntas relacionadas|otras preguntas/i.test(h));
    console.log('contains PAA :', paa ? '%cYES — over-broad container' : 'no', paa ? 'color:crimson;font-weight:bold' : '');
    console.log('height       :', Math.round(m.container.getBoundingClientRect().height), 'px of', Math.round(window.innerHeight), 'px viewport');
    console.log(m.container);
    console.groupEnd();
  });

  if (matched.length) {
    console.log('Read `text starts` yourself — no automatic verdict. Three heuristics for');
    console.log('this were tried against live markup and all three failed; see the note in');
    console.log('inspect-hidden-panels.js. A correctly scoped panel opens with AI Overview');
    console.log('content or Google\'s "not available for this search" placeholder.');
  }

  // ================= 2. Near-miss headings =================
  const AI_TOKENS = /\b(AI|A\.I\.|Gemini|IA|KI|overview|übersicht|aperçu|visão|visión)\b/i;
  const nearMiss = headings
    .filter((el) => !matched.some((m) => m.el === el))
    .map((el) => (el.textContent || '').trim())
    .filter((t) => t && AI_TOKENS.test(t));

  console.log('%c2. Unmatched headings containing AI-ish tokens', 'font-weight:bold', `— ${nearMiss.length}`);
  if (nearMiss.length) {
    console.log('%cReview these — a relabelled panel appears here, not in section 1.', 'color:darkorange');
    console.table([...new Set(nearMiss)].map((t) => ({ heading: t.slice(0, 80) })));
  } else {
    console.log('None. No sign of a heading the patterns should have caught.');
  }

  // ================= 3. SELECTORS over-match =================
  console.log('%c3. SELECTORS — what each currently matches', 'font-weight:bold');
  SELECTORS.forEach((sel) => {
    let nodes = [];
    try {
      nodes = [...document.querySelectorAll(sel)];
    } catch (e) {
      console.log(`%c${sel} — ${e.name}: no longer parses in this Chrome`, 'color:crimson');
      return;
    }
    if (!nodes.length) { console.log(`${sel} — 0 matches`); return; }
    console.group(`${sel} — ${nodes.length} match(es)`);
    nodes.forEach((n, i) => {
      const overlaps = matched.some((m) => m.container.contains(n) || n.contains(m.container));
      console.log(`[${i}] <${n.tagName.toLowerCase()}> jsname=${n.getAttribute('jsname') || '—'}`);
      console.log('    text starts:', cleanText(n).slice(0, 120) || '(empty)');
      console.log('    overlaps a heading-detected panel:', overlaps ? 'yes' : 'NO — matching something the heading path did not');
      console.log('   ', n);
    });
    console.groupEnd();
  });
  console.log('A selector matching something the heading path did NOT is the v1.1.1');
  console.log('shape: Google reassigned the attribute to an unrelated element.');
})();
