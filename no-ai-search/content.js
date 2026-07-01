// Backstop for the redirect rule in background.js. The redirect does the
// real work; this exists for two things: (1) Google quietly weakening or
// changing how udm=14 behaves, and (2) a "Show AI Overview for this
// search" link, so AI Overview isn't an all-or-nothing setting — you can
// ask for it on a single query without turning the extension off.
//
// IMPORTANT (v1.1): when a page is reached via an authorized "Show AI
// Overview" link — i.e. its URL carries this session's bypass token —
// this script stays completely hands-off on that page: no hiding, no
// MutationObserver, no banner, and no ai_content_detected report. The
// network-layer bypass rule in background.js already lets Google serve
// the AI Overview; without this exemption, the backstop below would then
// re-hide the very panel the user just asked to see AND fire a
// misleading "backup filter caught something" note in the popup. See
// isAuthorizedBypass() and the init block at the bottom of this file.
//
// The in-page "AI Mode" tab's destination page can't be reached by
// anything in this extension. Four separate extension APIs were tried —
// declarativeNetRequest, MutationObserver, chrome.tabs.onUpdated, and
// even chrome.storage.onChanged — and none of them observe anything at
// all once that page is loaded, even though the address bar visibly
// shows udm=50. Not "the values don't match," not "the selector misses
// it" — literally zero signal of any kind reaches this extension on that
// page. That consistent silence across four unrelated APIs is strong
// evidence the AI Mode experience isn't part of the same page/origin a
// content script attaches to at all — most likely it's served from a
// separate context Chrome merges into the same tab for a seamless feel,
// with no content script ever injected into it.
//
// So instead of catching the destination, AI_MODE_TAB_PATTERNS below hides
// the clickable tab itself, preventing the click rather than reacting to
// it. This works correctly everywhere this script actually runs — every
// normal results page, before AI Mode is ever clicked into. The "show AI
// Mode tab" setting (see showAiModeTabSetting below) is fully reversible
// on those pages too. The one bounded gap, a direct consequence of the
// finding above: flipping that setting off *while already on the AI Mode
// page itself* does nothing on that specific page, since nothing here is
// running there to receive the change — it'll correctly apply the moment
// you're back on a page this script does run on (a new search, the Web
// tab, etc.). Someone manually navigating to a udm=50 URL would also
// reach AI Mode unhindered, for the same underlying reason.
//
// Detection strategy: SELECTORS below are internal Google attributes
// (data-attrid, jsname, etc.) that may or may not match what Google
// currently ships — these get renamed often, so treat them as a cheap
// first check, not the primary mechanism. The more durable approach is
// HEADING_TEXT_PATTERNS: Google's AI Overview/AI Mode panels carry a
// visible role="heading" label ("AI Overview", "Mode IA", etc.), and
// that's matched directly, then climbed up to the nearest ancestor
// carrying a data-hveid attribute — a marker Google uses broadly across
// the results page to demarcate individual result blocks, not something
// AI-specific, which makes it a more stable anchor than guessing at
// AI-specific internals. If no such ancestor exists, climbToPanel()
// climbs a bounded number of parent levels — but stops early at the
// results root or a page-sized node, so a layout change can't cause it
// to hide half the page (see its comment).
//
// HEADING_TEXT_PATTERNS confidence by language: English, French, German,
// and Portuguese strings were confirmed directly against Google's own
// Search Help pages at the time this was written. The Spanish patterns
// are intentionally looser — Google's own help pages used inconsistent
// phrasing for "AI Overview" across different versions/dates, so there
// wasn't one confirmed literal string to match exactly. Any language not
// listed falls back to the attribute-based SELECTORS only.

const SELECTORS = [
  'div[data-attrid="AIOverview"]',
  'div[jsname="N760b"]',
  '[aria-label="AI Overview"]',
  '[aria-label*="AI Mode" i]'
  // A previous "bard" substring selector was removed here: it did a
  // loose case-insensitive substring match on an obfuscated Google
  // attribute, which risked false-matching unrelated elements whose
  // values happened to contain that substring coincidentally. The
  // heading-text detection below is the real detection mechanism now;
  // these are just a cheap first check against a couple of exact,
  // specific attribute values.
];

