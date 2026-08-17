// No AI Search — redirect health check (READ-ONLY)
//
// Checks the PRIMARY mechanism, not the backstop. background.js forces
// udm=14 onto Google search navigations via declarativeNetRequest; that
// redirect is what actually keeps AI Overview off the page for all 184
// users. content.js is explicitly a backstop for it. If the redirect
// stops working, every user degrades silently and nothing in the UI says
// so — this is the failure mode worth monitoring.
//
// Second thing checked: SAFE_VERTICAL_UDM_VALUES. That allowlist is
// reverse-engineered from undocumented Google tab codes (background.js
// says so itself). If Google ships a new vertical whose code isn't
// listed, clicking that tab gets bounced back to Web results. This scans
// the tab codes Google is currently rendering and diffs them against the
// allowlist, which is the only way that staleness surfaces before a user
// reports it.
//
// SOURCE OF THE COPIED CONSTANTS: background.js, NOT content.js.
// An earlier version of this header cited a content.js hash, which was simply
// wrong — SAFE_VERTICAL_UDM_VALUES and BYPASS_PARAM both live in background.js.
// Pinned below and guarded by .github/workflows/probe-freshness.yml, so a
// change to the allowlist can no longer leave this probe silently checking
// against rules the extension has stopped using.
//
// RUN WITH THE EXTENSION ON, on a Google results page.
//
// ---------------------------------------------------------------------
// PRE-REGISTER BEFORE RUNNING — fill these in, then run:
//
//   P1. Current page udm will be: ______   (expect "14")
//   P2. Tab codes NOT on the allowlist will be: ______ (expect only 50)
//   P3. Manual matrix rows that will land on udm=14: ______
//
//   Falsifier for "the redirect is healthy": any row of the manual
//   matrix below landing on a URL without udm=14, other than the
//   deliberate safe-vertical and bypass rows.
// ---------------------------------------------------------------------

const BACKGROUND_JS_SHA256 = "9ac41afe8e322cc32edfe34b9d199b3831ce6e6577778d05534506fab7c8410d";

