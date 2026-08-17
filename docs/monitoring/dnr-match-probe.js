// No AI Search — DNR rule matcher probe (READ-ONLY)
// docs/monitoring/dnr-match-probe.js
//
// Asks Chrome's own matcher which rules would fire for a set of hypothetical
// requests, via chrome.declarativeNetRequest.testMatchOutcome(). This settles
// four open questions against the real matcher instead of against anyone's
// reading of the docs:
//
//   1. SCOPE — background.js uses urlFilter "/search?" for the www rule.
//      Chrome's urlFilter is SUBSTRING matching unless anchored (the docs'
//      own example: "abc" matches https://example.com/abcd). If so, the rule
//      also reaches https://www.google.com/travel/search?q=... — outside the
//      extension's stated single purpose. The bare-apex rule is anchored with
//      "|" and should NOT have this problem, which makes it a built-in control.
//
//   2. udm=50 — content.js says a manually navigated udm=50 URL "would reach
//      AI Mode unhindered." But that is a main_frame GET to /search? with 50
//      not on the safe list, so the redirect rule should catch it. Chrome's
//      docs note DNR may not cover service-worker-handled navigation, which
//      would explain the in-page AI Mode tab but NOT a typed URL. Two claims,
//      currently conflated. This tests the typed one.
//
//   3. udm=14 — the root README says "the rule only fires when udm=14 isn't
//      already present." 14 is not in SAFE_VERTICAL_UDM_VALUES, so the rule
//      likely does match and rewrites 14 to 14. A practical no-op is not the
//      same claim as "doesn't fire."
//
//   4. STRICTNESS — udm=02 and duplicate udm params. The safe-vertical regex
//      matches literal alternatives at a parameter boundary, so "02" should
//      not be allowlisted; "?udm=50&udm=2" probably IS allowlisted, because
//      the rule asks whether a safe value EXISTS, not whether the effective
//      state is safe.
//
// NO COPIED LOGIC. Rules are read live via getDynamicRules() and the bypass
// token from chrome.storage.local, so this file cannot drift out of sync with
// background.js and needs no freshness pin. Prefer this shape where possible.
//
// ---------------------------------------------------------------------
// HOW TO RUN
//
// testMatchOutcome() is available only to UNPACKED extensions (Chrome 103+).
//
//   1. Load this repo's no-ai-search/ folder unpacked via chrome://extensions.
//   2. DISABLE the Chrome Web Store copy first. Two installs both register
//      redirect rules for the same URLs and will fight during normal browsing.
//      (The probe itself is unaffected — testMatchOutcome only ever consults
//      the calling extension's own rules — but leaving both on makes anything
//      you check by hand afterwards uninterpretable.)
//   3. Confirm the extension is ON in its popup, so init() has installed the
//      dynamic rules. With it OFF there are no rules and every row returns
//      empty, which looks like "nothing matches" but means "nothing exists."
//   4. chrome://extensions → the unpacked copy → "Inspect views: service
//      worker" → paste this into that console. NOT a page console: the
//      chrome.declarativeNetRequest namespace is not available there.
//
// PRE-REGISTER BEFORE RUNNING — one prediction per row, written down first.
// The rows most worth committing to:
//   travel/search (www)  → rules matched: ______
//   travel/search (apex) → rules matched: ______   (expect none — control)
//   udm=50 typed         → rules matched: ______
//   udm=14               → rules matched: ______
//   udm=02               → rules matched: ______
//   udm=50&udm=2         → rules matched: ______
//
// Falsifier for "the www rule is correctly scoped": any match on a
// /travel/search or /maps/search row.
// ---------------------------------------------------------------------