const HEADING_TEXT_PATTERNS = [
  /^AI (Overview|Mode)\b/i, // English
  /Aperçus? .*IA/i, /\bMode IA\b/i, // French
  /KI-Übersicht/i, /Übersicht mit KI/i, /KI-Modus/i, // German
  /Visão Geral.*IA/i, /\bModo IA\b/i, // Portuguese
  /Visión general.*IA/i, /\bVista.*IA\b/i // Spanish — lower confidence, see note above
];

function isAiHeadingText(text) {
  return HEADING_TEXT_PATTERNS.some((re) => re.test(text));
}

// Exact-match patterns for the tab label itself, not the panel heading —
// deliberately anchored with ^...$ rather than the looser partial-match
// patterns above, so this only ever matches a short standalone tab label
// ("AI Mode") and never a longer sentence that happens to contain those
// words. Same per-language confidence notes as HEADING_TEXT_PATTERNS.
const AI_MODE_TAB_PATTERNS = [
  /^AI Mode$/i, // English
  /^Mode IA$/i, // French
  /^KI-Modus$/i, // German
  /^Modo IA$/i // Portuguese & Spanish (same string in both)
];

function isAiModeTabText(text) {
  return AI_MODE_TAB_PATTERNS.some((re) => re.test(text));
}

// Must match BYPASS_PARAM in background.js.
const BYPASS_PARAM = "show_ai_overview";
const BANNER_ID = "no-ai-search-banner";

// Marks panels this script hid, and stashes their prior inline display
// value, so restoreHiddenPanels() can put them back when the extension
// is toggled off — hiding needs to be reversible on the open page, not
// just until the next reload.
const HIDDEN_PANEL_MARKER = "data-noaisearch-hidden-panel";

let observer = null;
let reported = false;
// Set once at load: true only when this exact page was opened via an
// authorized "Show AI Overview" link for the current session. When true,
// every filtering path below no-ops — the user asked to see AI here.
let bypassAuthorized = false;

// True only if the current page carries this session's bypass token in
// the URL. A token from a previous session (regenerated on each browser
// startup/install in background.js) won't match, so stale bypass links
// don't grant an exemption. Returns false when no token is stored yet.
function isAuthorizedBypass(bypassToken) {
  if (!bypassToken) return false;
  return new URLSearchParams(window.location.search).get(BYPASS_PARAM) === bypassToken;
}

// The banner only makes sense on the Web results view (udm=14) — the one
// place AI Overview would otherwise appear and that this extension has
// filtered. On Images/Videos/Shopping/etc. there's no AI Overview to
// "show," so the banner would just be noise there.
function isWebResultsView() {
  return new URLSearchParams(window.location.search).get("udm") === "14";
}

function hide(node) {
  if (node.getAttribute && node.getAttribute(HIDDEN_PANEL_MARKER)) return; // already hidden by us
  if (node.style && node.style.display !== "none") {
    node.dataset.noaisearchPrevDisplay = node.style.display || "";
    node.style.setProperty("display", "none", "important");
    node.setAttribute(HIDDEN_PANEL_MARKER, "1");
  }
  // Tell background.js the redirect didn't fully do its job here, so the
  // popup can surface that instead of silently degrading. Only once per
  // page — this is a signal, not a counter. (Never reached on an
  // authorized bypass page: filtering never runs there.)
  if (!reported) {
    reported = true;
    chrome.runtime.sendMessage({ type: "ai_content_detected" }).catch(() => {});
  }
}

// Undoes every panel hide() performed on this page — used when the user
// toggles the extension off, so AI content reappears immediately instead
// of only after a reload (mirrors revealAiModeTab() for the AI Mode tab).
function restoreHiddenPanels() {
  document.querySelectorAll(`[${HIDDEN_PANEL_MARKER}]`).forEach((el) => {
    const prev = el.dataset ? el.dataset.noaisearchPrevDisplay : "";
    if (prev) {
      el.style.setProperty("display", prev);
    } else {
      el.style.removeProperty("display");
    }
    if (el.dataset) delete el.dataset.noaisearchPrevDisplay;
    el.removeAttribute(HIDDEN_PANEL_MARKER);
  });
}

const MAX_CLIMB_LEVELS = 6;
// Known Google results-container ids. Climbing into or past any of these
// means we've overshot a single AI panel and are into shared page
// structure — stop before hiding it.
const RESULTS_CONTAINER_IDS = new Set(["search", "rso", "center_col", "main", "cnt"]);

