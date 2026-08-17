// No AI Search — heading detection dry run (READ-ONLY, hides nothing)
//
// Tests the path content.js actually relies on: HEADING_TEXT_PATTERNS
// matched against role="heading" text, then resolved to a container via
// closest('[data-hveid]') or the climbToPanel() fallback. That is the
// primary detection mechanism — SELECTORS is described in source as a
// cheap first check, and two of its entries have already been removed
// for going bad.
//
// Checks both failure directions:
//   UNDER-MATCH — Google relabels the panel and no pattern matches. This
//     is the silent one: detection just stops, nothing visibly breaks.
//   OVER-MATCH  — the resolved container swallows a neighbouring block.
//     This is what shipped in v1.1.1 (PAA over-hiding, fixed in 1.1.2).
//
// ---------------------------------------------------------------------
// A NOTE ON DUPLICATION, because the repo warns about exactly this.
//
// docs/inspect-hidden-panels.js deliberately reads the extension's own
// marker attribute rather than re-deriving matching rules, and says to
// prefer it over "any probe that copies the matching rules." This script
// IS such a probe, and it copies them on purpose: you cannot test whether
// a pattern still matches without evaluating the pattern. The trade-off
// is real — this file goes stale the moment content.js changes.
//
// Mitigations: everything below is copied verbatim from content.js at
// sha256 786de292... (tree V1.1.2, byte-identical to main), and the two
// scripts are meant to be run as a pair — this one PREDICTS what would be
// hidden, inspect-hidden-panels.js then OBSERVES what actually was. If
// the prediction and the observation disagree, this file has drifted and
// the observer is right.
// ---------------------------------------------------------------------
//
// RUN CONDITIONS — these matter:
//   Extension OFF, on a plain SERP (no udm=14) with a live AI Overview.
//   Under udm=14 there is no AI Overview to detect and this reports
//   nothing. With the extension ON, panels are display:none and
//   climbToPanel's getBoundingClientRect height check reads 0, so the
//   container it resolves would not be the one it resolves in real use.
//
// PRE-REGISTER BEFORE RUNNING:
//   P1. AI headings matched on this page: ______ (expect 1)
//   P2. Resolution route: ______ (expect data-hveid ancestor, not climb)
//   P3. Container will contain a PAA block: ______ (expect false)
//   P4. SELECTORS entries matching anything: ______
//
//   Falsifier for "detection is healthy": zero matched headings on a page
//   where an AI Overview is plainly visible.
//   P4 is the live question from issue-paa-overhide.md: if the three
//   remaining selectors match nothing across every query shape, that is
//   evidence for deleting them rather than a regression.

(() => {
  // ---- verbatim from content.js ----
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

  // From docs/inspect-hidden-panels.js: wrappers open with an inlined
  // <style> block, so raw textContent prefixes are unreadable.
  const cleanText = (el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('style, script').forEach((n) => n.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  };

  const udm = new URLSearchParams(location.search).get('udm');
  const alreadyHidden = document.querySelectorAll('[data-noaisearch-hidden-panel]').length;

  console.log('%c=== No AI Search — heading detection dry run ===', 'font-weight:bold');
  console.log('udm:', udm ?? 'none', '| headings on page:', document.querySelectorAll('[role="heading"]').length);
  if (udm === '14') console.warn('udm=14: no AI Overview renders here. Load a plain SERP with the extension OFF.');
  if (alreadyHidden) console.warn(`${alreadyHidden} panel(s) already hidden — turn the extension OFF and reload, or container scope will be wrong.`);

  // ---------------- 1. Heading matches ----------------
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
    console.log('%cNo AI heading matched.', 'color:crimson;font-weight:bold');
    console.log('If an AI Overview is visible on screen right now, the patterns have gone');
    console.log('stale and detection is dead — that is the finding. If no AI Overview is');
    console.log('present, this page simply had nothing to detect. Check the page, not the log.');
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
    console.log('Read `text starts` yourself — no automatic verdict. Per the note in');
    console.log('inspect-hidden-panels.js, three heuristics for this were tried against');
    console.log('live markup and all three failed. A correctly scoped panel opens with AI');
    console.log('Overview content or Google\'s "not available for this search" placeholder.');
  }

  // ---------------- 2. Near-miss headings ----------------
  // Under-match candidates: headings that look AI-related to a human but
  // that no pattern caught. This is what pattern rot looks like before
  // anyone notices detection stopped.
  const AI_TOKENS = /\b(AI|A\.I\.|Gemini|IA|KI|overview|übersicht|aperçu|visão|visión)\b/i;
  const nearMiss = headings
    .filter((el) => !matched.some((m) => m.el === el))
    .map((el) => (el.textContent || '').trim())
    .filter((t) => t && AI_TOKENS.test(t));

  console.log('%c2. Unmatched headings containing AI-ish tokens', 'font-weight:bold', `— ${nearMiss.length}`);
  if (nearMiss.length) {
    console.log('%cReview these — a relabelled panel would appear here, not in section 1.', 'color:darkorange');
    console.table([...new Set(nearMiss)].map((t) => ({ heading: t.slice(0, 80) })));
  } else {
    console.log('None. No sign of a heading the patterns should have caught.');
  }

  // ---------------- 3. SELECTORS over-match ----------------
  // The v1.1.1 direction: an attribute value Google reassigned to an
  // unrelated element. A non-zero count here is not automatically healthy
  // — read what it matched.
  console.log('%c3. SELECTORS — what each currently matches', 'font-weight:bold');
  SELECTORS.forEach((sel) => {
    let nodes = [];
    try {
      nodes = [...document.querySelectorAll(sel)];
    } catch (e) {
      console.log(`%c${sel} — ${e.name}: no longer parses in this Chrome`, 'color:crimson');
      return;
    }
    if (!nodes.length) {
      console.log(`${sel} — 0 matches`);
      return;
    }
    console.group(`${sel} — ${nodes.length} match(es)`);
    nodes.forEach((n, i) => {
      const insideAi = matched.some((m) => m.container.contains(n) || n.contains(m.container));
      console.log(`[${i}] <${n.tagName.toLowerCase()}> jsname=${n.getAttribute('jsname') || '—'}`);
      console.log('    text starts:', cleanText(n).slice(0, 120) || '(empty)');
      console.log('    overlaps a heading-detected panel:', insideAi ? 'yes' : '%cNO — matching something the heading path did not', insideAi ? '' : 'color:crimson');
      console.log('   ', n);
    });
    console.groupEnd();
  });
  console.log('A selector matching something the heading path did NOT is the v1.1.1');
  console.log('shape: Google reassigned the attribute to an unrelated element.');
})();
