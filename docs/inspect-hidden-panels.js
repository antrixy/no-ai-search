// No AI Search — hidden panel inspector (READ-ONLY)
//
// Reports exactly what content.js hid on the current page, by reading the
// extension's own `data-noaisearch-hidden-panel` marker attribute.
//
// This duplicates NO detection logic from content.js — it observes the
// result instead of re-deriving it, so it cannot drift out of sync when
// SELECTORS or HEADING_TEXT_PATTERNS change. Prefer this over any probe
// that copies the matching rules.
//
// Usage: paste into the DevTools console on a SERP where filtering has run.
// To inspect Mode-B behaviour (content script active, no udm=14 redirect):
//   1. extension OFF
//   2. load a plain SERP with a live AI Overview
//   3. toggle extension ON without reloading
//   4. run this
//
// Found the v1.1.1 PAA over-hiding bug (issue #2) on first run.
//
// --- Why this reports instead of judging ---
// Deliberately no automatic OK/SUSPECT verdict. Three heuristics were
// tried against live markup and all three failed:
//   * textContent prefix — wrappers begin with an inlined <style> block,
//     so everything looked wrong.
//   * "contains an AI heading anywhere" — an over-broad container contains
//     one by definition, so the real bug looked fine.
//   * style-stripped prefix — Google ships error-state placeholder text
//     ("An AI Overview is not available for this search") ahead of the
//     visible heading, so the prefix is rarely the heading.
// Read `text starts` yourself. A correctly-scoped panel opens with AI
// Overview content or placeholder text; an over-broad one opens with
// something that belongs to a neighbouring block — on the issue #2 page,
// a People-also-ask question.

(() => {
  const hidden = [...document.querySelectorAll('[data-noaisearch-hidden-panel]')];

  // textContent minus <style>/<script> noise, so the prefix is readable.
  const cleanText = (el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('style, script').forEach((n) => n.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  };

  console.log('%c=== No AI Search — hidden panels ===', 'font-weight:bold');
  console.log('udm param:', new URLSearchParams(location.search).get('udm') ?? 'none',
              '| hidden elements:', hidden.length);

  if (!hidden.length) {
    console.log('Nothing hidden. Either the extension is off, filtering has not run,');
    console.log('or no AI content was detected on this page.');
    return;
  }

  hidden.forEach((el, i) => {
    const nested = hidden.filter((o) => o !== el && el.contains(o)).length;

    console.group(`[${i}] <${el.tagName.toLowerCase()}> jsname=${el.getAttribute('jsname') || '—'}`);
    console.log('resolved via :', el.closest('[data-hveid]') ? 'data-hveid ancestor' : 'climbToPanel fallback');
    console.log('aria-label   :', el.getAttribute('aria-label') ?? 'null');
    console.log('text starts  :', cleanText(el).slice(0, 160) || '(empty)');
    console.log('headings     :', [...el.querySelectorAll('[role="heading"]')]
      .map((h) => (h.textContent || '').trim()).filter(Boolean).slice(0, 5));
    console.log('nesting      :', nested ? `contains ${nested} other hidden panel(s)` : 'leaf');
    console.log(el);
    console.groupEnd();
  });

  console.log('%cRead `text starts` for each entry.', 'font-weight:bold');
  console.log('Content belonging to a neighbouring block = over-broad container.');
  console.log('Sizes omitted: getBoundingClientRect() reads 0x0 on display:none.');
  console.log('To measure a panel, toggle the extension OFF first.');
})();