// Fallback when no data-hveid ancestor exists: climb toward the panel
// container, but bounded three ways so a layout change can't make us hide
// half the page — (1) a hard level cap, (2) stop at the <body> or a known
// results-container id, (3) stop if the candidate already spans most of
// the viewport (page structure, not one module). Returns the last safe
// element, so the whole module is hidden rather than just the heading
// text (which would leave an empty box behind).
function climbToPanel(node, maxLevels) {
  let el = node;
  for (let i = 0; i < maxLevels && el.parentElement; i++) {
    const parent = el.parentElement;
    if (parent === document.body || parent === document.documentElement) break;
    if (parent.id && RESULTS_CONTAINER_IDS.has(parent.id)) break;
    // getBoundingClientRect here forces a layout read, but this only runs
    // when an AI heading is actually found (rare), not on every mutation.
    const height = parent.getBoundingClientRect().height;
    if (height > 0 && height > window.innerHeight * 0.9) break;
    el = parent;
  }
  return el;
}

// Finds AI Overview/AI Mode panels by their visible heading text rather
// than internal attributes — see header comment for why. Checks root
// itself plus all descendants, so it works whether called with a whole
// page or a single newly-added node.
function scanForHeadings(root) {
  const containers = [];
  const check = (el) => {
    if (!el.getAttribute || el.getAttribute("role") !== "heading") return;
    const text = (el.textContent || "").trim();
    if (!isAiHeadingText(text)) return;
    const container = el.closest("[data-hveid]") || climbToPanel(el, MAX_CLIMB_LEVELS);
    if (container) containers.push(container);
  };
  check(root);
  try {
    root.querySelectorAll('[role="heading"]').forEach(check);
  } catch (e) {
    // root isn't a queryable element (e.g. a text node slipped through) — skip
  }
  return containers;
}

// Whether to hide the "AI Mode" tab — true by default (matches the rest
// of the extension's filtering), but the user can opt to show it instead
// from the popup. Read once at init and kept in sync via the storage
// listener at the bottom of this file, rather than re-reading storage on
// every call, since hideAiModeTab/revealAiModeTab run synchronously
// inside the MutationObserver callback.
let showAiModeTabSetting = false;
const HIDDEN_TAB_MARKER = "data-noaisearch-hidden-tab";

// Finds and hides the clickable "AI Mode" tab itself — see header
// comment for why this preventative approach exists instead of reacting
// to the tab after it's clicked. Checks anchors and tab/link-role
// elements for an exact text match (not scanForHeadings's reported
// hide(), since this isn't "AI content slipped through," it's normal,
// expected operation — no need to alarm the user via the popup note).
// The original href is stashed in a data attribute before being removed,
// so revealAiModeTab() can fully restore the element later if the user
// opts to show the tab — this needs to be reversible, not just hidden.
function hideAiModeTab(root) {
  if (bypassAuthorized) return; // authorized bypass page: leave everything as Google served it
  if (showAiModeTabSetting) return;
  const candidates = [];
  const check = (el) => {
    if (el.hasAttribute(HIDDEN_TAB_MARKER)) return; // already handled
    const text = (el.textContent || "").trim();
    if (!isAiModeTabText(text)) return;
    candidates.push(el);
  };
  if (root.matches && root.matches('a, [role="link"], [role="tab"]')) check(root);
  try {
    root.querySelectorAll('a, [role="link"], [role="tab"]').forEach(check);
  } catch (e) {
    return;
  }
  candidates.forEach((el) => {
    el.setAttribute(HIDDEN_TAB_MARKER, "1");
    if (el.hasAttribute("href")) {
      el.dataset.noaisearchHref = el.getAttribute("href");
      el.removeAttribute("href");
    }
    el.style.setProperty("display", "none", "important");
    el.style.pointerEvents = "none";
  });
}

// Undoes hideAiModeTab() for every tab currently hidden on this page —
// used when the user flips the "show AI Mode tab" setting on, so it
// takes effect immediately instead of only on the next page load.
function revealAiModeTab() {
  document.querySelectorAll(`[${HIDDEN_TAB_MARKER}]`).forEach((el) => {
    if (el.dataset.noaisearchHref) {
      el.setAttribute("href", el.dataset.noaisearchHref);
      delete el.dataset.noaisearchHref;
    }
    el.style.removeProperty("display");
    el.style.removeProperty("pointer-events");
    el.removeAttribute(HIDDEN_TAB_MARKER);
  });
}