(() => {
  // Copied verbatim from background.js @ BACKGROUND_JS_SHA256.
  // STRINGS, not numbers. The shipping rule matches a literal RE2 alternation
  // — udm=(2|6|7|...) — so "02" does NOT match in production. Number("02")===2
  // made the old probe call it allowlisted, i.e. laxer than the rule it checks.
  // An evidence probe must be at least as strict as production.
  const SAFE_VERTICAL_UDM_VALUES = new Set(
    ["2", "6", "7", "12", "15", "18", "28", "36", "37", "44", "48"]);
  const BYPASS_PARAM = 'show_ai_overview';

  const params = new URLSearchParams(location.search);
  const udm = params.get('udm');

  console.log('%c=== No AI Search — redirect health ===', 'font-weight:bold');
  console.log('origin      :', location.origin, '(apex and www take different DNR rules)');
  console.log('udm param   :', udm ?? 'none');
  console.log('bypass token:', params.get(BYPASS_PARAM) ? 'present — this page is exempt by design' : 'absent');

  if (params.get(BYPASS_PARAM)) {
    console.warn('This is an authorized bypass page. content.js is hands-off here and');
    console.warn('the redirect was deliberately skipped. Not a valid page for this check.');
  } else if (udm === '14') {
    console.log('%cRedirect applied on this page.', 'color:green');
  } else if (udm === null) {
    console.log('%cNo udm on a search URL — the redirect did not fire here.', 'color:crimson;font-weight:bold');
    console.log('Expected if you toggled the extension on without reloading. Otherwise a finding.');
  } else {
    console.log(SAFE_VERTICAL_UDM_VALUES.has(udm)
      ? `udm=${udm} is an allowlisted safe vertical — pass-through is correct here.`
      : `%cudm=${udm} is neither 14 nor allowlisted.`, 'color:crimson');
  }

  // ------------------------------------------------------------------
  // Tab codes Google is currently rendering.
  // Includes tabs content.js has hidden: hideAiModeTab() removes href and
  // stashes it in data-noaisearch-href, so an href-only scan would miss
  // the AI Mode tab entirely and under-report.
  // ------------------------------------------------------------------
  const codes = new Map(); // udm -> Set of link labels

  const record = (rawHref, el) => {
    let u;
    try { u = new URL(rawHref, location.origin); } catch { return; }
    if (!/\/search$/.test(u.pathname.replace(/\/$/, ''))) return;
    const code = u.searchParams.get('udm');
    if (code === null) return;
    const label = (el.textContent || '').replace(/\s+/g, ' ').trim() || '(no text)';
    if (!codes.has(code)) codes.set(code, new Set());
    codes.get(code).add(label.slice(0, 30));
  };

  document.querySelectorAll('a[href]').forEach((a) => record(a.getAttribute('href'), a));
  document.querySelectorAll('[data-noaisearch-href]').forEach((el) =>
    record(el.dataset.noaisearchHref, el));

  const rows = [...codes.entries()]
    .map(([code, labels]) => {
      return {
        udm: code,
        labels: [...labels].join(', '),
        verdict:
          code === '14' ? 'Web — the redirect target'
          : code === '50' ? 'AI Mode — expected redirect away (UNVERIFIED, see matrix)'
          : SAFE_VERTICAL_UDM_VALUES.has(code) ? 'allowlisted — passes through'
          : 'NOT ALLOWLISTED — would be bounced to Web',
      };
    })
    .sort((a, b) => Number(a.udm) - Number(b.udm));

  console.log('%cTab codes rendered on this page', 'font-weight:bold');
  if (!rows.length) {
    console.log('None found. Google renders the tab bar differently on some layouts —');
    console.log('try a plain informational query, and check the "More" menu is expanded.');
  } else {
    console.table(rows);
    const stale = rows.filter((r) => r.verdict.startsWith('NOT ALLOWLISTED'));
    console.log(
      stale.length
        ? `%cAllowlist may be stale — unlisted codes: ${stale.map((r) => r.udm).join(', ')}`
        : '%cEvery rendered tab code is accounted for.',
      `color:${stale.length ? 'crimson' : 'green'};font-weight:bold`
    );
  }

  // ------------------------------------------------------------------
  // The part no console script can do for you.
  // The redirect fires at navigation time, so it can only be observed by
  // navigating. Run each row from the address bar or a fresh tab, then
  // read the resulting URL.
  // ------------------------------------------------------------------
  console.log('%cManual navigation matrix — read the resulting URL each time', 'font-weight:bold');
  console.table([
    { step: '1', do: 'Search anything from the address bar', expect: 'lands on udm=14' },
    { step: '2', do: 'https://google.com/search?q=test (bare apex)', expect: 'lands on udm=14 — separate DNR rule' },
    { step: '3', do: 'Click the Images tab', expect: 'stays on udm=2, NOT bounced to Web' },
    { step: '4', do: 'Click the Videos tab', expect: 'stays on udm=7' },
    { step: '5', do: 'Click any tab flagged NOT ALLOWLISTED above', expect: 'bounced to Web — confirms the gap' },
    { step: '6', do: 'Click "Show AI Overview for this search" in the banner', expect: 'no udm, token present, AI Overview visible' },
    { step: '7', do: 'Reuse that same bypass URL after a browser restart', expect: 'token stale — redirect applies again' },
    { step: '8a', do: 'Type https://www.google.com/search?q=test&udm=50 directly', expect: 'UNRESOLVED — record what happens' },
    { step: '8b', do: 'Click Google\'s in-page AI Mode tab (set "show AI Mode tab" ON first)', expect: 'UNRESOLVED — record separately from 8a' },
  ]);
  console.log('Steps 8a and 8b settle a live contradiction in the repo. content.js says');
  console.log('a manually navigated udm=50 URL "would reach AI Mode unhindered", but the');
  console.log('DNR rule matches main_frame GETs to /search? and 50 is not allowlisted, so it');
  console.log('should be redirected. Chrome docs note DNR applies to requests reaching the');
  console.log('network stack and may not cover service-worker-handled navigation — which');
  console.log('would explain 8b but not 8a. They are two different claims. Test both.');
  console.log('Step 7 is the one most likely to be skipped and the only test of');
  console.log('per-session token regeneration. It needs a full browser restart.');
})();