(async () => {
  if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) {
    console.error('No chrome.declarativeNetRequest here. Run this in the extension service worker console.');
    return;
  }
  if (!chrome.declarativeNetRequest.testMatchOutcome) {
    console.error('testMatchOutcome unavailable — this build is packed, or Chrome < 103. Load unpacked.');
    return;
  }

  // Live rules, not a copy. Labels are derived from what is actually installed.
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  if (!rules.length) {
    console.error('No dynamic rules installed. Turn the extension ON in its popup, then re-run.');
    return;
  }

  const label = new Map(rules.map((r) => {
    const kind = r.action.type === 'redirect' ? 'redirect→udm=14' : r.action.type;
    const scope = r.condition.regexFilter ? 'regex'
      : (r.condition.urlFilter || '').startsWith('|') ? 'anchored'
      : 'substring';
    const host = r.condition.requestDomains ? r.condition.requestDomains.join(',') : 'any(apex-anchored)';
    return [r.id, `#${r.id} ${kind} [${scope}] ${host}`];
  }));

  console.log('%c=== Installed dynamic rules ===', 'font-weight:bold');
  console.table(rules.map((r) => ({
    id: r.id,
    priority: r.priority,
    action: r.action.type,
    condition: r.condition.regexFilter || r.condition.urlFilter,
  })));

  const { bypassToken } = await chrome.storage.local.get('bypassToken');
  console.log('bypass token:', bypassToken ? `${bypassToken.slice(0, 4)}… (live)` : 'MISSING — bypass rows will be meaningless');

  const W = 'https://www.google.com';
  const A = 'https://google.com';

  const cases = [
    // --- baseline: the rules doing their job ---
    { group: 'baseline', url: `${W}/search?q=test`, note: 'ordinary www search' },
    { group: 'baseline', url: `${A}/search?q=test`, note: 'ordinary bare-apex search' },

    // --- Q1: scope. The www rule is unanchored; the apex rule is anchored. ---
    { group: 'scope', url: `${W}/travel/search?q=hotel`, note: 'Google Travel — MUST NOT MATCH' },
    { group: 'scope', url: `${A}/travel/search?q=hotel`, note: 'same on apex — anchored control' },
    { group: 'scope', url: `${W}/maps/search?q=cafe`, note: 'Maps — MUST NOT MATCH' },
    { group: 'scope', url: `${W}/url?q=https://example.com/search?x=1`, note: '/search? inside a query value' },
    { group: 'scope', url: `${W}/shopping/search?q=shoes`, note: 'another /*/search? path' },

    // --- Q2: typed udm=50 ---
    { group: 'udm=50', url: `${W}/search?q=test&udm=50`, note: 'typed AI Mode URL' },
    { group: 'udm=50', url: `${A}/search?q=test&udm=50`, note: 'typed AI Mode URL, apex' },

    // --- Q3: udm=14 already present ---
    { group: 'udm=14', url: `${W}/search?q=test&udm=14`, note: 'README says rule "only fires" when absent' },

    // --- Q4: strictness ---
    { group: 'strict', url: `${W}/search?q=test&udm=2`, note: 'Images — should be allowed through' },
    { group: 'strict', url: `${W}/search?q=test&udm=02`, note: 'leading zero — should NOT be allowlisted' },
    { group: 'strict', url: `${W}/search?q=test&udm=50&udm=2`, note: 'duplicate udm — safe value exists' },
    { group: 'strict', url: `${W}/search?q=test&udm=2&udm=50`, note: 'duplicate udm, reversed order' },
    { group: 'strict', url: `${W}/search?q=test&udm=999`, note: 'unknown vertical — should redirect' },
    { group: 'strict', url: `${W}/search?q=xudm=2`, note: 'udm-like text inside the query, not a param' },

    // --- bypass ---
    { group: 'bypass', url: `${W}/search?q=test&show_ai_overview=${bypassToken || 'MISSING'}`, note: 'current session token' },
    { group: 'bypass', url: `${W}/search?q=test&show_ai_overview=stale0000deadbeef`, note: 'stale token — must NOT allow' },

    // --- request shape: rules specify get + main_frame ---
    { group: 'shape', url: `${W}/search?q=test`, type: 'xmlhttprequest', note: 'page AJAX — must not be touched' },
    { group: 'shape', url: `${W}/search?q=test`, method: 'post', note: 'POST — must not be touched' },
  ];

  const rows = [];
  for (const c of cases) {
    let matched = [];
    let error = null;
    try {
      const res = await chrome.declarativeNetRequest.testMatchOutcome({
        url: c.url,
        type: c.type || 'main_frame',
        method: c.method || 'get',
      });
      matched = res.matchedRules || [];
    } catch (e) {
      error = String(e);
    }
    rows.push({
      group: c.group,
      url: c.url.replace('https://', '').slice(0, 62),
      shape: `${c.method || 'get'}/${c.type || 'main_frame'}`,
      matched: error ? `ERR ${error}` : (matched.map((m) => m.ruleId).join(',') || '—'),
      rules: error ? '' : matched.map((m) => label.get(m.ruleId) || `#${m.ruleId}`).join(' | '),
      note: c.note,
    });
  }

  console.log('%c=== Match outcomes ===', 'font-weight:bold');
  console.table(rows);

  // Deliberately no pass/fail column.
  //
  // testMatchOutcome's documented return is "the rules (if any) that match the
  // hypothetical request" — which does not make clear whether the list is
  // pre- or post- priority resolution. An allow rule at priority 2 and a
  // redirect at priority 1 may both appear even though only the allow takes
  // effect. Scoring these rows automatically would bake in a guess about that.
  //
  // Read the raw ids. What the rows establish is which rules the matcher
  // CONSIDERS applicable — and for the scope question that is the whole point:
  // rule #1 appearing on a /travel/search row means the condition reaches
  // Google Travel, regardless of what happens afterwards.
  console.log('No verdict column by design — see the comment above this line.');
  console.log('Record the raw ids. For the scope rows, ANY match is the finding.');
  console.log('Then re-run the two most interesting rows against the OTHER claim source:');
  console.log('  • load www.google.com/travel/search?q=hotel with the extension ON and');
  console.log('    watch whether the address bar gains udm=14 (the live counterpart);');
  console.log('  • type a udm=50 search and see whether you land in AI Mode or Web.');
  console.log('testMatchOutcome says what the matcher thinks; the address bar says what');
  console.log('users get. Both belong in the record.');
})();