// One full pass at load, in case AI content was already in the initial
// HTML (e.g. the redirect rule didn't fire for this particular request).
function initialScan() {
  for (const sel of SELECTORS) {
    let nodes;
    try {
      nodes = document.querySelectorAll(sel);
    } catch (e) {
      continue; // selector syntax unsupported in this browser, skip it
    }
    nodes.forEach(hide);
  }
  scanForHeadings(document).forEach(hide);
  hideAiModeTab(document);
}

// After the initial pass, only inspect nodes that are actually added by
// a mutation — no re-scanning the whole document on every DOM change.
function handleMutations(records) {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      for (const sel of SELECTORS) {
        try {
          if (node.matches(sel)) {
            hide(node);
          } else {
            node.querySelectorAll(sel).forEach(hide);
          }
        } catch (e) {
          continue;
        }
      }
      scanForHeadings(node).forEach(hide);
      hideAiModeTab(node);
    }
  }
}

function startObserving() {
  if (observer) return;
  observer = new MutationObserver(handleMutations);
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserving() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
}

// Same query, minus udm (so Google serves the default tab, which can
// include AI Overview), plus this session's bypass token, matching the
// rule in background.js. Uses the current origin (www. or bare apex)
// rather than assuming one, so the link stays on whichever domain the
// page is actually on. Returns null if the token isn't ready yet (e.g.
// content.js loaded in the brief window before background.js's startup
// init() finishes) — caller skips showing the banner then.
async function buildShowAiUrl() {
  const { bypassToken } = await chrome.storage.local.get("bypassToken");
  if (!bypassToken) return null;
  const params = new URLSearchParams(window.location.search);
  params.delete("udm");
  params.set(BYPASS_PARAM, bypassToken);
  return `${window.location.origin}/search?${params.toString()}`;
}

async function injectShowAiBanner() {
  if (!isWebResultsView()) return; // only on the Web view; nothing to "show AI for" elsewhere
  if (document.getElementById(BANNER_ID)) return;
  const href = await buildShowAiUrl();
  if (!href) return;

  const banner = document.createElement("div");
  banner.id = BANNER_ID;
  banner.style.cssText =
    "position:fixed;top:12px;right:12px;z-index:2147483647;" +
    "background:#fff;color:#3c4043;border:1px solid #dadce0;" +
    "border-radius:8px;padding:8px 12px;font:13px/1.4 arial,sans-serif;" +
    "box-shadow:0 1px 3px rgba(0,0,0,.15);display:flex;" +
    "align-items:center;gap:10px;";

  const link = document.createElement("a");
  link.textContent = "Show AI Overview for this search";
  link.href = href;
  link.style.cssText = "color:#1a73e8;text-decoration:none;";

  const close = document.createElement("button");
  close.textContent = "\u00d7";
  close.setAttribute("aria-label", "Dismiss");
  close.style.cssText =
    "background:none;border:none;color:#5f6368;cursor:pointer;" +
    "font-size:16px;line-height:1;padding:0;";
  close.addEventListener("click", () => banner.remove());

  banner.append(link, close);
  document.body.appendChild(banner);
}

function removeShowAiBanner() {
  document.getElementById(BANNER_ID)?.remove();
}

chrome.storage.local.get(["enabled", "showAiModeTab", "bypassToken"], (result) => {
  showAiModeTabSetting = result.showAiModeTab === true;
  // If this page was reached via an authorized "Show AI Overview" link,
  // the user explicitly asked to see AI content here — so this script
  // stays completely hands-off: no hiding, no observing, no banner, and
  // (critically) no ai_content_detected report, which would otherwise
  // fire a misleading "backup filter caught something" note in the popup
  // for content the user deliberately requested. This is the fix for the
  // bypass-link regression; see the header comment.
  bypassAuthorized = isAuthorizedBypass(result.bypassToken);
  if (bypassAuthorized) return;

  if (result.enabled !== false) {
    initialScan();
    startObserving();
    injectShowAiBanner();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if ("showAiModeTab" in changes) {
    showAiModeTabSetting = changes.showAiModeTab.newValue === true;
    if (showAiModeTabSetting) {
      revealAiModeTab();
    } else {
      hideAiModeTab(document); // no-ops on an authorized bypass page
    }
  }

  if ("enabled" in changes) {
    if (bypassAuthorized) return; // authorized bypass page: never filter it
    if (changes.enabled.newValue !== false) {
      initialScan();
      startObserving();
      injectShowAiBanner();
    } else {
      stopObserving();
      removeShowAiBanner();
      restoreHiddenPanels(); // bring AI panels back immediately, not just on reload
    }
  }
});
